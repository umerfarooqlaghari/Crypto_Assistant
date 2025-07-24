import { BinanceService, BinanceTicker } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
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
    '5m': ConfidenceSignal;
    '15m': ConfidenceSignal;
    '30m': ConfidenceSignal;
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
  
  // Cache for coin list data
  private coinListCache: Map<string, CoinListItem> = new Map();
  private lastFullUpdate: number = 0;
  private readonly FULL_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly PRICE_UPDATE_INTERVAL = 30 * 1000; // 30 seconds
  private readonly CONFIDENCE_UPDATE_INTERVAL = 60 * 1000; // 1 minute for confidence updates
  
  // Background processing
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private confidenceUpdateInterval: NodeJS.Timeout | null = null;
  private isUpdatingPrices = false;
  private isUpdatingConfidence = false;

  // Smart queue for staggered API calls
  private smartQueueInterval: NodeJS.Timeout | null = null;
  private currentCoinIndex = 0;
  private isSmartQueueRunning = false;

  // Rate limiting and caching
  private lastApiCall = 0;
  private readonly MIN_API_DELAY = 1000; // 1 second between API calls
  private ohlcvCache: Map<string, { data: number[][], timestamp: number }> = new Map();
  private readonly OHLCV_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  // Top coins to analyze (limit to reduce API calls)
  private readonly TOP_COINS_LIMIT = 50;
  private readonly TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];

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

  // Performance monitoring
  private performanceStats = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    lastUpdateDuration: 0,
    errorCount: 0
  };

  constructor() {
    this.binanceService = new BinanceService();
    this.technicalAnalysisService = new AdvancedTechnicalAnalysis();

    logInfo('🚀 CoinListService constructor called - starting background updates');
    this.startBackgroundUpdates();
  }

  // Get coin list with confidence indicators
  async getCoinList(limit: number = 50): Promise<CoinListItem[]> {
    const startTime = Date.now();

    try {
      // Return cached data if recent
      if (this.shouldUseCachedData()) {
        const cached = Array.from(this.coinListCache.values())
          .sort((a, b) => b.volume - a.volume)
          .slice(0, limit);

        if (cached.length > 0) {
          this.performanceStats.cacheHits++;
          logDebug(`Returning ${cached.length} cached coin list items (cache hit)`);

          // Check notification rules against cached data as well
          // Run this asynchronously to not block the response
          setImmediate(async () => {
            try {
              await notificationRuleChecker.checkRulesAgainstCoins(cached);
            } catch (error) {
              logError('Error checking notification rules on cached data', error as Error);
            }
          });

          return cached;
        }
      }

      this.performanceStats.cacheMisses++;
      // Fetch fresh data
      const result = await this.fetchFreshCoinList(limit);

      // Update performance stats
      const duration = Date.now() - startTime;
      this.performanceStats.averageResponseTime =
        (this.performanceStats.averageResponseTime + duration) / 2;

      return result;
    } catch (error) {
      this.performanceStats.errorCount++;
      logError('Error getting coin list', error as Error);
      throw error;
    }
  }

  // Check if we should use cached data
  private shouldUseCachedData(): boolean {
    const now = Date.now();
    return (now - this.lastFullUpdate) < this.FULL_UPDATE_INTERVAL && 
           this.coinListCache.size > 0;
  }

  // Fetch fresh coin list data
  private async fetchFreshCoinList(limit: number): Promise<CoinListItem[]> {
    logInfo(`Fetching fresh coin list data for top ${limit} coins`);

    try {
      // Get all tickers from Binance (single API call)
      const allTickers = await this.binanceService.getAllTickers24hr();

      // Filter and prioritize coins
      const filteredTickers = this.filterAndPrioritizeCoins(allTickers, limit);

      // Use Binance data exclusively - no external APIs needed

      // Process coins in parallel batches to avoid overwhelming APIs
      const batchSize = 5; // Smaller batch size to reduce errors
      const coinListItems: CoinListItem[] = [];

      for (let i = 0; i < filteredTickers.length; i += batchSize) {
        const batch = filteredTickers.slice(i, i + batchSize);
        const batchPromises = batch.map(ticker => this.processCoinItem(ticker));

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            coinListItems.push(result.value);
            // Update cache
            this.coinListCache.set(result.value.symbol, result.value);
          } else {
            logDebug(`Failed to process coin ${batch[index].symbol}`,
              result.status === 'rejected' ? result.reason : new Error('Unknown error'));
          }
        });

        // Small delay between batches to respect rate limits
        if (i + batchSize < filteredTickers.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      this.lastFullUpdate = Date.now();
      logInfo(`Successfully processed ${coinListItems.length} coins for coin list`);

      // Subscribe to real-time updates for newly added coins
      this.subscribeToRealTimePrices();

      // Notify smart queue that new coins are available
      this.notifySmartQueueOfNewCoins();

      // Sort coins by volume
      const sortedCoins = coinListItems.sort((a, b) => b.volume - a.volume);

      // Check notification rules against the updated coin list
      // Run this asynchronously to not block the response
      setImmediate(async () => {
        try {
          await notificationRuleChecker.checkRulesAgainstCoins(sortedCoins);
        } catch (error) {
          logError('Error checking notification rules', error as Error);
        }
      });

      return sortedCoins;
    } catch (error) {
      logError('Error fetching fresh coin list', error as Error);
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

  // Process individual coin item using Binance data only
  private async processCoinItem(ticker: BinanceTicker): Promise<CoinListItem | null> {
    try {
      const symbol = ticker.symbol;

      // Generate REAL confidence signals for initial load (full analysis)
      const confidence = await this.generateConfidenceSignals(symbol);

      const coinItem: CoinListItem = {
        symbol,
        name: this.getCoinNameFromSymbol(symbol),
        price: parseFloat(ticker.price),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        marketCap: undefined, // We'll calculate this from Binance data if needed
        confidence,
        lastUpdated: Date.now()
      };

      return coinItem;
    } catch (error) {
      logError(`Error processing coin item ${ticker.symbol}`, error as Error);

      // Return coin with default confidence if error occurs
      const coinItem: CoinListItem = {
        symbol: ticker.symbol,
        name: this.getCoinNameFromSymbol(ticker.symbol),
        price: parseFloat(ticker.price),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        marketCap: undefined,
        confidence: {
          '5m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '15m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
          '30m': { action: 'HOLD' as const, confidence: 50, strength: 25, color: 'yellow' as const },
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

  // Generate confidence signals for all timeframes
  private async generateConfidenceSignals(symbol: string): Promise<CoinListItem['confidence']> {
    const confidence: CoinListItem['confidence'] = {
      '5m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '15m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '30m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '4h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1d': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' }
    };

    // Process timeframes in parallel with error handling
    const timeframePromises = this.TIMEFRAMES.map(async (timeframe) => {
      try {
        // Get technical indicators
        const indicators = await this.technicalAnalysisService.calculateIndicators(
          'binance', symbol, timeframe, 100 // Use more data points for better analysis
        );

        // Get OHLCV data for pattern analysis
        const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, 100);

        // Detect patterns
        const chartPatterns = this.technicalAnalysisService.detectChartPatterns(ohlcv, indicators);
        const candlestickPatterns = this.technicalAnalysisService.detectCandlestickPatterns(ohlcv);

        // Get current price
        const currentPrice = await this.binanceService.getCurrentPrice(symbol);

        // Generate trading signal
        const signal = this.technicalAnalysisService.generateTradingSignal(
          currentPrice, indicators, chartPatterns, candlestickPatterns
        );

        if (signal) {
          // Ensure confidence is already a percentage (0-100)
          const confidencePercentage = signal.confidence > 1 ? signal.confidence : signal.confidence * 100;
          // Ensure strength is also a percentage (0-100)
          const strengthPercentage = signal.strength > 1 ? signal.strength : signal.strength * 100;

          confidence[timeframe as keyof typeof confidence] = {
            action: signal.action,
            confidence: Math.round(confidencePercentage),
            strength: Math.round(strengthPercentage),
            color: this.getSignalColor(signal.action, signal.confidence)
          };
        }
      } catch (error) {
        logDebug(`Skipping ${symbol} ${timeframe} - insufficient data for technical analysis`);
        // Keep default HOLD signal for coins without enough data
      }
    });

    await Promise.allSettled(timeframePromises);
    return confidence;
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

  // Start background updates for price data and confidence levels
  private startBackgroundUpdates() {
    // REMOVED: REST API price updates - now using real-time WebSocket all-market tickers stream
    // The all-market tickers WebSocket stream provides real-time updates for ALL symbols
    // This eliminates the need for periodic REST API calls entirely

    // REPLACED: Old burst confidence updates with smart queue system
    // Start smart queue for staggered confidence updates (5 seconds between coins)
    this.startSmartQueue();

    // Subscribe to real-time price updates for all cached coins
    this.subscribeToRealTimePrices();

    logInfo('Started coin list background updates (smart queue: 15s intervals, real-time WebSocket for all prices)');
  }

  // Smart queue system for staggered confidence updates
  private startSmartQueue() {
    // Smart queue will be started when coin list API is called
    // No need to start immediately on service startup
    logInfo('Smart queue initialized - will start when coin list API is called (15s intervals with rate limiting)');
  }

  // Restart smart queue when coin list API is called
  private notifySmartQueueOfNewCoins() {
    if (this.coinListCache.size > 0) {
      // Stop existing queue if running
      if (this.isSmartQueueRunning) {
        logInfo(`Restarting smart queue with ${this.coinListCache.size} coins (API call triggered)`);
        this.stopSmartQueue();
      } else {
        logInfo(`Starting smart queue with ${this.coinListCache.size} coins (API call triggered)`);
      }

      // Start fresh queue with current coins
      this.startFreshSmartQueue();
    }
  }

  // Stop the smart queue
  private stopSmartQueue() {
    if (this.smartQueueInterval) {
      clearInterval(this.smartQueueInterval);
      this.smartQueueInterval = null;
    }
    this.isSmartQueueRunning = false;
    this.currentCoinIndex = 0;
  }

  // Start a fresh smart queue immediately (no waiting)
  private startFreshSmartQueue() {
    this.isSmartQueueRunning = true;
    this.currentCoinIndex = 0;

    // Process one coin every 15 seconds (reduced frequency to avoid rate limits)
    this.smartQueueInterval = setInterval(async () => {
      await this.processNextCoinInQueue();
    }, 15000); // 15 seconds between each coin

    const coinCount = this.coinListCache.size;
    logInfo(`Smart queue started - processing ${coinCount} coins, one every 15 seconds`);
  }

  // Process the next coin in the queue
  private async processNextCoinInQueue() {
    try {
      // Get list of cached coins
      const coinSymbols = Array.from(this.coinListCache.keys());

      if (coinSymbols.length === 0) {
        logDebug('No coins in cache for smart queue processing');
        return;
      }

      // Get current coin to process
      const symbol = coinSymbols[this.currentCoinIndex];

      if (!symbol) {
        // Reset to beginning if we've gone past the end
        this.currentCoinIndex = 0;
        return;
      }

      logInfo(`Smart queue processing coin ${this.currentCoinIndex + 1}/${coinSymbols.length}: ${symbol}`);

      // Update confidence for this specific coin
      await this.updateSingleCoinConfidence(symbol);

      // Move to next coin
      this.currentCoinIndex++;

      // Reset to beginning when we've processed all coins
      if (this.currentCoinIndex >= coinSymbols.length) {
        this.currentCoinIndex = 0;
        logInfo(`Smart queue completed full cycle of ${coinSymbols.length} coins, restarting cycle`);
      }

    } catch (error) {
      logError('Error in smart queue processing', error as Error);
      // Continue with next coin even if current one fails
      this.currentCoinIndex++;
    }
  }

  // Update confidence for a single coin (used by smart queue)
  private async updateSingleCoinConfidence(symbol: string) {
    try {
      const coinItem = this.coinListCache.get(symbol);
      if (!coinItem) {
        logDebug(`Coin ${symbol} not found in cache, skipping confidence update`);
        return;
      }

      // Generate new confidence signals for this coin with rate limiting
      const newConfidence = await this.generateConfidenceSignalsWithRateLimit(symbol);

      // Update the coin item
      coinItem.confidence = newConfidence;
      coinItem.lastUpdated = Date.now();

      // Update cache
      this.coinListCache.set(symbol, coinItem);

      // Broadcast real-time update to frontend
      if (this.realTimeService) {
        this.realTimeService.broadcastCoinConfidenceUpdate(coinItem);
      }

      logInfo(`Updated confidence for ${symbol} via smart queue`);

    } catch (error) {
      logError(`Error updating confidence for ${symbol}`, error as Error);
    }
  }

  // Rate-limited version of generateConfidenceSignals
  private async generateConfidenceSignalsWithRateLimit(symbol: string): Promise<CoinListItem['confidence']> {
    const confidence: CoinListItem['confidence'] = {
      '5m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '15m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '30m': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '4h': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' },
      '1d': { action: 'HOLD', confidence: 50, strength: 25, color: 'yellow' }
    };

    // Process only 2 timeframes per queue cycle to reduce API calls
    const timeframesToProcess = this.getTimeframesToProcess();

    for (const timeframe of timeframesToProcess) {
      try {
        // Add delay between API calls
        await this.enforceRateLimit();

        // Get cached OHLCV data or fetch new
        const ohlcv = await this.getCachedOHLCV(symbol, timeframe);

        if (ohlcv.length < 50) {
          logDebug(`Insufficient data for ${symbol} ${timeframe}, skipping`);
          continue;
        }

        // Add delay before next API call
        await this.enforceRateLimit();

        // Get technical indicators
        const indicators = await this.technicalAnalysisService.calculateIndicators(
          'binance', symbol, timeframe, 100
        );

        // Detect patterns
        const chartPatterns = this.technicalAnalysisService.detectChartPatterns(ohlcv, indicators);
        const candlestickPatterns = this.technicalAnalysisService.detectCandlestickPatterns(ohlcv);

        // Get current price from cache (no API call)
        const currentPrice = await this.binanceService.getCurrentPrice(symbol);

        // Generate trading signal
        const signal = this.technicalAnalysisService.generateTradingSignal(
          currentPrice, indicators, chartPatterns, candlestickPatterns
        );

        if (signal) {
          const confidencePercentage = signal.confidence > 1 ? signal.confidence : signal.confidence * 100;
          const strengthPercentage = signal.strength > 1 ? signal.strength : signal.strength * 100;

          confidence[timeframe as keyof typeof confidence] = {
            action: signal.action,
            confidence: Math.round(confidencePercentage),
            strength: Math.round(strengthPercentage),
            color: this.getSignalColor(signal.action, signal.confidence)
          };
        }
      } catch (error) {
        logDebug(`Skipping ${symbol} ${timeframe} - error in analysis: ${error}`);
      }
    }

    return confidence;
  }

  // Get 2 timeframes to process in rotation
  private getTimeframesToProcess(): string[] {
    const allTimeframes = this.TIMEFRAMES;
    const startIndex = (this.currentCoinIndex * 2) % allTimeframes.length;
    return [
      allTimeframes[startIndex],
      allTimeframes[(startIndex + 1) % allTimeframes.length]
    ];
  }

  // Enforce rate limiting between API calls
  private async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    if (timeSinceLastCall < this.MIN_API_DELAY) {
      const delay = this.MIN_API_DELAY - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastApiCall = Date.now();
  }

  // Get cached OHLCV data or fetch new with caching
  private async getCachedOHLCV(symbol: string, timeframe: string): Promise<number[][]> {
    const cacheKey = `${symbol}_${timeframe}`;
    const cached = this.ohlcvCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.OHLCV_CACHE_TTL) {
      return cached.data;
    }

    // Fetch new data
    const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, 100);

    // Cache the data
    this.ohlcvCache.set(cacheKey, {
      data: ohlcv,
      timestamp: Date.now()
    });

    return ohlcv;
  }

  // Subscribe to real-time price updates for all coins in cache
  private subscribeToRealTimePrices() {
    // Subscribe to price updates for all cached coins
    for (const symbol of this.coinListCache.keys()) {
      this.binanceService.subscribeToPrice(symbol, (tickerData) => {
        // Update cached coin data
        const coinItem = this.coinListCache.get(symbol);
        if (coinItem) {
          const oldPrice = coinItem.price;
          coinItem.price = parseFloat(tickerData.price);
          coinItem.priceChange24h = parseFloat(tickerData.priceChangePercent);
          coinItem.volume = parseFloat(tickerData.volume);
          coinItem.lastUpdated = Date.now();

          // Broadcast individual price update if real-time service is available and price changed
          if (this.realTimeService && oldPrice !== coinItem.price) {
            this.realTimeService.broadcastCoinPriceUpdate(
              symbol,
              coinItem.price,
              coinItem.priceChange24h,
              coinItem.volume
            );
          }
        }
      });
    }
    logInfo(`Subscribed to real-time price updates for ${this.coinListCache.size} coins`);
  }

  // Full confidence refresh - same as refresh API but automated
  private async fullConfidenceRefresh() {
    try {
      this.isUpdatingConfidence = true;
      logInfo('Starting automated full confidence refresh (like refresh API)');

      // Get current cached coins to recalculate their confidence scores
      const cachedCoins = Array.from(this.coinListCache.values());
      if (cachedCoins.length === 0) {
        logDebug('No cached coins found - nothing to recalculate confidence for');
        return;
      }

      // Process coins in batches to recalculate confidence scores
      const batchSize = 5;
      const updatedCoins: CoinListItem[] = [];

      for (let i = 0; i < cachedCoins.length; i += batchSize) {
        const batch = cachedCoins.slice(i, i + batchSize);
        const batchPromises = batch.map(async (coin) => {
          try {
            // Recalculate confidence signals for all timeframes
            const freshConfidence = await this.generateConfidenceSignals(coin.symbol);

            // Update the cached coin with new confidence data
            const updatedCoin = { ...coin, confidence: freshConfidence, lastUpdated: Date.now() };
            this.coinListCache.set(coin.symbol, updatedCoin);

            return updatedCoin;
          } catch (error) {
            logDebug(`Failed to refresh confidence for ${coin.symbol}`, error as Error);
            return coin; // Return original coin if refresh fails
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            updatedCoins.push(result.value);
          }
        });

        // Small delay between batches to respect rate limits
        if (i + batchSize < cachedCoins.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Broadcast full coin list update if real-time service is available
      if (this.realTimeService && updatedCoins.length > 0) {
        this.realTimeService.broadcastCoinListUpdate(updatedCoins);
      }

      // Check notification rules against updated coins after confidence refresh
      // Run this asynchronously to not block the confidence refresh
      setImmediate(async () => {
        try {
          await notificationRuleChecker.checkRulesAgainstCoins(updatedCoins);
          logInfo(`Notification rules checked after confidence refresh for ${updatedCoins.length} coins`);
        } catch (error) {
          logError('Error checking notification rules after confidence refresh', error as Error);
        }
      });

      logInfo(`Automated confidence refresh completed for ${updatedCoins.length} coins`);
    } catch (error) {
      logError('Error in automated confidence refresh', error as Error);
    } finally {
      this.isUpdatingConfidence = false;
    }
  }

  // Update only prices (lightweight update)
  private async updatePricesOnly() {
    try {
      this.isUpdatingPrices = true;

      const tickers = await this.binanceService.getAllTickers24hr();
      const tickerMap = new Map(tickers.map(t => [t.symbol, t]));

      // Update cached items with new prices
      const updatedCoins: any[] = [];
      for (const [symbol, coinItem] of this.coinListCache.entries()) {
        const ticker = tickerMap.get(symbol);
        if (ticker) {
          const oldPrice = coinItem.price;
          coinItem.price = parseFloat(ticker.price);
          coinItem.priceChange24h = parseFloat(ticker.priceChangePercent);
          coinItem.volume = parseFloat(ticker.volume);
          coinItem.lastUpdated = Date.now();

          // Broadcast individual price update if real-time service is available
          if (this.realTimeService && oldPrice !== coinItem.price) {
            this.realTimeService.broadcastCoinPriceUpdate(
              symbol,
              coinItem.price,
              coinItem.priceChange24h,
              coinItem.volume
            );
          }

          updatedCoins.push(coinItem);
        }
      }

      // Broadcast full coin list update if real-time service is available
      if (this.realTimeService && updatedCoins.length > 0) {
        this.realTimeService.broadcastCoinListUpdate(updatedCoins);
      }

      logDebug(`Updated prices for ${this.coinListCache.size} cached coins`);
    } catch (error) {
      logError('Error updating prices only', error as Error);
    } finally {
      this.isUpdatingPrices = false;
    }
  }

  // Update confidence levels for all cached coins
  private async updateConfidenceLevels() {
    try {
      this.isUpdatingConfidence = true;
      logDebug(`Updating confidence levels for ${this.coinListCache.size} cached coins`);

      // Process coins in batches to avoid overwhelming the API
      const coinSymbols = Array.from(this.coinListCache.keys());
      const batchSize = 5; // Smaller batch size for confidence updates

      for (let i = 0; i < coinSymbols.length; i += batchSize) {
        const batch = coinSymbols.slice(i, i + batchSize);

        const batchPromises = batch.map(async (symbol) => {
          try {
            const coinItem = this.coinListCache.get(symbol);
            if (coinItem) {
              const newConfidence = await this.generateConfidenceSignals(symbol);
              coinItem.confidence = newConfidence;
              coinItem.lastUpdated = Date.now();
            }
          } catch (error) {
            logDebug(`Failed to update confidence for ${symbol}:`, error);
          }
        });

        await Promise.allSettled(batchPromises);

        // Small delay between batches
        if (i + batchSize < coinSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Check notification rules against updated coins after confidence update
      // Run this asynchronously to not block the confidence update
      const updatedCoins = Array.from(this.coinListCache.values());
      setImmediate(async () => {
        try {
          await notificationRuleChecker.checkRulesAgainstCoins(updatedCoins);
          logInfo(`Notification rules checked after confidence update for ${updatedCoins.length} coins`);
        } catch (error) {
          logError('Error checking notification rules after confidence update', error as Error);
        }
      });

      logDebug(`Completed confidence level updates for ${coinSymbols.length} coins`);
    } catch (error) {
      logError('Error updating confidence levels', error as Error);
    } finally {
      this.isUpdatingConfidence = false;
    }
  }

  // Stop background updates
  stopBackgroundUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
    if (this.confidenceUpdateInterval) {
      clearInterval(this.confidenceUpdateInterval);
      this.confidenceUpdateInterval = null;
    }

    // Stop smart queue
    this.stopSmartQueue();

    logInfo('Stopped coin list background updates and smart queue');
  }

  // Get cached coin data
  getCachedCoin(symbol: string): CoinListItem | null {
    return this.coinListCache.get(symbol) || null;
  }

  // Clear cache
  clearCache() {
    this.coinListCache.clear();
    this.lastFullUpdate = 0;
    logInfo('Cleared coin list cache');
  }

  // Get performance statistics
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      cacheSize: this.coinListCache.size,
      lastUpdate: this.lastFullUpdate,
      uptime: Date.now() - this.lastFullUpdate
    };
  }

  // Reset performance statistics
  resetPerformanceStats() {
    this.performanceStats = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastUpdateDuration: 0,
      errorCount: 0
    };
    logInfo('Reset coin list performance statistics');
  }

  // Set real-time service for broadcasting updates
  setRealTimeService(realTimeService: any) {
    this.realTimeService = realTimeService;
    logInfo('Real-time service connected to coin list service');
  }
}
