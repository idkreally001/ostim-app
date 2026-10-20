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

import { logService } from '../services/logService';

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

  public clearTokens() {
    this.jwtToken = null;
    this.studentNo = null;
  }

  public isAuthenticated(): boolean {
    return !!this.jwtToken && !!this.studentNo;
  }

  /**
   * Log into OBS /Auth/CreateToken and return JWT token
   */
  public async login(studentNo: string, rawPass: string): Promise<AuthTokens> {
    logService.info('OBS', `Giriş isteği gönderiliyor (Öğrenci: ${studentNo})`);
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
    let res: Response;
    try {
      res = await fetch(url, {
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
    } catch (err: any) {
      logService.error('OBS Auth', 'Ağ bağlantı hatası', err.message);
      throw new Error(`Ağ hatası: Sunucuya bağlanılamadı (${err.message})`);
    }

    if (!res.ok) {
      const errText = await res.text();
      logService.error('OBS Auth', `Giriş reddedildi [${res.status}]`, errText);
      throw new Error(`OBS Giriş Başarısız (${res.status}): ${errText || 'Geçersiz kimlik bilgileri'}`);
    }

    const data = await res.json();
    const token = data.Value || data.token || data.Token;
    if (!token) {
      const errMsg = data.message || data.Message || data.Hata || 'Geçersiz kimlik bilgileri veya eksik token';
      logService.error('OBS Auth', 'Token bulunamadı', data);
      throw new Error(`OBS Giriş: ${errMsg}`);
    }

    logService.info('OBS Auth', 'Giriş başarılı, JWT token alındı.');
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
      logService.warn('OBS', 'Yetkilendirme olmadan GET çağrısı yapıldı.');
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

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', headers });
    } catch (err: any) {
      logService.error('OBS GET', `Ağ hatası: ${path}`, err.message);
      throw err;
    }

    if (!res.ok) {
      if (res.status === 401) {
        logService.warn('OBS GET', `Oturum süresi doldu [401]: ${path}`);
        throw new Error('SESSION_EXPIRED');
      }
      logService.error('OBS GET', `İstek başarısız [${res.status}]: ${path}`);
      throw new Error(`OBS Request failed [${res.status}] ${path}`);
    }

    return await res.json();
  }

  /**
   * /m1/mtd2 -> Student Profile
   * Handles multi-format Proliz schemas (std, ogr, ogrBilgi, array-wrapped, or Pascal/UPPERCASE keys).
   */
  public async getProfile(): Promise<StudentProfile> {
    const raw = await this.get('/m1/mtd2');
    
    // Unpack possible nested wrapper objects/arrays (std, ogr, ogrBilgi, data, item, Value)
    let std: any = raw;
    if (std && typeof std === 'object') {
      const candidates = ['std', 'ogr', 'ogrBilgi', 'ogrenci', 'ogrGenel', 'genelBilgi', 'data', 'item', 'Value', 'stdInfo'];
      for (const k of candidates) {
        if (std[k] !== undefined && std[k] !== null) {
          std = std[k];
          break;
        }
      }
    }
    if (Array.isArray(std)) {
      std = std[0] || {};
    }
    // Check one more level if still nested
    if (std && typeof std === 'object') {
      const candidates = ['std', 'ogr', 'ogrBilgi', 'ogrenci', 'ogrGenel', 'genelBilgi'];
      for (const k of candidates) {
        if (std[k] !== undefined && std[k] !== null) {
          std = Array.isArray(std[k]) ? std[k][0] : std[k];
          break;
        }
      }
    }
    if (!std || typeof std !== 'object') {
      std = {};
    }

    logService.info('OBS Profile', 'Profil verisi çözümlendi', {
      keys: Object.keys(std),
    });

    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      return parseFloat(String(val).replace(',', '.')) || 0;
    };

    const getField = (keys: string[]): any => {
      // 1. Direct key match
      for (const k of keys) {
        if (std[k] !== undefined && std[k] !== null && std[k] !== '') {
          return std[k];
        }
      }
      // 2. Case-insensitive key match against all keys of std
      const stdEntries = Object.entries(std);
      for (const k of keys) {
        const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = stdEntries.find(([sk]) => sk.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerK);
        if (match && match[1] !== undefined && match[1] !== null && match[1] !== '') {
          return match[1];
        }
      }
      return undefined;
    };

    const studentNo = getField(['StudentNo', 'OGRENCI_NO', 'OgrenciNo', 'OGR_NO', 'KullaniciAdi']) || this.studentNo || '';
    const firstName = getField(['Name', 'ADI', 'Ad', 'Adi', 'FirstName', 'OgrAd', 'OGRENCI_ADI']) || '';
    const lastName = getField(['Surname', 'SOYADI', 'Soyad', 'Soyadi', 'LastName', 'OgrSoyad', 'OGRENCI_SOYADI']) || '';
    const department = getField(['Department', 'BOLUM_ADI', 'BolumAdi', 'BOLUM', 'ProgramAdi', 'PROGRAM_ADI']) || '';
    const faculty = getField(['Faculty', 'FAKULTE_ADI', 'FakulteAdi', 'FAKULTE']) || '';
    const email = getField(['EPOSTA', 'Email', 'Eposta', 'OgrenciEposta']) || '';
    const photoUrl = getField(['PhotoUrl', 'RESIM_URL', 'ResimUrl', 'FotoUrl', 'FOTO_URL']) || '';
    const gpa = parseNum(getField(['AGNO', 'Gpa', 'GenelNotOrtalamasi', 'GENEL_AGNO', 'GENEL_ORTALAMA', 'agno']));
    const termGpa = parseNum(getField(['ANO', 'TermGpa', 'DonemNotOrtalamasi', 'DONEM_ANO', 'DONEM_ORTALAMA', 'ano']));
    const activeTermId = parseInt(String(getField(['DONEM_ID', 'ActiveTermId', 'DonemId', 'donemID']) || '0'), 10) || undefined;

    return {
      studentNo,
      firstName,
      lastName,
      department,
      faculty,
      email,
      photoUrl,
      gpa,
      termGpa,
      activeTermId,
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
   * Groups individual exam entries (Ara Sınav, Final, Büt) by course code.
   */
  public async getGrades(termId?: number | string): Promise<GradeEntry[]> {
    const path = termId ? `/m1/mtd5?donemID=${termId}` : '/m1/mtd5';
    const raw = await this.get(path);
    const list = raw.ogrSinavNotlariList || (Array.isArray(raw) ? raw : []);

    const courseMap = new Map<string, GradeEntry>();

    for (const item of list) {
      const code = item.D_KOD || item.DERS_KODU || item.DERS_KOD || '';
      if (!code) continue;

      const examName = (item.S_AD || '').toLowerCase();
      const scoreVal = item.NOT_DEG && item.NOT_DEG !== '--' ? item.NOT_DEG : null;

      if (!courseMap.has(code)) {
        courseMap.set(code, {
          courseCode: code,
          courseName: item.DERS_AD || item.DERS_ADI || code,
          credits: parseFloat(item.KREDI || '3') || 3,
          akts: parseFloat(item.AKTS || '5') || 5,
          midterm: null,
          finalExam: null,
          makeupExam: null,
          letterGrade: '',
          passed: undefined,
        });
      }

      const entry = courseMap.get(code)!;

      if (item.BASARI_NOT) {
        entry.letterGrade = item.BASARI_NOT;
      }
      if (item.GEC_DURUM) {
        entry.passed = item.GEC_DURUM === 'Geçti' || item.GEC_DURUM === 'GECTI';
      }

      if (examName.includes('ara') || examName.includes('vize')) {
        entry.midterm = scoreVal;
      } else if (examName.includes('sonu') || examName.includes('final')) {
        entry.finalExam = scoreVal;
      } else if (examName.includes('büt') || examName.includes('butun')) {
        entry.makeupExam = scoreVal;
      }
    }

    return Array.from(courseMap.values());
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
