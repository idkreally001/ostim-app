import { Platform } from 'react-native';
import { LmsCourseItem, LmsCalendarEvent, LmsSessionData } from '../types/models';
import { logService } from '../services/logService';

const LMS_BASE_URL = 'https://lmsclus.ostimteknik.edu.tr';

const getServiceEndpoint = () => {
  if (Platform.OS === 'web') {
    return '/lms-proxy/lib/ajax/service.php';
  }
  return `${LMS_BASE_URL}/lib/ajax/service.php`;
};

export class OstimLmsClient {
  private sesskey: string | null = null;
  private moodleSession: string | null = null;
  private userId: number | null = null;

  constructor(session?: LmsSessionData) {
    if (session) {
      this.setSession(session);
    }
  }

  public setSession(session: LmsSessionData) {
    this.sesskey = session.sesskey.trim();
    this.moodleSession = session.moodleSession.trim();
    if (session.userId) this.userId = session.userId;
  }

  public clearSession() {
    this.sesskey = null;
    this.moodleSession = null;
    this.userId = null;
  }

  public hasSession(): boolean {
    return Boolean(this.sesskey && this.moodleSession);
  }

  public getSession(): LmsSessionData | null {
    if (!this.sesskey || !this.moodleSession) return null;
    return {
      sesskey: this.sesskey,
      moodleSession: this.moodleSession,
      userId: this.userId || undefined,
    };
  }

  /**
   * Raw Moodle AJAX service runner
   */
  public async callService(methodname: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.sesskey || !this.moodleSession) {
      throw new Error('LMS oturumu bulunamadı. Lütfen önce Moodle oturumunu bağlayın.');
    }

    const endpoint = getServiceEndpoint();
    const url = `${endpoint}?sesskey=${encodeURIComponent(this.sesskey)}&info=${encodeURIComponent(methodname)}`;
    const payload = [
      {
        index: 0,
        methodname,
        args,
      },
    ];

    logService.info('LMS Service Call', `Calling ${methodname}`, { args });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Moodle-Session': this.moodleSession,
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (Platform.OS !== 'web') {
      headers['Cookie'] = `MoodleSession=${this.moodleSession}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logService.error('LMS HTTP Error', `Status ${response.status}`, { methodname });
      throw new Error(`LMS Sunucu Hatası (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('LMS sunucusundan geçersiz yanıt alındı.');
    }

    const result = data[0];
    if (result.error) {
      const errMsg = result.exception?.message || 'Bilinmeyen Moodle hatası';
      logService.error('LMS Exception', errMsg, result.exception);
      throw new Error(errMsg);
    }

    return result.data;
  }

  /**
   * Fetch all enrolled courses
   */
  public async getCourses(): Promise<LmsCourseItem[]> {
    const rawData = await this.callService('core_course_get_enrolled_courses_by_timeline_classification', {
      classification: 'all',
      limit: 0,
      offset: 0,
      sort: 'fullname asc',
    });

    const coursesList = rawData?.courses || [];
    return coursesList.map((c: any) => {
      // Parse course title, code and instructor
      // Example: "CENG 416 (1) [401779] Computer and Network Security (Dr. Muhammed Akif Ağca)"
      const rawFullname: string = c.fullname || '';
      let code = c.shortname || '';
      let instructor = '';

      // Match instructor in trailing parentheses: "... (Dr. Name)"
      const instructorMatch = rawFullname.match(/\((Dr\.[^)]+|Prof\.[^)]+|Öğr\.[^)]+|Doç\.[^)]+)\)$/i);
      if (instructorMatch) {
        instructor = instructorMatch[1].trim();
      }

      // Match code prefix: "CENG 416" or "CENG_459"
      const codeMatch = rawFullname.match(/^([A-Z]{3,4}[_ ]\d{3})/i);
      if (codeMatch) {
        code = codeMatch[1].replace('_', ' ');
      }

      return {
        id: c.id,
        fullname: rawFullname,
        shortname: c.shortname || '',
        code: code || c.shortname || 'Ders',
        instructor: instructor || undefined,
        viewurl: c.viewurl || `${LMS_BASE_URL}/course/view.php?id=${c.id}`,
        courseimage: c.courseimage || undefined,
        progress: typeof c.progress === 'number' ? c.progress : undefined,
        hasprogress: Boolean(c.hasprogress),
      };
    });
  }

  /**
   * Fetch upcoming deadlines and action events
   */
  public async getUpcomingDeadlines(): Promise<LmsCalendarEvent[]> {
    // Look from 2 days in the past to catch recently expired/due today assignments
    const timesortFrom = Math.floor(Date.now() / 1000) - 86400 * 2;

    const rawData = await this.callService('core_calendar_get_action_events_by_timesort', {
      timesortfrom: timesortFrom,
      limitnum: 25,
    });

    const eventsList = rawData?.events || [];
    const nowMs = Date.now();

    return eventsList.map((e: any) => {
      const timesort = e.timesort || 0;
      const targetDate = new Date(timesort * 1000);
      const isOverdue = Boolean(e.overdue || (timesort * 1000 < nowMs));

      // Calculate days remaining
      const diffMs = timesort * 1000 - nowMs;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Clean HTML description
      const cleanDesc = (e.description || '').replace(/<[^>]*>?/gm, '').trim();

      // Clean name: e.g. "Wireshark Assignment is due" -> "Wireshark Assignment"
      const cleanName = (e.name || '').replace(/\s+(is due|teslim tarihi|son gün)$/i, '').trim();

      const courseName = e.course?.fullname || '';
      let courseCode = e.course?.shortname || '';
      const codeMatch = courseName.match(/^([A-Z]{3,4}[_ ]\d{3})/i);
      if (codeMatch) {
        courseCode = codeMatch[1].replace('_', ' ');
      }

      const formattedDate = targetDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      });
      const formattedTime = targetDate.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        id: e.id,
        name: cleanName || e.name,
        description: cleanDesc || undefined,
        courseId: e.course?.id || 0,
        courseName: courseName,
        courseCode: courseCode || 'Ders',
        timesort,
        formattedDate,
        formattedTime,
        daysRemaining,
        isOverdue,
        actionUrl: e.action?.url || undefined,
        actionName: e.action?.name || (isOverdue ? 'Görüntüle' : 'Teslim Et'),
      };
    });
  }

  /**
   * Verify session credentials
   */
  public async testConnection(): Promise<{ success: boolean; message: string; courseCount?: number }> {
    try {
      const courses = await this.getCourses();
      return {
        success: true,
        message: `${courses.length} ders başarıyla yüklendi.`,
        courseCount: courses.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Moodle oturumu doğrulanamadı.',
      };
    }
  }
}

export const lmsClient = new OstimLmsClient();
