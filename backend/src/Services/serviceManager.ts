import { BinanceService } from './binanceService';
import { AdvancedTechnicalAnalysis } from './advancedTechnicalAnalysis';
import { CoinGeckoService } from './coinGeckoService';
import { logInfo, logError } from '../utils/logger';

// No pre-subscription at startup - coins will be subscribed only when user visits coin-list page

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

      // No pre-subscription at startup - WebSocket streams will be created dynamically
      // when user visits coin-list page and fresh top 50 coins are fetched

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
