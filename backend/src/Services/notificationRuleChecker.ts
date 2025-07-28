import { logInfo, logError } from '../utils/logger';
import { prismaService } from './prismaService';
import { NotificationEngine } from './notificationEngine';
import { CoinListItem } from './coinListService';

export interface NotificationRule {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  minConfidence?: number | null;
  minStrength?: number | null;
  requiredTimeframes?: number | null;
  specificTimeframes?: string[] | null;
  requiredSignalType?: string | null;
  priority: string;
  enableSound: boolean;
  enableVisual: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationRuleChecker {
  private static instance: NotificationRuleChecker;
  private lastNotificationTimes: Map<string, Date> = new Map(); // key: ruleId-symbol
  private lastNotificationValues: Map<string, any> = new Map(); // key: ruleId-symbol, value: signal values that triggered notification
  private notificationEngine: NotificationEngine;

  private constructor() {
    this.notificationEngine = new NotificationEngine();
  }

  public static getInstance(): NotificationRuleChecker {
    if (!NotificationRuleChecker.instance) {
      NotificationRuleChecker.instance = new NotificationRuleChecker();
    }
    return NotificationRuleChecker.instance;
  }

  public setSocketIO(io: any): void {
    this.notificationEngine.setSocketIO(io);
  }

  /**
   * Check all active notification rules against the provided coin list
   * This should be called whenever the coin list is refreshed
   */
  public async checkRulesAgainstCoins(coins: CoinListItem[]): Promise<void> {
    try {
      const prisma = prismaService.getClient();
      
      // Get all active notification rules
      const activeRules = await prisma.notificationRule.findMany({
        where: { isActive: true }
      });

      if (activeRules.length === 0) {
        logInfo('No active notification rules found');
        return;
      }

      logInfo(`Checking ${activeRules.length} active rules against ${coins.length} coins`);

      // Check each rule against each coin
      for (const rule of activeRules) {
        for (const coin of coins) {
          await this.checkRuleAgainstCoin(rule, coin);
        }
      }

    } catch (error) {
      logError('Error checking notification rules against coins', error as Error);
    }
  }

  /**
   * Check a specific rule against a specific coin
   */
  private async checkRuleAgainstCoin(rule: any, coin: CoinListItem): Promise<void> {
    try {
      const ruleKey = `${rule.id}-${coin.symbol}`;

      // Convert the rule to our expected format
      const typedRule: NotificationRule = {
        ...rule,
        specificTimeframes: Array.isArray(rule.specificTimeframes) ? rule.specificTimeframes : null
      };

      // Check if coin meets rule criteria
      const matchingSignals = this.evaluateRuleAgainstCoin(typedRule, coin);

      if (matchingSignals.length > 0) {
        // Check if values have changed since last notification
        if (this.hasSignificantChange(ruleKey, matchingSignals, coin)) {
          // Values have changed significantly, generate notification
          await this.generateNotification(typedRule, coin, matchingSignals);

          // Update last notification time and values
          this.lastNotificationTimes.set(ruleKey, new Date());
          this.updateLastNotificationValues(ruleKey, matchingSignals, coin);
        }
      } else {
        // Rule no longer matches, clear stored values so next match will trigger
        this.lastNotificationValues.delete(ruleKey);
      }

    } catch (error) {
      logError(`Error checking rule ${rule.name} against coin ${coin.symbol}`, error as Error);
    }
  }

  /**
   * Evaluate if a coin meets the criteria of a notification rule
   */
  private evaluateRuleAgainstCoin(rule: NotificationRule, coin: CoinListItem): Array<{timeframe: string, signal: any}> {
    const matchingSignals: Array<{timeframe: string, signal: any}> = [];

    // Determine which timeframes to check
    let timeframesToCheck: string[];
    if (rule.specificTimeframes && rule.specificTimeframes.length > 0) {
      // Use specific timeframes selected by user
      timeframesToCheck = rule.specificTimeframes;
    } else {
      // Fallback to all available timeframes for backward compatibility
      timeframesToCheck = ['1m', '5m', '15m', '1h', '4h', '1d'];
    }

    // Check each timeframe
    for (const timeframe of timeframesToCheck) {
      const signal = coin.confidence[timeframe as keyof typeof coin.confidence];

      if (!signal) continue;

      // Check signal type requirement
      if (rule.requiredSignalType && rule.requiredSignalType !== 'ANY' && signal.action !== rule.requiredSignalType) {
        continue;
      }

      // Check confidence requirement
      if (rule.minConfidence && signal.confidence < rule.minConfidence) {
        continue;
      }

      // Check strength requirement
      if (rule.minStrength && signal.strength < rule.minStrength) {
        continue;
      }

      // All criteria met for this timeframe
      matchingSignals.push({
        timeframe,
        signal
      });
    }

    // Determine required count for matching signals
    let requiredCount: number;
    if (rule.specificTimeframes && rule.specificTimeframes.length > 0) {
      // For specific timeframes, require all selected timeframes to match
      requiredCount = rule.specificTimeframes.length;
    } else {
      // Fallback to legacy requiredTimeframes field
      requiredCount = rule.requiredTimeframes || 1;
    }

    return matchingSignals.length >= requiredCount ? matchingSignals : [];
  }

  /**
   * Generate a notification when a rule is triggered
   */
  private async generateNotification(
    rule: NotificationRule, 
    coin: CoinListItem, 
    matchingSignals: Array<{timeframe: string, signal: any}>
  ): Promise<void> {
    try {
      const prisma = prismaService.getClient();

      // Calculate average confidence and strength across matching signals
      const avgConfidence = matchingSignals.reduce((sum, ms) => sum + ms.signal.confidence, 0) / matchingSignals.length;
      const avgStrength = matchingSignals.reduce((sum, ms) => sum + ms.signal.strength, 0) / matchingSignals.length;
      
      // Get the primary signal (from the first matching timeframe)
      const primarySignal = matchingSignals[0].signal;
      const primaryTimeframe = matchingSignals[0].timeframe;

      // Create notification title and message with timeframe details
      const timeframeList = matchingSignals.map(ms => ms.timeframe).join(', ');
      const title = `${rule.name}: ${coin.symbol} ${primarySignal.action} Signal`;
      const message = `${coin.symbol} meets ${rule.name} criteria with ${avgConfidence.toFixed(1)}% confidence and ${avgStrength.toFixed(1)}% strength across timeframes: ${timeframeList}`;

      // Get fresh technical analysis data for this coin and timeframe
      let technicalIndicators = null;
      let chartPatterns = null;
      let candlestickPatterns = null;
      let analysisReasoning = null;
      let currentPrice = coin.price;

      try {
        // Import the enhanced signal service to get current technical analysis
        const EnhancedSignalOrchestrator = (await import('./enhancedSignalOrchestrator')).default;
        const signalOrchestrator = new EnhancedSignalOrchestrator();

        // Get current technical analysis for the primary timeframe
        const currentAnalysis = await signalOrchestrator.processSignal(
          coin.symbol,
          primaryTimeframe,
          'binance'
        );

        if (currentAnalysis && currentAnalysis.signal) {
          const signal = currentAnalysis.signal;
          technicalIndicators = signal.technicalIndicators || null;
          chartPatterns = signal.chartPatterns || null;
          candlestickPatterns = signal.candlestickPatterns || null;
          analysisReasoning = signal.reasoning || null;
          currentPrice = signal.currentPrice || coin.price;
        }
      } catch (error) {
        logError(`Failed to get current technical analysis for ${coin.symbol}`, error as Error);

        // Fallback: try to get from recent signal in database
        const recentSignal = await prisma.signalHistory.findFirst({
          where: {
            symbol: coin.symbol,
            timeframe: primaryTimeframe
          },
          orderBy: {
            generatedAt: 'desc'
          }
        });

        if (recentSignal) {
          technicalIndicators = recentSignal.technicalIndicators;
          chartPatterns = recentSignal.chartPatterns;
          candlestickPatterns = recentSignal.candlestickPatterns;
          analysisReasoning = recentSignal.reasoning;
          currentPrice = recentSignal.currentPrice || coin.price;
        }
      }

      // Determine if this is a multi-timeframe notification
      const triggeredTimeframes = matchingSignals.map(ms => ms.timeframe);
      const isMultiTimeframe = triggeredTimeframes.length > 1;

      // For multi-timeframe notifications, collect technical analysis from all timeframes
      let multiTimeframeAnalysis: Record<string, any> | null = null;
      if (isMultiTimeframe) {
        multiTimeframeAnalysis = {};

        // Get technical analysis for each triggered timeframe
        for (const timeframe of triggeredTimeframes) {
          try {
            const EnhancedSignalOrchestrator = (await import('./enhancedSignalOrchestrator')).default;
            const signalOrchestrator = new EnhancedSignalOrchestrator();

            const analysis = await signalOrchestrator.processSignal(
              coin.symbol,
              timeframe,
              'binance'
            );

            if (analysis && analysis.signal) {
              multiTimeframeAnalysis[timeframe] = {
                technicalIndicators: analysis.signal.technicalIndicators || null,
                chartPatterns: analysis.signal.chartPatterns || null,
                candlestickPatterns: analysis.signal.candlestickPatterns || null,
                reasoning: analysis.signal.reasoning || null,
                currentPrice: analysis.signal.currentPrice || coin.price
              };
            }
          } catch (error) {
            logError(`Failed to get technical analysis for ${coin.symbol} ${timeframe}`, error as Error);
          }
        }
      }

      // Create notification in database with technical analysis data
      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          type: 'STRONG_SIGNAL',
          priority: rule.priority,
          symbol: coin.symbol,
          signal: primarySignal.action,
          confidence: avgConfidence,
          strength: avgStrength,
          timeframe: isMultiTimeframe ? 'multi' : primaryTimeframe,
          hasVisual: rule.enableVisual,
          ruleId: rule.id,
          isRead: false,
          // Store technical analysis data
          technicalIndicators: isMultiTimeframe ? multiTimeframeAnalysis : technicalIndicators,
          chartPatterns: isMultiTimeframe ? null : chartPatterns,
          candlestickPatterns: isMultiTimeframe ? null : candlestickPatterns,
          triggeredTimeframes: triggeredTimeframes,
          analysisReasoning: isMultiTimeframe ? null : analysisReasoning,
          currentPrice,
          exchange: 'binance'
        }
      });

