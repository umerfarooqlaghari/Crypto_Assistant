import { BinanceService, BinanceTicker } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { serviceManager } from './serviceManager';
import { logDebug, logError, logInfo } from '../utils/logger';
import { notificationRuleChecker } from './notificationRuleChecker';

export interface CoinListItem {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume: number;
  marketCap?: number;
  confidence: {
    '1m': ConfidenceSignal;
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
  private readonly REAL_TIME_UPDATE_INTERVAL = 5 * 1000; // 5 seconds for real-time updates

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
  private readonly TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Top 50 established coins by volume and market cap (no new/small coins)
  private readonly ESTABLISHED_COINS = [
    // Top 10 by market cap
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'POLUSDT',
    // Top 20 established altcoins
    'LTCUSDT', 'SHIBUSDT', 'AVAXUSDT', 'UNIUSDT', 'LINKUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT',
    // Top 30 DeFi and Layer 2
    'ETCUSDT', 'NEARUSDT', 'ALGOUSDT', 'MANAUSDT', 'SANDUSDT', 'CROUSDT', 'APEUSDT', 'LDOUSDT', 'OPUSDT', 'ARBUSDT',
    // Top 40 established projects
    'TONUSDT', 'FETUSDT', 'ENSUSDT', 'GRTUSDT', 'MKRUSDT', 'AAVEUSDT', 'COMPUSDT', 'SNXUSDT', 'YFIUSDT', 'SUSHIUSDT',
    // Top 50 established coins
    'CAKEUSDT', 'CHZUSDT', 'ENJUSDT', 'BATUSDT', 'ZRXUSDT', 'OMGUSDT', 'LRCUSDT', 'RLCUSDT', 'STORJUSDT', 'BANDUSDT'
  ];

  // Coins to exclude (new, unstable, stablecoins, wrapped tokens)
  private readonly EXCLUDED_COINS = [
    // New/unstable coins
    'SAHARAUSDT', 'ERAUSDT', 'CUSDT', 'LAUSDT', 'NEWTUSDT', 'RESOLVUSDT',
    // Stablecoins
    'FDUSDUSDT', 'USDCUSDT', 'TUSDUSDT', 'BUSDUSDT', 'DAIUSDT', 'USDPUSDT',
    // Wrapped tokens
    'WBTCUSDT', 'WETHUSDT', 'STETHUSDT', 'WBNBUSDT',
    // Test/demo coins
    'TESTUSDT', 'DEMOUSDT'
  ];

  constructor() {
    // Use shared services from ServiceManager to ensure WebSocket subscriptions are shared
    this.binanceService = serviceManager.getBinanceService();
    this.technicalAnalysisService = serviceManager.getTechnicalAnalysisService();

    logInfo('🚀 CoinListService constructor called - using shared WebSocket-enabled services');

    this.startRealTimeUpdates();
  }



  // Get coin list with confidence indicators (WebSocket-only approach)
  async getCoinList(limit: number = 50): Promise<CoinListItem[]> {
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

      // Get fresh data from WebSocket cache
      const result = await this.generateRealTimeCoinList(limit);

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

  // Generate real-time coin list from WebSocket data
  private async generateRealTimeCoinList(limit: number): Promise<CoinListItem[]> {
    logInfo(`Generating real-time coin list for top ${limit} coins from WebSocket data`);

    try {
      // Get all tickers from WebSocket cache
      const allTickers = this.binanceService.getAllTickersFromCache();

      if (allTickers.length === 0) {
        throw new Error('No ticker data available from WebSocket');
      }

      // Filter and prioritize coins
      const filteredTickers = this.filterAndPrioritizeCoins(allTickers, limit);

      // Process coins in parallel to calculate confidence signals
      const coinListItems: CoinListItem[] = [];
      const batchSize = 10; // Larger batch size since no API rate limits

      for (let i = 0; i < filteredTickers.length; i += batchSize) {
        const batch = filteredTickers.slice(i, i + batchSize);
        const batchPromises = batch.map(ticker => this.processRealTimeCoinItem(ticker));

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            coinListItems.push(result.value);
          } else {
            logDebug(`Failed to process coin ${batch[index].symbol}`,
              result.status === 'rejected' ? result.reason : new Error('Unknown error'));
          }
        });
      }

      // Sort coins by volume
      const sortedCoins = coinListItems.sort((a, b) => b.volume - a.volume);

      // Update current coin list for real-time updates
      this.currentCoinList = sortedCoins;
      this.performanceStats.activeCoinCount = sortedCoins.length;

      // Check notification rules against the updated coin list
      setImmediate(async () => {
        try {
          await notificationRuleChecker.checkRulesAgainstCoins(sortedCoins);
        } catch (error) {
          logError('Error checking notification rules', error as Error);
        }
      });

      logInfo(`Successfully generated ${sortedCoins.length} coins for real-time coin list`);
      return sortedCoins;
    } catch (error) {
      logError('Error generating real-time coin list', error as Error);
      throw error;
    }
  }

  // Filter and prioritize coins to get top 50 established coins by volume
  private filterAndPrioritizeCoins(allTickers: any[], limit: number) {
    // Filter out excluded coins and only include established coins or high-volume coins
    const validTickers = allTickers.filter(ticker => {
      // Exclude problematic/new coins
      if (this.EXCLUDED_COINS.includes(ticker.symbol)) {
        return false;
      }

      // Include established coins
      if (this.ESTABLISHED_COINS.includes(ticker.symbol)) {
        return true;
      }

      // For other coins, only include if they have high volume and are valid
      const volumeUSD = parseFloat(ticker.volume) * parseFloat(ticker.price);
      return volumeUSD > 10000000 && this.isValidCoin(ticker); // $10M+ volume
    });

    // Sort by volume (USD value) - highest first
    validTickers.sort((a, b) => {
      const aVolumeUSD = parseFloat(a.volume) * parseFloat(a.price);
      const bVolumeUSD = parseFloat(b.volume) * parseFloat(b.price);
      return bVolumeUSD - aVolumeUSD;
    });

    // Take top 50 by volume
    const result = validTickers.slice(0, limit);
    logInfo(`Selected top ${result.length} established coins by volume (excluded ${allTickers.length - validTickers.length} coins)`);

    return result;
  }

  // Check if a coin is valid for analysis
  private isValidCoin(ticker: any): boolean {
    const symbol = ticker.symbol;
    const volume = parseFloat(ticker.volume);
    const price = parseFloat(ticker.price);

    // Filter out low volume coins
    if (volume < 1000000) return false; // Minimum 1M volume

    // Filter out very low price coins (likely to have insufficient data)
    if (price < 0.000001) return false;

    // Filter out leveraged tokens and other derivatives
    if (symbol.includes('UP') || symbol.includes('DOWN') ||
        symbol.includes('BULL') || symbol.includes('BEAR') ||
        symbol.includes('HEDGE') || symbol.includes('HALF')) {
      return false;
    }

    // Filter out some problematic meme coins and new tokens that often lack data
    const problematicPatterns = [
      /^\d+.*USDT$/, // Tokens starting with numbers (like 1000SATS)
      /^1MB.*USDT$/, // 1MB tokens
      /BONK|PEPE|FLOKI|SHIB|DOGE(?!USDT$)|MEME|BTTC|LUNC|NEIRO|DOGS|HMSTR|PENGU|BOME|LEVER|WIN|SPK|SPELL|SLP/i
    ];

    return !problematicPatterns.some(pattern => pattern.test(symbol));
  }



  // Process individual coin item using real-time WebSocket data (optimized for real-time)
  private async processRealTimeCoinItem(ticker: BinanceTicker): Promise<CoinListItem | null> {
    try {
      const symbol = ticker.symbol;

      // Generate REAL confidence signals using WebSocket cached data (no REST API calls)
      const confidence = await this.generateRealTimeConfidenceSignals(symbol);

      const coinItem: CoinListItem = {
        symbol,
        name: this.getCoinNameFromSymbol(symbol),
        price: parseFloat(ticker.price),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        marketCap: undefined,
        confidence,
        lastUpdated: Date.now()
      };

      return coinItem;
    } catch (error) {
      logError(`Error processing real-time coin item ${ticker.symbol}`, error as Error);

      // Return coin with default confidence if error occurs
      const coinItem: CoinListItem = {
        symbol: ticker.symbol,
        name: this.getCoinNameFromSymbol(ticker.symbol),
        price: parseFloat(ticker.price),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        marketCap: undefined,
        confidence: {
          '1m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '5m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '15m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '1h': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '4h': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '1d': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const }
        },
        lastUpdated: Date.now()
      };

      return coinItem;
    }
  }

  // Get coin name from symbol using a mapping of common cryptocurrencies
  private getCoinNameFromSymbol(symbol: string): string {
    const baseAsset = symbol.replace('USDT', '').replace('BTC', '').replace('ETH', '');

    const coinNames: { [key: string]: string } = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'BNB': 'BNB',
      'XRP': 'XRP',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'SOL': 'Solana',
      'TRX': 'TRON',
      'DOT': 'Polkadot',
      'MATIC': 'Polygon',
      'LTC': 'Litecoin',
      'SHIB': 'Shiba Inu',
      'AVAX': 'Avalanche',
      'UNI': 'Uniswap',
      'LINK': 'Chainlink',
      'ATOM': 'Cosmos',
      'XLM': 'Stellar',
      'VET': 'VeChain',
      'FIL': 'Filecoin',
      'ICP': 'Internet Computer',
      'NEAR': 'NEAR Protocol',
      'ALGO': 'Algorand',
      'MANA': 'Decentraland',
      'SAND': 'The Sandbox',
      'CRO': 'Cronos',
      'APE': 'ApeCoin',
      'LDO': 'Lido DAO',
      'OP': 'Optimism',
      'ARB': 'Arbitrum',
      'TON': 'Toncoin',
      'FET': 'Fetch.ai',
      'ENS': 'Ethereum Name Service'
    };

    return coinNames[baseAsset] || baseAsset;
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

  // Start real-time updates using WebSocket data only
  private startRealTimeUpdates() {
    logInfo('Starting WebSocket-only real-time updates for coin list');

    // Subscribe to all tickers WebSocket stream
    this.binanceService.subscribeToAllTickers((tickers) => {
      // Process real-time ticker updates
      this.processRealTimeTickerUpdates(tickers);
    });

    // Start periodic confidence updates every 5 seconds
    this.realTimeUpdateInterval = setInterval(async () => {
      if (!this.isProcessingRealTimeData && this.currentCoinList.length > 0) {
        await this.updateRealTimeConfidenceSignals();
      }
    }, this.REAL_TIME_UPDATE_INTERVAL);

    logInfo('Started WebSocket-only real-time updates (5-second confidence updates, instant price updates)');
  }

  // Process real-time ticker updates from WebSocket
  private processRealTimeTickerUpdates(tickers: BinanceTicker[]) {
    try {
      this.performanceStats.wsUpdates++;

      // Update current coin list with new price data
      this.currentCoinList.forEach(coin => {
        const ticker = tickers.find(t => t.symbol === coin.symbol);
        if (ticker) {
          const oldPrice = coin.price;
          coin.price = parseFloat(ticker.price);
          coin.priceChange24h = parseFloat(ticker.priceChangePercent);
          coin.volume = parseFloat(ticker.volume);
          coin.lastUpdated = Date.now();

          // Broadcast individual price update if real-time service is available
          if (this.realTimeService && oldPrice !== coin.price) {
            this.realTimeService.broadcastCoinPriceUpdate(
              coin.symbol,
              coin.price,
              coin.priceChange24h,
              coin.volume
            );
          }
        }
      });

      // Broadcast full coin list update
      if (this.realTimeService && this.currentCoinList.length > 0) {
        this.realTimeService.broadcastCoinListUpdate(this.currentCoinList);
      }

      logDebug(`Processed ${tickers.length} real-time ticker updates`);
    } catch (error) {
      logError('Error processing real-time ticker updates', error as Error);
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
      '1m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
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

  // Clear current coin list
  clearCurrentCoinList() {
    this.currentCoinList = [];
    logInfo('Cleared current coin list');
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
}
