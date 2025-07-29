import { BinanceService, BinanceTicker } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { serviceManager } from './serviceManager';
import { logDebug, logError, logInfo } from '../utils/logger';

import { SUPPORTED_TIMEFRAMES, fetchTop30CoinsFromWebSocket } from '../config/coinConfig';



// Cache for coin list to avoid refetching on every request
let cachedCoinList: CoinListItem[] = [];
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export interface CoinListItem {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume: number;
  marketCap?: number;
  confidence: {
    '5m': ConfidenceSignal;
    '15m': ConfidenceSignal;
    '1h': ConfidenceSignal;
    '4h': ConfidenceSignal;
    '1d': ConfidenceSignal;
  };
  lastUpdated: number;
}

export interface ConfidenceSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  strength: number; // 0-100
  color: 'green' | 'red' | 'yellow';
}

export class CoinListService {
  private binanceService: BinanceService;
  private technicalAnalysisService: AdvancedTechnicalAnalysis;
  private realTimeService: any = null; // Will be set externally

  // Real-time processing (no caching)
  private realTimeUpdateInterval: NodeJS.Timeout | null = null;
  private isProcessingRealTimeData = false;
  private currentCoinList: CoinListItem[] = [];
  private readonly REAL_TIME_UPDATE_INTERVAL = 30 * 1000; // 30 seconds for coin list updates

  // Throttling for price update broadcasts
  private lastPriceBroadcastTime = 0;
  private readonly PRICE_BROADCAST_THROTTLE = 30 * 1000; // 30 seconds throttle for price broadcasts

  // Performance tracking (simplified for WebSocket-only approach)
  private performanceStats = {
    wsUpdates: 0,
    errorCount: 0,
    averageResponseTime: 0,
    lastUpdate: 0,
    activeCoinCount: 0,
    uptime: Date.now()
  };

  // Timeframes for technical analysis
  private readonly TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

  // Using centralized coin configuration

  constructor() {
    // Use shared services from ServiceManager to ensure WebSocket subscriptions are shared
    this.binanceService = serviceManager.getBinanceService();
    this.technicalAnalysisService = serviceManager.getTechnicalAnalysisService();

    logInfo('🚀 CoinListService constructor called - using shared WebSocket-enabled services');

    this.startRealTimeUpdates();
  }



  // Get top 30 coins dynamically from WebSocket (called when user visits coin-list page)
  async getTop30CoinList(): Promise<CoinListItem[]> {
    const startTime = Date.now();

    try {
      // Check cache first
      const now = Date.now();
      if (cachedCoinList.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
        logInfo(`📦 Returning cached coin list (${cachedCoinList.length} coins, age: ${Math.round((now - cacheTimestamp) / 1000)}s)`);
        return cachedCoinList;
      }

      logInfo('🔄 Fetching fresh top 30 coins from Binance WebSocket');

      // Get fresh top 30 coins with their ticker data directly from WebSocket
      const coinList = await this.generateTop30CoinListFromWebSocket();

      // Always ensure BTC and ETH are included with separate WebSocket calls
      const guaranteedCoinList = await this.ensureBTCETHIncluded(coinList);

      // Subscribe to WebSocket streams for the fetched coins using combined streams
      const symbols = guaranteedCoinList.map(coin => coin.symbol);
      await this.subscribeToCoins(symbols);

      // Update current coin list for real-time updates and setup individual subscriptions
      this.currentCoinList = guaranteedCoinList;
      this.performanceStats.activeCoinCount = guaranteedCoinList.length;

      // Setup individual price subscriptions for each coin in the list
      this.setupIndividualCoinSubscriptions(symbols);

      // Cache the results
      cachedCoinList = guaranteedCoinList;
      cacheTimestamp = now;

      // Update performance stats
      const duration = Date.now() - startTime;
      this.performanceStats.averageResponseTime =
        (this.performanceStats.averageResponseTime + duration) / 2;
      this.performanceStats.lastUpdate = Date.now();

      logInfo(`✅ Generated and cached coin list for ${guaranteedCoinList.length} coins in ${duration}ms`);
      return guaranteedCoinList;

    } catch (error) {
      this.performanceStats.errorCount++;
      logError('Error getting top 30 coin list', error as Error);
      throw error;
    }
  }