      logInfo(`Generated notification for ${coin.symbol} using rule ${rule.name}`);

      // Send real-time notification via WebSocket if available
      if (this.notificationEngine && (this.notificationEngine as any).io) {
        const payload = {
          id: notification.id,
          title,
          message,
          type: 'STRONG_SIGNAL' as const,
          priority: rule.priority as 'LOW' | 'MEDIUM' | 'HIGH',
          hasVisual: rule.enableVisual,
          symbol: coin.symbol,
          signal: primarySignal.action,
          confidence: avgConfidence,
          strength: avgStrength,
          timeframe: primaryTimeframe,
          ruleId: rule.id,
          ruleName: rule.name,
          createdAt: notification.createdAt.toISOString()
        };

        try {
          (this.notificationEngine as any).io.emit('notification', payload);
          logInfo(`Real-time notification sent for ${coin.symbol}`);
        } catch (error) {
          logError('Error sending real-time notification', error as Error);
        }
      }

    } catch (error) {
      logError(`Error generating notification for rule ${rule.name} and coin ${coin.symbol}`, error as Error);
    }
  }

  /**
   * Check if there's a significant change in signal values since last notification
   */
  private hasSignificantChange(
    ruleKey: string,
    currentSignals: Array<{timeframe: string, signal: any}>,
    coin: CoinListItem
  ): boolean {
    const lastValues = this.lastNotificationValues.get(ruleKey);

    // If no previous values, this is the first time - trigger notification
    if (!lastValues) {
      return true;
    }

    // Check for significant changes in confidence, strength, or signal action
    const currentAvgConfidence = currentSignals.reduce((sum, ms) => sum + ms.signal.confidence, 0) / currentSignals.length;
    const currentAvgStrength = currentSignals.reduce((sum, ms) => sum + ms.signal.strength, 0) / currentSignals.length;
    const currentPrimaryAction = currentSignals[0].signal.action;

    // Define thresholds for significant change
    const CONFIDENCE_THRESHOLD = 10; // 10% change in confidence
    const STRENGTH_THRESHOLD = 10; // 10% change in strength
    const PRICE_THRESHOLD = 5; // 5% change in price

    // Check if signal action changed
    if (currentPrimaryAction !== lastValues.primaryAction) {
      logInfo(`Signal action changed for ${ruleKey}: ${lastValues.primaryAction} -> ${currentPrimaryAction}`);
      return true;
    }

    // Check if confidence changed significantly
    if (Math.abs(currentAvgConfidence - lastValues.avgConfidence) >= CONFIDENCE_THRESHOLD) {
      logInfo(`Confidence changed significantly for ${ruleKey}: ${lastValues.avgConfidence} -> ${currentAvgConfidence}`);
      return true;
    }

    // Check if strength changed significantly
    if (Math.abs(currentAvgStrength - lastValues.avgStrength) >= STRENGTH_THRESHOLD) {
      logInfo(`Strength changed significantly for ${ruleKey}: ${lastValues.avgStrength} -> ${currentAvgStrength}`);
      return true;
    }

    // Check if price changed significantly
    if (lastValues.price && Math.abs((coin.price - lastValues.price) / lastValues.price * 100) >= PRICE_THRESHOLD) {
      logInfo(`Price changed significantly for ${ruleKey}: ${lastValues.price} -> ${coin.price}`);
      return true;
    }

    // Check if number of matching timeframes changed
    if (currentSignals.length !== lastValues.matchingTimeframes) {
      logInfo(`Matching timeframes changed for ${ruleKey}: ${lastValues.matchingTimeframes} -> ${currentSignals.length}`);
      return true;
    }

    // No significant change detected
    return false;
  }

  /**
   * Update stored values for the last notification
   */
  private updateLastNotificationValues(
    ruleKey: string,
    signals: Array<{timeframe: string, signal: any}>,
    coin: CoinListItem
  ): void {
    const avgConfidence = signals.reduce((sum, ms) => sum + ms.signal.confidence, 0) / signals.length;
    const avgStrength = signals.reduce((sum, ms) => sum + ms.signal.strength, 0) / signals.length;

    this.lastNotificationValues.set(ruleKey, {
      avgConfidence,
      avgStrength,
      primaryAction: signals[0].signal.action,
      price: coin.price,
      matchingTimeframes: signals.length,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cooldown for a specific rule and symbol (useful for testing)
   */
  public clearCooldown(ruleId: string, symbol: string): void {
    const cooldownKey = `${ruleId}-${symbol}`;
    this.lastNotificationTimes.delete(cooldownKey);
    this.lastNotificationValues.delete(cooldownKey);
  }

  /**
   * Clear all cooldowns (useful for testing)
   */
  public clearAllCooldowns(): void {
    this.lastNotificationTimes.clear();
    this.lastNotificationValues.clear();
  }

  /**
   * Get cooldown status for a rule and symbol
   */
  public getCooldownStatus(ruleId: string, symbol: string): { inCooldown: boolean, remainingMs: number } {
    const cooldownKey = `${ruleId}-${symbol}`;
    const lastNotificationTime = this.lastNotificationTimes.get(cooldownKey);

    if (!lastNotificationTime) {
      return { inCooldown: false, remainingMs: 0 };
    }

    // Note: We need to get the cooldown minutes from the rule, but for now assume 30 minutes default
    const cooldownMs = 30 * 60 * 1000; // 30 minutes default
    const timeSinceLastNotification = Date.now() - lastNotificationTime.getTime();
    const remainingMs = Math.max(0, cooldownMs - timeSinceLastNotification);

    return {
      inCooldown: remainingMs > 0,
      remainingMs
    };
  }

  /**
   * Force check rules against current coin data (useful for testing)
   */
  public async forceCheckRules(): Promise<void> {
    try {
      // Get current coin data from cache
      const coinListService = require('./coinListService').CoinListService.getInstance();
      const coins = await coinListService.getCoinList(100); // Get top 100 coins

      logInfo(`Force checking notification rules against ${coins.length} coins`);
      await this.checkRulesAgainstCoins(coins);

    } catch (error) {
      logError('Error in force check rules', error as Error);
    }
  }
}

// Export singleton instance
export const notificationRuleChecker = NotificationRuleChecker.getInstance();
