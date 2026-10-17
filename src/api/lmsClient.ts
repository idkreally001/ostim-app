import { configManager } from '../config/configManager';

export interface LmsCourse {
  id: number;
  fullname: string;
  shortname: string;
  categoryName?: string;
}

export class OstimLmsClient {
  private wstoken: string | null = null;

  constructor(wstoken?: string) {
    if (wstoken) this.wstoken = wstoken;
  }

  public setToken(token: string) {
    this.wstoken = token;
  }

  /**
   * Acquire Moodle mobile wstoken using student credentials
   */
  public async login(username: string, rawPass: string): Promise<string> {
    const config = configManager.getConfig().lms;
    const params = new URLSearchParams({
      service: 'moodle_mobile_app',
      username,
      password: rawPass,
    });

    const res = await fetch(`${config.tokenUrl}?${params.toString()}`, {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error(`LMS Login HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`LMS Login Error: ${data.error}`);
    }

    if (!data.token) {
      throw new Error('LMS token not returned in response.');
    }

    this.wstoken = data.token;
    return data.token;
  }

  /**
   * Call Moodle WebService function
   */
  public async call(wsfunction: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.wstoken) {
      throw new Error('LMS wstoken not set. Please login first.');
    }

    const config = configManager.getConfig().lms;
    const bodyParams = new URLSearchParams({
      wstoken: this.wstoken,
      wsfunction: wsfunction,
      moodlewsrestformat: 'json',
      ...params,
    });

    const res = await fetch(config.serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      throw new Error(`LMS Call ${wsfunction} error: ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Get enrolled courses for user
   */
  public async getEnrolledCourses(userId: number): Promise<LmsCourse[]> {
    const courses = await this.call('core_enrol_get_users_courses', { userid: userId });
    if (!Array.isArray(courses)) return [];
    return courses.map((c: any) => ({
      id: c.id,
      fullname: c.fullname,
      shortname: c.shortname,
    }));
  }
}

export const lmsClient = new OstimLmsClient();