  // Legacy method - Get coin list with confidence indicators (WebSocket-only approach)
  async getCoinList(limit: number = 30): Promise<CoinListItem[]> {
    const startTime = Date.now();

    try {
      // Check if WebSocket data is ready
      if (!this.binanceService.isWebSocketDataReady()) {
        logInfo('WebSocket data not ready yet, waiting for initial data...');
        // Wait a bit for WebSocket to populate data
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.binanceService.isWebSocketDataReady()) {
          throw new Error('WebSocket data not available. Please try again in a few seconds.');
        }
      }

      // Get fresh data using the fixed TOP_30_BEST_COINS list
      const result = await this.generateTop30CoinListFromWebSocket();

      // Update performance stats
      const duration = Date.now() - startTime;
      this.performanceStats.averageResponseTime =
        (this.performanceStats.averageResponseTime + duration) / 2;
      this.performanceStats.lastUpdate = Date.now();

      return result;
    } catch (error) {
      this.performanceStats.errorCount++;
      logError('Error getting coin list', error as Error);
      throw error;
    }
  }





  // Generate top 30 coin list from curated list (eliminates all-tickers WebSocket)
  private async generateTop30CoinListFromWebSocket(): Promise<CoinListItem[]> {
    logInfo('🔄 Generating top 30 coins from curated list (no all-tickers stream)...');

    try {
      // Get the curated top 30 coins directly (no WebSocket needed)
      const top30Symbols = await fetchTop30CoinsFromWebSocket();

      logInfo(`Processing ${top30Symbols.length} curated coins for analysis...`);

      // Process each symbol to create CoinListItem with technical analysis
      const coinListPromises = top30Symbols.map(async (symbol: string) => {
        try {
          // Individual subscriptions will be handled by setupIndividualCoinSubscriptions
          // No need to subscribe here as combined streams are already active

          // Wait a moment for individual stream to connect and populate cache
          await new Promise(resolve => setTimeout(resolve, 100));

          // Get ticker data from individual stream cache
          const cachedTicker = this.binanceService.getCachedPrice(symbol);

          if (cachedTicker) {
            return await this.convertWebSocketTickerToCoinItem({
              s: cachedTicker.symbol,
              c: cachedTicker.price,
              P: cachedTicker.priceChangePercent,
              v: cachedTicker.volume,
              h: cachedTicker.high,
              l: cachedTicker.low,
              q: (parseFloat(cachedTicker.volume) * parseFloat(cachedTicker.price)).toString()
            });
          } else {
            // If no cached data yet, create basic item and let individual stream populate it
            logDebug(`No cached data for ${symbol} yet, creating basic item`);
            return await this.createBasicCoinItem(symbol);
          }
        } catch (error) {
          logError(`Error processing ${symbol}:`, error as Error);
          return null;
        }
      });

      const coinItems = await Promise.all(coinListPromises);
      const validCoinItems = coinItems.filter(item => item !== null) as CoinListItem[];

      logInfo(`✅ Generated ${validCoinItems.length} coin items from curated list`);
      return validCoinItems;
    } catch (error) {
      logError('Error generating coin list from curated list:', error as Error);
      throw error;
    }
  }

  // Create a basic coin item when no cached data is available yet
  private async createBasicCoinItem(symbol: string): Promise<CoinListItem> {
    return {
      symbol,
      name: symbol.replace('USDT', ''),
      price: 0,
      priceChange24h: 0,
      volume: 0,
      confidence: {
        '5m': { action: 'HOLD' as const, confidence: 0, strength: 0, color: 'yellow' as const },
        '15m': { action: 'HOLD' as const, confidence: 0, strength: 0, color: 'yellow' as const },
        '1h': { action: 'HOLD' as const, confidence: 0, strength: 0, color: 'yellow' as const },
        '4h': { action: 'HOLD' as const, confidence: 0, strength: 0, color: 'yellow' as const },
        '1d': { action: 'HOLD' as const, confidence: 0, strength: 0, color: 'yellow' as const }
      },
      lastUpdated: Date.now()
    };
  }











  // Get signal color based on action and confidence
  private getSignalColor(action: string, confidence: number): 'green' | 'red' | 'yellow' {
    if (confidence < 0.6) return 'yellow'; // Low confidence = yellow

    switch (action) {
      case 'BUY':
        return 'green';
      case 'SELL':
        return 'red';
      default:
        return 'yellow';
    }
  }

  // Start real-time updates using combined WebSocket streams for tracked coins only
  private startRealTimeUpdates() {
    logInfo('Starting combined WebSocket streams for tracked coins only (no all-tickers stream)');

    // Subscribe to individual coin price updates from combined streams
    // This will be populated when coins are added to the current coin list
    this.setupCoinSpecificSubscriptions();

    // Start periodic confidence updates every 30 seconds
    this.realTimeUpdateInterval = setInterval(async () => {
      if (!this.isProcessingRealTimeData && this.currentCoinList.length > 0) {
        await this.updateRealTimeConfidenceSignals();
      }
    }, this.REAL_TIME_UPDATE_INTERVAL);

    logInfo('Started combined WebSocket streams (30-second confidence updates, 30-second throttled price broadcasts for tracked coins only)');
  }

  // Setup individual coin subscriptions using combined streams (replaces all-tickers approach)
  private setupCoinSpecificSubscriptions() {
    logInfo('Setting up individual coin subscriptions using combined streams');
    // Individual subscriptions will be set up when coins are added to currentCoinList
    // This eliminates the need for processing all tickers
  }

  // Setup individual price subscriptions for specific coins (replaces all-tickers subscription)
  private setupIndividualCoinSubscriptions(symbols: string[]) {
    logInfo(`Setting up individual price subscriptions for ${symbols.length} coins using combined streams`);

    symbols.forEach(symbol => {
      // Subscribe to individual price updates for this symbol
      this.binanceService.subscribeToPrice(symbol, (tickerData) => {
        // Process the price update for this specific coin
        this.processCoinPriceUpdate(symbol, tickerData);
      });
    });

    logInfo(`✅ Successfully set up individual subscriptions for ${symbols.length} coins`);
  }

  // Process individual coin price update from combined stream with 30-second throttling
  private processCoinPriceUpdate(symbol: string, tickerData: BinanceTicker) {
    try {
      this.performanceStats.wsUpdates++;

      // Find and update the specific coin in current coin list
      const coinIndex = this.currentCoinList.findIndex(coin => coin.symbol === symbol);
      if (coinIndex !== -1) {
        const coin = this.currentCoinList[coinIndex];

        // Always update internal data (keep cache fresh)
        coin.price = parseFloat(tickerData.price);
        coin.priceChange24h = parseFloat(tickerData.priceChangePercent);
        coin.volume = parseFloat(tickerData.volume);
        coin.lastUpdated = Date.now();

        // Throttle broadcasts to every 30 seconds
        const now = Date.now();
        const shouldBroadcast = (now - this.lastPriceBroadcastTime) >= this.PRICE_BROADCAST_THROTTLE;

        if (this.realTimeService && shouldBroadcast) {
          // Broadcast individual price update
          this.realTimeService.broadcastCoinPriceUpdate(
            coin.symbol,
            coin.price,
            coin.priceChange24h,
            coin.volume
          );

          // Broadcast full coin list update
          this.realTimeService.broadcastCoinListUpdate(this.currentCoinList);

          // Update last broadcast time
          this.lastPriceBroadcastTime = now;

          logDebug(`Broadcasted price updates (30s throttle) - ${symbol}: $${coin.price.toFixed(6)} (${coin.priceChange24h.toFixed(2)}%)`);
        } else {
          logDebug(`Updated price (no broadcast - throttled) for ${symbol}: $${coin.price.toFixed(6)} (${coin.priceChange24h.toFixed(2)}%)`);
        }
      }
    } catch (error) {
      logError(`Error processing price update for ${symbol}`, error as Error);
    }
  }

  // Update confidence signals for all coins in real-time
  private async updateRealTimeConfidenceSignals() {
    if (this.isProcessingRealTimeData || this.currentCoinList.length === 0) {
      return;
    }

    try {
      this.isProcessingRealTimeData = true;
      logDebug(`Updating confidence signals for ${this.currentCoinList.length} coins`);

      // Process coins in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < this.currentCoinList.length; i += batchSize) {
        const batch = this.currentCoinList.slice(i, i + batchSize);

        const batchPromises = batch.map(async (coin) => {
          try {
            // Generate confidence using WebSocket cached data (no REST API calls)
            const newConfidence = await this.generateRealTimeConfidenceSignals(coin.symbol);
            coin.confidence = newConfidence;
            coin.lastUpdated = Date.now();

            // Broadcast individual confidence update
            if (this.realTimeService) {
              this.realTimeService.broadcastCoinConfidenceUpdate(coin);
            }
          } catch (error) {
            logDebug(`Failed to update confidence for ${coin.symbol}:`, error);
          }
        });

        await Promise.allSettled(batchPromises);
      }

      logDebug(`Completed confidence updates for ${this.currentCoinList.length} coins`);
    } catch (error) {
      logError('Error updating real-time confidence signals', error as Error);
    } finally {
      this.isProcessingRealTimeData = false;
    }
  }





  // Generate confidence signals for real-time processing using WebSocket cached data
  private async generateRealTimeConfidenceSignals(symbol: string): Promise<CoinListItem['confidence']> {
    const confidence: CoinListItem['confidence'] = {
      '5m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '15m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '4h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1d': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' }
    };

    // Use the EXACT same calculation as analysis page (with WebSocket cached data)
    const timeframes = this.TIMEFRAMES;
    const promises = timeframes.map(async (timeframe) => {
      try {
        // Check if WebSocket data is available for this symbol/timeframe
        if (!this.binanceService.hasKlineData(symbol, timeframe)) {
          logDebug(`No WebSocket data available for ${symbol} ${timeframe}, skipping`);
          return { timeframe, signal: null };
        }

        // Get OHLCV data from WebSocket cache (no REST API calls)
        const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, 100);

        if (ohlcv.length < 50) {
          logDebug(`Insufficient cached data for ${symbol} ${timeframe} (${ohlcv.length} candles), using default`);
          return { timeframe, signal: null };
        }

        logDebug(`Using ${ohlcv.length} cached candles for ${symbol} ${timeframe} technical analysis`);

        // Get technical indicators (same calculation as analysis page)
        const indicators = await this.technicalAnalysisService.calculateIndicators(
          'binance', symbol, timeframe, 100
        );

        // Detect patterns (same as analysis page)
        const chartPatterns = this.technicalAnalysisService.detectChartPatterns(ohlcv, indicators);
        const candlestickPatterns = this.technicalAnalysisService.detectCandlestickPatterns(ohlcv);

        // Get current price from WebSocket cache
        const currentPrice = await this.binanceService.getCurrentPrice(symbol);

        // Generate trading signal using EXACT same logic as analysis page
        const signal = this.technicalAnalysisService.generateTradingSignal(
          currentPrice, indicators, chartPatterns, candlestickPatterns
        );

        logDebug(`Generated signal for ${symbol} ${timeframe}: ${signal.action} (confidence: ${signal.confidence}, strength: ${signal.strength})`);

        return { timeframe, signal };
      } catch (error) {
        logDebug(`Error in WebSocket-based technical analysis for ${symbol} ${timeframe}: ${error}`);
        return { timeframe, signal: null };
      }
    });

    // Wait for all timeframes to complete
    const results = await Promise.allSettled(promises);

    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.signal) {
        const { timeframe, signal } = result.value;
        const confidencePercentage = signal.confidence > 1 ? signal.confidence : signal.confidence * 100;
        const strengthPercentage = signal.strength > 1 ? signal.strength : signal.strength * 100;

        confidence[timeframe as keyof typeof confidence] = {
          action: signal.action,
          confidence: Math.round(confidencePercentage),
          strength: Math.round(strengthPercentage),
          color: this.getSignalColor(signal.action, signal.confidence)
        };
      }
    });

    return confidence;
  }









  // Stop real-time updates
  stopRealTimeUpdates() {
    if (this.realTimeUpdateInterval) {
      clearInterval(this.realTimeUpdateInterval);
      this.realTimeUpdateInterval = null;
    }

    logInfo('Stopped WebSocket-only real-time updates');
  }

  // Get current coin list (real-time data)
  getCurrentCoinList(): CoinListItem[] {
    return this.currentCoinList;
  }

  // Ensure BTC and ETH are always included with separate WebSocket calls
  private async ensureBTCETHIncluded(coinList: CoinListItem[]): Promise<CoinListItem[]> {
    try {
      const requiredCoins = ['BTCUSDT', 'ETHUSDT'];
      const existingSymbols = coinList.map((coin: CoinListItem) => coin.symbol);
      const missingCoins = requiredCoins.filter(symbol => !existingSymbols.includes(symbol));

      if (missingCoins.length === 0) {
        logInfo('✅ BTC and ETH already included in coin list');
        return coinList;
      }

      logInfo(`🔍 Adding missing essential coins: ${missingCoins.join(', ')}`);

      // Make separate WebSocket calls for missing BTC/ETH
      const additionalCoins: CoinListItem[] = [];

      for (const symbol of missingCoins) {
        try {
          // Get ticker data from Binance WebSocket cache
          let tickerData = this.binanceService.getCachedPrice(symbol);

          // If not in cache, try to get via REST API as fallback
          if (!tickerData) {
            logInfo(`${symbol} not in WebSocket cache, fetching via REST API`);
            tickerData = await this.binanceService.getTicker24hr(symbol);
          }

          if (tickerData && parseFloat(tickerData.price) > 0) {
            // Generate confidence data for this coin using existing method
            const confidence = await this.generateRealTimeConfidenceSignals(symbol);

            const coinItem: CoinListItem = {
              symbol: symbol,
              name: symbol.replace('USDT', ''),
              price: parseFloat(tickerData.price),
              priceChange24h: parseFloat(tickerData.priceChangePercent),
              volume: parseFloat(tickerData.volume),
              confidence: confidence,
              lastUpdated: Date.now()
            };

            additionalCoins.push(coinItem);
            logInfo(`✅ Added ${symbol} via separate call (price: $${tickerData.price})`);
          }
        } catch (error) {
          logError(`❌ Failed to fetch ${symbol} via separate call:`, error as Error);
        }
      }

      // Combine original list with additional coins, ensuring we don't exceed 30
      const combinedList = [...additionalCoins, ...coinList];
      return combinedList.slice(0, 30);

    } catch (error) {
      logError('❌ Error ensuring BTC/ETH inclusion:', error as Error);
      return coinList;
    }
  }

  // Subscribe to WebSocket streams for the given coins (with caching-aware logic)
  private async subscribeToCoins(symbols: string[]): Promise<void> {
    try {
      logInfo(`🔌 Subscribing to WebSocket streams for ${symbols.length} coins...`);

      const binanceService = serviceManager.getBinanceService();

      // Add tracked symbols to Binance service
      binanceService.addTrackedSymbols(symbols);

      // Pre-subscribe to kline data for all timeframes
      await (binanceService as any).preSubscribeToKlineData(symbols, SUPPORTED_TIMEFRAMES);

      logInfo(`✅ Successfully subscribed to WebSocket streams for ${symbols.length} coins`);
    } catch (error) {
      logError('Failed to subscribe to WebSocket streams for coins', error as Error);
    }
  }

  // Clear current coin list
  clearCurrentCoinList() {
    this.currentCoinList = [];
    logInfo('Cleared current coin list');
  }

  // Clear cached coin list (force refresh)
  clearCachedCoinList() {
    cachedCoinList = [];
    cacheTimestamp = 0;
    logInfo('Cleared cached coin list - next request will fetch fresh data');
  }

  // Get performance statistics
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      activeCoinCount: this.currentCoinList.length,
      uptime: Date.now() - this.performanceStats.uptime
    };
  }

  // Reset performance statistics
  resetPerformanceStats() {
    this.performanceStats = {
      wsUpdates: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastUpdate: 0,
      activeCoinCount: 0,
      uptime: Date.now()
    };
    logInfo('Reset coin list performance statistics');
  }

  // Set real-time service for broadcasting updates
  setRealTimeService(realTimeService: any) {
    this.realTimeService = realTimeService;
    logInfo('Real-time service connected to coin list service');
  }

  // Convert WebSocket ticker data to CoinListItem
  private async convertWebSocketTickerToCoinItem(ticker: any): Promise<CoinListItem | null> {
    try {
      const symbol = ticker.s;
      const price = parseFloat(ticker.c);
      const priceChange24h = parseFloat(ticker.P);
      const volume = parseFloat(ticker.v);

      // Get coin name from symbol (remove USDT)
      const coinName = symbol.replace('USDT', '');

      // Generate confidence signals for all timeframes
      const confidence = await this.generateRealTimeConfidenceSignals(symbol);

      return {
        symbol,
        name: coinName,
        price,
        priceChange24h,
        volume,
        confidence,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logError(`Error converting ticker ${ticker.s} to coin item:`, error as Error);
      return null;
    }
  }
}
