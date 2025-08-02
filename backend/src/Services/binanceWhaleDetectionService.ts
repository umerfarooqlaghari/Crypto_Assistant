import { logInfo, logError } from '../utils/logger';
import { BinanceService } from './binanceService';

interface LargeOrder {
  price: string;
  qty: string;
  count: number;
}

interface TradeData {
  symbol: string;
  price: string;
  quantity: string;
  time: number;
  isBuyerMaker: boolean;
  tradeValue: number;
}

interface OrderBookLevel {
  price: string;
  quantity: string;
  value: number;
}

interface WhaleDetectionResult {
  detected: boolean;
  confidence: number;
  whaleActivity: {
    largeOrders: {
      bids: LargeOrder[];
      asks: LargeOrder[];
      totalBidVolume: number;
      totalAskVolume: number;
    };
    largeTrades: TradeData[];
    volumeSpike: {
      detected: boolean;
      currentVolume: number;
      averageVolume: number;
      spikeRatio: number;
    };
    orderBookImbalance: {
      ratio: number;
      direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      largeWalls: {
        bidWalls: number;
        askWalls: number;
      };
    };
    priceImpact: {
      detected: boolean;
      impact: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
    };
  };
  score: number;
  transferDirection: 'ACCUMULATION' | 'DISTRIBUTION' | 'LARGE_TRANSFER' | 'UNKNOWN';
  estimatedValue: number;
}

export class BinanceWhaleDetectionService {
  private binanceService: BinanceService;
  private volumeHistory = new Map<string, number[]>();
  private priceHistory = new Map<string, number[]>();
  private tradeHistory = new Map<string, TradeData[]>();

  // Whale detection thresholds
  private readonly LARGE_ORDER_THRESHOLD_USD = 50000; // $50k+ orders
  private readonly LARGE_TRADE_THRESHOLD_USD = 25000; // $25k+ trades
  private readonly VOLUME_SPIKE_THRESHOLD = 2.5; // 2.5x average volume
  private readonly PRICE_IMPACT_THRESHOLD = 0.5; // 0.5% price impact
  private readonly MAX_HISTORY_LENGTH = 100; // Keep last 100 data points

  constructor(binanceService?: BinanceService) {
    if (!binanceService) {
      throw new Error('BinanceWhaleDetectionService requires a BinanceService instance');
    }
    this.binanceService = binanceService;
    logInfo('BinanceWhaleDetectionService initialized with shared WebSocket data');
  }

  /**
   * Detect whale activity for a specific symbol using WebSocket data
   */
  async detectWhaleActivity(symbol: string): Promise<WhaleDetectionResult> {
    try {
      // Get cached data from BinanceService WebSocket streams
      const ticker = this.binanceService.getCachedPrice(symbol);
      const orderBook = this.binanceService.getCachedOrderBook(symbol);

      if (!ticker) {
        logError(`No ticker data available for ${symbol}`);
        return this.getEmptyResult();
      }

      const currentPrice = parseFloat(ticker.price);
      const currentVolume = parseFloat(ticker.volume);
      const priceChange24h = parseFloat(ticker.priceChangePercent);

      // Store trade data from ticker updates (simulated large trades detection)
      this.updateTradeHistory(symbol, currentPrice, currentVolume, 1);

      // Analyze large orders in order book (if available)
      const largeOrders = orderBook ?
        this.analyzeLargeOrdersFromCache(orderBook, currentPrice) :
        this.getEmptyLargeOrders();

      // Analyze large trades from our trade history
      const largeTrades = this.analyzeLargeTradesFromHistory(symbol, currentPrice);

      // Analyze volume spike using historical data
      const volumeSpike = this.analyzeVolumeSpike(symbol, currentVolume);

      // Analyze order book imbalance (if order book available)
      const orderBookImbalance = orderBook ?
        this.analyzeOrderBookImbalanceFromCache(orderBook, currentPrice) :
        this.getEmptyOrderBookImbalance();

      // Analyze price impact from recent price movements
      const priceImpact = this.analyzePriceImpactFromHistory(symbol, currentPrice);

      // Calculate overall whale detection score
      const score = this.calculateWhaleScore(largeOrders, largeTrades, volumeSpike, orderBookImbalance, priceImpact);

      // Determine transfer direction
      const transferDirection = this.determineTransferDirection(orderBookImbalance, largeTrades, priceImpact, priceChange24h);

      // Estimate total value of whale activity
      const estimatedValue = this.estimateWhaleValue(largeOrders, largeTrades);

      const result: WhaleDetectionResult = {
        detected: score >= 30, // Minimum 30 points for whale detection
        confidence: Math.min(score, 100),
        whaleActivity: {
          largeOrders,
          largeTrades,
          volumeSpike,
          orderBookImbalance,
          priceImpact
        },
        score,
        transferDirection,
        estimatedValue
      };

      if (result.detected) {
        logInfo(`Whale activity detected for ${symbol}:`, {
          score: result.score,
          direction: result.transferDirection,
          value: result.estimatedValue,
          largeTradesCount: largeTrades.length,
          volumeSpike: volumeSpike.detected
        });
      }

      return result;

    } catch (error) {
      logError(`Error detecting whale activity for ${symbol}`, error as Error);
      return this.getEmptyResult();
    }
  }

