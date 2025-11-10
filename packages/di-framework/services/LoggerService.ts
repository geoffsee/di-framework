/**
 * Example Logger Service
 *
 * Demonstrates a simple injectable service with lifecycle methods
 */

import { Container } from '../decorators';

@Container()
export class LoggerService {
  private logs: string[] = [];

  constructor() {
    console.log('[LoggerService] Created');
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    console.log(`[LoggerService] ${logEntry}`);
  }

  error(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${message}`;
    this.logs.push(logEntry);
    console.error(`[LoggerService] ${logEntry}`);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    console.log('[LoggerService] Logs cleared');
  }
}
