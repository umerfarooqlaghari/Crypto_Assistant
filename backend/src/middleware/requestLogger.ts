import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logApiRequest, logger } from '../utils/logger';

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

// Request logger middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log incoming request
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    // Log API request completion
    logApiRequest(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseSize: res.get('Content-Length'),
      }
    );
  });

  next();
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn(`Slow Request Detected: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
      });
    }

    // Log performance metrics
    logger.debug(`Request Performance: ${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
      duration: `${duration.toFixed(2)}ms`,
      statusCode: res.statusCode,
      memoryUsage: process.memoryUsage(),
    });
  });

  next();
};

// Request size limiter
export const requestSizeLimiter = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);

    if (contentLength > maxSize) {
      logger.warn(`Request size limit exceeded: ${contentLength} bytes`, {
        requestId: req.requestId,
        maxSize,
        actualSize: contentLength,
        url: req.originalUrl,
      });

      res.status(413).json({
        error: {
          message: 'Request entity too large',
          maxSize: `${maxSize} bytes`,
          actualSize: `${contentLength} bytes`,
        },
      });
      return;
    }

    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

// CORS preflight handler
export const corsPreflightHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return;
  }

  next();
};

export default requestLogger;