  /**
   * Update trade history from ticker data
   */
  private updateTradeHistory(symbol: string, price: number, volume: number, tradeCount: number): void {
    const now = Date.now();
    const tradeData: TradeData = {
      symbol,
      price: price.toString(),
      quantity: volume.toString(),
      time: now,
      isBuyerMaker: false, // We'll determine this from price movement
      tradeValue: price * volume
    };

    let history = this.tradeHistory.get(symbol) || [];
    history.push(tradeData);

    // Keep only recent trades (last 100)
    if (history.length > this.MAX_HISTORY_LENGTH) {
      history = history.slice(-this.MAX_HISTORY_LENGTH);
    }

    this.tradeHistory.set(symbol, history);
  }

  /**
   * Get empty large orders structure
   */
  private getEmptyLargeOrders(): any {
    return {
      bids: [],
      asks: [],
      totalBidVolume: 0,
      totalAskVolume: 0
    };
  }

  /**
   * Get empty order book imbalance structure
   */
  private getEmptyOrderBookImbalance(): any {
    return {
      ratio: 1,
      direction: 'NEUTRAL' as const,
      largeWalls: {
        bidWalls: 0,
        askWalls: 0
      }
    };
  }

  /**
   * Analyze large orders from cached order book
   */
  private analyzeLargeOrdersFromCache(orderBook: any, currentPrice: number): any {
    const largeBids: LargeOrder[] = [];
    const largeAsks: LargeOrder[] = [];
    let totalBidVolume = 0;
    let totalAskVolume = 0;

    // Analyze bids (buy orders)
    orderBook.bids.forEach((level: any) => {
      const price = level.price;
      const qty = level.quantity;
      const orderValue = price * qty;
      if (orderValue >= this.LARGE_ORDER_THRESHOLD_USD) {
        largeBids.push({
          price: price.toString(),
          qty: qty.toString(),
          count: 1
        });
        totalBidVolume += orderValue;
      }
    });

    // Analyze asks (sell orders)
    orderBook.asks.forEach((level: any) => {
      const price = level.price;
      const qty = level.quantity;
      const orderValue = price * qty;
      if (orderValue >= this.LARGE_ORDER_THRESHOLD_USD) {
        largeAsks.push({
          price: price.toString(),
          qty: qty.toString(),
          count: 1
        });
        totalAskVolume += orderValue;
      }
    });

    return {
      bids: largeBids,
      asks: largeAsks,
      totalBidVolume,
      totalAskVolume
    };
  }

