import { getOHLCVFromExchange } from './ccxtService';
import { logError, logDebug } from '../utils/logger';

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
  };
  adx: number;
  atr: number;
  volume: number;
  // Allow index access for dynamic property access
  [key: string]: any;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalIndicatorService {
  
  // Convert OHLCV array to CandleData objects
  private formatCandleData(ohlcv: number[][]): CandleData[] {
    return ohlcv.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }));
  }

  // Calculate Simple Moving Average
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  // Calculate Exponential Moving Average
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  // Calculate RSI (Relative Strength Index)
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = this.calculateSMA(gains, period);
    const avgLoss = this.calculateSMA(losses, period);

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Calculate MACD (Moving Average Convergence Divergence)
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // For signal line, we need MACD values over time, simplified here
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  // Calculate Bollinger Bands
  private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number;
    middle: number;
    lower: number;
  } {
    const middle = this.calculateSMA(prices, period);
    
    if (prices.length < period) {
      return { upper: middle, middle, lower: middle };
    }

    const recentPrices = prices.slice(-period);
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev),
    };
  }



  // Calculate Average True Range (ATR)
  private calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < 2) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges, Math.min(period, trueRanges.length));
  }

  // Calculate Average Directional Index (ADX)
  private calculateADX(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const trueRanges: number[] = [];

    // Step 1: Calculate Directional Movement and True Range
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      // Plus Directional Movement (+DM)
      const upMove = current.high - previous.high;
      const downMove = previous.low - current.low;

      let plusDMValue = 0;
      let minusDMValue = 0;

      if (upMove > downMove && upMove > 0) {
        plusDMValue = upMove;
      }
      if (downMove > upMove && downMove > 0) {
        minusDMValue = downMove;
      }

      plusDM.push(plusDMValue);
      minusDM.push(minusDMValue);

      // True Range
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    // Step 2: Calculate smoothed values using Wilder's smoothing
    const smoothedPlusDM = this.wilderSmoothing(plusDM, period);
    const smoothedMinusDM = this.wilderSmoothing(minusDM, period);
    const smoothedTR = this.wilderSmoothing(trueRanges, period);

    // Step 3: Calculate +DI and -DI
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    // Step 4: Calculate DX
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    // Step 5: Calculate ADX (simplified - using current DX as ADX)
    // In a full implementation, ADX would be smoothed DX values over time
    return isNaN(dx) ? 0 : dx;
  }

  // Wilder's smoothing method for ADX calculation
  private wilderSmoothing(values: number[], period: number): number {
    if (values.length < period) return 0;

    // First smoothed value is simple average
    let smoothed = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    // Apply Wilder's smoothing to remaining values
    for (let i = period; i < values.length; i++) {
      smoothed = (smoothed * (period - 1) + values[i]) / period;
    }

    return smoothed;
  }

  // Main method to calculate all technical indicators
  async calculateIndicators(
    exchange: string,
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<TechnicalIndicators> {
    try {
      logDebug(`Calculating technical indicators for ${symbol} on ${exchange}`, {
        timeframe,
        limit,
      });

      const ohlcv = await getOHLCVFromExchange(exchange, symbol, timeframe, limit);
      const candles = this.formatCandleData(ohlcv);
      const closePrices = candles.map(c => c.close);

      const rsi = this.calculateRSI(closePrices);
      const macd = this.calculateMACD(closePrices);
      const bollingerBands = this.calculateBollingerBands(closePrices);
      const adx = this.calculateADX(candles);
      const atr = this.calculateATR(candles);

      const movingAverages = {
        sma20: this.calculateSMA(closePrices, 20),
        sma50: this.calculateSMA(closePrices, 50),
        ema12: this.calculateEMA(closePrices, 12),
        ema26: this.calculateEMA(closePrices, 26),
      };

      const currentCandle = candles[candles.length - 1];

      return {
        rsi,
        macd,
        bollingerBands,
        movingAverages,
        adx,
        atr,
        volume: currentCandle.volume,
      };
    } catch (error) {
      logError(`Error calculating technical indicators for ${symbol}`, error as Error, {
        exchange,
        timeframe,
        limit,
      });
      throw error;
    }
  }

  // Get signal strength based on technical indicators
  getSignalStrength(indicators: TechnicalIndicators): {
    strength: number;
    signals: string[];
    confidence: number;
  } {
    const signals: string[] = [];
    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalSignals = 0;

    // RSI signals
    if (indicators.rsi > 70) {
      signals.push('RSI Overbought');
      bearishSignals++;
    } else if (indicators.rsi < 30) {
      signals.push('RSI Oversold');
      bullishSignals++;
    }
    totalSignals++;

    // MACD signals
    if (indicators.macd.macd > indicators.macd.signal) {
      signals.push('MACD Bullish');
      bullishSignals++;
    } else {
      signals.push('MACD Bearish');
      bearishSignals++;
    }
    totalSignals++;

    // Bollinger Bands signals
    const currentPrice = indicators.bollingerBands.middle; // Simplified
    if (currentPrice > indicators.bollingerBands.upper) {
      signals.push('Price above Upper Bollinger Band');
      bearishSignals++;
    } else if (currentPrice < indicators.bollingerBands.lower) {
      signals.push('Price below Lower Bollinger Band');
      bullishSignals++;
    }
    totalSignals++;

    // Moving Average signals
    if (indicators.movingAverages.ema12 > indicators.movingAverages.ema26) {
      signals.push('EMA12 > EMA26');
      bullishSignals++;
    } else {
      signals.push('EMA12 < EMA26');
      bearishSignals++;
    }
    totalSignals++;

    // Calculate overall strength (-100 to 100)
    const strength = ((bullishSignals - bearishSignals) / totalSignals) * 100;
    
    // Calculate confidence based on signal agreement
    const confidence = Math.max(bullishSignals, bearishSignals) / totalSignals;

    return {
      strength,
      signals,
      confidence,
    };
  }
}
