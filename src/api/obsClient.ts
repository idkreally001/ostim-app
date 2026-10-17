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
        'User-Agent': 'okhttp/4.9.2',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OBS Login Failed (${res.status}): ${errText || 'Invalid credentials'}`);
    }

    const data = await res.json();
    const token = data.Token || data.token;
    if (!token) {
      throw new Error('OBS Login response did not contain a valid JWT Token.');
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
      'User-Agent': 'okhttp/4.9.2',
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
   */
  public async getProfile(): Promise<StudentProfile> {
    const raw = await this.get('/m1/mtd2');
    const item = Array.isArray(raw) ? raw[0] : raw;
    return {
      studentNo: item.OGRENCI_NO || this.studentNo,
      firstName: item.ADI || '',
      lastName: item.SOYADI || '',
      department: item.BOLUM_ADI || '',
      faculty: item.FAKULTE_ADI || '',
      email: item.EPOSTA || '',
      photoUrl: item.RESIM_URL || '',
      gpa: parseFloat(item.AGNO || '0') || 0,
      termGpa: parseFloat(item.ANO || '0') || 0,
      activeTermId: item.DONEM_ID ? parseInt(item.DONEM_ID, 10) : undefined,
    };
  }

  /**
   * /m1/mtd3 -> Weekly Timetable
   */
  public async getTimetable(): Promise<TimetableEntry[]> {
    const raw = await this.get('/m1/mtd3');
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => ({
      courseCode: item.DERS_KODU || '',
      courseName: item.DERS_ADI || '',
      dayName: item.GUN_ADI || '',
      dayId: parseInt(item.GUN_ID || '1', 10),
      startTime: item.BAS_SAAT || '',
      endTime: item.BIT_SAAT || '',
      classroom: item.DERSLIK_ADI || item.DERSLIK || 'Belirtilmedi',
      instructor: item.OGRETI_ELEMANI || '',
    }));
  }

  /**
   * /m1/mtd4 -> Attendance
   */
  public async getAttendance(): Promise<AttendanceEntry[]> {
    const raw = await this.get('/m1/mtd4');
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => {
      const theory = parseFloat(item.TEORIK_DEVAMSIZLIK || '0') || 0;
      const practice = parseFloat(item.UYGULAMA_DEVAMSIZLIK || '0') || 0;
      const total = theory + practice;
      const maxAllowed = parseFloat(item.DEVAMSIZLIK_HAKKI || '0') || 0;
      const isDanger = maxAllowed > 0 && total >= maxAllowed * 0.75;

      return {
        courseCode: item.DERS_KODU || '',
        courseName: item.DERS_ADI || '',
        theoryAbsence: theory,
        practiceAbsence: practice,
        maxAllowedAbsence: maxAllowed,
        status: item.DEVAMSIZLIK_DURUMU || 'Devam Ediyor',
        isDanger,
      };
    });
  }

  /**
   * /m1/mtd5 -> Grades
   */
  public async getGrades(termId?: number): Promise<GradeEntry[]> {
    const path = termId ? `/m1/mtd5?donemID=${termId}` : '/m1/mtd5';
    const raw = await this.get(path);
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => ({
      courseCode: item.DERS_KODU || '',
      courseName: item.DERS_ADI || '',
      credits: parseFloat(item.KREDI || '0') || 0,
      akts: parseFloat(item.AKTS || '0') || 0,
      midterm: item.VIZE ?? null,
      finalExam: item.FINAL ?? null,
      makeupExam: item.BUTUNLEME ?? null,
      letterGrade: item.HARF_NOTU || '',
      gradeAverage: item.BASARI_NOTU ? parseFloat(item.BASARI_NOTU) : undefined,
      passed: item.DURUM === 'Geçti' || item.DURUM === 'GECTI',
    }));
  }

  /**
   * /m3/mtd90 -> Available Terms
   */
  public async getTerms(): Promise<SemesterTerm[]> {
    const raw = await this.get('/m3/mtd90');
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => ({
      termId: parseInt(item.DONEM_ID, 10),
      termName: item.DONEM_ADI || '',
      isActive: item.AKTIF_DONEM === '1' || item.AKTIF_DONEM === true,
    }));
  }
}

export const obsClient = new OstimObsClient();
