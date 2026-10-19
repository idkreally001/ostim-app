import { Platform } from 'react-native';
import {
  LmsCourseItem,
  LmsCalendarEvent,
  LmsSessionData,
  LmsWeekDocument,
  LmsAssignmentDetails,
} from '../types/models';
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

      // Sanitize actionUrl: remove &action=editsubmission so it doesn't trigger Moodle's error/nopermission
      let cleanActionUrl: string | undefined = e.action?.url || e.url || undefined;
      if (cleanActionUrl) {
        cleanActionUrl = cleanActionUrl.replace(/([?&])action=editsubmission(&|$)/, '$1').replace(/[?&]$/, '');
      }

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
        actionUrl: cleanActionUrl,
        actionName: isOverdue ? 'Görüntüle' : 'Teslim Sayfası',
      };
    });
  }

  /**
   * Fetch related week documents and assignment attached files
   */
  public async getAssignmentDetails(assignmentId: number, actionUrl?: string): Promise<LmsAssignmentDetails> {
    if (!actionUrl) {
      return { assignmentId, attachedFiles: [], weekDocuments: [] };
    }

    try {
      let targetUrl = actionUrl;
      if (Platform.OS === 'web') {
        targetUrl = actionUrl.replace(LMS_BASE_URL, '/lms-proxy');
      }

      const headers: Record<string, string> = {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Moodle-Session': this.moodleSession || '',
      };
      if (Platform.OS !== 'web' && this.moodleSession) {
        headers['Cookie'] = `MoodleSession=${this.moodleSession}`;
      }

      const pageRes = await fetch(targetUrl, { headers });
      if (!pageRes.ok) {
        throw new Error(`Sayfa yüklenemedi (${pageRes.status})`);
      }
      const pageHtml = await pageRes.text();

      // 1. Extract direct attachments (PDF, ZIP, PPTX, etc.)
      const attachedFiles: LmsWeekDocument[] = [];
      const fileRegex = /<a[^>]*href=["']([^"']*pluginfile\.php[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let fMatch;
      while ((fMatch = fileRegex.exec(pageHtml)) !== null) {
        const fileUrl = fMatch[1].replace(/&amp;/g, '&');
        const rawFileName = fMatch[2].replace(/<[^>]*>?/gm, '').trim();
        if (rawFileName && !attachedFiles.some((f) => f.url === fileUrl)) {
          attachedFiles.push({
            title: rawFileName,
            url: fileUrl,
            type: detectFileType(rawFileName, fileUrl),
            isAttachment: true,
          });
        }
      }

      // 2. Extract breadcrumb section link (e.g. 19 October - 25 October -> section.php?id=...)
      let sectionName: string | undefined;
      let sectionUrl: string | undefined;

      const sectionMatch = pageHtml.match(
        /<li[^>]*breadcrumb-item[^>]*>\s*<a[^>]*href=["']([^"']*section\.php[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i
      );

      if (sectionMatch) {
        sectionUrl = sectionMatch[1].replace(/&amp;/g, '&');
        sectionName = sectionMatch[2].replace(/<[^>]*>?/gm, '').trim();
      }

      // 3. Fetch section HTML to get all week documents
      const weekDocuments: LmsWeekDocument[] = [];

      if (sectionUrl) {
        let secTargetUrl = sectionUrl;
        if (Platform.OS === 'web') {
          secTargetUrl = sectionUrl.replace(LMS_BASE_URL, '/lms-proxy');
        }

        const secRes = await fetch(secTargetUrl, { headers });
        if (secRes.ok) {
          const secHtml = await secRes.text();
          const activityRegex =
            /<li[^>]*class=["']([^"']*activity[^"']*)["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']*)["'][^>]*>[\s\S]*?<span[^>]*class=["']instancename["'][^>]*>([\s\S]*?)<\/span>/gi;

          let actMatch;
          while ((actMatch = activityRegex.exec(secHtml)) !== null) {
            const classes = actMatch[1];
            const itemUrl = actMatch[2].replace(/&amp;/g, '&');
            const rawItemName = actMatch[3]
              .replace(/<[^>]*>?/gm, '')
              .replace(/\s+(File|URL|Quiz|Page|Folder|Turnitin Assignment 2|Assignment)\b/gi, '')
              .trim();

            const modMatch = classes.match(/modtype_([a-z0-9_-]+)/i);
            const modType = modMatch ? modMatch[1] : 'resource';

            if (rawItemName && !itemUrl.includes(actionUrl)) {
              weekDocuments.push({
                title: rawItemName,
                url: itemUrl,
                type: detectFileType(rawItemName, itemUrl, modType),
                isAttachment: false,
              });
            }
          }
        }
      }

      return {
        assignmentId,
        sectionName,
        sectionUrl,
        attachedFiles,
        weekDocuments,
      };
    } catch (err: any) {
      logService.warn('LMS Assignment Details', 'Failed to fetch week documents', err.message);
      return {
        assignmentId,
        attachedFiles: [],
        weekDocuments: [],
      };
    }
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

function detectFileType(name: string, url: string, modType?: string): LmsWeekDocument['type'] {
  const lowerName = name.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerUrl.includes('.pdf')) return 'pdf';
  if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') || lowerUrl.includes('.ppt')) return 'pptx';
  if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar') || lowerUrl.includes('.zip')) return 'zip';
  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'doc';
  if (modType === 'quiz' || lowerUrl.includes('/mod/quiz/')) return 'quiz';
  if (
    modType === 'turnitintooltwo' ||
    lowerUrl.includes('/mod/turnitintooltwo/') ||
    lowerName.includes('turnitin')
  ) {
    return 'turnitin';
  }
  if (modType === 'url' || lowerUrl.includes('/mod/url/')) return 'link';
  return 'resource';
}

export const lmsClient = new OstimLmsClient();

