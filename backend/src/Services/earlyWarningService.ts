import { logInfo, logError, logDebug } from '../utils/logger';
import { prismaService } from './prismaService';
import { BinanceService } from './binanceService';
import { BinanceWhaleDetectionService } from './binanceWhaleDetectionService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { Server } from 'socket.io';


interface EarlyWarningAlert {
  id?: string;
  symbol: string;
  alertType: 'PUMP_LIKELY' | 'DUMP_LIKELY' | 'NEUTRAL';
  confidence: number;
  timeEstimateMin: number;
  timeEstimateMax: number;
  triggeredBy: string[];
  currentPrice: number;
  volume24h?: number;
  priceChange24h?: number;
  
  // Phase data
  volumeSpike?: any;
  rsiMomentum?: any;
  emaConvergence?: any;
  bidAskImbalance?: any;
  priceAction?: any;
  whaleActivity?: any;
  
  // Scores
  phase1Score: number;
  phase2Score: number;
  phase3Score: number;
}

interface VolumeAnalysis {
  currentVolume: number;
  avgVolume: number;
  ratio: number;
  priceChange: number;
  acceleration: number;
}

interface RSIAnalysis {
  currentRSI: number;
  previousRSI: number;
  velocity: number;
  momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface EMAAnalysis {
  ema20: number;
  ema50: number;
  gap: number;
  gapPercent: number;
  momentum: number;
  convergence: boolean;
}

export class EarlyWarningService {
  private binanceService: BinanceService;
  private whaleDetectionService: BinanceWhaleDetectionService;
  private technicalAnalysis: AdvancedTechnicalAnalysis;
  private io?: Server;

  private volumeHistory: Map<string, number[]> = new Map();
  private rsiHistory: Map<string, number[]> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private lastAlerts: Map<string, number> = new Map(); // Prevent spam

  constructor(binanceService: BinanceService, technicalAnalysis: AdvancedTechnicalAnalysis, io?: Server) {
    this.binanceService = binanceService;
    this.whaleDetectionService = new BinanceWhaleDetectionService(binanceService);
    this.technicalAnalysis = technicalAnalysis;
    this.io = io;

  }

  // Main method to analyze symbol for early warnings
  async analyzeSymbol(symbol: string): Promise<EarlyWarningAlert | null> {
    try {
      // Get current market data
      const ticker = this.binanceService.getCachedPrice(symbol);
      if (!ticker) {
        logDebug(`No cached price data for ${symbol}`);
        return null;
      }

      const currentPrice = parseFloat(ticker.price);
      const volume24h = parseFloat(ticker.volume);
      const priceChange24h = parseFloat(ticker.priceChangePercent);

      // Phase 1: Volume & Momentum Detection
      const phase1Result = await this.analyzePhase1(symbol, currentPrice, volume24h, priceChange24h);
      
      // Phase 2: Order Flow Analysis (if order book data available)
      const phase2Result = await this.analyzePhase2(symbol);
      
      // Phase 3: Whale Activity (placeholder for now)
      const phase3Result = await this.analyzePhase3(symbol);

      // Calculate overall confidence and alert type
      const alert = this.calculateOverallAlert(
        symbol, currentPrice, volume24h, priceChange24h,
        phase1Result, phase2Result, phase3Result
      );

      // Only process PUMP_LIKELY and DUMP_LIKELY signals, skip NEUTRAL
      // Note: Alerts are only saved to DB and broadcasted when they match configured rules
      // This is handled by the early warning alert rules cron job
      if (alert && alert.alertType !== 'NEUTRAL' && this.shouldCreateAlert(symbol, alert.alertType)) {
        // Return alert for rule checking, but don't save to DB or broadcast yet
        // Only rule-matched alerts will be saved and broadcasted
        return alert;
      }

      return null;
    } catch (error) {
      logError(`Error analyzing ${symbol} for early warnings`, error as Error);
      return null;
    }
  }

