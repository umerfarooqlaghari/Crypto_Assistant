import axios from 'axios';
import WebSocket from 'ws';
import { logDebug, logError, logInfo } from '../utils/logger';
import { config } from '../config/config';

export interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  price: string;
  volume: string;
  priceChangePercent: string;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface BinanceTicker {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  low: string;
}

export class BinanceService {
  private baseURL = 'https://api.binance.com/api/v3';
  private wsBaseURL = 'wss://stream.binance.com:9443/ws';
  private combinedStreamURL = 'wss://stream.binance.com:9443/stream';

  // Combined WebSocket connections (6 total instead of 150+)
  private combinedTickerWS: WebSocket | null = null;
  private combinedKlineWS: Map<string, WebSocket> = new Map(); // One per timeframe

  // Legacy individual connections (kept for compatibility during transition)
  private wsConnections: Map<string, WebSocket> = new Map();

  private allTickersCache: Map<string, BinanceTicker> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private isAllTickersConnected = false;
  private allTickersSubscribers: Set<(tickers: BinanceTicker[]) => void> = new Set();

  // Kline data caching for WebSocket streams
  private klineCache: Map<string, number[][]> = new Map(); // key: symbol_timeframe, value: OHLCV array
  private klineSubscribers: Map<string, Set<(ohlcv: number[][]) => void>> = new Map();
  private klineConnections: Map<string, WebSocket> = new Map();
  private readonly MAX_KLINE_BUFFER = 65; // Keep 65 candles in buffer

  // Track API usage statistics
  private cacheHits = 0;
  private restApiCalls = 0; // Track REST API calls for monitoring

  // Tracked symbols for combined streams
  private trackedSymbols: Set<string> = new Set();
  private activeTimeframes: Set<string> = new Set();

  // Smart reconnection state
  private reconnectionState: Map<string, {
    attempts: number;
    nextDelay: number;
    lastAttempt: number;
    isReconnecting: boolean;
  }> = new Map();

  constructor() {
    this.initializeCombinedStreams();
  }

  // Smart reconnection helper methods
  private getReconnectionState(connectionKey: string) {
    if (!this.reconnectionState.has(connectionKey)) {
      this.reconnectionState.set(connectionKey, {
        attempts: 0,
        nextDelay: 1000, // Start with 1 second
        lastAttempt: 0,
        isReconnecting: false
      });
    }
    return this.reconnectionState.get(connectionKey)!;
  }

  private calculateBackoffDelay(attempts: number): number {
    // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s → 60s (max)
    const baseDelay = 1000;
    const maxDelay = 60000; // 60 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
    return delay;
  }

  private resetReconnectionState(connectionKey: string) {
    this.reconnectionState.set(connectionKey, {
      attempts: 0,
      nextDelay: 1000,
      lastAttempt: 0,
      isReconnecting: false
    });
  }

  private shouldAttemptReconnection(connectionKey: string): boolean {
    const state = this.getReconnectionState(connectionKey);
    const now = Date.now();

    // Don't attempt if already reconnecting
    if (state.isReconnecting) {
      return false;
    }

    // Don't attempt if not enough time has passed since last attempt
    if (now - state.lastAttempt < state.nextDelay) {
      return false;
    }

    // Don't attempt if too many failed attempts (max 10)
    if (state.attempts >= 10) {
      logError(`Max reconnection attempts reached for ${connectionKey}`, new Error('Max reconnection attempts'));
      return false;
    }

    return true;
  }

  // Initialize combined streams (replaces individual connections)
  private async initializeCombinedStreams() {
    try {
      logInfo('🚀 Initializing Binance Combined Streams (6 connections instead of 150+)');

      // Import the curated coins list
      const { fetchTop30CoinsFromWebSocket } = await import('../config/coinConfig');
      const curatedCoins = await fetchTop30CoinsFromWebSocket();

      // Add all curated coins to tracking
      curatedCoins.forEach(symbol => this.trackedSymbols.add(symbol));

      // Initialize combined ticker stream for all tracked symbols
      this.initializeCombinedTickerStream();

      // Initialize combined kline streams for each timeframe
      const timeframes = ['5m', '15m', '1h', '4h', '1d'];
      timeframes.forEach(timeframe => {
        this.activeTimeframes.add(timeframe);
        this.initializeCombinedKlineStream(timeframe);
      });

      logInfo(`✅ Successfully initialized combined streams for ${curatedCoins.length} coins and ${timeframes.length} timeframes`);
    } catch (error) {
      logError('Failed to initialize combined streams', error as Error);
    }
  }

