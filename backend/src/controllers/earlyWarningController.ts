import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { prismaService } from '../Services/prismaService';

// Get active early warning alerts
export const getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, limit = 50 } = req.query;
    const prisma = prismaService.getClient();
    
    const where: any = {
      isActive: true,
      isResolved: false,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      }
    };
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    const alerts = await prisma.earlyWarningAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
    
  } catch (error) {
    logError('Error fetching active early warning alerts', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active alerts'
    });
  }
};

// Get early warning alert history
export const getAlertHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, limit = 100, offset = 0, alertType } = req.query;
    const prisma = prismaService.getClient();
    
    const where: any = {};
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    if (alertType) {
      where.alertType = alertType as string;
    }
    
    const [alerts, total] = await Promise.all([
      prisma.earlyWarningAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.earlyWarningAlert.count({ where })
    ]);
    
    res.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + alerts.length
      }
    });
    
  } catch (error) {
    logError('Error fetching early warning alert history', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert history'
    });
  }
};

// Get alert statistics
export const getAlertStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { days = 7, symbol } = req.query;
    const prisma = prismaService.getClient();
    
    const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
    
    const where: any = {
      createdAt: { gte: startDate }
    };
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    const [
      total,
      pumpAlerts,
      dumpAlerts,
      resolvedAlerts,
      accurateAlerts,
      avgConfidence,
      avgAccuracy
    ] = await Promise.all([
      prisma.earlyWarningAlert.count({ where }),
      prisma.earlyWarningAlert.count({ 
        where: { ...where, alertType: 'PUMP_LIKELY' } 
      }),
      prisma.earlyWarningAlert.count({ 
        where: { ...where, alertType: 'DUMP_LIKELY' } 
      }),
      prisma.earlyWarningAlert.count({ 
        where: { ...where, isResolved: true } 
      }),
      prisma.earlyWarningAlert.count({ 
        where: { ...where, accuracyScore: { gte: 80 } } 
      }),
      prisma.earlyWarningAlert.aggregate({
        where,
        _avg: { confidence: true }
      }),
      prisma.earlyWarningAlert.aggregate({
        where: { ...where, isResolved: true },
        _avg: { accuracyScore: true }
      })
    ]);
    
    // Get top performing symbols
    const topSymbols = await prisma.earlyWarningAlert.groupBy({
      by: ['symbol'],
      where,
      _count: { symbol: true },
      _avg: { accuracyScore: true },
      orderBy: { _count: { symbol: 'desc' } },
      take: 10
    });
    
    res.json({
      success: true,
      data: {
        total,
        breakdown: {
          pumpAlerts,
          dumpAlerts,
          neutralAlerts: total - pumpAlerts - dumpAlerts
        },
        performance: {
          resolved: resolvedAlerts,
          accurate: accurateAlerts,
          accuracyRate: resolvedAlerts > 0 ? (accurateAlerts / resolvedAlerts * 100) : 0,
          avgConfidence: avgConfidence._avg.confidence || 0,
          avgAccuracy: avgAccuracy._avg.accuracyScore || 0
        },
        topSymbols: topSymbols.map(item => ({
          symbol: item.symbol,
          alertCount: item._count.symbol,
          avgAccuracy: item._avg.accuracyScore || 0
        })),
        period: `${days} days`
      }
    });
    
  } catch (error) {
    logError('Error fetching early warning alert statistics', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics'
    });
  }
};

// Get alert by ID
export const getAlertById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prisma = prismaService.getClient();
    
    const alert = await prisma.earlyWarningAlert.findUnique({
      where: { id }
    });
    
    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: alert
    });
    
  } catch (error) {
    logError(`Error fetching early warning alert ${req.params.id}`, error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert'
    });
  }
};

// Update alert outcome (for accuracy tracking)
export const updateAlertOutcome = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { outcome, responseTime } = req.body;
    
    if (!outcome || !['PUMP_CONFIRMED', 'DUMP_CONFIRMED', 'PARTIAL_MOVE', 'FALSE_SIGNAL'].includes(outcome)) {
      res.status(400).json({
        success: false,
        error: 'Invalid outcome. Must be one of: PUMP_CONFIRMED, DUMP_CONFIRMED, PARTIAL_MOVE, FALSE_SIGNAL'
      });
      return;
    }
    
    const prisma = prismaService.getClient();
    
    // Calculate accuracy score based on outcome
    let accuracyScore = 0;
    switch (outcome) {
      case 'PUMP_CONFIRMED':
      case 'DUMP_CONFIRMED':
        accuracyScore = 100;
        break;
      case 'PARTIAL_MOVE':
        accuracyScore = 50;
        break;
      case 'FALSE_SIGNAL':
        accuracyScore = 0;
        break;
    }
    
    const alert = await prisma.earlyWarningAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        actualOutcome: outcome,
        accuracyScore,
        responseTime: responseTime ? parseInt(responseTime) : null
      }
    });
    
    logInfo(`Updated alert outcome: ${id} -> ${outcome} (${accuracyScore}% accuracy)`);
    
    res.json({
      success: true,
      data: alert
    });
    
  } catch (error) {
    logError(`Error updating alert outcome for ${req.params.id}`, error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert outcome'
    });
  }
};

// Delete alert
export const deleteAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prisma = prismaService.getClient();
    
    await prisma.earlyWarningAlert.delete({
      where: { id }
    });
    
    logInfo(`Deleted early warning alert: ${id}`);
    
    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
    
  } catch (error) {
    logError(`Error deleting early warning alert ${req.params.id}`, error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert'
    });
  }
};

// Get recent alerts count (for UI badge)
export const getRecentAlertsCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = prismaService.getClient();
    
    const count = await prisma.earlyWarningAlert.count({
      where: {
        isActive: true,
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
        }
      }
    });
    
    res.json({
      success: true,
      data: { count }
    });
    
  } catch (error) {
    logError('Error fetching recent alerts count', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent alerts count'
    });
  }
};
