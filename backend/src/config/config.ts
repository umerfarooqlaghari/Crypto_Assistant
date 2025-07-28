import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Define configuration schema
const configSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5001),
  
  // Database configuration
  DATABASE_URL: Joi.string().optional(),
  REDIS_URL: Joi.string().optional(),
  
  // API Keys for exchanges
  BINANCE_API_KEY: Joi.string().optional(),
  BINANCE_SECRET_KEY: Joi.string().optional(),
  COINBASE_API_KEY: Joi.string().optional(),
  COINBASE_SECRET_KEY: Joi.string().optional(),
  KRAKEN_API_KEY: Joi.string().optional(),
  KRAKEN_SECRET_KEY: Joi.string().optional(),
  
  // External API keys
  COINGECKO_API_KEY: Joi.string().optional(),
  CRYPTOCOMPARE_API_KEY: Joi.string().optional(),
  
  // Security
  JWT_SECRET: Joi.string().default('your-super-secret-jwt-key'),
  JWT_EXPIRE: Joi.string().default('24h'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:3001'),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  
  // WebSocket
  WS_PORT: Joi.number().default(5002),
  
  // Signal processing
  SIGNAL_UPDATE_INTERVAL: Joi.number().default(60000), // 1 minute
  MAX_CANDLE_HISTORY: Joi.number().default(1000),
}).unknown();

// Validate environment variables
const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  
  // Database
  database: {
    url: envVars.DATABASE_URL,
  },
  
  redis: {
    url: envVars.REDIS_URL,
  },
  
  // Exchange API credentials
  exchanges: {
    binance: {
      apiKey: envVars.BINANCE_API_KEY,
      secretKey: envVars.BINANCE_SECRET_KEY,
    },
    coinbase: {
      apiKey: envVars.COINBASE_API_KEY,
      secretKey: envVars.COINBASE_SECRET_KEY,
    },
    kraken: {
      apiKey: envVars.KRAKEN_API_KEY,
      secretKey: envVars.KRAKEN_SECRET_KEY,
    },
  },
  
  // External APIs
  externalApis: {
    coingecko: {
      apiKey: envVars.COINGECKO_API_KEY,
    },
    cryptocompare: {
      apiKey: envVars.CRYPTOCOMPARE_API_KEY,
    },
  },
  
  // Security
  jwt: {
    secret: envVars.JWT_SECRET,
    expire: envVars.JWT_EXPIRE,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  
  // CORS
  cors: {
    allowedOrigins: envVars.CORS_ORIGINS.split(','),
  },
  
  // Logging
  logging: {
    level: envVars.LOG_LEVEL,
  },
  
  // WebSocket
  websocket: {
    port: envVars.WS_PORT,
  },
  
  // Signal processing
  signals: {
    updateInterval: envVars.SIGNAL_UPDATE_INTERVAL,
    maxCandleHistory: envVars.MAX_CANDLE_HISTORY,
  },
  
  // Supported exchanges
  supportedExchanges: [
    'binance',
    'coinbase',
    'kraken',
    'bitfinex',
    'bitstamp',
    'kucoin',
    'bybit',
    'okx',
    'huobi',
    'gate',
  ],
  
  // Supported timeframes
  supportedTimeframes: [
    '1m', '3m', '5m', '15m',
    '1h', '2h', '4h', '6h', '8h', '12h',
    '1d', '3d', '1w', '1M',
  ],
  
  // Default trading pairs
  defaultTradingPairs: [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT',
    'SOL/USDT', 'XRP/USDT', 'DOT/USDT', 'AVAX/USDT',
    'MATIC/USDT', 'LINK/USDT', 'UNI/USDT', 'LTC/USDT',
  ],
};

export type Config = typeof config;