  // Phase 1: Volume & Momentum Detection
  private async analyzePhase1(symbol: string, currentPrice: number, volume24h: number, priceChange24h: number) {
    const results = {
      volumeSpike: null as any,
      rsiMomentum: null as any,
      emaConvergence: null as any,
      score: 0
    };

    try {
      // 1. Volume Spike Detection
      const volumeAnalysis = await this.analyzeVolumeSpike(symbol, volume24h, priceChange24h);
      if (volumeAnalysis.ratio > 2.0 && Math.abs(volumeAnalysis.priceChange) > 1.0) {
        results.volumeSpike = {
          detected: true,
          ...volumeAnalysis
        };
        results.score += 30;
      }

      // 2. RSI Momentum Analysis
      const rsiAnalysis = await this.analyzeRSIMomentum(symbol);
      if (rsiAnalysis && Math.abs(rsiAnalysis.velocity) > 5) {
        results.rsiMomentum = {
          detected: true,
          ...rsiAnalysis
        };
        results.score += 25;
      }

      // 3. EMA Convergence Detection
      const emaAnalysis = await this.analyzeEMAConvergence(symbol);
      if (emaAnalysis && emaAnalysis.convergence && Math.abs(emaAnalysis.gapPercent) < 0.5) {
        results.emaConvergence = {
          detected: true,
          ...emaAnalysis
        };
        results.score += 20;
      }

    } catch (error) {
      logError(`Error in Phase 1 analysis for ${symbol}`, error as Error);
    }

    logInfo(`Phase 1 Analysis for ${symbol}:`, {
      volumeSpike: results.volumeSpike?.detected || false,
      rsiMomentum: results.rsiMomentum?.detected || false,
      emaConvergence: results.emaConvergence?.detected || false,
      score: results.score
    });

    return results;
  }

