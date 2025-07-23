import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as notificationController from '../controllers/notificationController';

const router = Router();

// Notification Management Routes
/**
 * @route GET /api/notifications
 * @description Get notifications with pagination
 * @query unread - Filter by unread status (optional)
 * @query limit - Number of notifications to return (default: 50)
 * @query offset - Number of notifications to skip (default: 0)
 * @returns Array of notifications with pagination info
 */
router.get('/', asyncHandler(notificationController.getNotifications));

/**
 * @route GET /api/notifications/unread-count
 * @description Get count of unread notifications
 * @returns Unread notification count
 */
router.get('/unread-count', asyncHandler(notificationController.getUnreadCount));

/**
 * @route GET /api/notifications/:id
 * @description Get a single notification with full details including signal data
 * @param id - Notification ID
 * @returns Detailed notification with signal analysis data
 */
router.get('/:id', asyncHandler(notificationController.getNotificationById));

/**
 * @route PUT /api/notifications/:id/read
 * @description Mark a specific notification as read
 * @param id - Notification ID
 * @returns Updated notification
 */
router.put('/:id/read', asyncHandler(notificationController.markAsRead));

/**
 * @route POST /api/notifications/:id/read
 * @description Mark a specific notification as read (alternative method)
 * @param id - Notification ID
 * @returns Updated notification
 */
router.post('/:id/read', asyncHandler(notificationController.markAsRead));

/**
 * @route PUT /api/notifications/mark-all-read
 * @description Mark all notifications as read
 * @returns Count of updated notifications
 */
router.put('/mark-all-read', asyncHandler(notificationController.markAllAsRead));

/**
 * @route DELETE /api/notifications/:id
 * @description Delete a specific notification
 * @param id - Notification ID
 * @returns Success message
 */
router.delete('/:id', asyncHandler(notificationController.deleteNotification));

/**
 * @route DELETE /api/notifications/read
 * @description Delete all read notifications
 * @returns Count of deleted notifications
 */
router.delete('/read', asyncHandler(notificationController.deleteAllRead));

/**
 * @route GET /api/notifications/stats
 * @description Get notification statistics
 * @query days - Number of days to include in stats (default: 7)
 * @returns Notification statistics
 */
router.get('/stats', asyncHandler(notificationController.getNotificationStats));

// Signal History Routes
/**
 * @route GET /api/notifications/signals/history
 * @description Get signal history
 * @query symbol - Filter by symbol (optional)
 * @query timeframe - Filter by timeframe (optional)
 * @query limit - Number of signals to return (default: 100)
 * @query offset - Number of signals to skip (default: 0)
 * @returns Array of signal history
 */
router.get('/signals/history', asyncHandler(notificationController.getSignalHistory));

/**
 * @route GET /api/notifications/signals/stats
 * @description Get signal statistics
 * @query symbol - Filter by symbol (optional)
 * @query days - Number of days to include in stats (default: 7)
 * @returns Signal statistics
 */
router.get('/signals/stats', asyncHandler(notificationController.getSignalStats));

export default router;
