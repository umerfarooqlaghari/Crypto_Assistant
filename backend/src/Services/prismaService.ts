import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';

class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logInfo('Database connected successfully');
    } catch (error) {
      logError('Failed to connect to database', error as Error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logInfo('Database disconnected successfully');
    } catch (error) {
      logError('Failed to disconnect from database', error as Error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logError('Database health check failed', error as Error);
      return false;
    }
  }

  // Admin Settings methods
  public async getAdminSetting(key: string) {
    return this.prisma.adminSettings.findUnique({
      where: { settingKey: key }
    });
  }

  public async setAdminSetting(key: string, value: string, type: string, description?: string, category?: string) {
    return this.prisma.adminSettings.upsert({
      where: { settingKey: key },
      update: { 
        settingValue: value, 
        settingType: type, 
        description, 
        category,
        updatedAt: new Date()
      },
      create: { 
        settingKey: key, 
        settingValue: value, 
        settingType: type, 
        description, 
        category: category || 'general'
      }
    });
  }

  public async getAllAdminSettings(category?: string) {
    return this.prisma.adminSettings.findMany({
      where: category ? { category } : undefined,
      orderBy: { category: 'asc' }
    });
  }

  // Notification Rules methods
  public async getActiveNotificationRules() {
    return this.prisma.notificationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    });
  }

  public async createNotificationRule(data: any) {
    return this.prisma.notificationRule.create({
      data
    });
  }

  public async updateNotificationRule(id: string, data: any) {
    return this.prisma.notificationRule.update({
      where: { id },
      data
    });
  }

  public async deleteNotificationRule(id: string) {
    return this.prisma.notificationRule.delete({
      where: { id }
    });
  }

  // Signal History methods
  public async saveSignal(signalData: any) {
    return this.prisma.signalHistory.create({
      data: signalData
    });
  }

  public async getSignalHistory(symbol?: string, timeframe?: string, limit: number = 100) {
    return this.prisma.signalHistory.findMany({
      where: {
        ...(symbol && { symbol }),
        ...(timeframe && { timeframe })
      },
      orderBy: { generatedAt: 'desc' },
      take: limit
    });
  }

  // Notification methods
  public async createNotification(data: any) {
    return this.prisma.notification.create({
      data,
      include: {
        rule: true,
        signalHistory: true
      }
    });
  }

  public async getUnreadNotifications() {
    return this.prisma.notification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
        signalHistory: true
      }
    });
  }

  public async markNotificationAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { 
        isRead: true, 
        readAt: new Date() 
      }
    });
  }
}

export const prismaService = PrismaService.getInstance();
export default prismaService;
