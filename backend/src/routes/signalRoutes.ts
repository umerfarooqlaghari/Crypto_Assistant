import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as signalController from '../controllers/signalController';

const router = Router();

// Basic signal routes
router.get('/', asyncHandler(signalController.getBasicSignals));
router.get('/multi-exchange', asyncHandler(signalController.getMultiExchangeSignal));

// Advanced signal routes
router.get('/technical/:symbol', asyncHandler(signalController.getTechnicalSignals));
router.get('/technical/:symbol/:timeframe', asyncHandler(signalController.getTechnicalSignalsByTimeframe));
router.get('/sentiment/:symbol', asyncHandler(signalController.getSentimentSignals));
router.get('/composite/:symbol', asyncHandler(signalController.getCompositeSignals));

// Signal history and analytics
router.get('/history/:symbol', asyncHandler(signalController.getSignalHistory));
router.get('/performance/:symbol', asyncHandler(signalController.getSignalPerformance));
router.get('/alerts', asyncHandler(signalController.getActiveAlerts));

// Signal configuration
router.post('/alerts', asyncHandler(signalController.createAlert));
router.put('/alerts/:id', asyncHandler(signalController.updateAlert));
router.delete('/alerts/:id', asyncHandler(signalController.deleteAlert));

export default router;