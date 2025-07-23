import { Request, Response } from 'express';
import prismaService from '../Services/prismaService';
import DefaultSettingsService from '../Services/defaultSettingsService';
import { logInfo, logError } from '../utils/logger';
import { ExchangeError } from '../middleware/errorHandler';

// Admin Settings Controllers
export const getAdminSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const settings = await prismaService.getAllAdminSettings(category as string);
    
    res.json({
      success: true,
      data: settings,
      count: settings.length
    });
  } catch (error) {
    logError('Error fetching admin settings', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin settings'
    });
  }
};

export const getAdminSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const setting = await prismaService.getAdminSetting(key);
    
    if (!setting) {
      res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
      return;
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    logError('Error fetching admin setting', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin setting'
    });
  }
};

export const updateAdminSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value, description, category } = req.body;

    if (!value) {
      throw new ExchangeError('Setting value is required', 'validation');
    }

    // Get existing setting to preserve type
    const existingSetting = await prismaService.getAdminSetting(key);
    if (!existingSetting) {
      res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
      return;
    }

    const updatedSetting = await prismaService.setAdminSetting(
      key,
      value,
      existingSetting.settingType,
      description || existingSetting.description,
      category || existingSetting.category
    );

    logInfo(`Admin setting updated: ${key} = ${value}`);

    res.json({
      success: true,
      data: updatedSetting
    });
  } catch (error) {
    logError('Error updating admin setting', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin setting'
    });
  }
};

export const createAdminSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, type, description, category } = req.body;

    if (!key || !value || !type) {
      throw new ExchangeError('Key, value, and type are required', 'validation');
    }

    const setting = await prismaService.setAdminSetting(
      key,
      value,
      type,
      description,
      category || 'general'
    );

    logInfo(`Admin setting created: ${key} = ${value}`);

    res.status(201).json({
      success: true,
      data: setting
    });
  } catch (error) {
    logError('Error creating admin setting', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin setting'
    });
  }
};

// Notification Rules Controllers
export const getNotificationRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { active } = req.query;
    const prisma = prismaService.getClient();
    
    const rules = await prisma.notificationRule.findMany({
      where: active === 'true' ? { isActive: true } : undefined,
      orderBy: { priority: 'desc' }
    });
    
    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    logError('Error fetching notification rules', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification rules'
    });
  }
};

export const getNotificationRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prisma = prismaService.getClient();
    
    const rule = await prisma.notificationRule.findUnique({
      where: { id }
    });
    
    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'Notification rule not found'
      });
      return;
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logError('Error fetching notification rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification rule'
    });
  }
};

export const createNotificationRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const ruleData = req.body;

    if (!ruleData.name) {
      throw new ExchangeError('Rule name is required', 'validation');
    }

    const rule = await prismaService.createNotificationRule(ruleData);

    logInfo(`Notification rule created: ${ruleData.name}`);

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    logError('Error creating notification rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification rule'
    });
  }
};

export const updateNotificationRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const rule = await prismaService.updateNotificationRule(id, updateData);

    logInfo(`Notification rule updated: ${id}`);

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logError('Error updating notification rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification rule'
    });
  }
};

export const deleteNotificationRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prismaService.deleteNotificationRule(id);

    logInfo(`Notification rule deleted: ${id}`);

    res.json({
      success: true,
      message: 'Notification rule deleted successfully'
    });
  } catch (error) {
    logError('Error deleting notification rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification rule'
    });
  }
};

// System Controllers
export const initializeDefaults = async (req: Request, res: Response): Promise<void> => {
  try {
    await DefaultSettingsService.initializeDefaultSettings();

    res.json({
      success: true,
      message: 'Default settings initialized successfully'
    });
  } catch (error) {
    logError('Error initializing defaults', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default settings'
    });
  }
};

export const resetToDefaults = async (req: Request, res: Response): Promise<void> => {
  try {
    await DefaultSettingsService.resetToDefaults();

    res.json({
      success: true,
      message: 'Settings reset to defaults successfully'
    });
  } catch (error) {
    logError('Error resetting to defaults', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset to default settings'
    });
  }
};

export const getSystemStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = await prismaService.healthCheck();
    const prisma = prismaService.getClient();
    
    const [settingsCount, rulesCount, signalsCount, notificationsCount] = await Promise.all([
      prisma.adminSettings.count(),
      prisma.notificationRule.count(),
      prisma.signalHistory.count(),
      prisma.notification.count()
    ]);

    res.json({
      success: true,
      data: {
        database: {
          healthy: isHealthy,
          connected: true
        },
        counts: {
          settings: settingsCount,
          rules: rulesCount,
          signals: signalsCount,
          notifications: notificationsCount
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logError('Error getting system status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
};
