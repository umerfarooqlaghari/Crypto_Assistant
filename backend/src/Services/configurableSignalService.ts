import prismaService from './prismaService';
import { SignalAnalysisService, SignalResult, MultiTimeframeSignal } from './signalAnalysisService';
import { logInfo, logError, logDebug } from '../utils/logger';

export interface ConfigurableSignalSettings {
  minConfidenceThreshold: number;
  highConfidenceThreshold: number;
  minStrengthThreshold: number;
  highStrengthThreshold: number;
  requiredTimeframeConsensus: number;
  enabledTimeframes: string[];
  signalUpdateIntervalSeconds: number;
}

export interface EnhancedSignalResult extends SignalResult {
  meetsThresholds: boolean;
  isHighPriority: boolean;
  configuredSettings: ConfigurableSignalSettings;
}

export interface EnhancedMultiTimeframeSignal extends MultiTimeframeSignal {
  meetsConsensusThreshold: boolean;
  consensusCount: number;
  highConfidenceCount: number;
  configuredSettings: ConfigurableSignalSettings;
}

export class ConfigurableSignalService {
  private signalAnalysisService: SignalAnalysisService;
  private cachedSettings: ConfigurableSignalSettings | null = null;
  private settingsCacheExpiry: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute

  constructor() {
    this.signalAnalysisService = new SignalAnalysisService();
  }

  // Get configurable settings from database with caching
  private async getSettings(): Promise<ConfigurableSignalSettings> {
    const now = Date.now();
    
    // Return cached settings if still valid
    if (this.cachedSettings && now < this.settingsCacheExpiry) {
      return this.cachedSettings;
    }

    try {
      const [
        minConfidence,
        highConfidence,
        minStrength,
        highStrength,
        requiredConsensus,
        enabledTimeframes,
        updateInterval
      ] = await Promise.all([
        prismaService.getAdminSetting('min_confidence_threshold'),
        prismaService.getAdminSetting('high_confidence_threshold'),
        prismaService.getAdminSetting('min_strength_threshold'),
        prismaService.getAdminSetting('high_strength_threshold'),
        prismaService.getAdminSetting('required_timeframe_consensus'),
        prismaService.getAdminSetting('enabled_timeframes'),
        prismaService.getAdminSetting('signal_update_interval_seconds')
      ]);

      this.cachedSettings = {
        minConfidenceThreshold: parseFloat(minConfidence?.settingValue || '70'),
        highConfidenceThreshold: parseFloat(highConfidence?.settingValue || '85'),
        minStrengthThreshold: parseFloat(minStrength?.settingValue || '75'),
        highStrengthThreshold: parseFloat(highStrength?.settingValue || '90'),
        requiredTimeframeConsensus: parseInt(requiredConsensus?.settingValue || '3'),
        enabledTimeframes: enabledTimeframes ? JSON.parse(enabledTimeframes.settingValue) : ['5m', '15m', '30m', '1h', '4h'],
        signalUpdateIntervalSeconds: parseInt(updateInterval?.settingValue || '10')
      };

      this.settingsCacheExpiry = now + this.CACHE_DURATION;
      
      logDebug('Loaded configurable signal settings', this.cachedSettings);
      return this.cachedSettings;
    } catch (error) {
      logError('Failed to load configurable settings, using defaults', error as Error);
      
      // Return default settings if database fails
      this.cachedSettings = {
        minConfidenceThreshold: 70,
        highConfidenceThreshold: 85,
        minStrengthThreshold: 75,
        highStrengthThreshold: 90,
        requiredTimeframeConsensus: 3,
        enabledTimeframes: ['5m', '15m', '30m', '1h', '4h'],
        signalUpdateIntervalSeconds: 10
      };

      return this.cachedSettings;
    }
  }

  // Clear settings cache to force reload
  public clearSettingsCache(): void {
    this.cachedSettings = null;
    this.settingsCacheExpiry = 0;
  }

