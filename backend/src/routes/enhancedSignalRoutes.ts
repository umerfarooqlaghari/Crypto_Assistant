import { Router } from 'express';
import {
    getAvailableSymbols,
    generateAdvancedSignals,
    getMultiTimeframeAnalysis,
    getMarketOverview
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

export default router;
