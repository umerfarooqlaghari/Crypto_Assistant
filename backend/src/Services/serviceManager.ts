import { BinanceService } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { CoinGeckoService } from './coinGeckoService';
import { logInfo, logError } from '../utils/logger';

/**
 * Service Manager - Singleton pattern to ensure all parts of the application
 * use the same WebSocket-enabled service instances
 */
class ServiceManager {
  private static instance: ServiceManager;
  private _binanceService: BinanceService | null = null;
  private _technicalAnalysisService: AdvancedTechnicalAnalysis | null = null;
  private _coinGeckoService: CoinGeckoService | null = null;
  private _initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  // Initialize all services with WebSocket subscriptions
  public async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      logInfo('Initializing shared services with WebSocket support');

      // Create BinanceService instance
      this._binanceService = new BinanceService();

      // Create AdvancedTechnicalAnalysis with shared BinanceService
      this._technicalAnalysisService = new AdvancedTechnicalAnalysis(this._binanceService);

      // Create CoinGeckoService
      this._coinGeckoService = new CoinGeckoService();

      // Pre-subscribe to kline data for established coins and timeframes
      const ESTABLISHED_COINS = [
        // Top 10 by market cap
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'POLUSDT',
        // Top 20 by market cap
        'AVAXUSDT', 'SHIBUSDT', 'LINKUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT', 'BCHUSDT',
        // Top 30 by market cap
        'FILUSDT', 'APTUSDT', 'NEARUSDT', 'VETUSDT', 'ICPUSDT', 'ALGOUSDT', 'QNTUSDT', 'HBARUSDT', 'EGLDUSDT', 'SANDUSDT',
        // Top 40 by market cap
        'MANAUSDT', 'AXSUSDT', 'THETAUSDT', 'FLOWUSDT', 'XTZUSDT', 'AAVEUSDT', 'EOSUSDT', 'KLAYUSDT', 'CHZUSDT', 'GALAUSDT',
        // Top 50 by market cap
        'ENJUSDT', 'MKRUSDT', 'SNXUSDT', 'GRTUSDT', 'LRCUSDT', 'BATUSDT', 'COMPUSDT', 'YFIUSDT', 'SUSHIUSDT', 'CRVUSDT'
      ];

      const TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];

      await (this._binanceService as any).preSubscribeToKlineData(ESTABLISHED_COINS, TIMEFRAMES);

      this._initialized = true;
      logInfo('Successfully initialized shared services with WebSocket support');

      // Log cache statistics
      const stats = (this._binanceService as any).getKlineCacheStats();
      logInfo(`Shared service kline cache: ${stats.totalStreams} streams, ${stats.totalCandles} total candles, ${stats.symbols.length} symbols`);
    } catch (error) {
      logError('Failed to initialize shared services', error as Error);
      throw error;
    }
  }

  // Get BinanceService instance
  public getBinanceService(): BinanceService {
    if (!this._binanceService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._binanceService;
  }

  // Get AdvancedTechnicalAnalysis instance
  public getTechnicalAnalysisService(): AdvancedTechnicalAnalysis {
    if (!this._technicalAnalysisService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._technicalAnalysisService;
  }

  // Get CoinGeckoService instance
  public getCoinGeckoService(): CoinGeckoService {
    if (!this._coinGeckoService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._coinGeckoService;
  }

  // Check if services are initialized
  public isInitialized(): boolean {
    return this._initialized;
  }

  // Get service statistics
  public getStats(): {
    initialized: boolean;
    klineCache?: { totalStreams: number; totalCandles: number; symbols: string[] };
  } {
    const stats: any = {
      initialized: this._initialized
    };

    if (this._binanceService) {
      stats.klineCache = (this._binanceService as any).getKlineCacheStats();
    }

    return stats;
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();

// Export convenience functions
export const getBinanceService = (): BinanceService => serviceManager.getBinanceService();
export const getTechnicalAnalysisService = (): AdvancedTechnicalAnalysis => serviceManager.getTechnicalAnalysisService();
export const getCoinGeckoService = (): CoinGeckoService => serviceManager.getCoinGeckoService();
