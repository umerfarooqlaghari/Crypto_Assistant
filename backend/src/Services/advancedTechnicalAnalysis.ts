import { RSI, MACD, BollingerBands, EMA } from 'technicalindicators';
import { BinanceService } from './binanceService';
import { logDebug, logError } from '../utils/logger';

export interface TechnicalIndicatorResults {
  rsi: number;
  macd: {
    MACD: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  ema20: number;
  ema50: number;
}

export interface ChartPattern {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  description: string;
}

export interface CandlestickPattern {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  description: string;
}

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  reasoning: string[];
}

export class AdvancedTechnicalAnalysis {
  private binanceService: BinanceService;

  constructor(binanceService?: BinanceService) {
    this.binanceService = binanceService || new BinanceService();
  }

  // Calculate top 5 technical indicators using WebSocket cached data
  async calculateIndicators(
    exchange: string,
    symbol: string,
    timeframe: string,
    periods: number = 100
  ): Promise<TechnicalIndicatorResults> {
    try {
      logDebug(`Calculating indicators for ${symbol} on ${timeframe} using WebSocket cached data`);

      // Use WebSocket cached OHLCV data instead of REST API calls
      const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, periods);

      // Require 50 data points for accurate technical analysis
      if (ohlcv.length < 50) {
        logDebug(`Only ${ohlcv.length} data points available for ${symbol} ${timeframe}, minimum 50 required`);
        throw new Error('Insufficient data for technical analysis');
      }

      // Log data availability for debugging
      logDebug(`${symbol} ${timeframe}: ${ohlcv.length} data points available`);

      const closes = ohlcv.map(candle => candle[4]);
      const highs = ohlcv.map(candle => candle[2]);
      const lows = ohlcv.map(candle => candle[3]);
      const volumes = ohlcv.map(candle => candle[5]);

      // 1. RSI (Relative Strength Index)
      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      const rsi = rsiValues[rsiValues.length - 1] || 50;

      // 2. MACD (Moving Average Convergence Divergence)
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      const macdResult = macdValues[macdValues.length - 1];
      const macd = {
        MACD: macdResult?.MACD || 0,
        signal: macdResult?.signal || 0,
        histogram: macdResult?.histogram || 0
      };

      // 3. Bollinger Bands
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2
      });
      const bollingerBands = bbValues[bbValues.length - 1] || { upper: 0, middle: 0, lower: 0 };

      // 4. EMA (Exponential Moving Averages)
      const ema20Values = EMA.calculate({ values: closes, period: 20 });
      const ema50Values = EMA.calculate({ values: closes, period: 50 });
      let ema20 = ema20Values[ema20Values.length - 1];
      let ema50 = ema50Values[ema50Values.length - 1];

      // Fallback to current price if EMA calculation fails
      if (!ema20 || ema20 === 0 || isNaN(ema20)) {
        ema20 = closes[closes.length - 1];
      }
      if (!ema50 || ema50 === 0 || isNaN(ema50)) {
        ema50 = closes[closes.length - 1];
      }



      // Debug logging for small price values
      if (closes[closes.length - 1] < 0.01) {
        logDebug(`Small price detected for ${symbol}: ${closes[closes.length - 1]}`);
        logDebug(`Bollinger Bands: upper=${bollingerBands.upper}, middle=${bollingerBands.middle}, lower=${bollingerBands.lower}`);
        logDebug(`EMA values: ema20=${ema20}, ema50=${ema50}`);
      }

      return {
        rsi,
        macd,
        bollingerBands,
        ema20,
        ema50
      };

    } catch (error) {
      logError(`Error calculating indicators for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Detect chart patterns
  detectChartPatterns(
    ohlcv: number[][],
    indicators: TechnicalIndicatorResults
  ): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    if (ohlcv.length < 20) return patterns;

    const closes = ohlcv.map(candle => candle[4]);
    const highs = ohlcv.map(candle => candle[2]);
    const lows = ohlcv.map(candle => candle[3]);

    // Head and Shoulders pattern detection
    const headAndShoulders = this.detectHeadAndShoulders(highs, lows);
    if (headAndShoulders) {
      patterns.push(headAndShoulders);
    }

    // Double Top/Bottom detection
    const doublePattern = this.detectDoubleTopBottom(highs, lows);
    if (doublePattern) {
      patterns.push(doublePattern);
    }

    // Triangle patterns
    const trianglePattern = this.detectTrianglePattern(highs, lows);
    if (trianglePattern) {
      patterns.push(trianglePattern);
    }

    // Support/Resistance breakout
    const breakoutPattern = this.detectBreakoutPattern(closes, indicators);
    if (breakoutPattern) {
      patterns.push(breakoutPattern);
    }

    return patterns;
  }

  // Detect candlestick patterns
  detectCandlestickPatterns(ohlcv: number[][]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    
    if (ohlcv.length < 3) return patterns;

    const recent = ohlcv.slice(-3); // Last 3 candles
    
    // Doji pattern
    const doji = this.detectDoji(recent[recent.length - 1]);
    if (doji) patterns.push(doji);

    // Hammer/Hanging Man
    const hammer = this.detectHammer(recent[recent.length - 1]);
    if (hammer) patterns.push(hammer);

    // Engulfing patterns
    if (recent.length >= 2) {
      const engulfing = this.detectEngulfingPattern(recent.slice(-2));
      if (engulfing) patterns.push(engulfing);
    }

    // Morning/Evening Star
    if (recent.length >= 3) {
      const star = this.detectStarPattern(recent);
      if (star) patterns.push(star);
    }

    return patterns;
  }

  // Generate comprehensive trading signal
  generateTradingSignal(
    currentPrice: number,
    indicators: TechnicalIndicatorResults,
    chartPatterns: ChartPattern[],
    candlestickPatterns: CandlestickPattern[]
  ): TradingSignal {
    let bullishScore = 0;
    let bearishScore = 0;
    const reasoning: string[] = [];

    // Analyze technical indicators
    const indicatorAnalysis = this.analyzeIndicators(indicators);
    bullishScore += indicatorAnalysis.bullishScore;
    bearishScore += indicatorAnalysis.bearishScore;
    reasoning.push(...indicatorAnalysis.reasoning);

    // Analyze chart patterns
    chartPatterns.forEach(pattern => {
      if (pattern.type === 'BULLISH') {
        bullishScore += pattern.confidence * 0.3;
        reasoning.push(`Bullish chart pattern: ${pattern.name}`);
      } else if (pattern.type === 'BEARISH') {
        bearishScore += pattern.confidence * 0.3;
        reasoning.push(`Bearish chart pattern: ${pattern.name}`);
      }
    });

    // Analyze candlestick patterns
    candlestickPatterns.forEach(pattern => {
      if (pattern.type === 'BULLISH') {
        bullishScore += pattern.confidence * 0.2;
        reasoning.push(`Bullish candlestick: ${pattern.name}`);
      } else if (pattern.type === 'BEARISH') {
        bearishScore += pattern.confidence * 0.2;
        reasoning.push(`Bearish candlestick: ${pattern.name}`);
      }
    });

    // Determine action and confidence
    const netScore = bullishScore - bearishScore;

    let action: 'BUY' | 'SELL' | 'HOLD';
    let confidence: number;

    if (netScore > 20) {
      action = 'BUY';
      // Confidence based on how strong the bullish signal is
      confidence = Math.min(Math.max((Math.abs(netScore) / 50) * 100, 60), 100);
    } else if (netScore < -20) {
      action = 'SELL';
      // Confidence based on how strong the bearish signal is
      confidence = Math.min(Math.max((Math.abs(netScore) / 50) * 100, 60), 100);
    } else {
      action = 'HOLD';
      // For HOLD, confidence should be lower since signals are mixed
      // The closer to 0, the more confident we are in holding
      const holdConfidence = Math.max(30, 70 - Math.abs(netScore) * 2);
      confidence = Math.min(holdConfidence, 65); // Cap HOLD confidence at 65%
    }

    // Calculate entry, stop loss, and take profit levels
    const { entry, stopLoss, takeProfit1, takeProfit2, takeProfit3 } = 
      this.calculateTradingLevels(currentPrice, action, indicators);

    return {
      action,
      confidence,
      strength: Math.abs(netScore),
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      reasoning
    };
  }

  // Private helper methods will be added in the next part...
  private analyzeIndicators(indicators: TechnicalIndicatorResults) {
    let bullishScore = 0;
    let bearishScore = 0;
    const reasoning: string[] = [];

    // RSI analysis
    if (indicators.rsi < 30) {
      bullishScore += 25;
      reasoning.push(`RSI oversold at ${indicators.rsi.toFixed(1)}`);
    } else if (indicators.rsi > 70) {
      bearishScore += 25;
      reasoning.push(`RSI overbought at ${indicators.rsi.toFixed(1)}`);
    }

    // MACD analysis
    if (indicators.macd.MACD > indicators.macd.signal && indicators.macd.histogram > 0) {
      bullishScore += 20;
      reasoning.push('MACD bullish crossover');
    } else if (indicators.macd.MACD < indicators.macd.signal && indicators.macd.histogram < 0) {
      bearishScore += 20;
      reasoning.push('MACD bearish crossover');
    }

    // EMA analysis
    if (indicators.ema20 > indicators.ema50) {
      bullishScore += 15;
      reasoning.push('EMA20 above EMA50 (bullish trend)');
    } else {
      bearishScore += 15;
      reasoning.push('EMA20 below EMA50 (bearish trend)');
    }



    return { bullishScore, bearishScore, reasoning };
  }

  private detectHeadAndShoulders(highs: number[], _lows: number[]): ChartPattern | null {
    if (highs.length < 20) return null;

    const recentHighs = highs.slice(-20);
    const maxHigh = Math.max(...recentHighs);
    const maxIndex = recentHighs.lastIndexOf(maxHigh);

    // Simple head and shoulders detection
    if (maxIndex > 5 && maxIndex < 15) {
      const leftShoulder = Math.max(...recentHighs.slice(0, maxIndex - 3));
      const rightShoulder = Math.max(...recentHighs.slice(maxIndex + 3));

      if (leftShoulder < maxHigh * 0.98 && rightShoulder < maxHigh * 0.98) {
        return {
          name: 'Head and Shoulders',
          type: 'BEARISH',
          confidence: 75,
          description: 'Classic bearish reversal pattern detected'
        };
      }
    }
    return null;
  }

  private detectDoubleTopBottom(highs: number[], lows: number[]): ChartPattern | null {
    if (highs.length < 15) return null;

    const recentHighs = highs.slice(-15);
    const recentLows = lows.slice(-15);

    // Double top detection
    const sortedHighs = [...recentHighs].sort((a, b) => b - a);
    if (Math.abs(sortedHighs[0] - sortedHighs[1]) / sortedHighs[0] < 0.02) {
      return {
        name: 'Double Top',
        type: 'BEARISH',
        confidence: 70,
        description: 'Double top pattern suggests bearish reversal'
      };
    }

    // Double bottom detection
    const sortedLows = [...recentLows].sort((a, b) => a - b);
    if (Math.abs(sortedLows[0] - sortedLows[1]) / sortedLows[0] < 0.02) {
      return {
        name: 'Double Bottom',
        type: 'BULLISH',
        confidence: 70,
        description: 'Double bottom pattern suggests bullish reversal'
      };
    }

    return null;
  }

  private detectTrianglePattern(highs: number[], lows: number[]): ChartPattern | null {
    if (highs.length < 10) return null;

    const recentHighs = highs.slice(-10);
    const recentLows = lows.slice(-10);

    // Simple ascending triangle detection
    const highTrend = this.calculateTrend(recentHighs);
    const lowTrend = this.calculateTrend(recentLows);

    if (Math.abs(highTrend) < 0.001 && lowTrend > 0.001) {
      return {
        name: 'Ascending Triangle',
        type: 'BULLISH',
        confidence: 65,
        description: 'Ascending triangle pattern suggests bullish breakout'
      };
    }

    if (Math.abs(lowTrend) < 0.001 && highTrend < -0.001) {
      return {
        name: 'Descending Triangle',
        type: 'BEARISH',
        confidence: 65,
        description: 'Descending triangle pattern suggests bearish breakout'
      };
    }

    return null;
  }

  private detectBreakoutPattern(closes: number[], indicators: TechnicalIndicatorResults): ChartPattern | null {
    if (closes.length < 5) return null;

    const currentPrice = closes[closes.length - 1];
    const { upper, lower } = indicators.bollingerBands;

    // Bollinger Band breakout
    if (currentPrice > upper) {
      return {
        name: 'Bollinger Band Breakout',
        type: 'BULLISH',
        confidence: 60,
        description: 'Price broke above upper Bollinger Band'
      };
    }

    if (currentPrice < lower) {
      return {
        name: 'Bollinger Band Breakdown',
        type: 'BEARISH',
        confidence: 60,
        description: 'Price broke below lower Bollinger Band'
      };
    }

    return null;
  }

  private detectDoji(candle: number[]): CandlestickPattern | null {
    const [, open, high, low, close] = candle;
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;

    if (bodySize / totalRange < 0.1) {
      return {
        name: 'Doji',
        type: 'NEUTRAL',
        confidence: 70,
        description: 'Doji candle indicates market indecision'
      };
    }
    return null;
  }

  private detectHammer(candle: number[]): CandlestickPattern | null {
    const [, open, high, low, close] = candle;
    const bodySize = Math.abs(close - open);
    const lowerShadow = Math.min(open, close) - low;
    const upperShadow = high - Math.max(open, close);

    if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
      return {
        name: 'Hammer',
        type: 'BULLISH',
        confidence: 75,
        description: 'Hammer pattern suggests bullish reversal'
      };
    }
    return null;
  }

  private detectEngulfingPattern(candles: number[][]): CandlestickPattern | null {
    if (candles.length < 2) return null;

    const [prev, current] = candles;
    const [, prevOpen, , , prevClose] = prev;
    const [, currOpen, , , currClose] = current;

    const prevBullish = prevClose > prevOpen;
    const currBullish = currClose > currOpen;

    // Bullish engulfing
    if (!prevBullish && currBullish && currOpen < prevClose && currClose > prevOpen) {
      return {
        name: 'Bullish Engulfing',
        type: 'BULLISH',
        confidence: 80,
        description: 'Bullish engulfing pattern suggests strong upward momentum'
      };
    }

    // Bearish engulfing
    if (prevBullish && !currBullish && currOpen > prevClose && currClose < prevOpen) {
      return {
        name: 'Bearish Engulfing',
        type: 'BEARISH',
        confidence: 80,
        description: 'Bearish engulfing pattern suggests strong downward momentum'
      };
    }

    return null;
  }

  private detectStarPattern(candles: number[][]): CandlestickPattern | null {
    if (candles.length < 3) return null;

    const [first, middle, last] = candles;
    const [, firstOpen, , , firstClose] = first;
    const [, middleOpen, middleHigh, middleLow, middleClose] = middle;
    const [, lastOpen, , , lastClose] = last;

    const middleBodySize = Math.abs(middleClose - middleOpen);
    const middleRange = middleHigh - middleLow;

    // Morning star (bullish)
    if (firstClose < firstOpen && lastClose > lastOpen && middleBodySize / middleRange < 0.3) {
      return {
        name: 'Morning Star',
        type: 'BULLISH',
        confidence: 85,
        description: 'Morning star pattern indicates bullish reversal'
      };
    }

    // Evening star (bearish)
    if (firstClose > firstOpen && lastClose < lastOpen && middleBodySize / middleRange < 0.3) {
      return {
        name: 'Evening Star',
        type: 'BEARISH',
        confidence: 85,
        description: 'Evening star pattern indicates bearish reversal'
      };
    }

    return null;
  }

  private calculateTradingLevels(
    currentPrice: number,
    action: 'BUY' | 'SELL' | 'HOLD',
    indicators: TechnicalIndicatorResults
  ) {
    let entry = currentPrice;
    let stopLoss: number;
    let takeProfit1: number;
    let takeProfit2: number;
    let takeProfit3: number;

    // Check if Bollinger Bands are valid (not 0 or NaN)
    const validBB = indicators.bollingerBands.upper > 0 &&
                   indicators.bollingerBands.lower > 0 &&
                   !isNaN(indicators.bollingerBands.upper) &&
                   !isNaN(indicators.bollingerBands.lower);

    if (action === 'BUY') {
      stopLoss = validBB ?
        Math.max(indicators.bollingerBands.lower, currentPrice * 0.97) :
        currentPrice * 0.97;
      takeProfit1 = currentPrice * 1.02;
      takeProfit2 = currentPrice * 1.04;
      takeProfit3 = validBB ?
        Math.min(indicators.bollingerBands.upper, currentPrice * 1.06) :
        currentPrice * 1.06;
    } else if (action === 'SELL') {
      stopLoss = validBB ?
        Math.min(indicators.bollingerBands.upper, currentPrice * 1.03) :
        currentPrice * 1.03;
      takeProfit1 = currentPrice * 0.98;
      takeProfit2 = currentPrice * 0.96;
      takeProfit3 = validBB ?
        Math.max(indicators.bollingerBands.lower, currentPrice * 0.94) :
        currentPrice * 0.94;
    } else {
      stopLoss = currentPrice * 0.98;
      takeProfit1 = currentPrice * 1.01;
      takeProfit2 = currentPrice * 1.02;
      takeProfit3 = currentPrice * 1.03;
    }

    return { entry, stopLoss, takeProfit1, takeProfit2, takeProfit3 };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    let sum = 0;
    for (let i = 1; i < values.length; i++) {
      sum += (values[i] - values[i - 1]) / values[i - 1];
    }

    return sum / (values.length - 1);
  }


}
