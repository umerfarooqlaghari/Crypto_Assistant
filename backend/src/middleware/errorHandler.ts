import { Request, Response, NextFunction } from 'express';
import { logger, ErrorType, logTypedError } from '../utils/logger';
import { config } from '../config/config';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorType: ErrorType;

  constructor(
    message: string,
    statusCode: number = 500,
    errorType: ErrorType = ErrorType.INTERNAL_ERROR,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Exchange-specific error handling
export class ExchangeError extends AppError {
  constructor(message: string, exchange: string, operation?: string) {
    super(message, 503, ErrorType.EXCHANGE_ERROR);
    this.name = 'ExchangeError';
    
    logTypedError(ErrorType.EXCHANGE_ERROR, message, this, {
      exchange,
      operation,
    });
  }
}

// Validation error handling
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, ErrorType.VALIDATION_ERROR);
    this.name = 'ValidationError';
    
    logTypedError(ErrorType.VALIDATION_ERROR, message, this, {
      field,
    });
  }
}

// Rate limit error handling
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, ErrorType.RATE_LIMIT_ERROR);
    this.name = 'RateLimitError';
    
    logTypedError(ErrorType.RATE_LIMIT_ERROR, message, this);
  }
}

// Authentication error handling
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, ErrorType.AUTHENTICATION_ERROR);
    this.name = 'AuthenticationError';
    
    logTypedError(ErrorType.AUTHENTICATION_ERROR, message, this);
  }
}

// Network error handling
export class NetworkError extends AppError {
  constructor(message: string, url?: string) {
    super(message, 503, ErrorType.NETWORK_ERROR);
    this.name = 'NetworkError';
    
    logTypedError(ErrorType.NETWORK_ERROR, message, this, {
      url,
    });
  }
}

// Database error handling
export class DatabaseError extends AppError {
  constructor(message: string, operation?: string) {
    super(message, 500, ErrorType.DATABASE_ERROR);
    this.name = 'DatabaseError';
    
    logTypedError(ErrorType.DATABASE_ERROR, message, this, {
      operation,
    });
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    type: string;
    statusCode: number;
    timestamp: string;
    path: string;
    requestId?: string;
    details?: any;
  };
}

// Main error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Convert known errors to AppError
  if (!(error instanceof AppError)) {
    if (error.name === 'ValidationError') {
      error = new ValidationError(error.message);
    } else if (error.name === 'CastError') {
      error = new ValidationError('Invalid data format');
    } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
      error = new DatabaseError(error.message);
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      error = new NetworkError(error.message);
    } else {
      error = new AppError(error.message || 'Internal server error', 500);
    }
  }

  const appError = error as AppError;

  // Log error
  if (appError.isOperational) {
    logger.warn(`Operational Error: ${appError.message}`, {
      statusCode: appError.statusCode,
      errorType: appError.errorType,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  } else {
    logger.error(`Programming Error: ${appError.message}`, {
      error: appError.message,
      stack: appError.stack,
      statusCode: appError.statusCode,
      errorType: appError.errorType,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message: appError.message,
      type: appError.errorType,
      statusCode: appError.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  };

  // Add stack trace in development
  if (config.nodeEnv === 'development') {
    errorResponse.error.details = {
      stack: appError.stack,
    };
  }

  // Send error response
  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  
  // Close server gracefully
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  
  // Close server gracefully
  process.exit(1);
});

export default errorHandler;
