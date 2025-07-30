import ConfigurableSignalService from './configurableSignalService';
import prismaService from './prismaService';
import { BinanceService } from './binanceService';
import { serviceManager } from './serviceManager';
import { logInfo, logError, logDebug } from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

export interface SignalProcessingResult {
  symbol: string;
  timeframe: string;
  signal: any;
  notifications: any[];
  saved: boolean;
  processingTimeMs: number;
}

export interface MultiTimeframeProcessingResult {
  symbol: string;
  timeframes: string[];
  multiSignal: any;
  notifications: any[];
  saved: boolean;
  processingTimeMs: number;
}

export class EnhancedSignalOrchestrator {
  private configurableSignalService: ConfigurableSignalService;
  private binanceService: BinanceService;
  private io: SocketIOServer | null = null;

  constructor(io?: SocketIOServer) {
    this.configurableSignalService = new ConfigurableSignalService();
    // Use shared BinanceService from ServiceManager to avoid duplicate WebSocket connections
    this.binanceService = serviceManager.getBinanceService();
    this.io = io || null;
  }

  public setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  // Process a single symbol and timeframe with full pipeline
  async processSignal(
    symbol: string,
    timeframe: string,
    exchange: string = 'binance'
  ): Promise<SignalProcessingResult> {
    const startTime = Date.now();
    
    try {
      logDebug(`Processing signal for ${symbol} ${timeframe}`);

      // Generate enhanced signal with configurable thresholds
      const enhancedSignal = await this.configurableSignalService.generateEnhancedSignal(
        exchange,
        symbol,
        timeframe
      );

      // Get current price for storage
      const currentPrice = await this.getCurrentPrice(symbol);

      // Save signal to database with full details
      const savedSignal = await this.saveEnhancedSignal(
        symbol,
        exchange,
        timeframe,
        enhancedSignal,
        currentPrice,
        startTime
      );

      // Notifications are handled by cron job (NotificationRuleChecker) only
      const notifications: any[] = [];

      // Emit real-time signal update
      if (this.io) {
        this.io.emit('signal-update', {
          symbol,
          timeframe,
          signal: enhancedSignal,
          notifications: notifications.length,
          timestamp: new Date().toISOString()
        });
      }

      const processingTimeMs = Date.now() - startTime;

      logInfo(`Signal processed for ${symbol} ${timeframe}`, {
        signal: enhancedSignal.signal,
        confidence: enhancedSignal.confidence,
        strength: enhancedSignal.strength,
        notifications: notifications.length,
        processingTimeMs
      });

      return {
        symbol,
        timeframe,
        signal: enhancedSignal,
        notifications,
        saved: !!savedSignal,
        processingTimeMs
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      logError(`Error processing signal for ${symbol} ${timeframe}`, error as Error);
      
      return {
        symbol,
        timeframe,
        signal: null,
        notifications: [],
        saved: false,
        processingTimeMs
      };
    }
  }

  // Process multi-timeframe analysis with full pipeline
  async processMultiTimeframeSignal(
    symbol: string,
    customTimeframes?: string[],
    exchange: string = 'binance'
  ): Promise<MultiTimeframeProcessingResult> {
    const startTime = Date.now();
    
    try {
      logDebug(`Processing multi-timeframe signal for ${symbol}`);

      // Generate enhanced multi-timeframe signal
      const multiSignal = await this.configurableSignalService.generateEnhancedMultiTimeframeSignals(
        exchange,
        symbol,
        customTimeframes
      );

      // Get current price
      const currentPrice = await this.getCurrentPrice(symbol);

      // Save individual timeframe signals
      const savedSignals = await this.saveMultiTimeframeSignals(
        symbol,
        exchange,
        multiSignal,
        currentPrice,
        startTime
      );

      // Notifications are handled by cron job (NotificationRuleChecker) only
      const notifications: any[] = [];

      // Emit real-time multi-timeframe update
      if (this.io) {
        this.io.emit('multi-timeframe-update', {
          symbol,
          multiSignal,
          notifications: notifications.length,
          timestamp: new Date().toISOString()
        });
      }

      const processingTimeMs = Date.now() - startTime;
      const timeframes = Object.keys(multiSignal.timeframes);

      logInfo(`Multi-timeframe signal processed for ${symbol}`, {
        timeframes: timeframes.length,
        consensus: multiSignal.consensusCount,
        overallSignal: multiSignal.overallSignal,
        notifications: notifications.length,
        processingTimeMs
      });

      return {
        symbol,
        timeframes,
        multiSignal,
        notifications,
        saved: savedSignals.length > 0,
        processingTimeMs
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      logError(`Error processing multi-timeframe signal for ${symbol}`, error as Error);
      
      return {
        symbol,
        timeframes: [],
        multiSignal: null,
        notifications: [],
        saved: false,
        processingTimeMs
      };
    }
  }

  // Save enhanced signal to database with full details
  private async saveEnhancedSignal(
    symbol: string,
    exchange: string,
    timeframe: string,
    signal: any,
    currentPrice: number,
    startTime: number
  ): Promise<any> {
    try {
      const signalData = {
        symbol,
        exchange,
        timeframe,
        signal: signal.signal,
        confidence: signal.confidence > 1 ? signal.confidence : signal.confidence * 100,
        strength: signal.strength,
        currentPrice,
        technicalIndicators: signal.technicalIndicators || {},
        chartPatterns: signal.chartPatterns || [],
        candlestickPatterns: signal.candlestickPatterns || [],
        reasoning: signal.reasoning || [],
        processingTimeMs: Date.now() - startTime
      };

      return await prismaService.saveSignal(signalData);
    } catch (error) {
      logError('Failed to save enhanced signal to database', error as Error);
      return null;
    }
  }

  // Save multi-timeframe signals to database
  private async saveMultiTimeframeSignals(
    symbol: string,
    exchange: string,
    multiSignal: any,
    currentPrice: number,
    startTime: number
  ): Promise<any[]> {
    try {
      const savedSignals = [];
      const processingTimeMs = Date.now() - startTime;

      for (const [timeframe, tfSignal] of Object.entries(multiSignal.timeframes)) {
        try {
          const signalData = {
            symbol,
            exchange,
            timeframe,
            signal: (tfSignal as any).signal,
            confidence: (tfSignal as any).confidence > 1 ? (tfSignal as any).confidence : (tfSignal as any).confidence * 100,
            strength: (tfSignal as any).strength,
            currentPrice,
            technicalIndicators: (tfSignal as any).technicalIndicators || {},
            reasoning: (tfSignal as any).reasoning || [],
            processingTimeMs
          };

          const saved = await prismaService.saveSignal(signalData);
          if (saved) {
            savedSignals.push(saved);
          }
        } catch (error) {
          logError(`Failed to save signal for timeframe ${timeframe}`, error as Error);
        }
      }

      return savedSignals;
    } catch (error) {
      logError('Failed to save multi-timeframe signals', error as Error);
      return [];
    }
  }

  // Get current price from exchange
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.binanceService.getTicker24hr(symbol);
      return parseFloat(ticker.price || '0');
    } catch (error) {
      logError(`Failed to get current price for ${symbol}`, error as Error);
      return 0;
    }
  }

