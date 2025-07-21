import winston from 'winston';
import { config } from '../config/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each log level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Create custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP request logging
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Helper functions for structured logging
export const logError = (message: string, error?: Error, meta?: any) => {
  logger.error(message, {
    error: error?.message,
    stack: error?.stack,
    ...meta,
  });
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Performance logging
export const logPerformance = (operation: string, startTime: number, meta?: any) => {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation} completed in ${duration}ms`, {
    operation,
    duration,
    ...meta,
  });
};

// API request logging
export const logApiRequest = (method: string, url: string, statusCode: number, duration: number, meta?: any) => {
  logger.info(`API Request: ${method} ${url} - ${statusCode} (${duration}ms)`, {
    method,
    url,
    statusCode,
    duration,
    ...meta,
  });
};

// Exchange operation logging
export const logExchangeOperation = (exchange: string, operation: string, symbol?: string, meta?: any) => {
  logger.info(`Exchange Operation: ${exchange} - ${operation}${symbol ? ` (${symbol})` : ''}`, {
    exchange,
    operation,
    symbol,
    ...meta,
  });
};

// Signal generation logging
export const logSignalGeneration = (symbol: string, timeframe: string, signal: string, confidence: number, meta?: any) => {
  logger.info(`Signal Generated: ${symbol} ${timeframe} - ${signal} (confidence: ${confidence})`, {
    symbol,
    timeframe,
    signal,
    confidence,
    ...meta,
  });
};

// Error types for better error handling
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXCHANGE_ERROR = 'EXCHANGE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const logTypedError = (type: ErrorType, message: string, error?: Error, meta?: any) => {
  logger.error(`[${type}] ${message}`, {
    errorType: type,
    error: error?.message,
    stack: error?.stack,
    ...meta,
  });
};

export default logger;
