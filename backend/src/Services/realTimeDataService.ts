import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import cron from 'node-cron';
import { BinanceService } from './binanceService';
import { AdvancedTechnicalAnalysis, TradingSignal } from './advancedTechnicalAnalysis';
import { EarlyWarningService } from './earlyWarningService';
import { serviceManager } from './serviceManager';
import { logDebug, logError, logInfo } from '../utils/logger';
import { config } from '../config/config';

export interface RealTimeData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume: number;
  timestamp: number;
  technicalAnalysis?: {
    indicators: any;
    chartPatterns: any[];
    candlestickPatterns: any[];
    signal: TradingSignal;
  };
}

export interface ClientSubscription {
  socketId: string;
  symbols: Set<string>;
  timeframes: Set<string>;
}

export class RealTimeDataService {
  private io: SocketIOServer;
  private binanceService: BinanceService;
  private technicalAnalysis: AdvancedTechnicalAnalysis;
  private earlyWarningService: EarlyWarningService;
  private subscriptions: Map<string, ClientSubscription> = new Map();
  private activeSymbols: Set<string> = new Set();
  private dataCache: Map<string, RealTimeData> = new Map();
  private analysisCache: Map<string, any> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private earlyWarningInterval: NodeJS.Timeout | null = null;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Use shared services from ServiceManager to avoid duplicate WebSocket connections
    this.binanceService = serviceManager.getBinanceService();
    this.technicalAnalysis = serviceManager.getTechnicalAnalysisService();

    // Initialize Early Warning Service
    this.earlyWarningService = new EarlyWarningService(
      this.binanceService,
      this.technicalAnalysis,
      this.io
    );

    this.initializeSocketHandlers();
    this.startDataUpdates();
    this.startEarlyWarningAnalysis();