  // Initialize combined ticker stream for all tracked symbols
  private initializeCombinedTickerStream() {
    if (this.trackedSymbols.size === 0) {
      logInfo('No symbols to track for ticker stream');
      return;
    }

    const symbols = Array.from(this.trackedSymbols);
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
    const streamUrl = `${this.combinedStreamURL}?streams=${streams.join('/')}`;

    logInfo(`🔌 Connecting to combined ticker stream for ${symbols.length} symbols`);

    const ws = new WebSocket(streamUrl);
    const connectionKey = 'combined_ticker';

    ws.on('open', () => {
      logInfo(`✅ Connected to combined ticker stream for ${symbols.length} symbols`);
      this.isAllTickersConnected = true;
      this.resetReconnectionState(connectionKey);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleCombinedTickerMessage(message);
      } catch (error) {
        logError('Error parsing combined ticker message', error as Error);
      }
    });

    ws.on('error', (error) => {
      logError('Combined ticker WebSocket error', error);
    });

    ws.on('close', () => {
      logInfo('Combined ticker WebSocket closed, attempting smart reconnection...');
      this.isAllTickersConnected = false;
      this.combinedTickerWS = null;
      this.attemptSmartReconnection(connectionKey, () => this.initializeCombinedTickerStream());
    });

    this.combinedTickerWS = ws;
  }

  // Initialize combined kline stream for a specific timeframe
  private initializeCombinedKlineStream(timeframe: string) {
    if (this.trackedSymbols.size === 0) {
      logInfo(`No symbols to track for ${timeframe} kline stream`);
      return;
    }

    const symbols = Array.from(this.trackedSymbols);
    const interval = this.convertTimeframeToInterval(timeframe);
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@kline_${interval}`);
    const streamUrl = `${this.combinedStreamURL}?streams=${streams.join('/')}`;

    logInfo(`🔌 Connecting to combined ${timeframe} kline stream for ${symbols.length} symbols`);

    const ws = new WebSocket(streamUrl);
    const connectionKey = `combined_kline_${timeframe}`;

    ws.on('open', () => {
      logInfo(`✅ Connected to combined ${timeframe} kline stream for ${symbols.length} symbols`);
      this.resetReconnectionState(connectionKey);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleCombinedKlineMessage(message, timeframe);
      } catch (error) {
        logError(`Error parsing combined ${timeframe} kline message`, error as Error);
      }
    });

    ws.on('error', (error) => {
      logError(`Combined ${timeframe} kline WebSocket error`, error);
    });

    ws.on('close', () => {
      logInfo(`Combined ${timeframe} kline WebSocket closed, attempting smart reconnection...`);
      this.combinedKlineWS.delete(timeframe);
      this.attemptSmartReconnection(connectionKey, () => this.initializeCombinedKlineStream(timeframe));
    });

    this.combinedKlineWS.set(timeframe, ws);
  }

  // Handle combined ticker stream messages
  private handleCombinedTickerMessage(message: any) {
    if (!message.data) {
      return;
    }

    const ticker = message.data;

    // Validate ticker data
    if (!ticker.s || !ticker.s.endsWith('USDT') ||
        ticker.s.includes('UP') || ticker.s.includes('DOWN') ||
        ticker.s.includes('BULL') || ticker.s.includes('BEAR')) {
      return;
    }

    const tickerData: BinanceTicker = {
      symbol: ticker.s,
      price: ticker.c,
      priceChangePercent: ticker.P,
      volume: ticker.v,
      high: ticker.h,
      low: ticker.l
    };

    // Update cache
    this.allTickersCache.set(ticker.s, tickerData);

    // Notify individual symbol subscribers
    this.notifySubscribers(ticker.s, tickerData);

    // No longer notify all-tickers subscribers - using individual subscriptions only
  }

  // Handle combined kline stream messages
  private handleCombinedKlineMessage(message: any, timeframe: string) {
    if (!message.data || !message.data.k) {
      return;
    }

    const klineData = message.data.k;
    const symbol = klineData.s;

    // Use existing kline update logic
    this.handleKlineUpdate(symbol, timeframe, message.data);
  }

  // Smart reconnection with exponential backoff
  private attemptSmartReconnection(connectionKey: string, reconnectFunction: () => void) {
    if (!this.shouldAttemptReconnection(connectionKey)) {
      return;
    }

    const state = this.getReconnectionState(connectionKey);
    state.isReconnecting = true;
    state.attempts++;
    state.lastAttempt = Date.now();
    state.nextDelay = this.calculateBackoffDelay(state.attempts);

    logInfo(`🔄 Attempting reconnection for ${connectionKey} (attempt ${state.attempts}, next delay: ${state.nextDelay}ms)`);

    setTimeout(() => {
      try {
        reconnectFunction();
        state.isReconnecting = false;
      } catch (error) {
        logError(`Reconnection failed for ${connectionKey}`, error as Error);
        state.isReconnecting = false;
        // Will try again based on shouldAttemptReconnection logic
      }
    }, state.nextDelay);
  }

  // Subscribe to kline data for a specific symbol and timeframe
  async subscribeToKlineData(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;

    // Don't create duplicate connections
    if (this.klineConnections.has(key)) {
      logDebug(`Already subscribed to kline data for ${symbol} ${timeframe}`);
      return;
    }

    try {
      // First, get initial historical data via REST API (one-time only)
      await this.initializeKlineBuffer(symbol, timeframe);

      // Then start WebSocket stream for real-time updates
      this.startKlineWebSocketStream(symbol, timeframe);

      logInfo(`Successfully subscribed to kline data for ${symbol} ${timeframe}`);
    } catch (error) {
      logError(`Failed to subscribe to kline data for ${symbol} ${timeframe}`, error as Error);
      throw error;
    }
  }

  // Initialize kline buffer with historical data (one-time REST API call)
  private async initializeKlineBuffer(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;

    try {
      logDebug(`Initializing kline buffer for ${symbol} ${timeframe}`);

      // Get historical data via REST API (one-time only)
      const interval = this.convertTimeframeToInterval(timeframe);
      const klines = await this.getKlines(symbol, interval, this.MAX_KLINE_BUFFER);

      // Convert to OHLCV format
      const ohlcv = klines.map(kline => [
        kline.openTime,
        parseFloat(kline.open),
        parseFloat(kline.high),
        parseFloat(kline.low),
        parseFloat(kline.close),
        parseFloat(kline.volume)
      ]);

      // Store in cache
      this.klineCache.set(key, ohlcv);

      logDebug(`Initialized kline buffer for ${symbol} ${timeframe} with ${ohlcv.length} candles`);
    } catch (error) {
      logError(`Failed to initialize kline buffer for ${symbol} ${timeframe}`, error as Error);
      throw error;
    }
  }

  // Start WebSocket stream for real-time kline updates
  private startKlineWebSocketStream(symbol: string, timeframe: string): void {
    const key = `${symbol}_${timeframe}`;
    const interval = this.convertTimeframeToInterval(timeframe);
    const wsUrl = `${this.wsBaseURL}/${symbol.toLowerCase()}@kline_${interval}`;

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logDebug(`Connected to kline WebSocket for ${symbol} ${timeframe}`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleKlineUpdate(symbol, timeframe, message);
      } catch (error) {
        logError(`Error parsing kline WebSocket message for ${symbol} ${timeframe}`, error as Error);
      }
    });

    ws.on('error', (error) => {
      logError(`Kline WebSocket error for ${symbol} ${timeframe}`, error);
    });

    ws.on('close', () => {
      logInfo(`Kline WebSocket connection closed for ${symbol} ${timeframe}, attempting smart reconnection...`);
      this.klineConnections.delete(key);

      // Use smart reconnection instead of aggressive 5-second retry
      this.attemptSmartReconnection(`kline_${key}`, () => {
        if (!this.klineConnections.has(key)) {
          this.startKlineWebSocketStream(symbol, timeframe);
        }
      });
    });

    this.klineConnections.set(key, ws);
  }

  // Handle incoming kline updates from WebSocket
  private handleKlineUpdate(symbol: string, timeframe: string, message: any): void {
    const key = `${symbol}_${timeframe}`;
    const klineData = message.k;

    if (!klineData) {
      logError(`Invalid kline data received for ${symbol} ${timeframe}`, new Error('Missing kline data'));
      return;
    }

    // Get current buffer
    const currentBuffer = this.klineCache.get(key) || [];

    // Create new OHLCV candle
    const newCandle = [
      klineData.t, // open time
      parseFloat(klineData.o), // open
      parseFloat(klineData.h), // high
      parseFloat(klineData.l), // low
      parseFloat(klineData.c), // close
      parseFloat(klineData.v)  // volume
    ];

    // Update buffer
    let updatedBuffer = [...currentBuffer];

    if (klineData.x) {
      // Kline is closed - add new candle and maintain buffer size
      updatedBuffer.push(newCandle);

      // Keep only the last MAX_KLINE_BUFFER candles
      if (updatedBuffer.length > this.MAX_KLINE_BUFFER) {
        updatedBuffer = updatedBuffer.slice(-this.MAX_KLINE_BUFFER);
      }
    } else {
      // Kline is still open - update the last candle
      if (updatedBuffer.length > 0) {
        updatedBuffer[updatedBuffer.length - 1] = newCandle;
      } else {
        updatedBuffer.push(newCandle);
      }
    }

    // Update cache
    this.klineCache.set(key, updatedBuffer);

    // Notify subscribers
    this.notifyKlineSubscribers(key, updatedBuffer);

    logDebug(`Updated kline data for ${symbol} ${timeframe}, buffer size: ${updatedBuffer.length}, closed: ${klineData.x}`);
  }

  // Get cached OHLCV data (replaces REST API calls)
  getCachedOHLCV(symbol: string, timeframe: string, limit: number = 100): number[][] {
    const key = `${symbol}_${timeframe}`;
    const cached = this.klineCache.get(key) || [];

    // Return the last 'limit' candles
    return cached.slice(-limit);
  }

  // Check if kline data is available for a symbol/timeframe
  hasKlineData(symbol: string, timeframe: string): boolean {
    const key = `${symbol}_${timeframe}`;
    const cached = this.klineCache.get(key) || [];
    return cached.length >= 50; // Minimum required for technical analysis
  }

  // Subscribe to kline data updates
  subscribeToKlineUpdates(symbol: string, timeframe: string, callback: (ohlcv: number[][]) => void): void {
    const key = `${symbol}_${timeframe}`;

    if (!this.klineSubscribers.has(key)) {
      this.klineSubscribers.set(key, new Set());
    }

    this.klineSubscribers.get(key)!.add(callback);

    // Send current data if available
    const cached = this.klineCache.get(key);
    if (cached && cached.length > 0) {
      callback(cached);
    }
  }

  // Unsubscribe from kline data updates
  unsubscribeFromKlineUpdates(symbol: string, timeframe: string, callback: (ohlcv: number[][]) => void): void {
    const key = `${symbol}_${timeframe}`;
    const subscribers = this.klineSubscribers.get(key);

    if (subscribers) {
      subscribers.delete(callback);

      // Clean up if no more subscribers
      if (subscribers.size === 0) {
        this.klineSubscribers.delete(key);

        // Optionally close WebSocket connection if no subscribers
        const ws = this.klineConnections.get(key);
        if (ws) {
          ws.close();
          this.klineConnections.delete(key);
          this.klineCache.delete(key);
          logDebug(`Closed kline WebSocket for ${symbol} ${timeframe} - no more subscribers`);
        }
      }
    }
  }

  // Notify kline subscribers
  private notifyKlineSubscribers(key: string, ohlcv: number[][]): void {
    const subscribers = this.klineSubscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(ohlcv);
        } catch (error) {
          logError(`Error notifying kline subscriber for ${key}`, error as Error);
        }
      });
    }
  }

  // Get all trading symbols from Binance
  async getAllSymbols(): Promise<BinanceSymbol[]> {
    try {
      logDebug('Fetching all Binance symbols');
      
      const [exchangeInfo, ticker24hr] = await Promise.all([
        axios.get(`${this.baseURL}/exchangeInfo`),
        axios.get(`${this.baseURL}/ticker/24hr`)
      ]);

      const symbols = exchangeInfo.data.symbols
        .filter((symbol: any) => 
          symbol.status === 'TRADING' && 
          symbol.quoteAsset === 'USDT' &&
          !symbol.symbol.includes('UP') &&
          !symbol.symbol.includes('DOWN') &&
          !symbol.symbol.includes('BULL') &&
          !symbol.symbol.includes('BEAR')
        )
        .map((symbol: any) => {
          const tickerData = ticker24hr.data.find((t: any) => t.symbol === symbol.symbol);
          return {
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset,
            quoteAsset: symbol.quoteAsset,
            status: symbol.status,
            price: tickerData?.lastPrice || '0',
            volume: tickerData?.volume || '0',
            priceChangePercent: tickerData?.priceChangePercent || '0'
          };
        })
        .sort((a: BinanceSymbol, b: BinanceSymbol) => 
          parseFloat(b.volume) - parseFloat(a.volume)
        );

      logInfo(`Fetched ${symbols.length} trading symbols from Binance`);
      return symbols;
    } catch (error) {
      logError('Error fetching Binance symbols', error as Error);
      throw error;
    }
  }

  // Get current price for a symbol (WebSocket cache only)
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Use WebSocket cache only - no REST API fallback
      const cached = this.allTickersCache.get(symbol);
      if (cached) {
        return parseFloat(cached.price);
      }

      // If no cached data, return 0 or throw error
      // The all-market tickers WebSocket should have data for all USDT pairs
      logError(`No cached price data available for ${symbol} - WebSocket may not have received data yet`);
      throw new Error(`No cached price data available for ${symbol}`);
    } catch (error) {
      logError(`Error getting cached price for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Get 24hr ticker statistics
  async getTicker24hr(symbol: string): Promise<BinanceTicker> {
    try {
      const response = await axios.get(`${this.baseURL}/ticker/24hr`, {
        params: { symbol }
      });

      const ticker: BinanceTicker = {
        symbol: response.data.symbol,
        price: response.data.lastPrice,
        priceChangePercent: response.data.priceChangePercent,
        volume: response.data.volume,
        high: response.data.highPrice,
        low: response.data.lowPrice
      };

      // Update cache
      this.allTickersCache.set(symbol, ticker);

      return ticker;
    } catch (error) {
      logError(`Error fetching 24hr ticker for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Get all tickers from WebSocket cache (replaces REST API call)
  getAllTickersFromCache(): BinanceTicker[] {
    const tickers = Array.from(this.allTickersCache.values())
      .filter(ticker =>
        ticker.symbol.endsWith('USDT') &&
        !ticker.symbol.includes('UP') &&
        !ticker.symbol.includes('DOWN') &&
        !ticker.symbol.includes('BULL') &&
        !ticker.symbol.includes('BEAR')
      )
      .sort((a: BinanceTicker, b: BinanceTicker) =>
        parseFloat(b.volume) - parseFloat(a.volume)
      );

    logDebug(`Retrieved ${tickers.length} tickers from WebSocket cache`);
    return tickers;
  }

  // Check if WebSocket data is ready
  isWebSocketDataReady(): boolean {
    return this.isAllTickersConnected && this.allTickersCache.size > 0;
  }

  // Subscribe to all tickers updates
  subscribeToAllTickers(callback: (tickers: BinanceTicker[]) => void) {
    this.allTickersSubscribers.add(callback);

    // Send current data if available
    if (this.isWebSocketDataReady()) {
      callback(this.getAllTickersFromCache());
    }
  }

  // Unsubscribe from all tickers updates
  unsubscribeFromAllTickers(callback: (tickers: BinanceTicker[]) => void) {
    this.allTickersSubscribers.delete(callback);
  }

  // Get historical klines/candlestick data with retry logic
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 100,
    startTime?: number,
    endTime?: number,
    retryCount: number = 0
  ): Promise<BinanceKline[]> {
    try {
      logDebug(`Fetching klines for ${symbol} ${interval}`);

      const params: any = {
        symbol,
        interval,
        limit
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.baseURL}/klines`, { params });

      return response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: kline[9],
        takerBuyQuoteAssetVolume: kline[10]
      }));
    } catch (error: any) {
      // Handle rate limiting with exponential backoff
      if (error.response?.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        logDebug(`Rate limited for ${symbol}, retrying in ${delay}ms (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getKlines(symbol, interval, limit, startTime, endTime, retryCount + 1);
      }

      logError(`Error fetching klines for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Convert timeframe to Binance interval
  private convertTimeframeToInterval(timeframe: string): string {
    const mapping: { [key: string]: string } = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return mapping[timeframe] || '1h';
  }

  // Get OHLCV data - now uses WebSocket cache instead of REST API
  async getOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<number[][]> {
    try {
      // First try to get from WebSocket cache
      if (this.hasKlineData(symbol, timeframe)) {
        const cachedData = this.getCachedOHLCV(symbol, timeframe, limit);
        this.cacheHits++;
        logDebug(`✅ Retrieved ${cachedData.length} OHLCV candles from WebSocket cache for ${symbol} ${timeframe} - NO REST API CALL! (Cache hits: ${this.cacheHits})`);
        return cachedData;
      }

      // If not in cache, subscribe to WebSocket and get initial data
      logDebug(`No cached data for ${symbol} ${timeframe}, initializing WebSocket subscription`);
      await this.subscribeToKlineData(symbol, timeframe);

      // Get the newly cached data
      const cachedData = this.getCachedOHLCV(symbol, timeframe, limit);
      if (cachedData.length > 0) {
        logDebug(`Retrieved ${cachedData.length} OHLCV candles after WebSocket initialization for ${symbol} ${timeframe}`);
        return cachedData;
      }

      // Fallback to REST API if WebSocket fails (should be rare)
      this.restApiCalls++;
      logError(`⚠️ WebSocket cache failed for ${symbol} ${timeframe}, falling back to REST API - THIS SHOULD BE RARE! (REST API calls: ${this.restApiCalls})`, new Error('WebSocket cache unavailable'));
      const interval = this.convertTimeframeToInterval(timeframe);
      const klines = await this.getKlines(symbol, interval, limit);

      return klines.map(kline => [
        kline.openTime,
        parseFloat(kline.open),
        parseFloat(kline.high),
        parseFloat(kline.low),
        parseFloat(kline.close),
        parseFloat(kline.volume)
      ]);
    } catch (error) {
      logError(`Error getting OHLCV for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Pre-subscribe to kline data for multiple symbols and timeframes (for coin list)
  async preSubscribeToKlineData(symbols: string[], timeframes: string[]): Promise<void> {
    logInfo(`Pre-subscribing to kline data for ${symbols.length} symbols and ${timeframes.length} timeframes`);

    const subscriptionPromises: Promise<void>[] = [];

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        subscriptionPromises.push(
          this.subscribeToKlineData(symbol, timeframe).catch(error => {
            logError(`Failed to pre-subscribe to ${symbol} ${timeframe}`, error as Error);
          })
        );
      }
    }

    // Subscribe in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < subscriptionPromises.length; i += batchSize) {
      const batch = subscriptionPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);

      // Small delay between batches to be respectful to Binance
      if (i + batchSize < subscriptionPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logInfo(`Completed pre-subscription to kline data for ${symbols.length} symbols and ${timeframes.length} timeframes`);
  }

  // Get statistics about cached kline data
  getKlineCacheStats(): { totalStreams: number; totalCandles: number; symbols: string[] } {
    const totalStreams = this.klineCache.size;
    let totalCandles = 0;
    const symbols = new Set<string>();

    for (const [key, ohlcv] of this.klineCache.entries()) {
      totalCandles += ohlcv.length;
      const symbol = key.split('_')[0];
      symbols.add(symbol);
    }

    return {
      totalStreams,
      totalCandles,
      symbols: Array.from(symbols)
    };
  }

  // Get API usage statistics
  getApiUsageStats(): { cacheHits: number; restApiCalls: number; cacheHitRate: number } {
    const total = this.cacheHits + this.restApiCalls;
    const cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      cacheHits: this.cacheHits,
      restApiCalls: this.restApiCalls,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100 // Round to 2 decimal places
    };
  }

  // Get connection statistics
  getConnectionStats(): {
    combinedStreams: number;
    legacyConnections: number;
    totalConnections: number;
    trackedSymbols: number;
    activeTimeframes: number;
    reconnectionAttempts: { [key: string]: number };
  } {
    const combinedStreams = (this.combinedTickerWS ? 1 : 0) + this.combinedKlineWS.size;
    const legacyConnections = this.wsConnections.size + this.klineConnections.size;

    const reconnectionAttempts: { [key: string]: number } = {};
    this.reconnectionState.forEach((state, key) => {
      if (state.attempts > 0) {
        reconnectionAttempts[key] = state.attempts;
      }
    });

    return {
      combinedStreams,
      legacyConnections,
      totalConnections: combinedStreams + legacyConnections,
      trackedSymbols: this.trackedSymbols.size,
      activeTimeframes: this.activeTimeframes.size,
      reconnectionAttempts
    };
  }

  // Initialize WebSocket connection for selective symbol streams (optimized approach)
  private initializeSelectiveTickersStream() {
    logInfo('Initializing Binance WebSocket selective symbol streams (bandwidth optimized)');

    // Initialize with empty set - symbols will be added dynamically
    this.trackedSymbols = new Set();
  }

  // Initialize individual ticker streams for all curated coins (eliminates all-tickers stream)
  private async initializeCuratedCoinsStreams() {
    try {
      // Import the curated coins list
      const { fetchTop30CoinsFromWebSocket } = await import('../config/coinConfig');
      const curatedCoins = await fetchTop30CoinsFromWebSocket();

      logInfo(`🚀 Initializing individual ticker streams for ${curatedCoins.length} curated coins (eliminates all-tickers bandwidth)`);

      // Add all curated coins to tracking and create individual streams
      this.addTrackedSymbols(curatedCoins);

      logInfo(`✅ Successfully set up individual ticker streams for all ${curatedCoins.length} curated coins`);
    } catch (error) {
      logError('Failed to initialize curated coins streams', error as Error);
    }
  }

  // Add symbols to be tracked via combined WebSocket streams
  public addTrackedSymbols(symbols: string[]): void {
    const newSymbols: string[] = [];

    symbols.forEach(symbol => {
      if (!this.trackedSymbols.has(symbol)) {
        this.trackedSymbols.add(symbol);
        newSymbols.push(symbol);
      }
    });

    if (newSymbols.length > 0) {
      logInfo(`🔄 Adding ${newSymbols.length} new symbols to combined streams: ${newSymbols.join(', ')}`);

      // Restart combined streams to include new symbols
      this.restartCombinedStreams();
    }
  }

  // Restart combined streams with updated symbol list
  private restartCombinedStreams(): void {
    logInfo('🔄 Restarting combined streams with updated symbol list...');

    // Close existing combined connections
    if (this.combinedTickerWS) {
      this.combinedTickerWS.close();
      this.combinedTickerWS = null;
    }

    this.combinedKlineWS.forEach((ws, timeframe) => {
      ws.close();
    });
    this.combinedKlineWS.clear();

    // Restart with new symbol list
    setTimeout(() => {
      this.initializeCombinedTickerStream();
      this.activeTimeframes.forEach(timeframe => {
        this.initializeCombinedKlineStream(timeframe);
      });
    }, 1000); // Small delay to ensure clean shutdown
  }

  // Subscribe to selective symbols using individual streams for reliability
  private subscribeToSelectiveSymbols(symbols: string[]): void {
    logInfo(`Setting up individual ticker streams for ${symbols.length} symbols`);

    // Create individual ticker streams for each symbol to avoid URL length issues
    symbols.forEach((symbol, index) => {
      // Add small delay between connections to avoid rate limiting
      setTimeout(() => {
        this.createIndividualTickerStream(symbol);
      }, index * 50); // 50ms delay between each connection
    });
  }

  // Create individual ticker stream for a single symbol
  private createIndividualTickerStream(symbol: string): void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const wsUrl = `${this.wsBaseURL}/ws/${streamName}`;
    const connectionKey = `ticker_${symbol}`;

    // Don't create duplicate connections
    if (this.wsConnections.has(connectionKey)) {
      return;
    }

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logInfo(`Connected to ticker stream for ${symbol}`);
      this.isAllTickersConnected = true; // Mark as connected for compatibility
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const ticker = JSON.parse(data.toString());

        // Handle individual ticker stream format (direct ticker data)
        if (ticker.s && ticker.s.endsWith('USDT') &&
            !ticker.s.includes('UP') &&
            !ticker.s.includes('DOWN') &&
            !ticker.s.includes('BULL') &&
            !ticker.s.includes('BEAR')) {

          const tickerData: BinanceTicker = {
            symbol: ticker.s,
            price: ticker.c,
            priceChangePercent: ticker.P,
            volume: ticker.v,
            high: ticker.h,
            low: ticker.l
          };

          // Update cache
          this.allTickersCache.set(ticker.s, tickerData);

          // Notify individual symbol subscribers
          this.notifySubscribers(ticker.s, tickerData);

          // No longer notify all-tickers subscribers - using individual subscriptions only
        }
      } catch (error) {
        logError(`Error parsing ticker WebSocket message for ${symbol}`, error as Error);
      }
    });

    ws.on('error', (error) => {
      logError(`Ticker WebSocket error for ${symbol}`, error);
    });

    ws.on('close', () => {
      logInfo(`Ticker WebSocket connection closed for ${symbol}, attempting smart reconnection...`);
      this.wsConnections.delete(connectionKey);

      // Use smart reconnection instead of aggressive 5-second retry
      this.attemptSmartReconnection(`ticker_${symbol}`, () => {
        if (!this.wsConnections.has(connectionKey)) {
          this.createIndividualTickerStream(symbol);
        }
      });
    });

    this.wsConnections.set(connectionKey, ws);
  }

  // Notify all-tickers subscribers with current cached data
  private notifyAllTickersSubscribers(): void {
    if (this.allTickersSubscribers.size > 0) {
      const cachedTickers = Array.from(this.allTickersCache.values());
      this.allTickersSubscribers.forEach(callback => {
        try {
          callback(cachedTickers);
        } catch (error) {
          logError('Error in all-tickers subscriber callback', error as Error);
        }
      });
    }
  }

  // Subscribe to individual symbol ticker
  subscribeToIndividualTicker(symbol: string) {
    const connectionKey = `ticker_${symbol}`;

    // Don't create duplicate connections
    if (this.wsConnections.has(connectionKey)) {
      return;
    }

    const wsUrl = `${this.wsBaseURL}/${symbol.toLowerCase()}@ticker`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logInfo(`Connected to Binance WebSocket for ${symbol}`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const ticker = JSON.parse(data.toString());
        logDebug(`Received ticker data for ${symbol}: ${ticker.c}`);

        const tickerData: BinanceTicker = {
          symbol: ticker.s,
          price: ticker.c,
          priceChangePercent: ticker.P,
          volume: ticker.v,
          high: ticker.h,
          low: ticker.l
        };

        // Update cache
        this.allTickersCache.set(symbol, tickerData);

        // Notify subscribers
        this.notifySubscribers(symbol, tickerData);
      } catch (error) {
        logError(`Error parsing WebSocket message for ${symbol}`, error as Error);
      }
    });

    ws.on('error', (error) => {
      logError(`Binance WebSocket error for ${symbol}`, error);
    });

    ws.on('close', () => {
      logInfo(`Binance WebSocket connection closed for ${symbol}, attempting smart reconnection...`);
      this.wsConnections.delete(connectionKey);

      // Use smart reconnection instead of aggressive 5-second retry
      this.attemptSmartReconnection(`individual_ticker_${symbol}`, () => {
        this.subscribeToIndividualTicker(symbol);
      });
    });

    this.wsConnections.set(connectionKey, ws);
  }

  // Subscribe to price updates for a specific symbol (uses combined streams)
  subscribeToPrice(symbol: string, callback: (data: BinanceTicker) => void) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      // Add symbol to tracked symbols for combined streams (no individual connections)
      this.addTrackedSymbols([symbol]);
    }
    this.subscribers.get(symbol)!.add(callback);

    // Send current cached data if available (WebSocket cache-first approach)
    const cached = this.allTickersCache.get(symbol);
    if (cached) {
      callback(cached);
    } else {
      // No REST API fallback - combined WebSocket streams will provide data when available
      logDebug(`No cached data for ${symbol} yet - combined WebSocket streams will provide data when available`);
    }
  }

  // Unsubscribe from price updates
  unsubscribeFromPrice(symbol: string, callback: (data: BinanceTicker) => void) {
    const symbolSubscribers = this.subscribers.get(symbol);
    if (symbolSubscribers) {
      symbolSubscribers.delete(callback);
      if (symbolSubscribers.size === 0) {
        this.subscribers.delete(symbol);
      }
    }
  }

  // Notify all subscribers of price updates
  private notifySubscribers(symbol: string, data: BinanceTicker) {
    const symbolSubscribers = this.subscribers.get(symbol);
    if (symbolSubscribers) {
      symbolSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logError(`Error in price update callback for ${symbol}`, error as Error);
        }
      });
    }
  }

  // Get cached price data
  getCachedPrice(symbol: string): BinanceTicker | null {
    return this.allTickersCache.get(symbol) || null;
  }

  // Close all WebSocket connections
  closeConnections() {
    // Close combined streams
    if (this.combinedTickerWS) {
      this.combinedTickerWS.close();
      this.combinedTickerWS = null;
      logInfo('Closed combined ticker WebSocket');
    }

    this.combinedKlineWS.forEach((ws, timeframe) => {
      ws.close();
      logInfo(`Closed combined ${timeframe} kline WebSocket`);
    });
    this.combinedKlineWS.clear();

    // Close legacy individual connections
    this.wsConnections.forEach((ws, key) => {
      ws.close();
      logInfo(`Closed WebSocket connection: ${key}`);
    });
    this.wsConnections.clear();

    // Close kline connections
    this.klineConnections.forEach((ws, key) => {
      ws.close();
      logInfo(`Closed kline WebSocket connection: ${key}`);
    });
    this.klineConnections.clear();

    // Clear subscribers and caches
    this.subscribers.clear();
    this.allTickersSubscribers.clear();
    this.klineSubscribers.clear();
    this.allTickersCache.clear();
    this.klineCache.clear();

    // Reset connection state
    this.isAllTickersConnected = false;
    this.reconnectionState.clear();

    logInfo('🔌 All WebSocket connections closed and caches cleared');
  }
}