  // Volume spike detection
  private async analyzeVolumeSpike(symbol: string, currentVolume: number, priceChange: number): Promise<VolumeAnalysis> {
    // Get historical volume data
    const volumeKey = `${symbol}_volume`;
    let volumeHistory = this.volumeHistory.get(volumeKey) || [];
    
    // Add current volume
    volumeHistory.push(currentVolume);
    
    // Keep only last 20 periods for moving average
    if (volumeHistory.length > 20) {
      volumeHistory = volumeHistory.slice(-20);
    }
    
    this.volumeHistory.set(volumeKey, volumeHistory);
    
    // Calculate 20-period average
    const avgVolume = volumeHistory.reduce((sum, vol) => sum + vol, 0) / volumeHistory.length;
    const ratio = currentVolume / avgVolume;
    
    // Calculate acceleration (volume trend over last 3-5 periods)
    const recentVolumes = volumeHistory.slice(-5);
    const acceleration = recentVolumes.length > 1 ? 
      (recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / recentVolumes[0] : 0;

    return {
      currentVolume,
      avgVolume,
      ratio,
      priceChange,
      acceleration
    };
  }

  // RSI momentum analysis
  private async analyzeRSIMomentum(symbol: string): Promise<RSIAnalysis | null> {
    try {
      // Get RSI from 1m and 5m timeframes
      const indicators1m = await this.technicalAnalysis.calculateIndicators('binance', symbol, '1m');
      const indicators5m = await this.technicalAnalysis.calculateIndicators('binance', symbol, '5m');
      
      const currentRSI = indicators1m.rsi;
      
      // Get RSI history
      const rsiKey = `${symbol}_rsi`;
      let rsiHistory = this.rsiHistory.get(rsiKey) || [];
      rsiHistory.push(currentRSI);
      
      if (rsiHistory.length > 10) {
        rsiHistory = rsiHistory.slice(-10);
      }
      
      this.rsiHistory.set(rsiKey, rsiHistory);
      
      if (rsiHistory.length < 2) return null;
      
      const previousRSI = rsiHistory[rsiHistory.length - 2];
      const velocity = currentRSI - previousRSI;
      
      let momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      
      // Pump signal: RSI crosses above 50 with momentum (was below 40 recently)
      if (currentRSI > 50 && velocity > 0 && rsiHistory.some(rsi => rsi < 40)) {
        momentum = 'BULLISH';
      }
      // Dump signal: RSI crosses below 50 with momentum (was above 60 recently)
      else if (currentRSI < 50 && velocity < 0 && rsiHistory.some(rsi => rsi > 60)) {
        momentum = 'BEARISH';
      }
      
      return {
        currentRSI,
        previousRSI,
        velocity,
        momentum
      };
      
    } catch (error) {
      logError(`Error analyzing RSI momentum for ${symbol}`, error as Error);
      return null;
    }
  }

  // EMA convergence analysis
  private async analyzeEMAConvergence(symbol: string): Promise<EMAAnalysis | null> {
    try {
      const indicators = await this.technicalAnalysis.calculateIndicators('binance', symbol, '5m');
      
      const ema20 = indicators.ema20;
      const ema50 = indicators.ema50;
      
      if (!ema20 || !ema50) return null;
      
      const gap = Math.abs(ema20 - ema50);
      const gapPercent = (gap / ema50) * 100;
      
      // Calculate momentum (rate of gap change)
      const priceKey = `${symbol}_ema_gap`;
      let gapHistory = this.priceHistory.get(priceKey) || [];
      gapHistory.push(gap);
      
      if (gapHistory.length > 5) {
        gapHistory = gapHistory.slice(-5);
      }
      
      this.priceHistory.set(priceKey, gapHistory);
      
      const momentum = gapHistory.length > 1 ? 
        gapHistory[gapHistory.length - 1] - gapHistory[0] : 0;
      
      const convergence = gapPercent < 0.5 && Math.abs(momentum) > 0;
      
      return {
        ema20,
        ema50,
        gap,
        gapPercent,
        momentum,
        convergence
      };
      
    } catch (error) {
      logError(`Error analyzing EMA convergence for ${symbol}`, error as Error);
      return null;
    }
  }

  // Phase 2: Order Flow Analysis
  private async analyzePhase2(symbol: string) {
    const results = {
      bidAskImbalance: null as any,
      priceAction: null as any,
      score: 0
    };

    try {
      // 1. Bid/Ask Imbalance Analysis
      const imbalanceAnalysis = await this.analyzeBidAskImbalance(symbol);
      if (imbalanceAnalysis && imbalanceAnalysis.detected) {
        results.bidAskImbalance = imbalanceAnalysis;
        results.score += 35;
      }

      // 2. Price Action Microstructure
      const priceActionAnalysis = await this.analyzePriceActionMicrostructure(symbol);
      if (priceActionAnalysis && priceActionAnalysis.detected) {
        results.priceAction = priceActionAnalysis;
        results.score += 30;
      }

    } catch (error) {
      logError(`Error in Phase 2 analysis for ${symbol}`, error as Error);
    }

    logInfo(`Phase 2 Analysis for ${symbol}:`, {
      bidAskImbalance: results.bidAskImbalance?.detected || false,
      priceAction: results.priceAction?.detected || false,
      score: results.score
    });

    return results;
  }

  // Analyze bid/ask imbalance for early pump/dump signals
  private async analyzeBidAskImbalance(symbol: string) {
    try {
      // Get current order book data
      const orderBook = this.binanceService.getCachedOrderBook(symbol);
      if (!orderBook || !orderBook.bids.length || !orderBook.asks.length) {
        // Try to get fresh order book data
        try {
          await this.binanceService.getOrderBook(symbol, 20);
          const freshOrderBook = this.binanceService.getCachedOrderBook(symbol);
          if (!freshOrderBook) return null;
          return this.calculateImbalance(freshOrderBook);
        } catch (error) {
          return null;
        }
      }

      return this.calculateImbalance(orderBook);

    } catch (error) {
      logError(`Error analyzing bid/ask imbalance for ${symbol}`, error as Error);
      return null;
    }
  }

  // Calculate order book imbalance
  private calculateImbalance(orderBook: any) {
    const topBids = orderBook.bids.slice(0, 10);
    const topAsks = orderBook.asks.slice(0, 10);

    // Calculate total volume on each side
    const bidVolume = topBids.reduce((sum: number, bid: any) => sum + bid.quantity, 0);
    const askVolume = topAsks.reduce((sum: number, ask: any) => sum + ask.quantity, 0);

    // Calculate weighted volume (closer to mid price = higher weight)
    const midPrice = (topBids[0].price + topAsks[0].price) / 2;

    const weightedBidVolume = topBids.reduce((sum: number, bid: any) => {
      const weight = 1 - Math.abs(bid.price - midPrice) / midPrice;
      return sum + (bid.quantity * weight);
    }, 0);

    const weightedAskVolume = topAsks.reduce((sum: number, ask: any) => {
      const weight = 1 - Math.abs(ask.price - midPrice) / midPrice;
      return sum + (ask.quantity * weight);
    }, 0);

    const totalVolume = bidVolume + askVolume;
    const buyPressure = bidVolume / totalVolume;
    const sellPressure = askVolume / totalVolume;
    const ratio = bidVolume / askVolume;

    // Detect significant imbalance
    const detected = ratio > 2.0 || ratio < 0.5;

    // Identify large orders (potential whale activity)
    const largeBids = topBids.filter((bid: any) => bid.quantity > bidVolume * 0.2);
    const largeAsks = topAsks.filter((ask: any) => ask.quantity > askVolume * 0.2);

    return {
      detected,
      buyPressure,
      sellPressure,
      ratio,
      bidVolume,
      askVolume,
      weightedBidVolume,
      weightedAskVolume,
      largeBids: largeBids.length,
      largeAsks: largeAsks.length,
      signal: ratio > 1.5 ? 'BULLISH' : ratio < 0.67 ? 'BEARISH' : 'NEUTRAL'
    };
  }

  // Analyze price action microstructure
  private async analyzePriceActionMicrostructure(symbol: string) {
    try {
      const orderBook = this.binanceService.getCachedOrderBook(symbol);
      if (!orderBook || !orderBook.bids.length || !orderBook.asks.length) {
        return null;
      }

      const bestBid = orderBook.bids[0].price;
      const bestAsk = orderBook.asks[0].price;
      const spread = bestAsk - bestBid;
      const spreadPercent = (spread / bestBid) * 100;

      // Get historical spread data
      const spreadKey = `${symbol}_spread`;
      let spreadHistory = this.priceHistory.get(spreadKey) || [];
      spreadHistory.push(spread);

      if (spreadHistory.length > 10) {
        spreadHistory = spreadHistory.slice(-10);
      }

      this.priceHistory.set(spreadKey, spreadHistory);

      if (spreadHistory.length < 3) return null;

      // Calculate spread change
      const avgSpread = spreadHistory.reduce((sum, s) => sum + s, 0) / spreadHistory.length;
      const spreadChange = (spread - avgSpread) / avgSpread;

      // Detect unusual order sizes
      const avgBidSize = orderBook.bids.reduce((sum: number, bid: any) => sum + bid.quantity, 0) / orderBook.bids.length;
      const avgAskSize = orderBook.asks.reduce((sum: number, ask: any) => sum + ask.quantity, 0) / orderBook.asks.length;

      const unusualBids = orderBook.bids.filter((bid: any) => bid.quantity > avgBidSize * 3);
      const unusualAsks = orderBook.asks.filter((ask: any) => ask.quantity > avgAskSize * 3);

      // Detect potential iceberg orders (multiple similar-sized orders at similar prices)
      const icebergBids = this.detectIcebergOrders(orderBook.bids);
      const icebergAsks = this.detectIcebergOrders(orderBook.asks);

      const detected = Math.abs(spreadChange) > 0.2 || unusualBids.length > 2 || unusualAsks.length > 2 || icebergBids.length > 0 || icebergAsks.length > 0;

      return {
        detected,
        spread,
        spreadPercent,
        spreadChange,
        unusualBids: unusualBids.length,
        unusualAsks: unusualAsks.length,
        icebergBids: icebergBids.length,
        icebergAsks: icebergAsks.length,
        signal: spreadChange < -0.1 ? 'BULLISH' : spreadChange > 0.1 ? 'BEARISH' : 'NEUTRAL'
      };

    } catch (error) {
      logError(`Error analyzing price action microstructure for ${symbol}`, error as Error);
      return null;
    }
  }

  // Detect iceberg orders (hidden large orders split into smaller chunks)
  private detectIcebergOrders(orders: any[]) {
    const icebergs = [];
    const tolerance = 0.001; // 0.1% price tolerance

    for (let i = 0; i < orders.length - 2; i++) {
      const order1 = orders[i];
      const order2 = orders[i + 1];
      const order3 = orders[i + 2];

      // Check if orders are at similar prices and similar sizes
      const price1 = order1.price;
      const price2 = order2.price;
      const price3 = order3.price;

      const size1 = order1.quantity;
      const size2 = order2.quantity;
      const size3 = order3.quantity;

      const priceRange = Math.max(price1, price2, price3) - Math.min(price1, price2, price3);
      const avgPrice = (price1 + price2 + price3) / 3;
      const priceVariation = priceRange / avgPrice;

      const sizeRange = Math.max(size1, size2, size3) - Math.min(size1, size2, size3);
      const avgSize = (size1 + size2 + size3) / 3;
      const sizeVariation = sizeRange / avgSize;

      // Potential iceberg if prices are close and sizes are similar
      if (priceVariation < tolerance && sizeVariation < 0.2) {
        icebergs.push({
          startPrice: Math.min(price1, price2, price3),
          endPrice: Math.max(price1, price2, price3),
          avgSize: avgSize,
          totalSize: size1 + size2 + size3
        });
      }
    }

    return icebergs;
  }

  // Phase 3: Whale Activity Detection
  private async analyzePhase3(symbol: string) {
    const results = {
      whaleActivity: null as any,
      score: 0
    };

    try {
      // Use comprehensive Binance whale detection
      const whaleAnalysis = await this.whaleDetectionService.detectWhaleActivity(symbol);

      if (whaleAnalysis && whaleAnalysis.detected) {
        results.whaleActivity = {
          detected: true,
          confidence: whaleAnalysis.confidence,
          transferDirection: whaleAnalysis.transferDirection,
          estimatedValue: whaleAnalysis.estimatedValue,
          largeOrders: whaleAnalysis.whaleActivity.largeOrders,
          largeTrades: whaleAnalysis.whaleActivity.largeTrades,
          volumeSpike: whaleAnalysis.whaleActivity.volumeSpike,
          orderBookImbalance: whaleAnalysis.whaleActivity.orderBookImbalance,
          priceImpact: whaleAnalysis.whaleActivity.priceImpact
        };

        // Score based on whale detection confidence and activity level
        results.score = Math.round(whaleAnalysis.score * 0.4); // Max 40 points (100 * 0.4)
      }

    } catch (error) {
      logError(`Error in Phase 3 analysis for ${symbol}`, error as Error);
    }

    logInfo(`Phase 3 Analysis for ${symbol}:`, {
      whaleActivity: results.whaleActivity?.detected || false,
      confidence: results.whaleActivity?.confidence || 0,
      transferDirection: results.whaleActivity?.transferDirection || 'UNKNOWN',
      estimatedValue: results.whaleActivity?.estimatedValue || 0,
      score: results.score
    });

    return results;
  }



  // Calculate overall alert from all phases
  private calculateOverallAlert(
    symbol: string,
    currentPrice: number,
    volume24h: number,
    priceChange24h: number,
    phase1: any,
    phase2: any,
    phase3: any
  ): EarlyWarningAlert | null {

    const totalScore = phase1.score + phase2.score + phase3.score;
    const confidence = Math.min(totalScore, 100);

    // Remove hardcoded confidence check - let user rules handle confidence filtering

    // Determine alert type based on signals
    let alertType: 'PUMP_LIKELY' | 'DUMP_LIKELY' | 'NEUTRAL' = 'NEUTRAL';
    const triggeredBy: string[] = [];

    // Analyze signals for pump/dump direction
    if (phase1.volumeSpike?.detected) {
      triggeredBy.push('Volume Spike');
      if (phase1.volumeSpike.priceChange > 0) {
        alertType = 'PUMP_LIKELY';
      } else {
        alertType = 'DUMP_LIKELY';
      }
    }

    if (phase1.rsiMomentum?.detected) {
      triggeredBy.push('RSI Momentum');
      if (phase1.rsiMomentum.momentum === 'BULLISH') {
        alertType = alertType === 'DUMP_LIKELY' ? 'NEUTRAL' : 'PUMP_LIKELY';
      } else if (phase1.rsiMomentum.momentum === 'BEARISH') {
        alertType = alertType === 'PUMP_LIKELY' ? 'NEUTRAL' : 'DUMP_LIKELY';
      }
    }

    if (phase1.emaConvergence?.detected) {
      triggeredBy.push('EMA Convergence');
    }

    // Calculate time estimates based on confidence and signals
    let timeEstimateMin = 3;
    let timeEstimateMax = 8;

    if (phase1.volumeSpike?.detected && phase1.volumeSpike.ratio > 3) {
      timeEstimateMin = 2;
      timeEstimateMax = 5;
    }

    if (phase2.score > 0) {
      timeEstimateMin = 1;
      timeEstimateMax = 3;
    }

    if (phase3.score > 0) {
      timeEstimateMin = 0.5;
      timeEstimateMax = 2;
    }

    // Add Phase 2 signals to triggered by
    if (phase2.bidAskImbalance?.detected) {
      triggeredBy.push('Order Flow Imbalance');
      if (phase2.bidAskImbalance.signal === 'BULLISH') {
        alertType = alertType === 'DUMP_LIKELY' ? 'NEUTRAL' : 'PUMP_LIKELY';
      } else if (phase2.bidAskImbalance.signal === 'BEARISH') {
        alertType = alertType === 'PUMP_LIKELY' ? 'NEUTRAL' : 'DUMP_LIKELY';
      }
    }

    if (phase2.priceAction?.detected) {
      triggeredBy.push('Price Action Microstructure');
      if (phase2.priceAction.signal === 'BULLISH') {
        alertType = alertType === 'DUMP_LIKELY' ? 'NEUTRAL' : 'PUMP_LIKELY';
      } else if (phase2.priceAction.signal === 'BEARISH') {
        alertType = alertType === 'PUMP_LIKELY' ? 'NEUTRAL' : 'DUMP_LIKELY';
      }
    }

    // Add Phase 3 signals to triggered by
    if (phase3.whaleActivity?.detected) {
      triggeredBy.push('Whale Activity');
      if (phase3.whaleActivity.transferDirection === 'ACCUMULATION') {
        alertType = alertType === 'DUMP_LIKELY' ? 'NEUTRAL' : 'PUMP_LIKELY';
      } else if (phase3.whaleActivity.transferDirection === 'DISTRIBUTION') {
        alertType = alertType === 'PUMP_LIKELY' ? 'NEUTRAL' : 'DUMP_LIKELY';
      }
    }

    return {
      symbol,
      alertType,
      confidence,
      timeEstimateMin,
      timeEstimateMax,
      triggeredBy,
      currentPrice,
      volume24h,
      priceChange24h,
      volumeSpike: phase1.volumeSpike,
      rsiMomentum: phase1.rsiMomentum,
      emaConvergence: phase1.emaConvergence,
      bidAskImbalance: phase2.bidAskImbalance,
      priceAction: phase2.priceAction,
      whaleActivity: phase3.whaleActivity,
      phase1Score: phase1.score,
      phase2Score: phase2.score,
      phase3Score: phase3.score
    };
  }

  // Check if we should create alert (prevent spam)
  private shouldCreateAlert(symbol: string, alertType: string): boolean {
    const key = `${symbol}_${alertType}`;
    const lastAlert = this.lastAlerts.get(key) || 0;
    const now = Date.now();

    // Minimum 5 minutes between same type of alerts for same symbol
    if (now - lastAlert < 5 * 60 * 1000) {
      return false;
    }

    this.lastAlerts.set(key, now);
    return true;
  }

  // Save alert to database
  private async saveAlert(alert: EarlyWarningAlert): Promise<void> {
    try {
      const prisma = prismaService.getClient();

      await prisma.earlyWarningAlert.create({
        data: {
          symbol: alert.symbol,
          exchange: 'binance',
          alertType: alert.alertType,
          confidence: alert.confidence,
          timeEstimateMin: alert.timeEstimateMin,
          timeEstimateMax: alert.timeEstimateMax,
          volumeSpike: alert.volumeSpike,
          rsiMomentum: alert.rsiMomentum,
          emaConvergence: alert.emaConvergence,
          bidAskImbalance: alert.bidAskImbalance,
          priceAction: alert.priceAction,
          whaleActivity: alert.whaleActivity,
          phase1Score: alert.phase1Score,
          phase2Score: alert.phase2Score,
          phase3Score: alert.phase3Score,
          triggeredBy: alert.triggeredBy,
          currentPrice: alert.currentPrice,
          volume24h: alert.volume24h || 0,
          priceChange24h: alert.priceChange24h || 0,
          isActive: true,
          isResolved: false
        }
      });

      logInfo(`Early warning alert saved for ${alert.symbol}: ${alert.alertType} (${alert.confidence}% confidence)`);

    } catch (error) {
      logError(`Error saving early warning alert for ${alert.symbol}`, error as Error);
    }
  }

  // Broadcast toast alert to coin listing page
  private async broadcastToastAlert(alert: EarlyWarningAlert, triggeredRule: any): Promise<void> {
    if (!this.io) return;

    try {
      const toastPayload = {
        id: `toast_${Date.now()}_${alert.symbol}`,
        type: 'EARLY_WARNING_TOAST',
        symbol: alert.symbol,
        alertType: alert.alertType,
        confidence: alert.confidence,
        timeEstimate: `${alert.timeEstimateMin}-${alert.timeEstimateMax} min`,
        triggeredBy: alert.triggeredBy,
        currentPrice: alert.currentPrice,
        ruleName: triggeredRule.ruleName,
        priority: triggeredRule.priority,
        message: `${alert.alertType.replace('_', ' ')} signal detected for ${alert.symbol} with ${alert.confidence}% confidence`,
        timestamp: new Date().toISOString(),
        duration: 30000 // 30 seconds
      };

      // Emit to coin listing page for toast display
      this.io.emit('earlyWarningToast', toastPayload);
      logInfo(`Early warning toast broadcast for ${alert.symbol}: ${alert.alertType} (Rule: ${triggeredRule.ruleName})`);

    } catch (error) {
      logError(`Error broadcasting early warning toast for ${alert.symbol}`, error as Error);
    }
  }

  // Broadcast alert via WebSocket to early warning system UI
  private async broadcastAlert(alert: EarlyWarningAlert): Promise<void> {
    if (!this.io) return;

    try {
      const payload = {
        id: `early_${Date.now()}_${alert.symbol}`,
        type: 'EARLY_WARNING',
        symbol: alert.symbol,
        alertType: alert.alertType,
        confidence: alert.confidence,
        timeEstimate: `${alert.timeEstimateMin}-${alert.timeEstimateMax} min`,
        triggeredBy: alert.triggeredBy,
        currentPrice: alert.currentPrice,
        timestamp: new Date().toISOString()
      };

      this.io.emit('earlyWarning', payload);
      logInfo(`Early warning broadcast for ${alert.symbol}: ${alert.alertType}`);

    } catch (error) {
      logError(`Error broadcasting early warning for ${alert.symbol}`, error as Error);
    }
  }

  // Get active alerts for a symbol
  async getActiveAlerts(symbol?: string): Promise<any[]> {
    try {
      const prisma = prismaService.getClient();

      const where: any = {
        isActive: true,
        isResolved: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      };

      if (symbol) {
        where.symbol = symbol;
      }

      const alerts = await prisma.earlyWarningAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return alerts;

    } catch (error) {
      logError('Error fetching active early warning alerts', error as Error);
      return [];
    }
  }

  // Get alert history
  async getAlertHistory(symbol?: string, limit: number = 100): Promise<any[]> {
    try {
      const prisma = prismaService.getClient();

      const where: any = {};
      if (symbol) {
        where.symbol = symbol;
      }

      const alerts = await prisma.earlyWarningAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return alerts;

    } catch (error) {
      logError('Error fetching early warning alert history', error as Error);
      return [];
    }
  }

  // Update alert outcome for accuracy tracking
  async updateAlertOutcome(alertId: string, outcome: string, responseTime?: number): Promise<void> {
    try {
      const prisma = prismaService.getClient();

      // Calculate accuracy score based on outcome
      let accuracyScore = 0;
      switch (outcome) {
        case 'PUMP_CONFIRMED':
        case 'DUMP_CONFIRMED':
          accuracyScore = 100;
          break;
        case 'PARTIAL_MOVE':
          accuracyScore = 50;
          break;
        case 'FALSE_SIGNAL':
          accuracyScore = 0;
          break;
      }

      await prisma.earlyWarningAlert.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          actualOutcome: outcome,
          accuracyScore,
          responseTime
        }
      });

      logInfo(`Updated alert outcome: ${alertId} -> ${outcome} (${accuracyScore}% accuracy)`);

    } catch (error) {
      logError(`Error updating alert outcome for ${alertId}`, error as Error);
    }
  }
}
