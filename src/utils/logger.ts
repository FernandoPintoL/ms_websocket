/**
 * Logger Utility
 * Simple logging con timestamps
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Crear directorio de logs si no existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: { [key in LogLevel]: number } = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const COLORS = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  info: '\x1b[36m', // Cyan
  debug: '\x1b[90m', // Gray
  reset: '\x1b[0m', // Reset
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, data?: any): string {
  const timestamp = formatTimestamp();
  const color = COLORS[level];
  const reset = COLORS.reset;

  let output = `${timestamp} [${level.toUpperCase()}] ${message}`;

  if (data) {
    output += `\n${JSON.stringify(data, null, 2)}`;
  }

  return `${color}${output}${reset}`;
}

function writeToFile(level: LogLevel, message: string, data?: any): void {
  try {
    const timestamp = formatTimestamp();
    let logEntry = `${timestamp} [${level.toUpperCase()}] ${message}`;

    if (data) {
      logEntry += `\n${JSON.stringify(data, null, 2)}`;
    }

    logEntry += '\n';

    const logFile = path.join(LOG_DIR, `${level}.log`);
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

export function error(message: string, data?: any): void {
  if (shouldLog('error')) {
    console.error(formatMessage('error', message, data));
    writeToFile('error', message, data);
  }
}

export function warn(message: string, data?: any): void {
  if (shouldLog('warn')) {
    console.warn(formatMessage('warn', message, data));
    writeToFile('warn', message, data);
  }
}

export function info(message: string, data?: any): void {
  if (shouldLog('info')) {
    console.log(formatMessage('info', message, data));
    writeToFile('info', message, data);
  }
}

export function debug(message: string, data?: any): void {
  if (shouldLog('debug')) {
    console.log(formatMessage('debug', message, data));
    writeToFile('debug', message, data);
  }
}
