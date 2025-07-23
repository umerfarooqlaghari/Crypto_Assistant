import { Request, Response } from 'express';
import prismaService from '../Services/prismaService';
import { logInfo, logError } from '../utils/logger';

// Get all notifications
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { unread, limit = 50, offset = 0 } = req.query;
    const prisma = prismaService.getClient();
    
    const where = unread === 'true' ? { isRead: false } : {};
    
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          rule: true,
          signalHistory: {
            select: {
              symbol: true,
              timeframe: true,
              signal: true,
              confidence: true,
              strength: true,
              currentPrice: true
            }
          }
        }
      }),
      prisma.notification.count({ where })
    ]);
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + parseInt(limit as string)
      }
    });
  } catch (error) {
    logError('Error fetching notifications', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
};

// Get unread notifications count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = prismaService.getClient();
    const count = await prisma.notification.count({
      where: { isRead: false }
    });
    
    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    logError('Error fetching unread count', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const notification = await prismaService.markNotificationAsRead(id);
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    logError('Error marking notification as read', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = prismaService.getClient();

    const result = await prisma.notification.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    logInfo(`Marked ${result.count} notifications as read`);

    res.json({
      success: true,
      data: { updatedCount: result.count }
    });
  } catch (error) {
    logError('Error marking all notifications as read', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
};

// Get single notification with full details
export const getNotificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prisma = prismaService.getClient();

    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            description: true,
            minConfidence: true,
            minStrength: true,
            requiredTimeframes: true,
            requiredSignalType: true
          }
        },
        signalHistory: {
          select: {
            id: true,
            symbol: true,
            exchange: true,
            timeframe: true,
            signal: true,
            confidence: true,
            strength: true,
            currentPrice: true,
            technicalIndicators: true,
            chartPatterns: true,
            candlestickPatterns: true,
            reasoning: true,
            generatedAt: true,
            processingTimeMs: true
          }
        }
      }
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
      return;
    }

    // Transform the data to match frontend interface
    const transformedNotification = {
      ...notification,
      signalData: notification.signalHistory
    };

    res.json({
      success: true,
      data: transformedNotification
    });
  } catch (error) {
    logError('Error fetching notification by ID', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification details'
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prisma = prismaService.getClient();
    
    await prisma.notification.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logError('Error deleting notification', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
};

// Delete all read notifications
export const deleteAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = prismaService.getClient();
    
    const result = await prisma.notification.deleteMany({
      where: { isRead: true }
    });
    
    logInfo(`Deleted ${result.count} read notifications`);
    
    res.json({
      success: true,
      data: { deletedCount: result.count }
    });
  } catch (error) {
    logError('Error deleting read notifications', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete read notifications'
    });
  }
};

// Get notification statistics
export const getNotificationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { days = 7 } = req.query;
    const prisma = prismaService.getClient();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    
    const [total, unread, byType, byPriority, recent] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: { type: true },
        where: { createdAt: { gte: startDate } }
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where: { createdAt: { gte: startDate } }
      }),
      prisma.notification.count({
        where: { createdAt: { gte: startDate } }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        unread,
        recent,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {} as Record<string, number>),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item.priority] = item._count.priority;
          return acc;
        }, {} as Record<string, number>),
        period: `${days} days`
      }
    });
  } catch (error) {
    logError('Error fetching notification stats', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification statistics'
    });
  }
};

// Get signal history
export const getSignalHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, timeframe, limit = 100, offset = 0 } = req.query;
    
    const signals = await prismaService.getSignalHistory(
      symbol as string,
      timeframe as string,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    logError('Error fetching signal history', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signal history'
    });
  }
};

// Get signal statistics
export const getSignalStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, days = 7 } = req.query;
    const prisma = prismaService.getClient();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    
    const where = {
      generatedAt: { gte: startDate },
      ...(symbol && { symbol: symbol as string })
    };
    
    const [total, bySignal, byTimeframe, avgConfidence, avgStrength] = await Promise.all([
      prisma.signalHistory.count({ where }),
      prisma.signalHistory.groupBy({
        by: ['signal'],
        _count: { signal: true },
        where
      }),
      prisma.signalHistory.groupBy({
        by: ['timeframe'],
        _count: { timeframe: true },
        where
      }),
      prisma.signalHistory.aggregate({
        _avg: { confidence: true },
        where
      }),
      prisma.signalHistory.aggregate({
        _avg: { strength: true },
        where
      })
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        averages: {
          confidence: avgConfidence._avg.confidence || 0,
          strength: avgStrength._avg.strength || 0
        },
        bySignal: bySignal.reduce((acc, item) => {
          acc[item.signal] = item._count.signal;
          return acc;
        }, {} as Record<string, number>),
        byTimeframe: byTimeframe.reduce((acc, item) => {
          acc[item.timeframe] = item._count.timeframe;
          return acc;
        }, {} as Record<string, number>),
        period: `${days} days`,
        symbol: symbol || 'all'
      }
    });
  } catch (error) {
    logError('Error fetching signal stats', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signal statistics'
    });
  }
};
