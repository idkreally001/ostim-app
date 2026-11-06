import { logService, LogEntry } from './logService';
import { FileHelper } from '../utils/fileHelper';

export class DebugDiagnosticsService {
  /**
   * Sanitizes diagnostic logs removing sensitive tokens, passwords, and sessions.
   */
  public static sanitizeLogs(logs: LogEntry[]): string {
    const sensitiveKeys = [
      /password['":\s]+([^'",\s]+)/gi,
      /moodlesession['":\s]+([^'",\s]+)/gi,
      /sesskey['":\s]+([^'",\s]+)/gi,
      /token['":\s]+([^'",\s]+)/gi,
      /bearer\s+([A-Za-z0-9_\-\.]+)/gi,
    ];

    return logs
      .map((entry) => {
        let cleanDetails = entry.details || '';
        sensitiveKeys.forEach((regex) => {
          cleanDetails = cleanDetails.replace(regex, '$1=[REDACTED]');
        });

        return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.tag}] ${entry.message} ${
          cleanDetails ? '\n  Details: ' + cleanDetails : ''
        }`;
      })
      .join('\n');
  }

  /**
   * Prepares and exports a sanitized diagnostic report file.
   */
  public static async exportSanitizedReport(): Promise<boolean> {
    const logs = logService.getLogs();
    if (logs.length === 0) return false;

    const sanitizedContent = [
      '====================================================',
      'OstimOne Diagnostic & Troubleshooting Report',
      `Generated at: ${new Date().toISOString()}`,
      'Privacy: All authentication tokens and passwords are redacted.',
      '====================================================\n',
      this.sanitizeLogs(logs),
    ].join('\n');

    await FileHelper.exportAndShareFile('ostimone_diagnostics.txt', sanitizedContent, 'text/plain');
    return true;
  }
}
