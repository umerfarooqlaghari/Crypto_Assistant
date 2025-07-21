import { logInfo, logError, logDebug } from '../utils/logger';

export interface Alert {
  id: string;
  userId?: string;
  symbol: string;
  type: 'PRICE' | 'SIGNAL' | 'TECHNICAL' | 'SENTIMENT';
  condition: AlertCondition;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  message: string;
  notificationMethods: ('EMAIL' | 'SMS' | 'WEBHOOK')[];
}

export interface AlertCondition {
  // Price alerts
  priceAbove?: number;
  priceBelow?: number;
  priceChange?: {
    percentage: number;
    timeframe: string;
  };
  
  // Technical alerts
  rsiAbove?: number;
  rsiBelow?: number;
  macdCrossover?: 'BULLISH' | 'BEARISH';
  
  // Signal alerts
  signalType?: 'BUY' | 'SELL';
  confidenceAbove?: number;
  
  // Sentiment alerts
  sentimentAbove?: number;
  sentimentBelow?: number;
}

export interface AlertNotification {
  alertId: string;
  message: string;
  timestamp: string;
  method: 'EMAIL' | 'SMS' | 'WEBHOOK';
  status: 'PENDING' | 'SENT' | 'FAILED';
}

export class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private notifications: AlertNotification[] = [];

  // Create a new alert
  createAlert(alertData: Omit<Alert, 'id' | 'createdAt' | 'isActive'>): Alert {
    const alert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.alerts.set(alert.id, alert);
    
    logInfo(`Alert created: ${alert.id}`, {
      symbol: alert.symbol,
      type: alert.type,
    });

    return alert;
  }

  // Update an existing alert
  updateAlert(alertId: string, updates: Partial<Alert>): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      logError(`Alert not found: ${alertId}`);
      return null;
    }

    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(alertId, updatedAlert);

    logInfo(`Alert updated: ${alertId}`, updates);
    return updatedAlert;
  }

  // Delete an alert
  deleteAlert(alertId: string): boolean {
    const deleted = this.alerts.delete(alertId);
    
    if (deleted) {
      logInfo(`Alert deleted: ${alertId}`);
    } else {
      logError(`Failed to delete alert: ${alertId}`);
    }

    return deleted;
  }

  // Get all alerts for a user
  getUserAlerts(userId?: string): Alert[] {
    const userAlerts = Array.from(this.alerts.values()).filter(
      alert => !userId || alert.userId === userId
    );

    return userAlerts;
  }

  // Get active alerts
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.isActive);
  }

  // Check if price alert should trigger
  checkPriceAlert(alert: Alert, currentPrice: number): boolean {
    const condition = alert.condition;

    if (condition.priceAbove && currentPrice > condition.priceAbove) {
      return true;
    }

    if (condition.priceBelow && currentPrice < condition.priceBelow) {
      return true;
    }

    // Price change alerts would require historical data
    if (condition.priceChange) {
      // Placeholder - implement with historical price data
      return false;
    }

    return false;
  }

  // Check if technical alert should trigger
  checkTechnicalAlert(alert: Alert, indicators: any): boolean {
    const condition = alert.condition;

    if (condition.rsiAbove && indicators.rsi > condition.rsiAbove) {
      return true;
    }

    if (condition.rsiBelow && indicators.rsi < condition.rsiBelow) {
      return true;
    }

    if (condition.macdCrossover) {
      // Check MACD crossover
      if (condition.macdCrossover === 'BULLISH' && 
          indicators.macd.macd > indicators.macd.signal) {
        return true;
      }
      if (condition.macdCrossover === 'BEARISH' && 
          indicators.macd.macd < indicators.macd.signal) {
        return true;
      }
    }

    return false;
  }

  // Check if signal alert should trigger
  checkSignalAlert(alert: Alert, signal: any): boolean {
    const condition = alert.condition;

    if (condition.signalType && signal.signal === condition.signalType) {
      if (condition.confidenceAbove) {
        return signal.confidence >= condition.confidenceAbove;
      }
      return true;
    }

    return false;
  }

  // Check if sentiment alert should trigger
  checkSentimentAlert(alert: Alert, sentiment: any): boolean {
    const condition = alert.condition;

    if (condition.sentimentAbove && sentiment.overall.score > condition.sentimentAbove) {
      return true;
    }

    if (condition.sentimentBelow && sentiment.overall.score < condition.sentimentBelow) {
      return true;
    }

    return false;
  }

  // Trigger an alert
  async triggerAlert(alert: Alert, data: any): Promise<void> {
    try {
      // Update alert as triggered
      alert.triggeredAt = new Date().toISOString();
      alert.isActive = false; // Deactivate one-time alerts
      this.alerts.set(alert.id, alert);

      // Create notification message
      const message = this.createNotificationMessage(alert, data);

      // Send notifications
      for (const method of alert.notificationMethods) {
        await this.sendNotification(alert.id, message, method);
      }

      logInfo(`Alert triggered: ${alert.id}`, {
        symbol: alert.symbol,
        type: alert.type,
        message,
      });
    } catch (error) {
      logError(`Error triggering alert: ${alert.id}`, error as Error);
    }
  }

  // Create notification message
  private createNotificationMessage(alert: Alert, data: any): string {
    switch (alert.type) {
      case 'PRICE':
        return `Price Alert: ${alert.symbol} - ${alert.message}. Current price: $${data.price}`;
      case 'SIGNAL':
        return `Signal Alert: ${alert.symbol} - ${data.signal} signal generated with ${(data.confidence * 100).toFixed(1)}% confidence`;
      case 'TECHNICAL':
        return `Technical Alert: ${alert.symbol} - ${alert.message}`;
      case 'SENTIMENT':
        return `Sentiment Alert: ${alert.symbol} - Sentiment score: ${data.sentiment.overall.score.toFixed(2)}`;
      default:
        return `Alert: ${alert.symbol} - ${alert.message}`;
    }
  }

  // Send notification
  private async sendNotification(
    alertId: string,
    message: string,
    method: 'EMAIL' | 'SMS' | 'WEBHOOK'
  ): Promise<void> {
    const notification: AlertNotification = {
      alertId,
      message,
      timestamp: new Date().toISOString(),
      method,
      status: 'PENDING',
    };

    try {
      switch (method) {
        case 'EMAIL':
          await this.sendEmailNotification(message);
          break;
        case 'SMS':
          await this.sendSMSNotification(message);
          break;
        case 'WEBHOOK':
          await this.sendWebhookNotification(message);
          break;
      }

      notification.status = 'SENT';
      logDebug(`Notification sent via ${method}`, { alertId, message });
    } catch (error) {
      notification.status = 'FAILED';
      logError(`Failed to send notification via ${method}`, error as Error, { alertId });
    }

    this.notifications.push(notification);
  }

  // Placeholder notification methods
  private async sendEmailNotification(message: string): Promise<void> {
    // Implement email sending logic (e.g., using SendGrid, AWS SES)
    logDebug('Email notification sent', { message });
  }

  private async sendSMSNotification(message: string): Promise<void> {
    // Implement SMS sending logic (e.g., using Twilio)
    logDebug('SMS notification sent', { message });
  }

  private async sendWebhookNotification(message: string): Promise<void> {
    // Implement webhook sending logic
    logDebug('Webhook notification sent', { message });
  }

  // Generate unique alert ID
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get notification history
  getNotificationHistory(alertId?: string): AlertNotification[] {
    if (alertId) {
      return this.notifications.filter(n => n.alertId === alertId);
    }
    return this.notifications;
  }
}
