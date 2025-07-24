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
  private wsConnections: Map<string, WebSocket> = new Map();
  private priceCache: Map<string, BinanceTicker> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.initializePriceStreams();
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
      const cached = this.priceCache.get(symbol);
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
      this.priceCache.set(symbol, ticker);

      return ticker;
    } catch (error) {
      logError(`Error fetching 24hr ticker for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Get all 24hr ticker statistics in bulk (more efficient for coin list)
  async getAllTickers24hr(): Promise<BinanceTicker[]> {
    try {
      logDebug('Fetching all 24hr tickers from Binance');

      const response = await axios.get(`${this.baseURL}/ticker/24hr`);

      const tickers: BinanceTicker[] = response.data
        .filter((ticker: any) =>
          ticker.symbol.endsWith('USDT') &&
          !ticker.symbol.includes('UP') &&
          !ticker.symbol.includes('DOWN') &&
          !ticker.symbol.includes('BULL') &&
          !ticker.symbol.includes('BEAR')
        )
        .map((ticker: any) => ({
          symbol: ticker.symbol,
          price: ticker.lastPrice,
          priceChangePercent: ticker.priceChangePercent,
          volume: ticker.volume,
          high: ticker.highPrice,
          low: ticker.lowPrice
        }))
        .sort((a: BinanceTicker, b: BinanceTicker) =>
          parseFloat(b.volume) - parseFloat(a.volume)
        );

      // Update cache for all tickers
      tickers.forEach(ticker => {
        this.priceCache.set(ticker.symbol, ticker);
      });

      logInfo(`Fetched ${tickers.length} 24hr tickers from Binance`);
      return tickers;
    } catch (error) {
      logError('Error fetching all 24hr tickers', error as Error);
      throw error;
    }
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
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return mapping[timeframe] || '1h';
  }

  // Get OHLCV data in standard format
  async getOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<number[][]> {
    try {
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

  // Initialize WebSocket connections for real-time price updates
  private initializePriceStreams() {
    logInfo('Initializing Binance WebSocket price streams');

    // Subscribe to ALL market tickers stream for comprehensive real-time data
    this.subscribeToAllMarketTickers();

    // We'll start with major pairs and add more as needed
    const majorPairs = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT',
      'XRPUSDT', 'DOTUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT'
    ];

    this.subscribeToMultipleTickers(majorPairs);
  }

  // Subscribe to real-time ticker updates for multiple symbols
  private subscribeToMultipleTickers(symbols: string[]) {
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
    const wsUrl = `${this.wsBaseURL}/${streams.join('/')}`;

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logInfo(`Connected to Binance WebSocket for ${symbols.length} symbols`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const ticker = JSON.parse(data.toString());

        if (ticker.stream && ticker.data) {
          const symbol = ticker.data.s;
          const tickerData: BinanceTicker = {
            symbol,
            price: ticker.data.c,
            priceChangePercent: ticker.data.P,
            volume: ticker.data.v,
            high: ticker.data.h,
            low: ticker.data.l
          };

          // Update cache
          this.priceCache.set(symbol, tickerData);

          // Notify subscribers
          this.notifySubscribers(symbol, tickerData);
        }
      } catch (error) {
        logError('Error parsing WebSocket message', error as Error);
      }
    });

    ws.on('error', (error) => {
      logError('Binance WebSocket error', error);
    });

    ws.on('close', () => {
      logInfo('Binance WebSocket connection closed, attempting to reconnect...');
      setTimeout(() => this.subscribeToMultipleTickers(symbols), 5000);
    });

    this.wsConnections.set('main', ws);
  }

  // Subscribe to ALL market tickers stream (replaces REST API calls)
  private subscribeToAllMarketTickers() {
    const wsUrl = `${this.wsBaseURL}/!ticker@arr`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logInfo('Connected to Binance ALL market tickers WebSocket stream');
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const tickers = JSON.parse(data.toString());

        // Process each ticker in the array
        if (Array.isArray(tickers)) {
          tickers.forEach((ticker: any) => {
            // Filter for USDT pairs and exclude leveraged tokens
            if (ticker.s.endsWith('USDT') &&
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
              this.priceCache.set(ticker.s, tickerData);

              // Notify subscribers
              this.notifySubscribers(ticker.s, tickerData);
            }
          });

          logDebug(`Processed ${tickers.length} ticker updates from all market stream`);
        }
      } catch (error) {
        logError('Error parsing all market tickers WebSocket message', error as Error);
      }
    });

    ws.on('error', (error) => {
      logError('Binance all market tickers WebSocket error', error);
    });

    ws.on('close', () => {
      logInfo('Binance all market tickers WebSocket connection closed, attempting to reconnect...');
      setTimeout(() => this.subscribeToAllMarketTickers(), 5000);
    });

    this.wsConnections.set('allTickers', ws);
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
        this.priceCache.set(symbol, tickerData);

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
      logInfo(`Binance WebSocket connection closed for ${symbol}, attempting to reconnect...`);
      this.wsConnections.delete(connectionKey);
      setTimeout(() => this.subscribeToIndividualTicker(symbol), 5000);
    });

    this.wsConnections.set(connectionKey, ws);
  }

  // Subscribe to price updates for a specific symbol
  subscribeToPrice(symbol: string, callback: (data: BinanceTicker) => void) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      // Create WebSocket connection for this symbol if it doesn't exist
      this.subscribeToIndividualTicker(symbol);
    }
    this.subscribers.get(symbol)!.add(callback);

    // Send current cached data if available (WebSocket cache-first approach)
    const cached = this.priceCache.get(symbol);
    if (cached) {
      callback(cached);
    } else {
      // No REST API fallback - WebSocket will provide data when available
      // The all-market tickers stream should have data for all USDT pairs
      logDebug(`No cached data for ${symbol} yet - WebSocket will provide data when available`);
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
    return this.priceCache.get(symbol) || null;
  }

  // Close all WebSocket connections
  closeConnections() {
    this.wsConnections.forEach((ws, key) => {
      ws.close();
      logInfo(`Closed WebSocket connection: ${key}`);
    });
    this.wsConnections.clear();
    this.subscribers.clear();
  }
}