    logInfo('Real-time data service initialized with shared services and early warning system');
  }

  // Getter for socket.io instance
  public getSocketIO(): SocketIOServer {
    return this.io;
  }

  private initializeSocketHandlers() {
    this.io.on('connection', (socket) => {
      logInfo(`Client connected: ${socket.id}`);

      // Initialize client subscription
      this.subscriptions.set(socket.id, {
        socketId: socket.id,
        symbols: new Set(),
        timeframes: new Set(['5m', '15m', '4h'])
      });

      // Handle symbol subscription
      socket.on('subscribe', (data: { symbols: string[], timeframes?: string[] }) => {
        this.handleSubscription(socket.id, data.symbols, data.timeframes);
      });

      // Handle symbol unsubscription
      socket.on('unsubscribe', (data: { symbols: string[] }) => {
        this.handleUnsubscription(socket.id, data.symbols);
      });

      // Handle timeframe change
      socket.on('changeTimeframes', (data: { timeframes: string[] }) => {
        this.handleTimeframeChange(socket.id, data.timeframes);
      });

      // Send initial data for popular symbols
      this.sendInitialData(socket.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        logInfo(`Client disconnected: ${socket.id}`);
        this.handleDisconnection(socket.id);
      });
    });
  }

  private handleSubscription(socketId: string, symbols: string[], timeframes?: string[]) {
    const subscription = this.subscriptions.get(socketId);
    if (!subscription) return;

    const newSymbols: string[] = [];
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      subscription.symbols.add(upperSymbol);
      if (!this.activeSymbols.has(upperSymbol)) {
        newSymbols.push(upperSymbol);
      }
      this.activeSymbols.add(upperSymbol);
    });

    if (timeframes) {
      subscription.timeframes.clear();
      timeframes.forEach(tf => subscription.timeframes.add(tf));
    }

    // Subscribe to Binance WebSocket for new symbols
    if (newSymbols.length > 0) {
      this.subscribeToNewSymbols(newSymbols);
    }

    logDebug(`Client ${socketId} subscribed to: ${symbols.join(', ')}`);

    // Send current data for newly subscribed symbols
    this.sendCurrentDataToClient(socketId, symbols);
  }

  private handleUnsubscription(socketId: string, symbols: string[]) {
    const subscription = this.subscriptions.get(socketId);
    if (!subscription) return;

    symbols.forEach(symbol => {
      subscription.symbols.delete(symbol.toUpperCase());
    });

    logDebug(`Client ${socketId} unsubscribed from: ${symbols.join(', ')}`);
    
    // Clean up unused symbols
    this.cleanupUnusedSymbols();
  }

  private handleTimeframeChange(socketId: string, timeframes: string[]) {
    const subscription = this.subscriptions.get(socketId);
    if (!subscription) return;

    subscription.timeframes.clear();
    timeframes.forEach(tf => subscription.timeframes.add(tf));

    logDebug(`Client ${socketId} changed timeframes to: ${timeframes.join(', ')}`);
  }

  private handleDisconnection(socketId: string) {
    this.subscriptions.delete(socketId);
    this.cleanupUnusedSymbols();
  }

  private cleanupUnusedSymbols() {
    const usedSymbols = new Set<string>();
    this.subscriptions.forEach(sub => {
      sub.symbols.forEach(symbol => usedSymbols.add(symbol));
    });

    this.activeSymbols = usedSymbols;
  }

  private async sendInitialData(socketId: string) {
    try {
      // Send popular symbols data
      const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
      
      for (const symbol of popularSymbols) {
        const cachedData = this.dataCache.get(symbol);
        if (cachedData) {
          this.io.to(socketId).emit('priceUpdate', cachedData);
        }
      }
    } catch (error) {
      logError(`Error sending initial data to ${socketId}`, error as Error);
    }
  }

  private async sendCurrentDataToClient(socketId: string, symbols: string[]) {
    try {
      for (const symbol of symbols) {
        const cachedData = this.dataCache.get(symbol.toUpperCase());
        if (cachedData) {
          this.io.to(socketId).emit('priceUpdate', cachedData);
        } else {
          // Fetch fresh data if not cached
          await this.updateSymbolData(symbol.toUpperCase());
        }
      }
    } catch (error) {
      logError(`Error sending current data to ${socketId}`, error as Error);
    }
  }

  private startDataUpdates() {
    // REMOVED: Periodic REST API updates - now using real-time WebSocket data
    // Price data is updated in real-time via WebSocket all-market tickers stream
    // Technical analysis is triggered by WebSocket price changes (see subscribeToNewSymbols)

    // Optional: Keep a backup technical analysis update every 5 minutes for reliability
    cron.schedule('*/5 * * * *', async () => {
      await this.updateTechnicalAnalysis();
    });

    logInfo('Started real-time data updates (WebSocket-based, technical analysis: real-time + 5min backup)');
  }

  private async updateSymbolData(symbol: string) {
    try {
      // Get latest price data from WebSocket cache (no REST API calls)
      const cachedTicker = this.binanceService.getCachedPrice(symbol);

      if (!cachedTicker) {
        logDebug(`No cached data available for ${symbol} - WebSocket may not have received data yet`);
        return;
      }

      const realTimeData: RealTimeData = {
        symbol: cachedTicker.symbol,
        price: parseFloat(cachedTicker.price),
        priceChange24h: parseFloat(cachedTicker.priceChangePercent),
        volume: parseFloat(cachedTicker.volume),
        timestamp: Date.now()
      };

      // Add cached technical analysis if available
      const cachedAnalysis = this.analysisCache.get(symbol);
      if (cachedAnalysis) {
        realTimeData.technicalAnalysis = cachedAnalysis;
      }

      // Update cache
      this.dataCache.set(symbol, realTimeData);

      // Broadcast to subscribed clients
      this.broadcastToSubscribers(symbol, realTimeData);

      logDebug(`Updated symbol data for ${symbol}: $${realTimeData.price} (from WebSocket cache)`);
    } catch (error) {
      logError(`Error updating data for ${symbol}`, error as Error);
    }
  }

  private async updateTechnicalAnalysis() {
    try {
      logDebug('Updating technical analysis for active symbols');
      
      const analysisPromises = Array.from(this.activeSymbols).map(async (symbol) => {
        try {
          // Get timeframes for this symbol from subscriptions
          const timeframes = this.getTimeframesForSymbol(symbol);
          
          for (const timeframe of timeframes) {
            const indicators = await this.technicalAnalysis.calculateIndicators(
              'binance', symbol, timeframe
            );

            const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, 100);
            const chartPatterns = this.technicalAnalysis.detectChartPatterns(ohlcv, indicators);
            const candlestickPatterns = this.technicalAnalysis.detectCandlestickPatterns(ohlcv);
            
            // Get current price from WebSocket cache instead of REST API
            const cachedTicker = this.binanceService.getCachedPrice(symbol);
            const currentPrice = cachedTicker ? parseFloat(cachedTicker.price) : 0;
            const signal = this.technicalAnalysis.generateTradingSignal(
              currentPrice, indicators, chartPatterns, candlestickPatterns
            );

            const analysis = {
              timeframe,
              indicators,
              chartPatterns,
              candlestickPatterns,
              signal,
              timestamp: Date.now()
            };

            // Cache the analysis
            const cacheKey = `${symbol}-${timeframe}`;
            this.analysisCache.set(cacheKey, analysis);

            // Update real-time data with analysis
            const cachedData = this.dataCache.get(symbol);
            if (cachedData) {
              cachedData.technicalAnalysis = analysis;
              this.broadcastToSubscribers(symbol, cachedData);
            }
          }
        } catch (error) {
          logError(`Error updating technical analysis for ${symbol}`, error as Error);
        }
      });

      await Promise.allSettled(analysisPromises);
    } catch (error) {
      logError('Error in technical analysis update', error as Error);
    }
  }

  private getTimeframesForSymbol(symbol: string): string[] {
    const timeframes = new Set<string>();
    
    this.subscriptions.forEach(subscription => {
      if (subscription.symbols.has(symbol)) {
        subscription.timeframes.forEach(tf => timeframes.add(tf));
      }
    });

    return Array.from(timeframes);
  }

  private broadcastToSubscribers(symbol: string, data: RealTimeData) {
    this.subscriptions.forEach((subscription, socketId) => {
      if (subscription.symbols.has(symbol)) {
        this.io.to(socketId).emit('priceUpdate', data);
      }
    });
  }

  // Broadcast coin list updates to all connected clients
  broadcastCoinListUpdate(coinListData: any[]) {
    this.io.emit('coinListUpdate', {
      data: coinListData,
      timestamp: Date.now()
    });
    logDebug(`Broadcasted coin list update to ${this.io.sockets.sockets.size} clients`);
  }

  // Broadcast individual coin price updates for coin list
  broadcastCoinPriceUpdate(symbol: string, price: number, priceChange24h: number, volume: number) {
    this.io.emit('coinPriceUpdate', {
      symbol,
      price,
      priceChange24h,
      volume,
      timestamp: Date.now()
    });
  }

  // Broadcast individual coin confidence updates (real-time WebSocket approach)
  broadcastCoinConfidenceUpdate(coinData: any) {
    this.io.emit('coinConfidenceUpdate', {
      symbol: coinData.symbol,
      confidence: coinData.confidence,
      lastUpdated: coinData.lastUpdated,
      timestamp: Date.now()
    });
    logDebug(`Broadcasted confidence update for ${coinData.symbol} to ${this.io.sockets.sockets.size} clients`);
  }

  // Public methods for external access
  async getSymbolData(symbol: string): Promise<RealTimeData | null> {
    const cached = this.dataCache.get(symbol.toUpperCase());
    if (cached) return cached;

    // Fetch fresh data if not cached
    await this.updateSymbolData(symbol.toUpperCase());
    return this.dataCache.get(symbol.toUpperCase()) || null;
  }

  async getAvailableSymbols(): Promise<string[]> {
    try {
      const symbols = await this.binanceService.getAllSymbols();
      return symbols.map(s => s.symbol);
    } catch (error) {
      logError('Error fetching available symbols', error as Error);
      return [];
    }
  }

  getActiveSymbols(): string[] {
    return Array.from(this.activeSymbols);
  }



  // Subscribe to new symbols in Binance WebSocket
  private subscribeToNewSymbols(symbols: string[]) {
    symbols.forEach(symbol => {
      // Subscribe to individual ticker updates for the new symbol
      this.binanceService.subscribeToPrice(symbol, async (data) => {
        logDebug(`Received price update for ${symbol}: ${data.price}`);

        const realTimeData: RealTimeData = {
          symbol: data.symbol,
          price: parseFloat(data.price),
          priceChange24h: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          timestamp: Date.now()
        };

        // Update cache
        this.dataCache.set(symbol, realTimeData);

        // Trigger real-time technical analysis update for this symbol
        await this.updateTechnicalAnalysisForSymbol(symbol);

        // Broadcast to subscribed clients
        this.broadcastToSubscribers(symbol, realTimeData);
        logDebug(`Broadcasted price update for ${symbol} to clients`);
      });
    });

    logInfo(`Subscribed to real-time data for new symbols: ${symbols.join(', ')}`);
  }

  // Update technical analysis for a specific symbol (real-time)
  private async updateTechnicalAnalysisForSymbol(symbol: string) {
    try {
      // Get timeframes for this symbol from subscriptions
      const timeframes = this.getTimeframesForSymbol(symbol);

      if (timeframes.length === 0) {
        return; // No subscriptions for this symbol
      }

      for (const timeframe of timeframes) {
        try {
          const indicators = await this.technicalAnalysis.calculateIndicators(
            'binance', symbol, timeframe
          );

          const ohlcv = await this.binanceService.getOHLCV(symbol, timeframe, 100);
          const chartPatterns = this.technicalAnalysis.detectChartPatterns(ohlcv, indicators);
          const candlestickPatterns = this.technicalAnalysis.detectCandlestickPatterns(ohlcv);

          // Get current price from WebSocket cache
          const cachedTicker = this.binanceService.getCachedPrice(symbol);
          const currentPrice = cachedTicker ? parseFloat(cachedTicker.price) : 0;

          if (currentPrice > 0) {
            const signal = this.technicalAnalysis.generateTradingSignal(
              currentPrice, indicators, chartPatterns, candlestickPatterns
            );

            const analysis = {
              timeframe,
              indicators,
              chartPatterns,
              candlestickPatterns,
              signal,
              timestamp: Date.now()
            };

            // Update analysis cache
            this.analysisCache.set(`${symbol}_${timeframe}`, analysis);

            // Update real-time data with fresh technical analysis
            const realTimeData = this.dataCache.get(symbol);
            if (realTimeData) {
              realTimeData.technicalAnalysis = analysis;
              this.dataCache.set(symbol, realTimeData);

              // Broadcast updated data to clients
              this.broadcastToSubscribers(symbol, realTimeData);
            }

            logDebug(`Updated technical analysis for ${symbol} ${timeframe} in real-time`);
          }
        } catch (error) {
          logDebug(`Error updating technical analysis for ${symbol} ${timeframe}:`, error);
        }
      }
    } catch (error) {
      logError(`Error in real-time technical analysis update for ${symbol}`, error as Error);
    }
  }

  // Get the Socket.IO instance for external use
  getIO(): SocketIOServer {
    return this.io;
  }

  getConnectedClients(): number {
    return this.io.sockets.sockets.size;
  }

  // Start early warning analysis
  private startEarlyWarningAnalysis() {
    // Add default symbols for early warning analysis (top 30 coins)
    const defaultSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'SHIBUSDT',
      'AVAXUSDT', 'LTCUSDT', 'UNIUSDT', 'LINKUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT', 'BCHUSDT', 'FILUSDT', 'TRXUSDT',
      'VETUSDT', 'ICPUSDT', 'FTMUSDT', 'HBARUSDT', 'NEARUSDT', 'ALGOUSDT', 'FLOWUSDT', 'XTZUSDT', 'EGLDUSDT', 'SANDUSDT'
    ];

    // Add default symbols to active symbols for early warning analysis
    defaultSymbols.forEach(symbol => this.activeSymbols.add(symbol));
    logInfo(`Added ${defaultSymbols.length} default symbols for early warning analysis`);

    // Run early warning analysis every 30 seconds
    this.earlyWarningInterval = setInterval(async () => {
      try {
        const symbols = Array.from(this.activeSymbols);
        logDebug(`🚨 Running early warning analysis for ${symbols.length} symbols`);

        // Analyze each active symbol for early warnings
        const analysisPromises = symbols.map(async (symbol) => {
          try {
            await this.earlyWarningService.analyzeSymbol(symbol);
          } catch (error) {
            logError(`Error in early warning analysis for ${symbol}`, error as Error);
          }
        });

        await Promise.allSettled(analysisPromises);
        logDebug(`Early warning analysis completed for ${symbols.length} symbols`);

      } catch (error) {
        logError('Error in early warning analysis cycle', error as Error);
      }
    }, 30000); // 30 seconds

    logInfo('Early warning analysis started (30-second intervals)');
  }

  // Get early warning service instance
  public getEarlyWarningService(): EarlyWarningService {
    return this.earlyWarningService;
  }

  // Cleanup method
  shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.earlyWarningInterval) {
      clearInterval(this.earlyWarningInterval);
    }

    this.binanceService.closeConnections();
    this.io.close();

    logInfo('Real-time data service shut down');
  }
}
