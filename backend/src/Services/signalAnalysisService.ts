import { TechnicalIndicatorService, TechnicalIndicators } from './technicalIndicatorService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { getOHLCVFromExchange } from './ccxtService';
import { logSignalGeneration, logDebug, logError } from '../utils/logger';

export interface SignalResult {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;
  reasoning: string[];
  technicalIndicators?: TechnicalIndicators;
  priceAction?: PriceActionAnalysis;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
  // Additional properties for enhanced analysis
  chartPatterns?: any[];
  candlestickPatterns?: any[];
  currentPrice?: number;
}

export interface PriceActionAnalysis {
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  support: number;
  resistance: number;
  volatility: number;
  momentum: number;
}

export interface MultiTimeframeSignal {
  symbol: string;
  timeframes: {
    [key: string]: SignalResult;
  };
  overallSignal: 'BUY' | 'SELL' | 'HOLD';
  overallConfidence: number;
  overallStrength?: number; // Overall strength across timeframes
  consensus: number; // Percentage of timeframes agreeing
  currentPrice?: number; // Current price for the symbol
}

export class SignalAnalysisService {
  private technicalService: TechnicalIndicatorService;
  private advancedTechnicalAnalysis: AdvancedTechnicalAnalysis;

  constructor() {
    this.technicalService = new TechnicalIndicatorService();
    this.advancedTechnicalAnalysis = new AdvancedTechnicalAnalysis();
  }

