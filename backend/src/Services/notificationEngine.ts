import prismaService from './prismaService';
import { EnhancedSignalResult, EnhancedMultiTimeframeSignal } from './configurableSignalService';
import { logInfo, logError, logDebug } from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  type: 'STRONG_SIGNAL' | 'ALERT' | 'WARNING';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  hasVisual: boolean;
  symbol: string;
  signal: string;
  confidence?: number;
  strength?: number;
  timeframe?: string;
  ruleId?: string;
  ruleName?: string;
  createdAt: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  minConfidence?: number | null;
  minStrength?: number | null;
  requiredTimeframes?: number | null;
  requiredSignalType?: string | null;
  advancedConditions?: any;
  enableSound: boolean;
  enableVisual: boolean;
  priority: string;
}

export class NotificationEngine {
  private io: SocketIOServer | null = null;
  private notificationCooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes default

  constructor(io?: SocketIOServer) {
    this.io = io || null;
  }

  public setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  // Evaluate a single signal against all active notification rules
  async evaluateSignal(
    signal: EnhancedSignalResult,
    symbol: string,
    timeframe: string,
    exchange: string = 'binance'
  ): Promise<NotificationPayload[]> {
    try {
      const activeRules = await prismaService.getActiveNotificationRules();
      const notifications: NotificationPayload[] = [];

      for (const rule of activeRules) {
        if (await this.shouldTriggerNotification(signal, rule, symbol, timeframe)) {
          const notification = await this.createNotification(signal, rule, symbol, timeframe);
          if (notification) {
            notifications.push(notification);
          }
        }
      }

      return notifications;
    } catch (error) {
      logError('Error evaluating signal for notifications', error as Error);
      return [];
    }
  }

  // Evaluate multi-timeframe signal against rules
  async evaluateMultiTimeframeSignal(
    multiSignal: EnhancedMultiTimeframeSignal,
    symbol: string,
    exchange: string = 'binance'
  ): Promise<NotificationPayload[]> {
    try {
      const activeRules = await prismaService.getActiveNotificationRules();
      const notifications: NotificationPayload[] = [];

      for (const rule of activeRules) {
        if (await this.shouldTriggerMultiTimeframeNotification(multiSignal, rule, symbol)) {
          const notification = await this.createMultiTimeframeNotification(multiSignal, rule, symbol);
          if (notification) {
            notifications.push(notification);
          }
        }
      }

      return notifications;
    } catch (error) {
      logError('Error evaluating multi-timeframe signal for notifications', error as Error);
      return [];
    }
  }