  // Generate enhanced signal with configurable thresholds
  async generateEnhancedSignal(
    exchange: string,
    symbol: string,
    timeframe: string = '1h'
  ): Promise<EnhancedSignalResult> {
    try {
      const settings = await this.getSettings();
      const baseSignal = await this.signalAnalysisService.generateTechnicalSignals(exchange, symbol, timeframe);

      // Convert confidence to percentage if it's in decimal format
      const confidencePercent = baseSignal.confidence > 1 ? baseSignal.confidence : baseSignal.confidence * 100;

      // Check if signal meets configured thresholds
      const meetsThresholds = 
        confidencePercent >= settings.minConfidenceThreshold &&
        baseSignal.strength >= settings.minStrengthThreshold;

      const isHighPriority = 
        confidencePercent >= settings.highConfidenceThreshold &&
        baseSignal.strength >= settings.highStrengthThreshold;

      const enhancedSignal: EnhancedSignalResult = {
        ...baseSignal,
        confidence: confidencePercent / 100, // Keep as decimal for consistency
        meetsThresholds,
        isHighPriority,
        configuredSettings: settings
      };

      // Save signal to database
      await this.saveSignalToDatabase(symbol, exchange, timeframe, enhancedSignal);

      logDebug(`Enhanced signal generated for ${symbol}`, {
        signal: enhancedSignal.signal,
        confidence: confidencePercent,
        strength: enhancedSignal.strength,
        meetsThresholds,
        isHighPriority
      });

      return enhancedSignal;
    } catch (error) {
      logError(`Error generating enhanced signal for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Generate multi-timeframe analysis with configurable consensus
  async generateEnhancedMultiTimeframeSignals(
    exchange: string,
    symbol: string,
    customTimeframes?: string[]
  ): Promise<EnhancedMultiTimeframeSignal> {
    try {
      const settings = await this.getSettings();
      const timeframes = customTimeframes || settings.enabledTimeframes;

      const baseMultiSignal = await this.signalAnalysisService.generateMultiTimeframeSignals(
        exchange,
        symbol,
        timeframes
      );

      // Analyze consensus based on configurable thresholds
      const timeframeResults = Object.values(baseMultiSignal.timeframes);
      const confidencePercents = timeframeResults.map(tf => tf.confidence > 1 ? tf.confidence : tf.confidence * 100);
      
      const meetsThresholdCount = timeframeResults.filter(tf => {
        const confidencePercent = tf.confidence > 1 ? tf.confidence : tf.confidence * 100;
        return confidencePercent >= settings.minConfidenceThreshold && tf.strength >= settings.minStrengthThreshold;
      }).length;

      const highConfidenceCount = timeframeResults.filter(tf => {
        const confidencePercent = tf.confidence > 1 ? tf.confidence : tf.confidence * 100;
        return confidencePercent >= settings.highConfidenceThreshold;
      }).length;

      const meetsConsensusThreshold = meetsThresholdCount >= settings.requiredTimeframeConsensus;

      const enhancedMultiSignal: EnhancedMultiTimeframeSignal = {
        ...baseMultiSignal,
        meetsConsensusThreshold,
        consensusCount: meetsThresholdCount,
        highConfidenceCount,
        configuredSettings: settings
      };

      logDebug(`Enhanced multi-timeframe signal generated for ${symbol}`, {
        consensusCount: meetsThresholdCount,
        requiredConsensus: settings.requiredTimeframeConsensus,
        meetsThreshold: meetsConsensusThreshold,
        highConfidenceCount
      });

      return enhancedMultiSignal;
    } catch (error) {
      logError(`Error generating enhanced multi-timeframe signals for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Save signal to database for historical tracking
  private async saveSignalToDatabase(
    symbol: string,
    exchange: string,
    timeframe: string,
    signal: EnhancedSignalResult
  ): Promise<void> {
    try {
      const signalData = {
        symbol,
        exchange,
        timeframe,
        signal: signal.signal,
        confidence: signal.confidence * 100, // Store as percentage
        strength: signal.strength,
        currentPrice: 0, // Will be updated with actual price
        technicalIndicators: signal.technicalIndicators || {},
        reasoning: signal.reasoning || [],
        processingTimeMs: 0 // Could be calculated if needed
      };

      await prismaService.saveSignal(signalData);
    } catch (error) {
      logError('Failed to save signal to database', error as Error);
      // Don't throw error to avoid breaking signal generation
    }
  }

  // Get current settings (for API responses)
  async getCurrentSettings(): Promise<ConfigurableSignalSettings> {
    return this.getSettings();
  }

  // Update settings cache when settings change
  async refreshSettings(): Promise<ConfigurableSignalSettings> {
    this.clearSettingsCache();
    return this.getSettings();
  }
}

export default ConfigurableSignalService;
