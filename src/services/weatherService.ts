export interface WeatherInfo {
  temp: number;
  condition: string;
  emoji: string;
}

export interface LessonWeatherSummary {
  periodText: string;
  temp: number;
  condition: string;
  emoji: string;
}

function getWeatherCondition(code: number): { condition: string; emoji: string } {
  if (code === 0) return { condition: 'Açık', emoji: '☀️' };
  if (code === 1 || code === 2) return { condition: 'Az Bulutlu', emoji: '🌤️' };
  if (code === 3) return { condition: 'Parçalı Bulutlu', emoji: '⛅' };
  if (code === 45 || code === 48) return { condition: 'Sisli', emoji: '🌫️' };
  if (code >= 51 && code <= 55) return { condition: 'Çisenti', emoji: '🌦️' };
  if (code >= 61 && code <= 67) return { condition: 'Yağmurlu', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { condition: 'Karlı', emoji: '❄️' };
  if (code >= 80 && code <= 82) return { condition: 'Sağanak Yağış', emoji: '🌧️' };
  if (code >= 95 && code <= 99) return { condition: 'Gök Gürültülü Fırtına', emoji: '⛈️' };
  return { condition: 'Bulutlu', emoji: '☁️' };
}

class WeatherService {
  // OSTİM Teknik Üniversitesi Coordinates
  private lat = 39.9679;
  private lon = 32.7483;
  private cachedData: any = null;
  private lastFetch = 0;

  public async fetchWeatherData(): Promise<any> {
    const now = Date.now();
    // Cache for 15 minutes to save bandwidth
    if (this.cachedData && now - this.lastFetch < 15 * 60 * 1000) {
      return this.cachedData;
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=Europe%2FIstanbul`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Weather API error: ${res.status}`);
    }

    const data = await res.json();
    this.cachedData = data;
    this.lastFetch = now;
    return data;
  }

  public async getCurrentWeather(): Promise<WeatherInfo | null> {
    try {
      const data = await this.fetchWeatherData();
      const current = data.current;
      const { condition, emoji } = getWeatherCondition(current.weather_code);
      return {
        temp: Math.round(current.temperature_2m),
        condition,
        emoji,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculates weather forecast for 1 hour before lesson starts up to start time
   * e.g. for lesson at 15:00 -> forecast for 14:00 - 15:00
   */
  public async getLessonForecast(lessonStartTime: string): Promise<LessonWeatherSummary | null> {
    try {
      if (!lessonStartTime || !lessonStartTime.includes(':')) return null;
      const data = await this.fetchWeatherData();
      const [startHourStr] = lessonStartTime.split(':');
      const startHour = parseInt(startHourStr, 10);
      const preHour = Math.max(0, startHour - 1);

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const targetTimeKey = `${year}-${month}-${day}T${String(preHour).padStart(2, '0')}:00`;

      const hourlyTimes: string[] = data.hourly?.time || [];
      const hourlyTemps: number[] = data.hourly?.temperature_2m || [];
      const hourlyCodes: number[] = data.hourly?.weather_code || [];

      let index = hourlyTimes.indexOf(targetTimeKey);
      if (index === -1) {
        // Fallback to closest hour
        index = startHour;
      }

      const temp = Math.round(hourlyTemps[index] ?? data.current?.temperature_2m ?? 15);
      const code = hourlyCodes[index] ?? data.current?.weather_code ?? 0;
      const { condition, emoji } = getWeatherCondition(code);

      const periodText = `${String(preHour).padStart(2, '0')}:00 - ${lessonStartTime}`;

      return {
        periodText,
        temp,
        condition,
        emoji,
      };
    } catch {
      return null;
    }
  }
}

export const weatherService = new WeatherService();