  // Check if a signal should trigger a notification based on a rule
  private async shouldTriggerNotification(
    signal: EnhancedSignalResult,
    rule: NotificationRule,
    symbol: string,
    timeframe: string
  ): Promise<boolean> {
    try {
      // Check cooldown
      const cooldownKey = `${rule.id}-${symbol}`;
      const lastNotification = this.notificationCooldowns.get(cooldownKey);
      const now = Date.now();
      
      if (lastNotification && (now - lastNotification) < this.COOLDOWN_DURATION) {
        logDebug(`Notification cooldown active for rule ${rule.name} and symbol ${symbol}`);
        return false;
      }

      const confidencePercent = signal.confidence > 1 ? signal.confidence : signal.confidence * 100;

      // Check basic conditions
      if (rule.minConfidence && confidencePercent < rule.minConfidence) {
        return false;
      }

      if (rule.minStrength && signal.strength < rule.minStrength) {
        return false;
      }

      if (rule.requiredSignalType && signal.signal !== rule.requiredSignalType) {
        return false;
      }

      // Check advanced conditions if present
      if (rule.advancedConditions) {
        const meetsAdvanced = await this.evaluateAdvancedConditions(
          signal,
          rule.advancedConditions,
          symbol,
          timeframe
        );
        if (!meetsAdvanced) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logError('Error checking notification trigger conditions', error as Error);
      return false;
    }
  }

  // Check if multi-timeframe signal should trigger notification
  private async shouldTriggerMultiTimeframeNotification(
    multiSignal: EnhancedMultiTimeframeSignal,
    rule: NotificationRule,
    symbol: string
  ): Promise<boolean> {
    try {
      // Check cooldown
      const cooldownKey = `${rule.id}-${symbol}-multi`;
      const lastNotification = this.notificationCooldowns.get(cooldownKey);
      const now = Date.now();
      
      if (lastNotification && (now - lastNotification) < this.COOLDOWN_DURATION) {
        return false;
      }

      // Check if rule requires timeframe consensus
      if (rule.requiredTimeframes) {
        if (multiSignal.consensusCount < rule.requiredTimeframes) {
          return false;
        }
      }

      // Check overall signal conditions
      const overallConfidencePercent = multiSignal.overallConfidence > 1 ? 
        multiSignal.overallConfidence : multiSignal.overallConfidence * 100;

      if (rule.minConfidence && overallConfidencePercent < rule.minConfidence) {
        return false;
      }

      if (rule.requiredSignalType && multiSignal.overallSignal !== rule.requiredSignalType) {
        return false;
      }

      return true;
    } catch (error) {
      logError('Error checking multi-timeframe notification trigger', error as Error);
      return false;
    }
  }

  // Evaluate advanced conditions (JSON-based rules)
  private async evaluateAdvancedConditions(
    signal: EnhancedSignalResult,
    conditions: any,
    symbol: string,
    timeframe: string
  ): Promise<boolean> {
    try {
      if (conditions.type === 'timeframe_consensus') {
        // This would require multi-timeframe analysis
        // For now, return true if basic conditions are met
        return signal.meetsThresholds;
      }

      // Add more advanced condition types as needed
      return true;
    } catch (error) {
      logError('Error evaluating advanced conditions', error as Error);
      return false;
    }
  }

  // Create notification for single signal
  private async createNotification(
    signal: EnhancedSignalResult,
    rule: NotificationRule,
    symbol: string,
    timeframe: string
  ): Promise<NotificationPayload | null> {
    try {
      const confidencePercent = signal.confidence > 1 ? signal.confidence : signal.confidence * 100;
      
      const title = `${signal.signal} Signal: ${symbol}`;
      const message = `${signal.signal} signal detected for ${symbol} (${timeframe}) with ${confidencePercent.toFixed(1)}% confidence and ${signal.strength.toFixed(1)}% strength`;

      const notificationData = {
        title,
        message,
        type: signal.isHighPriority ? 'STRONG_SIGNAL' : 'ALERT' as const,
        priority: rule.priority,
        symbol,
        signal: signal.signal,
        confidence: confidencePercent,
        strength: signal.strength,
        timeframe,
        hasVisual: rule.enableVisual,
        ruleId: rule.id
      };

      // Save to database
      const savedNotification = await prismaService.createNotification(notificationData);

      // Create payload for real-time delivery
      const payload: NotificationPayload = {
        id: savedNotification.id,
        title,
        message,
        type: notificationData.type as 'STRONG_SIGNAL' | 'ALERT' | 'WARNING',
        priority: rule.priority as 'LOW' | 'MEDIUM' | 'HIGH',

        hasVisual: rule.enableVisual,
        symbol,
        signal: signal.signal,
        confidence: confidencePercent,
        strength: signal.strength,
        timeframe,
        ruleId: rule.id,
        ruleName: rule.name,
        createdAt: savedNotification.createdAt.toISOString()
      };

      // Send real-time notification
      await this.sendRealTimeNotification(payload);

      // Update cooldown
      const cooldownKey = `${rule.id}-${symbol}`;
      this.notificationCooldowns.set(cooldownKey, Date.now());

      logInfo(`Notification created: ${title}`, { rule: rule.name, symbol, timeframe });

      return payload;
    } catch (error) {
      logError('Error creating notification', error as Error);
      return null;
    }
  }

  // Create notification for multi-timeframe signal
  private async createMultiTimeframeNotification(
    multiSignal: EnhancedMultiTimeframeSignal,
    rule: NotificationRule,
    symbol: string
  ): Promise<NotificationPayload | null> {
    try {
      const overallConfidencePercent = multiSignal.overallConfidence > 1 ? 
        multiSignal.overallConfidence : multiSignal.overallConfidence * 100;

      const title = `Multi-Timeframe ${multiSignal.overallSignal}: ${symbol}`;
      const message = `${multiSignal.overallSignal} consensus across ${multiSignal.consensusCount} timeframes for ${symbol} with ${overallConfidencePercent.toFixed(1)}% overall confidence`;

      const notificationData = {
        title,
        message,
        type: 'STRONG_SIGNAL' as const,
        priority: rule.priority,
        symbol,
        signal: multiSignal.overallSignal,
        confidence: overallConfidencePercent,
        strength: 0, // Multi-timeframe doesn't have single strength value
        timeframe: 'multi',
        hasVisual: rule.enableVisual,
        ruleId: rule.id
      };

      const savedNotification = await prismaService.createNotification(notificationData);

      const payload: NotificationPayload = {
        id: savedNotification.id,
        title,
        message,
        type: 'STRONG_SIGNAL',
        priority: rule.priority as 'LOW' | 'MEDIUM' | 'HIGH',

        hasVisual: rule.enableVisual,
        symbol,
        signal: multiSignal.overallSignal,
        confidence: overallConfidencePercent,
        strength: 0, // Multi-timeframe doesn't have single strength value
        ruleId: rule.id,
        ruleName: rule.name,
        createdAt: savedNotification.createdAt.toISOString()
      };

      await this.sendRealTimeNotification(payload);

      const cooldownKey = `${rule.id}-${symbol}-multi`;
      this.notificationCooldowns.set(cooldownKey, Date.now());

      logInfo(`Multi-timeframe notification created: ${title}`, { rule: rule.name, symbol });

      return payload;
    } catch (error) {
      logError('Error creating multi-timeframe notification', error as Error);
      return null;
    }
  }

  // Send real-time notification via WebSocket
  private async sendRealTimeNotification(payload: NotificationPayload): Promise<void> {
    try {
      if (this.io) {
        this.io.emit('notification', payload);
        logDebug('Real-time notification sent', { id: payload.id, symbol: payload.symbol });
      }
    } catch (error) {
      logError('Error sending real-time notification', error as Error);
    }
  }

  // Clear notification cooldowns (for testing or admin purposes)
  public clearCooldowns(): void {
    this.notificationCooldowns.clear();
    logInfo('Notification cooldowns cleared');
  }

  // Get cooldown status for a symbol and rule
  public getCooldownStatus(ruleId: string, symbol: string): { isActive: boolean; remainingMs: number } {
    const cooldownKey = `${ruleId}-${symbol}`;
    const lastNotification = this.notificationCooldowns.get(cooldownKey);
    
    if (!lastNotification) {
      return { isActive: false, remainingMs: 0 };
    }

    const now = Date.now();
    const remainingMs = Math.max(0, this.COOLDOWN_DURATION - (now - lastNotification));
    
    return {
      isActive: remainingMs > 0,
      remainingMs
    };
  }
}

export default NotificationEngine;
