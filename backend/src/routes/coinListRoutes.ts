import { Router } from 'express';
import {
  getCoinList,
  getCoinData,
  refreshCoinList,
  getCoinListStats,
  getCoinListPerformance,
  resetCoinListPerformance,
  getTop50CoinList,
  getTop30CoinList,
  clearCoinList
} from '../controllers/coinListController';

const router = Router();

/**
 * @route GET /api/coin-list/top50
 * @description Get top 50 best coins dynamically from Binance WebSocket (called when user visits coin-list page)
 * @returns Array of top 50 best coins with confidence signals for multiple timeframes
 */
router.get('/top50', getTop50CoinList);

/**
 * @route GET /api/coin-list/top30
 * @description Legacy endpoint - returns first 30 coins from top50 for backward compatibility
 * @returns Array of top 30 best coins with confidence signals for multiple timeframes
 */
router.get('/top30', getTop30CoinList);

/**
 * @route GET /api/coin-list
 * @description Get list of top cryptocurrencies with confidence indicators
 * @query limit - Number of coins to return (1-50, default: 30)
 * @returns Array of coins with confidence signals for multiple timeframes
 */
router.get('/', getCoinList);

/**
 * @route GET /api/coin-list/stats
 * @description Get statistics about coin list signals
 * @returns Statistics about buy/sell/hold signals across timeframes
 */
router.get('/stats', getCoinListStats);

/**
 * @route GET /api/coin-list/status
 * @description Get coin list service status and last update time
 * @returns Service status information
 */
router.get('/status', async (_req, res) => {
  try {
    const { getCoinListService } = await import('../controllers/coinListController');
    const service = getCoinListService();
    const stats = service.getPerformanceStats();

    res.status(200).json({
      success: true,
      data: {
        isActive: true,
        lastUpdate: stats.lastUpdate,
        totalCoins: stats.activeCoinCount, // Real-time active coin count
        realTimeUpdatesActive: true,
        wsUpdates: stats.wsUpdates,
        uptime: stats.uptime,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

/**
 * @route GET /api/coin-list/:symbol
 * @description Get specific coin data with confidence indicators
 * @param symbol - Trading symbol (e.g., BTCUSDT)
 * @returns Single coin data with confidence signals
 */
router.get('/:symbol', getCoinData);

/**
 * @route POST /api/coin-list/refresh
 * @description Manually refresh coin list cache
 * @query limit - Number of coins to return (1-50, default: 30)
 * @returns Refreshed coin list data
 */
router.post('/refresh', refreshCoinList);

/**
 * @route GET /api/coin-list/performance
 * @description Get performance statistics for coin list service
 * @returns Performance metrics including API calls, cache hits, response times
 */
router.get('/performance', getCoinListPerformance);

/**
 * @route POST /api/coin-list/performance/reset
 * @description Reset performance statistics
 * @returns Success confirmation
 */
router.post('/performance/reset', resetCoinListPerformance);

/**
 * @route POST /api/coin-list/clear
 * @description Clear current coin list (called when user navigates away)
 * @returns Success confirmation
 */
router.post('/clear', clearCoinList);

export default router;
