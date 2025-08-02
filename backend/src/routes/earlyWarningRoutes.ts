import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as earlyWarningController from '../controllers/earlyWarningController';

const router = Router();

// Early Warning Alert Routes
/**
 * @route GET /api/early-warnings/active
 * @description Get active early warning alerts
 * @query symbol - Filter by symbol (optional)
 * @query limit - Number of alerts to return (default: 50)
 * @returns Array of active early warning alerts
 */
router.get('/active', asyncHandler(earlyWarningController.getActiveAlerts));

/**
 * @route GET /api/early-warnings/history
 * @description Get early warning alert history with pagination
 * @query symbol - Filter by symbol (optional)
 * @query alertType - Filter by alert type: PUMP_LIKELY, DUMP_LIKELY (optional)
 * @query limit - Number of alerts to return (default: 100)
 * @query offset - Number of alerts to skip (default: 0)
 * @returns Array of early warning alerts with pagination info
 */
router.get('/history', asyncHandler(earlyWarningController.getAlertHistory));

/**
 * @route GET /api/early-warnings/stats
 * @description Get early warning alert statistics
 * @query days - Number of days to include in stats (default: 7)
 * @query symbol - Filter by symbol (optional)
 * @returns Early warning alert statistics including accuracy metrics
 */
router.get('/stats', asyncHandler(earlyWarningController.getAlertStats));

/**
 * @route GET /api/early-warnings/recent-count
 * @description Get count of recent early warning alerts (for UI badge)
 * @returns Count of alerts in last 30 minutes
 */
router.get('/recent-count', asyncHandler(earlyWarningController.getRecentAlertsCount));

/**
 * @route GET /api/early-warnings/:id
 * @description Get a single early warning alert by ID
 * @param id - Alert ID
 * @returns Detailed early warning alert
 */
router.get('/:id', asyncHandler(earlyWarningController.getAlertById));

/**
 * @route PUT /api/early-warnings/:id/outcome
 * @description Update alert outcome for accuracy tracking
 * @param id - Alert ID
 * @body outcome - PUMP_CONFIRMED, DUMP_CONFIRMED, PARTIAL_MOVE, FALSE_SIGNAL
 * @body responseTime - Time in minutes from alert to actual move (optional)
 * @returns Updated alert
 */
router.put('/:id/outcome', asyncHandler(earlyWarningController.updateAlertOutcome));

/**
 * @route DELETE /api/early-warnings/:id
 * @description Delete an early warning alert
 * @param id - Alert ID
 * @returns Success message
 */
router.delete('/:id', asyncHandler(earlyWarningController.deleteAlert));

export default router;
