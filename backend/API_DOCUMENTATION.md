# Crypto Assistant API Documentation

## Overview
Professional cryptocurrency trading assistant with real-time data, advanced signal processing, and multi-exchange integration.

## Base URL
```
http://localhost:5001
```

## Authentication
Currently no authentication required. API keys for exchanges are configured via environment variables.

## Rate Limiting
- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Error Handling
All errors return JSON with the following structure:
```json
{
  "error": {
    "message": "Error description",
    "type": "ERROR_TYPE",
    "statusCode": 400,
    "timestamp": "2025-07-22T01:00:00.000Z",
    "path": "/api/endpoint"
  }
}
```

## Core Endpoints

### 1. Health Check
**GET** `/health`

**Description**: Server health and status information

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2025-07-22T01:00:00.000Z",
  "uptime": 3600.5,
  "environment": "development"
}
```

**Frequency**: Real-time
**Use Case**: Monitor server status

---

### 2. Basic Price Data
**GET** `/api/prices/price`

**Description**: Current BTC/USDT price from Binance

**Response**:
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "price": 117017.53
}
```

**Frequency**: Real-time (updated every request)
**Use Case**: Get current market price

---

### 3. Exchange-Specific Price
**GET** `/api/exchange-prices/{exchange}`

**Parameters**:
- `exchange` (path): Exchange name (binance, bybit, etc.)

**Response**:
```json
{
  "exchange": "binance",
  "price": 116959.17
}
```

**Frequency**: Real-time
**Use Case**: Get price from specific exchange

---

## Signal Endpoints

### 4. Basic Trading Signals
**GET** `/api/signals/`

**Query Parameters**:
- `symbol` (optional): Trading pair (default: BTC/USDT)
- `timeframe` (optional): Candle timeframe (default: 1h)

**Response**:
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "timestamp": "2025-07-22T01:00:00.000Z",
  "signal": "BUY",
  "confidence": 0.75,
  "strength": 75.0,
  "currentPrice": 117039.9,
  "reasoning": ["Simple signal based on current price: $117039.9"]
}
```

**Frequency**: Real-time
**Use Case**: Get basic trading recommendations

---

### 5. Multi-Exchange Comparison
**GET** `/api/signals/multi-exchange`

**Query Parameters**:
- `symbol` (optional): Trading pair (default: BTC/USDT)

**Response**:
```json
{
  "symbol": "BTC/USDT",
  "timestamp": "2025-07-22T01:00:00.000Z",
  "summary": {
    "averagePrice": 123101.17,
    "spread": 12122.55,
    "spreadPercentage": 9.85,
    "exchangeCount": 2
  },
  "exchanges": [
    {
      "exchange": "binance",
      "price": 117039.9,
      "status": "success"
    },
    {
      "exchange": "bybit",
      "price": 129162.45,
      "status": "success"
    }
  ],
  "arbitrageOpportunities": [
    {
      "exchange": "binance",
      "price": 117039.9,
      "deviation": -4.92
    }
  ]
}
```

**Frequency**: Real-time
**Use Case**: Compare prices across exchanges, find arbitrage opportunities

---

### 6. Technical Analysis Signals
**GET** `/api/signals/technical/{symbol}`

**Parameters**:
- `symbol` (path): URL-encoded trading pair (e.g., BTC%2FUSDT)

**Query Parameters**:
- `exchange` (optional): Exchange name (default: binance)
- `timeframe` (optional): Candle timeframe (default: 1h)

**Response**:
```json
{
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "timeframe": "1h",
  "signal": "BUY",
  "confidence": 0.92,
  "strength": 85.5,
  "rsi": 65.2,
  "macd": 0.15,
  "currentPrice": 116959.74,
  "timestamp": "2025-07-22T01:00:00.000Z"
}
```

**Frequency**: Real-time
**Use Case**: Advanced technical analysis with indicators

---

## Supported Features

### Exchanges
- Binance ✅
- Bybit ✅
- Coinbase (sandbox issues)
- Kraken (sandbox issues)
- Bitfinex (sandbox issues)
- Bitstamp (sandbox issues)
- KuCoin (sandbox issues)

### Timeframes
- 1m, 3m, 5m, 15m, 30m
- 1h, 2h, 4h, 6h, 8h, 12h
- 1d, 3d, 1w, 1M

### Technical Indicators
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- Moving Averages (SMA, EMA)
- Stochastic Oscillator
- ATR (Average True Range)

### Signal Types
- BUY: Bullish signal
- SELL: Bearish signal
- HOLD: Neutral/wait signal

## Environment Configuration

Create `.env` file in backend directory:
```env
NODE_ENV=development
PORT=5001
LOG_LEVEL=info

# Exchange API Keys (optional)
BINANCE_API_KEY=your_key
BINANCE_SECRET_KEY=your_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Running the Server

```bash
cd Crypto_Assistant/backend
npm install
npm run dev
```

Server will start on `http://localhost:5001`

## Testing Endpoints

```bash
# Health check
curl http://localhost:5001/health

# Basic price
curl http://localhost:5001/api/prices/price

# Multi-exchange signals
curl http://localhost:5001/api/signals/multi-exchange

# Technical analysis (URL encode the symbol)
curl "http://localhost:5001/api/signals/technical/BTC%2FUSDT"

# Exchange-specific price
curl http://localhost:5001/api/exchange-prices/binance
```

## Data Update Frequency

- **Price Data**: Real-time (every request)
- **Technical Indicators**: Real-time calculation
- **Signal Generation**: Real-time with caching
- **Multi-Exchange**: Real-time comparison
- **Arbitrage Detection**: Real-time analysis

## Error Codes

- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized
- `404`: Not Found
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error
- `503`: Service Unavailable (exchange error)

## Next Features (Planned)

1. **Candle Data Endpoints** (1m, 15m, 1h, 4h)
2. **Exit Signal Logic** (gain targets, overbought RSI, MACD bearish)
3. **Trailing Stop Strategy**
4. **Confidence-Based Take Profit**
5. **WebSocket Real-time Updates**
6. **Portfolio Management**
7. **Historical Data Storage**
8. **Alert System**