  // Generate basic signals (legacy compatibility)
  async generateBasicSignals(symbol: string, timeframe: string): Promise<SignalResult> {
    try {
      logDebug(`Generating basic signals for ${symbol} ${timeframe}`);

      // Get recent candle data for simple trend analysis
      const ohlcv = await getOHLCVFromExchange('binance', symbol, timeframe, 5);
      
      if (ohlcv.length < 3) {
        throw new Error('Insufficient data for signal generation');
      }

      const closes = ohlcv.map(candle => candle[4]); // Close prices
      const close1 = closes[closes.length - 3];
      const close2 = closes[closes.length - 2];
      const close3 = closes[closes.length - 1];

      let signal: 'BUY' | 'SELL' | 'HOLD';
      let confidence: number;
      let reasoning: string[] = [];

      // Simple trend analysis
      if (close3 > close2 && close2 > close1) {
        signal = 'BUY';
        confidence = 0.6;
        reasoning.push('Upward price trend detected');
      } else if (close3 < close2 && close2 < close1) {
        signal = 'SELL';
        confidence = 0.6;
        reasoning.push('Downward price trend detected');
      } else {
        signal = 'HOLD';
        confidence = 0.4;
        reasoning.push('No clear trend detected');
      }

      // Calculate basic volatility
      const volatility = Math.abs(close3 - close1) / close1;
      const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = volatility > 0.05 ? 'HIGH' : volatility > 0.02 ? 'MEDIUM' : 'LOW';

      const result: SignalResult = {
        signal,
        confidence,
        strength: confidence * 100,
        reasoning,
        riskLevel,
        timestamp: new Date().toISOString(),
      };

      logSignalGeneration(symbol, timeframe, signal, confidence);
      return result;
    } catch (error) {
      logError(`Error generating basic signals for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Generate comprehensive technical signals
  async generateTechnicalSignals(
    exchange: string,
    symbol: string,
    timeframe: string = '1h'
  ): Promise<SignalResult> {
    try {
      logDebug(`Generating technical signals for ${symbol} on ${exchange}`, { timeframe });

      // Get OHLCV data for pattern analysis
      const ohlcv = await getOHLCVFromExchange(exchange, symbol, timeframe, 100);

      // Get technical indicators (convert to advanced format)
      const indicators = await this.technicalService.calculateIndicators(exchange, symbol, timeframe);
      const advancedIndicators = {
        rsi: indicators.rsi,
        macd: {
          MACD: indicators.macd.macd,
          signal: indicators.macd.signal,
          histogram: indicators.macd.histogram
        },
        bollingerBands: indicators.bollingerBands,
        ema20: indicators.movingAverages.ema12, // Use available EMA
        ema50: indicators.movingAverages.ema26  // Use available EMA
      };

      // Detect chart patterns
      const chartPatterns = this.advancedTechnicalAnalysis.detectChartPatterns(ohlcv, advancedIndicators);

      // Detect candlestick patterns
      const candlestickPatterns = this.advancedTechnicalAnalysis.detectCandlestickPatterns(ohlcv);

      // Get current price
      const currentPrice = ohlcv[ohlcv.length - 1][4]; // Close price of last candle

      // Generate trading signal using advanced analysis
      const tradingSignal = this.advancedTechnicalAnalysis.generateTradingSignal(
        currentPrice,
        advancedIndicators,
        chartPatterns,
        candlestickPatterns
      );

      // Get price action analysis
      const priceAction = await this.analyzePriceAction(exchange, symbol, timeframe);

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(indicators, priceAction);

      const result: SignalResult = {
        signal: tradingSignal.action,
        confidence: tradingSignal.confidence / 100, // Convert to decimal
        strength: tradingSignal.strength,
        reasoning: tradingSignal.reasoning,
        technicalIndicators: indicators,
        priceAction,
        riskLevel,
        timestamp: new Date().toISOString(),
        // Include pattern data
        chartPatterns,
        candlestickPatterns,
        currentPrice
      };

      logSignalGeneration(symbol, timeframe, tradingSignal.action, tradingSignal.confidence / 100);
      return result;
    } catch (error) {
      logError(`Error generating technical signals for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Analyze price action
  private async analyzePriceAction(
    exchange: string,
    symbol: string,
    timeframe: string
  ): Promise<PriceActionAnalysis> {
    const ohlcv = await getOHLCVFromExchange(exchange, symbol, timeframe, 50);
    
    const highs = ohlcv.map(candle => candle[2]);
    const lows = ohlcv.map(candle => candle[3]);
    const closes = ohlcv.map(candle => candle[4]);

    // Calculate trend
    const recentCloses = closes.slice(-10);
    const oldCloses = closes.slice(-20, -10);
    const recentAvg = recentCloses.reduce((sum, price) => sum + price, 0) / recentCloses.length;
    const oldAvg = oldCloses.reduce((sum, price) => sum + price, 0) / oldCloses.length;

    let trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    if (recentAvg > oldAvg * 1.02) {
      trend = 'UPTREND';
    } else if (recentAvg < oldAvg * 0.98) {
      trend = 'DOWNTREND';
    } else {
      trend = 'SIDEWAYS';
    }

    // Calculate support and resistance
    const support = Math.min(...lows.slice(-20));
    const resistance = Math.max(...highs.slice(-20));

    // Calculate volatility
    const returns = closes.slice(1).map((close, i) => (close - closes[i]) / closes[i]);
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) * 100;

    // Calculate momentum
    const momentum = ((closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10]) * 100;

    return {
      trend,
      support,
      resistance,
      volatility,
      momentum,
    };
  }

  // Calculate risk level
  private calculateRiskLevel(
    indicators: TechnicalIndicators,
    priceAction: PriceActionAnalysis
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    let riskScore = 0;

    // High volatility increases risk
    if (priceAction.volatility > 5) riskScore += 2;
    else if (priceAction.volatility > 2) riskScore += 1;

    // Extreme RSI values increase risk
    if (indicators.rsi > 80 || indicators.rsi < 20) riskScore += 2;
    else if (indicators.rsi > 70 || indicators.rsi < 30) riskScore += 1;

    // High ATR increases risk
    if (indicators.atr > priceAction.resistance * 0.05) riskScore += 1;

    if (riskScore >= 4) return 'HIGH';
    if (riskScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  // Generate multi-timeframe analysis
  async generateMultiTimeframeSignals(
    exchange: string,
    symbol: string,
    timeframes: string[] = ['15m', '1h', '4h']
  ): Promise<MultiTimeframeSignal> {
    try {
      logDebug(`Generating multi-timeframe signals for ${symbol}`, { timeframes });

      const signalPromises = timeframes.map(async (tf) => {
        try {
          const signal = await this.generateTechnicalSignals(exchange, symbol, tf);
          return { timeframe: tf, signal };
        } catch (error) {
          logError(`Error generating signal for ${tf}`, error as Error);
          return null;
        }
      });

      const results = await Promise.all(signalPromises);
      const validResults = results.filter(r => r !== null);

      if (validResults.length === 0) {
        throw new Error('No valid signals generated for any timeframe');
      }

      // Build timeframes object
      const timeframeSignals: { [key: string]: SignalResult } = {};
      validResults.forEach(result => {
        if (result) {
          timeframeSignals[result.timeframe] = result.signal;
        }
      });

      // Calculate consensus
      const buySignals = validResults.filter(r => r?.signal.signal === 'BUY').length;
      const sellSignals = validResults.filter(r => r?.signal.signal === 'SELL').length;
      const holdSignals = validResults.filter(r => r?.signal.signal === 'HOLD').length;

      let overallSignal: 'BUY' | 'SELL' | 'HOLD';
      if (buySignals > sellSignals && buySignals > holdSignals) {
        overallSignal = 'BUY';
      } else if (sellSignals > buySignals && sellSignals > holdSignals) {
        overallSignal = 'SELL';
      } else {
        overallSignal = 'HOLD';
      }

      const maxSignals = Math.max(buySignals, sellSignals, holdSignals);
      const consensus = (maxSignals / validResults.length) * 100;

      // Calculate overall confidence
      const avgConfidence = validResults.reduce((sum, r) => sum + (r?.signal.confidence || 0), 0) / validResults.length;

      return {
        symbol,
        timeframes: timeframeSignals,
        overallSignal,
        overallConfidence: avgConfidence,
        consensus,
      };
    } catch (error) {
      logError(`Error generating multi-timeframe signals for ${symbol}`, error as Error);
      throw error;
    }
  }
}