  // Process multiple symbols in batch
  async processBatchSignals(
    symbols: string[],
    timeframe: string,
    exchange: string = 'binance'
  ): Promise<SignalProcessingResult[]> {
    const results: SignalProcessingResult[] = [];
    
    logInfo(`Processing batch signals for ${symbols.length} symbols`);

    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < symbols.length; i += concurrencyLimit) {
      const batch = symbols.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(symbol => 
        this.processSignal(symbol, timeframe, exchange)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logError('Batch signal processing failed', result.reason);
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + concurrencyLimit < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logInfo(`Batch processing completed`, {
      total: symbols.length,
      successful: results.filter(r => r.saved).length,
      notifications: results.reduce((sum, r) => sum + r.notifications.length, 0)
    });

    return results;
  }

  // Get processing statistics
  async getProcessingStats(days: number = 7): Promise<any> {
    try {
      const prisma = prismaService.getClient();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalSignals, avgProcessingTime, signalsByType, recentActivity] = await Promise.all([
        prisma.signalHistory.count({
          where: { generatedAt: { gte: startDate } }
        }),
        prisma.signalHistory.aggregate({
          _avg: { processingTimeMs: true },
          where: { generatedAt: { gte: startDate } }
        }),
        prisma.signalHistory.groupBy({
          by: ['signal'],
          _count: { signal: true },
          where: { generatedAt: { gte: startDate } }
        }),
        prisma.signalHistory.findMany({
          where: { generatedAt: { gte: startDate } },
          orderBy: { generatedAt: 'desc' },
          take: 10,
          select: {
            symbol: true,
            timeframe: true,
            signal: true,
            confidence: true,
            strength: true,
            generatedAt: true
          }
        })
      ]);

      return {
        period: `${days} days`,
        totalSignals,
        averageProcessingTimeMs: avgProcessingTime._avg.processingTimeMs || 0,
        signalDistribution: signalsByType.reduce((acc, item) => {
          acc[item.signal] = item._count.signal;
          return acc;
        }, {} as Record<string, number>),
        recentActivity
      };
    } catch (error) {
      logError('Failed to get processing statistics', error as Error);
      throw error;
    }
  }

  // Refresh configurable settings
  async refreshSettings(): Promise<void> {
    await this.configurableSignalService.refreshSettings();
    logInfo('Signal processing settings refreshed');
  }
}

export default EnhancedSignalOrchestrator;
