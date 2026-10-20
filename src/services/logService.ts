export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  details?: string;
}

class LogService {
  private logs: LogEntry[] = [];
  private listeners: (() => void)[] = [];
  private maxLogs = 100;

  public log(level: 'info' | 'warn' | 'error', tag: string, message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour12: false }),
      level,
      tag,
      message,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : undefined,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Also forward to React Native console so it appears in adb logcat
    const formattedTag = `[${tag}] ${message}`;
    if (level === 'error') {
      console.error(formattedTag, details ?? '');
    } else if (level === 'warn') {
      console.warn(formattedTag, details ?? '');
    } else {
      console.log(formattedTag, details ?? '');
    }

    this.notify();
  }

  public info(tag: string, message: string, details?: any) {
    this.log('info', tag, message, details);
  }

  public warn(tag: string, message: string, details?: any) {
    this.log('warn', tag, message, details);
  }

  public error(tag: string, message: string, details?: any) {
    this.log('error', tag, message, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getErrorCount(): number {
    return this.logs.filter((l) => l.level === 'error').length;
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const logService = new LogService();
