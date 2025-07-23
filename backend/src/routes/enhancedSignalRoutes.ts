import { Router } from 'express';
import {
    getAvailableSymbols,
    generateAdvancedSignals,
    getMultiTimeframeAnalysis,
    getMarketOverview,
    generateEnhancedSignalWithNotifications,
    generateMultiTimeframeWithNotifications,
    processBatchSignals,
    getProcessingStats
} from '../controllers/enhancedSignalController';

const router = Router();

// Get all available trading symbols
router.get('/symbols', getAvailableSymbols);

// Generate advanced signals for a symbol
router.get('/advanced', generateAdvancedSignals);

// Get multi-timeframe analysis
router.get('/multi-timeframe', getMultiTimeframeAnalysis);

// Get market overview
router.get('/market-overview', getMarketOverview);

// Enhanced signal processing with notifications
router.get('/enhanced', generateEnhancedSignalWithNotifications);

// Multi-timeframe analysis with notifications
router.get('/multi-timeframe-enhanced', generateMultiTimeframeWithNotifications);

// Batch process multiple symbols
router.post('/batch', processBatchSignals);

// Get processing statistics
router.get('/stats', getProcessingStats);

export default router;
