import { BinanceService, BinanceTicker } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { serviceManager } from './serviceManager';
import { logDebug, logError, logInfo } from '../utils/logger';
import { notificationRuleChecker } from './notificationRuleChecker';
import { SUPPORTED_TIMEFRAMES } from '../config/coinConfig';

// Essential coins that should always be included in the top 50 list
const ESSENTIAL_COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT',
  'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT', 'AVAXUSDT', 'LINKUSDT'
];

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
  private readonly REAL_TIME_UPDATE_INTERVAL = 15 * 1000; // 15 seconds for optimized real-time updates

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

  // Using centralized coin configuration

  constructor() {
    // Use shared services from ServiceManager to ensure WebSocket subscriptions are shared
    this.binanceService = serviceManager.getBinanceService();
    this.technicalAnalysisService = serviceManager.getTechnicalAnalysisService();

    logInfo('🚀 CoinListService constructor called - using shared WebSocket-enabled services');

    this.startRealTimeUpdates();
  }



  // Get top 50 coins dynamically from WebSocket (called when user visits coin-list page)
  async getTop50CoinList(): Promise<CoinListItem[]> {
    const startTime = Date.now();

    try {
      // Check cache first
      const now = Date.now();
      if (cachedCoinList.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
        logInfo(`📦 Returning cached coin list (${cachedCoinList.length} coins, age: ${Math.round((now - cacheTimestamp) / 1000)}s)`);
        return cachedCoinList;
      }

      logInfo('🔄 Fetching fresh top 50 coins from Binance WebSocket');

      // Get fresh top 50 coins with their ticker data directly from WebSocket
      const coinList = await this.generateTop50CoinListFromWebSocket();

      // Always ensure BTC and ETH are included with separate WebSocket calls
      const guaranteedCoinList = await this.ensureBTCETHIncluded(coinList);

      // Subscribe to WebSocket streams for the fetched coins (only if not already subscribed)
      const symbols = guaranteedCoinList.map(coin => coin.symbol);
      await this.subscribeToCoins(symbols);

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
      logError('Error getting top 50 coin list', error as Error);
      throw error;
    }
  }

  // Legacy method - Get coin list with confidence indicators (WebSocket-only approach)
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

      // Ensure BTC and ETH are always included in real-time updates too
      const guaranteedCoins = await this.ensureBTCETHIncluded(sortedCoins);

      // Update current coin list for real-time updates
      this.currentCoinList = guaranteedCoins;
      this.performanceStats.activeCoinCount = guaranteedCoins.length;

      // Check notification rules against the updated coin list
      setImmediate(async () => {
        try {
          await notificationRuleChecker.checkRulesAgainstCoins(guaranteedCoins);
        } catch (error) {
          logError('Error checking notification rules', error as Error);
        }
      });

      logInfo(`Successfully generated ${guaranteedCoins.length} coins for real-time coin list (including guaranteed BTC/ETH)`);
      return guaranteedCoins;
    } catch (error) {
      logError('Error generating real-time coin list', error as Error);
      throw error;
    }
  }

  // Filter and prioritize coins to get top 50 established coins by volume
  private filterAndPrioritizeCoins(allTickers: any[], limit: number) {
    // Filter out excluded coins and only include high-volume coins
    const validTickers = allTickers.filter(ticker => {
      // Use local validation logic (avoid async call in filter)
      const volumeUSD = parseFloat(ticker.volume) * parseFloat(ticker.price);
      return volumeUSD > 10000000 && // $10M+ volume
             this.isValidCoin(ticker);
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

  // Generate top 50 coin list directly from WebSocket (bypasses cache limitations)
  private async generateTop50CoinListFromWebSocket(): Promise<CoinListItem[]> {
    return new Promise((resolve, reject) => {
      logInfo('🔄 Connecting to Binance WebSocket for top 50 coins...');

      const WebSocket = require('ws');
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
      let dataReceived = false;

      // Set timeout to avoid hanging
      const timeout = setTimeout(() => {
        if (!dataReceived) {
          logError('WebSocket timeout for top 50 coins');
          ws.close();
          reject(new Error('WebSocket timeout'));
        }
      }, 15000); // 15 second timeout

      ws.on('open', () => {
        logInfo('Connected to Binance WebSocket for top 50 coins');
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const tickers = JSON.parse(data.toString());

          if (Array.isArray(tickers) && tickers.length > 0) {
            dataReceived = true;
            clearTimeout(timeout);

            // Filter for USDT pairs and sort by quote volume
            const allUsdtPairs = tickers
              .filter((ticker: any) =>
                ticker.s.endsWith('USDT') &&
                this.isValidCoin({ symbol: ticker.s, volume: ticker.v, price: ticker.c }) &&
                parseFloat(ticker.q) > 1000000 // Min $1M quote volume
              )
              .sort((a: any, b: any) => parseFloat(b.q) - parseFloat(a.q)); // Sort by quote volume desc

            // Ensure essential coins are always included
            const essentialTickers = tickers.filter((ticker: any) =>
              ESSENTIAL_COINS.includes(ticker.s) &&
              this.isValidCoin({ symbol: ticker.s, volume: ticker.v, price: ticker.c })
            );

            // Find missing essential coins that weren't in the WebSocket data
            const foundEssentialSymbols = essentialTickers.map((t: any) => t.s);
            const missingEssentialCoins = ESSENTIAL_COINS.filter(symbol => !foundEssentialSymbols.includes(symbol));

            // Add missing essential coins from the full ticker data (with relaxed volume requirements)
            const missingEssentialTickers = tickers.filter((ticker: any) =>
              missingEssentialCoins.includes(ticker.s) &&
              ticker.s.endsWith('USDT') &&
              parseFloat(ticker.c) > 0 // Just ensure price is valid
            );

            // Combine essential coins (found + missing) with top volume coins
            const allEssentialTickers = [...essentialTickers, ...missingEssentialTickers];
            const combinedPairs = [...allEssentialTickers];
            const essentialSymbols = allEssentialTickers.map((t: any) => t.s);

            // Add remaining high-volume coins
            for (const ticker of allUsdtPairs) {
              if (!essentialSymbols.includes(ticker.s) && combinedPairs.length < 50) {
                combinedPairs.push(ticker);
              }
            }

            const usdtPairs = combinedPairs.slice(0, 50); // Ensure we have exactly 50

            logInfo(`📊 Processing ${usdtPairs.length} top coins from WebSocket (${allEssentialTickers.length} essential coins included)...`);
            logInfo(`🔥 Essential coins found: ${foundEssentialSymbols.join(', ')}`);
            if (missingEssentialCoins.length > 0) {
              logInfo(`⚠️ Essential coins missing from high-volume data: ${missingEssentialCoins.join(', ')}`);
              logInfo(`✅ Added missing essential coins: ${missingEssentialTickers.map((t: any) => t.s).join(', ')}`);
            }

            // Convert to CoinListItem format
            const coinList: CoinListItem[] = [];

            for (const ticker of usdtPairs) {
              try {
                const coinItem = await this.convertWebSocketTickerToCoinItem(ticker);
                if (coinItem) {
                  coinList.push(coinItem);
                }
              } catch (error) {
                logError(`Error processing ${ticker.s}:`, error as Error);
              }
            }

            logInfo(`✅ Successfully processed ${coinList.length} coins from WebSocket`);
            ws.close();
            resolve(coinList);
          }
        } catch (error) {
          logError('Error parsing WebSocket data:', error as Error);
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      });

      ws.on('error', (error: Error) => {
        logError('WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('close', () => {
        logInfo('WebSocket connection closed');
      });
    });
  }

  // Generate coin list for specific symbols (used by top 50 fetcher)
  private async generateCoinListForSymbols(symbols: string[]): Promise<CoinListItem[]> {
    const coinList: CoinListItem[] = [];

    logInfo(`🔄 Generating analysis for ${symbols.length} symbols...`);

    // Get all tickers from cache
    const allTickers = this.binanceService.getAllTickersFromCache();
    const tickerMap = new Map(allTickers.map(ticker => [ticker.symbol, ticker]));

    for (const symbol of symbols) {
      try {
        // Get ticker data from WebSocket cache
        const tickerData = tickerMap.get(symbol);

        if (tickerData) {
          const coinItem = await this.processRealTimeCoinItem(tickerData);
          if (coinItem) {
            coinList.push(coinItem);
          }
        } else {
          logDebug(`No ticker data available for ${symbol}`);
        }
      } catch (error) {
        logError(`Error processing ${symbol}:`, error as Error);
      }
    }

    // Sort by volume (USD value) - highest first (same as existing logic)
    coinList.sort((a, b) => {
      const aVolumeUSD = a.volume * a.price;
      const bVolumeUSD = b.volume * b.price;
      return bVolumeUSD - aVolumeUSD;
    });

    logInfo(`✅ Successfully generated analysis for ${coinList.length}/${symbols.length} symbols`);
    return coinList;
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

    // Start periodic confidence updates every 15 seconds
    this.realTimeUpdateInterval = setInterval(async () => {
      if (!this.isProcessingRealTimeData && this.currentCoinList.length > 0) {
        await this.updateRealTimeConfidenceSignals();
      }
    }, this.REAL_TIME_UPDATE_INTERVAL);

    logInfo('Started WebSocket-only real-time updates (15-second confidence updates, instant price updates)');
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

      // Combine original list with additional coins, ensuring we don't exceed 50
      const combinedList = [...additionalCoins, ...coinList];
      return combinedList.slice(0, 50);

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
