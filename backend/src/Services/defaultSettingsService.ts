import prismaService from './prismaService';
import { logInfo, logError } from '../utils/logger';

export interface DefaultAdminSetting {
  key: string;
  value: string;
  type: 'number' | 'string' | 'boolean' | 'json';
  description: string;
  category: string;
}

export interface DefaultNotificationRule {
  name: string;
  description: string;
  minConfidence?: number;
  minStrength?: number;
  requiredTimeframes?: number;
  requiredSignalType?: 'BUY' | 'SELL' | 'HOLD';
  advancedConditions?: any;
  enableSound: boolean;
  enableVisual: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class DefaultSettingsService {
  private static defaultAdminSettings: DefaultAdminSetting[] = [
    // Confidence Settings
    {
      key: 'min_confidence_threshold',
      value: '70',
      type: 'number',
      description: 'Minimum confidence percentage for signals (0-100)',
      category: 'confidence'
    },
    {
      key: 'high_confidence_threshold',
      value: '85',
      type: 'number',
      description: 'High confidence threshold for priority signals (0-100)',
      category: 'confidence'
    },
    
    // Strength Settings
    {
      key: 'min_strength_threshold',
      value: '75',
      type: 'number',
      description: 'Minimum signal strength for notifications (0-100)',
      category: 'strength'
    },
    {
      key: 'high_strength_threshold',
      value: '90',
      type: 'number',
      description: 'High strength threshold for priority notifications (0-100)',
      category: 'strength'
    },
    
    // Timeframe Settings
    {
      key: 'required_timeframe_consensus',
      value: '3',
      type: 'number',
      description: 'Number of timeframes that must agree for strong signal',
      category: 'timeframe'
    },
    {
      key: 'enabled_timeframes',
      value: '["1m", "5m", "15m", "1h", "4h"]',
      type: 'json',
      description: 'List of enabled timeframes for analysis',
      category: 'timeframe'
    },
    
    // Notification Settings
    {
      key: 'enable_sound_notifications',
      value: 'true',
      type: 'boolean',
      description: 'Enable sound notifications for strong signals',
      category: 'notification'
    },
    {
      key: 'enable_visual_notifications',
      value: 'true',
      type: 'boolean',
      description: 'Enable visual notifications for strong signals',
      category: 'notification'
    },
    {
      key: 'notification_cooldown_minutes',
      value: '5',
      type: 'number',
      description: 'Cooldown period between notifications for same symbol (minutes)',
      category: 'notification'
    },
    
    // Signal Processing Settings
    {
      key: 'signal_update_interval_seconds',
      value: '10',
      type: 'number',
      description: 'Interval for signal updates in seconds',
      category: 'processing'
    },
    {
      key: 'max_signals_per_symbol',
      value: '1000',
      type: 'number',
      description: 'Maximum number of signals to store per symbol',
      category: 'processing'
    }
  ];

  private static defaultNotificationRules: DefaultNotificationRule[] = [
    {
      name: 'High Confidence Buy Signal',
      description: 'Trigger when confidence >= 85% and signal is BUY',
      minConfidence: 85,
      requiredSignalType: 'BUY',
      enableSound: true,
      enableVisual: true,
      priority: 'HIGH'
    },
    {
      name: 'High Strength Signal',
      description: 'Trigger when signal strength >= 90%',
      minStrength: 90,
      enableSound: true,
      enableVisual: true,
      priority: 'HIGH'
    },
    {
      name: 'Multi-Timeframe Consensus',
      description: 'Trigger when 3+ timeframes agree with 70%+ confidence',
      minConfidence: 70,
      requiredTimeframes: 3,
      advancedConditions: {
        type: 'timeframe_consensus',
        minAgreement: 3,
        minConfidencePerTimeframe: 70
      },
      enableSound: true,
      enableVisual: true,
      priority: 'HIGH'
    },
    {
      name: 'Strong Buy Signal',
      description: 'Trigger for BUY signals with 75%+ confidence and 80%+ strength',
      minConfidence: 75,
      minStrength: 80,
      requiredSignalType: 'BUY',
      enableSound: true,
      enableVisual: true,
      priority: 'MEDIUM'
    },
    {
      name: 'Strong Sell Signal',
      description: 'Trigger for SELL signals with 75%+ confidence and 80%+ strength',
      minConfidence: 75,
      minStrength: 80,
      requiredSignalType: 'SELL',
      enableSound: true,
      enableVisual: true,
      priority: 'MEDIUM'
    },
    {
      name: 'Medium Confidence Alert',
      description: 'Trigger for signals with 70%+ confidence',
      minConfidence: 70,
      enableSound: false,
      enableVisual: true,
      priority: 'LOW'
    }
  ];

  public static async initializeDefaultSettings(): Promise<void> {
    try {
      logInfo('Initializing default admin settings and notification rules...');

      // Initialize admin settings
      for (const setting of this.defaultAdminSettings) {
        const existing = await prismaService.getAdminSetting(setting.key);
        if (!existing) {
          await prismaService.setAdminSetting(
            setting.key,
            setting.value,
            setting.type,
            setting.description,
            setting.category
          );
          logInfo(`Created default admin setting: ${setting.key}`);
        }
      }

      // REMOVED: Default notification rules creation
      // Users can create their own notification rules through the admin panel
      // No default notification rules will be created automatically
      logInfo('Skipping default notification rules creation - users can create custom rules');

      logInfo('Default settings initialization completed');
    } catch (error) {
      logError('Failed to initialize default settings', error as Error);
      throw error;
    }
  }

  public static async initializeAdminSettingsOnly(): Promise<void> {
    try {
      logInfo('Initializing admin settings only (no notification rules)...');

      // Initialize admin settings only
      for (const setting of this.defaultAdminSettings) {
        const existing = await prismaService.getAdminSetting(setting.key);
        if (!existing) {
          await prismaService.setAdminSetting(
            setting.key,
            setting.value,
            setting.type,
            setting.description,
            setting.category
          );
          logInfo(`Created default admin setting: ${setting.key}`);
        }
      }

      logInfo('Admin settings initialization completed');
    } catch (error) {
      logError('Failed to initialize admin settings', error as Error);
      throw error;
    }
  }

  public static async resetToDefaults(): Promise<void> {
    try {
      logInfo('Resetting to default settings...');

      // Delete existing settings and rules
      const prisma = prismaService.getClient();
      await prisma.adminSettings.deleteMany({});
      await prisma.notificationRule.deleteMany({});

      // Reinitialize defaults (admin settings only, no notification rules)
      await this.initializeDefaultSettings();

      logInfo('Reset to default settings completed');
    } catch (error) {
      logError('Failed to reset to default settings', error as Error);
      throw error;
    }
  }

  public static getDefaultSettings(): DefaultAdminSetting[] {
    return [...this.defaultAdminSettings];
  }

  public static getDefaultRules(): DefaultNotificationRule[] {
    return [...this.defaultNotificationRules];
  }
}

export default DefaultSettingsService;
