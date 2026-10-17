import { configManager } from '../config/configManager';
import {
  encryptObsField,
  getProlizTimestamps,
  md5Upper,
} from '../crypto/obsCrypto';
import {
  StudentProfile,
  TimetableEntry,
  AttendanceEntry,
  GradeEntry,
  SemesterTerm,
} from '../types/models';

export interface AuthTokens {
  jwtToken: string;
  studentNo: string;
}

export class OstimObsClient {
  private jwtToken: string | null = null;
  private studentNo: string | null = null;

  constructor(jwtToken?: string, studentNo?: string) {
    if (jwtToken) this.jwtToken = jwtToken;
    if (studentNo) this.studentNo = studentNo;
  }

  public setTokens(jwtToken: string, studentNo: string) {
    this.jwtToken = jwtToken;
    this.studentNo = studentNo;
  }

  public isAuthenticated(): boolean {
    return !!this.jwtToken && !!this.studentNo;
  }

  /**
   * Log into OBS /Auth/CreateToken and return JWT token
   */
  public async login(studentNo: string, rawPass: string): Promise<AuthTokens> {
    const config = configManager.getConfig().obs;
    const { timeStr, dateStr } = getProlizTimestamps();

    const encUser = encryptObsField(studentNo, timeStr, dateStr, config);
    const passHash = md5Upper(rawPass);
    const encPassHash = encryptObsField(passHash, timeStr, dateStr, config);

    // Basic Auth: base64(encUser : encPassHash)
    const basicAuth = btoa(`${encUser}:${encPassHash}`);

    const payload = {
      userType: encryptObsField('std', timeStr, dateStr, config),
      RawPass: encryptObsField(rawPass, timeStr, dateStr, config),
      st: encryptObsField(config.uniToken, timeStr, dateStr, config),
      stk: encryptObsField(config.uniCode, timeStr, dateStr, config),
      suip: encryptObsField('127.0.0.1', timeStr, dateStr, config),
    };

    const url = `${config.baseUrl}/Auth/CreateToken`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Basic ${basicAuth}`,
        'lang': 'tr',
        'st': encryptObsField(config.uniToken, timeStr, dateStr, config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OBS Login Failed (${res.status}): ${errText || 'Invalid credentials'}`);
    }

    const data = await res.json();
    const token = data.Value || data.token || data.Token;
    if (!token) {
      const errMsg = data.message || data.Message || data.Hata || 'Invalid credentials or missing token';
      throw new Error(`OBS Login: ${errMsg}`);
    }

    this.jwtToken = token;
    this.studentNo = studentNo;

    return {
      jwtToken: token,
      studentNo: studentNo,
    };
  }

  /**
   * Internal helper for authenticated GET requests
   */
  private async get(path: string, queryParams: Record<string, string | number> = {}): Promise<any> {
    if (!this.jwtToken || !this.studentNo) {
      throw new Error('Not authenticated. Please call login() first.');
    }

    const config = configManager.getConfig().obs;
    const { timeStr, dateStr } = getProlizTimestamps();

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${this.jwtToken}`,
      'st': encryptObsField(config.uniToken, timeStr, dateStr, config),
      'pp1': encryptObsField(this.studentNo, timeStr, dateStr, config),
      'lang': 'tr',
    };

    let url = `${config.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const queryEntries = Object.entries(queryParams);
    if (queryEntries.length > 0) {
      const qs = queryEntries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('SESSION_EXPIRED');
      }
      throw new Error(`OBS Request failed [${res.status}] ${path}`);
    }

    return await res.json();
  }

  /**
   * /m1/mtd2 -> Student Profile
   * Raw Response: { Stat: true, std: { StudentNo, Name, Surname, Faculty, Department, AGNO, ... } }
   */
  public async getProfile(): Promise<StudentProfile> {
    const raw = await this.get('/m1/mtd2');
    const std = raw.std || (Array.isArray(raw) ? raw[0] : raw) || {};

    const parseNum = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(String(val).replace(',', '.')) || 0;
    };

    return {
      studentNo: std.StudentNo || std.OGRENCI_NO || this.studentNo || '',
      firstName: std.Name || std.ADI || '',
      lastName: std.Surname || std.SOYADI || '',
      department: std.Department || std.BOLUM_ADI || '',
      faculty: std.Faculty || std.FAKULTE_ADI || '',
      email: std.EPOSTA || '',
      photoUrl: std.PhotoUrl || std.RESIM_URL || '',
      gpa: parseNum(std.AGNO),
      termGpa: parseNum(std.ANO),
      activeTermId: std.DONEM_ID ? parseInt(std.DONEM_ID, 10) : undefined,
    };
  }

  /**
   * /m1/mtd3 -> Weekly Timetable
   * Raw Response: { Stat: true, dersProg: [ { DERS_KODU, DERS_ADI, GUN, GUN_NO, BASLANGIC_SAAT, BITIS_SAAT, DERSLIK, HOCA_AD_SOYAD } ] }
   */
  public async getTimetable(): Promise<TimetableEntry[]> {
    const raw = await this.get('/m1/mtd3');
    const list = raw.dersProg || (Array.isArray(raw) ? raw : []);

    return list.map((item: any) => ({
      courseCode: item.DERS_KODU || '',
      courseName: item.DERS_ADI || '',
      dayName: item.GUN || item.GUN_ADI || '',
      dayId: parseInt(item.GUN_NO ?? item.GUN_ID ?? '0', 10), // 0=Pzt, 1=Sal, ...
      startTime: item.BASLANGIC_SAAT || item.BAS_SAAT || '',
      endTime: item.BITIS_SAAT || item.BIT_SAAT || '',
      classroom: item.DERSLIK || item.DERSLIK_ADI || 'Belirtilmedi',
      instructor: item.HOCA_AD_SOYAD || item.OGRETI_ELEMANI || '',
    }));
  }

  /**
   * /m1/mtd4 -> Attendance
   * Raw Response: { Stat: true, ogrYoklamaList: [ { DERS_KOD, DERS_AD, TEO_SAAT, UYG_SAAT, DY_DURUM, DY_DERS_DURUM } ] }
   */
  public async getAttendance(): Promise<AttendanceEntry[]> {
    const raw = await this.get('/m1/mtd4');
    const list = raw.ogrYoklamaList || (Array.isArray(raw) ? raw : []);

    return list.map((item: any) => {
      // Clean HTML tags from DY_DURUM (e.g. "<font color=\"green\">Devam Zor.Yok</font>")
      const rawStatus = (item.DY_DURUM || item.DEVAMSIZLIK_DURUMU || 'Devam Ediyor').replace(/<[^>]*>/g, '').trim();
      const teo = parseFloat(item.TEO_SAAT || item.TEORIK_DEVAMSIZLIK || '0') || 0;
      const uyg = parseFloat(item.UYG_SAAT || item.UYGULAMA_DEVAMSIZLIK || '0') || 0;

      return {
        courseCode: item.DERS_KOD || item.DERS_KODU || '',
        courseName: item.DERS_AD || item.DERS_ADI || '',
        theoryAbsence: teo,
        practiceAbsence: uyg,
        maxAllowedAbsence: parseFloat(item.DEVAMSIZLIK_HAKKI || '12'),
        status: rawStatus || 'Kayıtlı',
        isDanger: false,
      };
    });
  }

  /**
   * /m1/mtd5 -> Semester Exam Grades
   * Raw Response: { Stat: true, ogrSinavNotlariList: [ { D_KOD, DERS_AD, BASARI_NOT, GEC_DURUM, NOT_DEG, S_AD } ] }
   */
  public async getGrades(termId?: number | string): Promise<GradeEntry[]> {
    const path = termId ? `/m1/mtd5?donemID=${termId}` : '/m1/mtd5';
    const raw = await this.get(path);
    const list = raw.ogrSinavNotlariList || (Array.isArray(raw) ? raw : []);

    return list.map((item: any) => ({
      courseCode: item.D_KOD || item.DERS_KODU || item.DERS_KOD || '',
      courseName: item.DERS_AD || item.DERS_ADI || '',
      credits: parseFloat(item.KREDI || '3') || 3,
      akts: parseFloat(item.AKTS || '5') || 5,
      midterm: item.S_AD?.toLowerCase().includes('ara') || item.S_AD?.toLowerCase().includes('vize') ? item.NOT_DEG : item.VIZE ?? null,
      finalExam: item.S_AD?.toLowerCase().includes('sonu') || item.S_AD?.toLowerCase().includes('final') ? item.NOT_DEG : item.FINAL ?? null,
      makeupExam: item.BUTUNLEME ?? null,
      letterGrade: item.BASARI_NOT || item.HARF_NOTU || '',
      gradeAverage: item.NOT_DEG ? parseFloat(item.NOT_DEG) : undefined,
      passed: item.GEC_DURUM === 'Geçti' || item.DURUM === 'Geçti',
    }));
  }

  /**
   * /m3/mtd90 -> Available Terms
   * Raw Response: { Stat: true, donemList: [ { ID: "20261", AD: "2026-2027 Güz", DURUM: 0 } ] }
   */
  public async getTerms(): Promise<SemesterTerm[]> {
    const raw = await this.get('/m3/mtd90');
    const list = raw.donemList || (Array.isArray(raw) ? raw : []);

    return list.map((item: any, idx: number) => ({
      termId: parseInt(item.ID || item.DONEM_ID || String(idx), 10),
      termName: item.AD || item.DONEM_ADI || '',
      isActive: item.DURUM === 1 || idx === 0,
    }));
  }
}

export const obsClient = new OstimObsClient();
