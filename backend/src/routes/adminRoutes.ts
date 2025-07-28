import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as adminController from '../controllers/adminController';

const router = Router();

// Admin Settings Routes
/**
 * @route GET /api/admin/settings
 * @description Get all admin settings, optionally filtered by category
 * @query category - Filter by setting category (optional)
 * @returns Array of admin settings
 */
router.get('/settings', asyncHandler(adminController.getAdminSettings));

/**
 * @route GET /api/admin/settings/:key
 * @description Get a specific admin setting by key
 * @param key - Setting key
 * @returns Admin setting object
 */
router.get('/settings/:key', asyncHandler(adminController.getAdminSetting));

/**
 * @route PUT /api/admin/settings/:key
 * @description Update an admin setting
 * @param key - Setting key
 * @body value - New setting value
 * @body description - Setting description (optional)
 * @body category - Setting category (optional)
 * @returns Updated admin setting
 */
router.put('/settings/:key', asyncHandler(adminController.updateAdminSetting));

/**
 * @route POST /api/admin/settings
 * @description Create a new admin setting
 * @body key - Setting key
 * @body value - Setting value
 * @body type - Setting type ('number', 'string', 'boolean', 'json')
 * @body description - Setting description (optional)
 * @body category - Setting category (optional)
 * @returns Created admin setting
 */
router.post('/settings', asyncHandler(adminController.createAdminSetting));

// Notification Rules Routes
/**
 * @route GET /api/admin/notification-rules
 * @description Get all notification rules
 * @query active - Filter by active status (optional)
 * @returns Array of notification rules
 */
router.get('/notification-rules', asyncHandler(adminController.getNotificationRules));

/**
 * @route GET /api/admin/notification-rules/:id
 * @description Get a specific notification rule by ID
 * @param id - Rule ID
 * @returns Notification rule object
 */
router.get('/notification-rules/:id', asyncHandler(adminController.getNotificationRule));

/**
 * @route POST /api/admin/notification-rules
 * @description Create a new notification rule
 * @body name - Rule name
 * @body description - Rule description (optional)
 * @body minConfidence - Minimum confidence threshold (optional)
 * @body minStrength - Minimum strength threshold (optional)
 * @body requiredTimeframes - Required number of agreeing timeframes (optional, deprecated)
 * @body specificTimeframes - Array of specific timeframes to check (e.g., ["1m", "5m", "1h"]) (optional)
 * @body requiredSignalType - Required signal type ('BUY', 'SELL', 'HOLD') (optional)
 * @body advancedConditions - Advanced rule conditions in JSON format (optional)
 * @body enableSound - Enable sound notifications (default: true)
 * @body enableVisual - Enable visual notifications (default: true)
 * @body priority - Notification priority ('LOW', 'MEDIUM', 'HIGH')
 * @returns Created notification rule
 */
router.post('/notification-rules', asyncHandler(adminController.createNotificationRule));

/**
 * @route PUT /api/admin/notification-rules/:id
 * @description Update a notification rule
 * @param id - Rule ID
 * @body Any notification rule fields to update
 * @returns Updated notification rule
 */
router.put('/notification-rules/:id', asyncHandler(adminController.updateNotificationRule));

/**
 * @route DELETE /api/admin/notification-rules/:id
 * @description Delete a notification rule
 * @param id - Rule ID
 * @returns Success message
 */
router.delete('/notification-rules/:id', asyncHandler(adminController.deleteNotificationRule));

/**
 * @route POST /api/admin/notification-rules/check
 * @description Check notification rules against provided coin data
 * @body coins - Array of coin data to check against rules
 * @returns Result of rule checking process
 */
router.post('/notification-rules/check', asyncHandler(adminController.checkNotificationRules));

// System Management Routes
/**
 * @route POST /api/admin/initialize-defaults
 * @description Initialize default admin settings and notification rules
 * @returns Success message
 */
router.post('/initialize-defaults', asyncHandler(adminController.initializeDefaults));

/**
 * @route POST /api/admin/reset-defaults
 * @description Reset all settings to default values
 * @returns Success message
 */
router.post('/reset-defaults', asyncHandler(adminController.resetToDefaults));

/**
 * @route GET /api/admin/system-status
 * @description Get system status and statistics
 * @returns System status and database counts
 */
router.get('/system-status', asyncHandler(adminController.getSystemStatus));

export default router;