  /**
   * Analyze large trades from history
   */
  private analyzeLargeTradesFromHistory(symbol: string, currentPrice: number): TradeData[] {
    const history = this.tradeHistory.get(symbol) || [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    return history.filter(trade => {
      const tradeValue = parseFloat(trade.price) * parseFloat(trade.quantity);
      const isRecent = trade.time >= oneHourAgo;
      return tradeValue >= this.LARGE_TRADE_THRESHOLD_USD && isRecent;
    });
  }

  /**
   * Analyze order book imbalance from cached data
   */
  private analyzeOrderBookImbalanceFromCache(orderBook: any, currentPrice: number): any {
    if (!orderBook.bids || !orderBook.asks) {
      return this.getEmptyOrderBookImbalance();
    }

    const topBids = orderBook.bids.slice(0, 10);
    const topAsks = orderBook.asks.slice(0, 10);

    const bidVolume = topBids.reduce((sum: number, level: any) =>
      sum + (level.price * level.quantity), 0);
    const askVolume = topAsks.reduce((sum: number, level: any) =>
      sum + (level.price * level.quantity), 0);

    const ratio = askVolume > 0 ? bidVolume / askVolume : 1;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    if (ratio > 1.5) direction = 'BULLISH';
    else if (ratio < 0.67) direction = 'BEARISH';

    // Count large walls (orders > $100k)
    const bidWalls = topBids.filter((level: any) =>
      level.price * level.quantity > 100000
    ).length;

    const askWalls = topAsks.filter((level: any) =>
      level.price * level.quantity > 100000
    ).length;

    return {
      ratio,
      direction,
      largeWalls: {
        bidWalls,
        askWalls
      }
    };
  }

  /**
   * Analyze price impact from price history
   */
  private analyzePriceImpactFromHistory(symbol: string, currentPrice: number): any {
    const priceHistory = this.priceHistory.get(symbol) || [];

    if (priceHistory.length < 10) {
      return { detected: false, impact: 0, direction: 'NEUTRAL' };
    }

    const recentPrices = priceHistory.slice(-10);
    const oldestPrice = recentPrices[0];
    const newestPrice = recentPrices[recentPrices.length - 1];

    const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
    const impact = Math.abs(priceChange);

    const detected = impact >= this.PRICE_IMPACT_THRESHOLD;
    const direction = priceChange > 0 ? 'UP' : priceChange < 0 ? 'DOWN' : 'NEUTRAL';

    return {
      detected,
      impact,
      direction
    };
  }



  /**
   * Analyze volume spike using historical data
   */
  private analyzeVolumeSpike(symbol: string, currentVolume: number): any {
    // Get volume history for comparison
    let volumeHistory = this.volumeHistory.get(symbol) || [];
    volumeHistory.push(currentVolume);

    if (volumeHistory.length > this.MAX_HISTORY_LENGTH) {
      volumeHistory = volumeHistory.slice(-this.MAX_HISTORY_LENGTH);
    }

    this.volumeHistory.set(symbol, volumeHistory);

    if (volumeHistory.length < 10) {
      return {
        detected: false,
        currentVolume,
        averageVolume: currentVolume,
        spikeRatio: 1
      };
    }

    // Calculate average volume from historical data
    const averageVolume = volumeHistory.reduce((sum, vol) => sum + vol, 0) / volumeHistory.length;
    const spikeRatio = currentVolume / averageVolume;
    const detected = spikeRatio >= this.VOLUME_SPIKE_THRESHOLD;

    return {
      detected,
      currentVolume,
      averageVolume,
      spikeRatio
    };
  }



  /**
   * Calculate overall whale detection score
   */
  private calculateWhaleScore(largeOrders: any, largeTrades: any, volumeSpike: any, orderBookImbalance: any, priceImpact: any): number {
    let score = 0;

    // Large orders score (max 30 points)
    score += Math.min((largeOrders.bids.length + largeOrders.asks.length) * 5, 30);

    // Large trades score (max 25 points)
    score += Math.min(largeTrades.length * 5, 25);

    // Volume spike score (max 20 points)
    if (volumeSpike.detected) {
      score += Math.min(volumeSpike.spikeRatio * 5, 20);
    }

    // Order book imbalance score (max 15 points)
    if (orderBookImbalance.direction !== 'NEUTRAL') {
      score += 10;
      score += (orderBookImbalance.largeWalls.bidWalls + orderBookImbalance.largeWalls.askWalls) * 2.5;
    }

    // Price impact score (max 10 points)
    if (priceImpact.detected) {
      score += Math.min(priceImpact.impact * 2, 10);
    }

    return Math.round(score);
  }

  /**
   * Determine transfer direction based on analysis
   */
  private determineTransferDirection(orderBookImbalance: any, largeTrades: any, priceImpact: any, priceChange24h: number): 'ACCUMULATION' | 'DISTRIBUTION' | 'LARGE_TRANSFER' | 'UNKNOWN' {
    const bullishSignals = [
      orderBookImbalance.direction === 'BULLISH',
      priceImpact.direction === 'UP',
      priceChange24h > 2, // Price up more than 2%
      largeTrades.filter((t: any) => !t.isBuyerMaker).length > largeTrades.filter((t: any) => t.isBuyerMaker).length
    ].filter(Boolean).length;

    const bearishSignals = [
      orderBookImbalance.direction === 'BEARISH',
      priceImpact.direction === 'DOWN',
      priceChange24h < -2, // Price down more than 2%
      largeTrades.filter((t: any) => t.isBuyerMaker).length > largeTrades.filter((t: any) => !t.isBuyerMaker).length
    ].filter(Boolean).length;

    if (bullishSignals >= 2) return 'ACCUMULATION';
    if (bearishSignals >= 2) return 'DISTRIBUTION';
    if (largeTrades.length > 0) return 'LARGE_TRANSFER';
    return 'UNKNOWN';
  }

  /**
   * Estimate total value of whale activity
   */
  private estimateWhaleValue(largeOrders: any, largeTrades: any): number {
    const orderValue = largeOrders.totalBidVolume + largeOrders.totalAskVolume;
    const tradeValue = largeTrades.reduce((sum: number, trade: any) => 
      sum + (parseFloat(trade.price) * parseFloat(trade.qty)), 0
    );
    
    return orderValue + tradeValue;
  }

  /**
   * Get empty result for error cases
   */
  private getEmptyResult(): WhaleDetectionResult {
    return {
      detected: false,
      confidence: 0,
      whaleActivity: {
        largeOrders: { bids: [], asks: [], totalBidVolume: 0, totalAskVolume: 0 },
        largeTrades: [],
        volumeSpike: { detected: false, currentVolume: 0, averageVolume: 0, spikeRatio: 0 },
        orderBookImbalance: { ratio: 1, direction: 'NEUTRAL', largeWalls: { bidWalls: 0, askWalls: 0 } },
        priceImpact: { detected: false, impact: 0, direction: 'NEUTRAL' }
      },
      score: 0,
      transferDirection: 'UNKNOWN',
      estimatedValue: 0
    };
  }
}
