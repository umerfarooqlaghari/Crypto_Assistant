import { Request, Response } from 'express';
import { CoinListService } from '../Services/coinListService';
import { logError, logInfo } from '../utils/logger';

// Singleton instance
let coinListService: CoinListService | null = null;
let realTimeServiceInstance: any = null;

// Set real-time service instance
export const setRealTimeService = (realTimeService: any) => {
  realTimeServiceInstance = realTimeService;
  if (coinListService) {
    coinListService.setRealTimeService(realTimeService);
  }
};

// Get or create coin list service instance
export const getCoinListService = (): CoinListService => {
  if (!coinListService) {
    coinListService = new CoinListService();
    if (realTimeServiceInstance) {
      coinListService.setRealTimeService(realTimeServiceInstance);
    }
  }
  return coinListService;
};

// Get top 30 coins dynamically from WebSocket (called when user visits coin-list page)
export const getTop30CoinList = async (req: Request, res: Response): Promise<void> => {
  try {
    logInfo('📊 API call: GET /api/coin-list/top30 - Fetching top 30 coins from WebSocket');

    const service = getCoinListService();
    const coinList = await service.getTop30CoinList();

    logInfo(`✅ Successfully returned ${coinList.length} top coins from WebSocket`);

    res.status(200).json({
      success: true,
      data: coinList,
      metadata: {
        count: coinList.length,
        source: 'binance_websocket',
        timestamp: Date.now(),
        description: 'Top 30 best coins by market cap and liquidity from Binance WebSocket'
      }
    });
  } catch (error) {
    logError('Error in getTop30CoinList controller:', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top 30 coin list',
      details: (error as Error).message
    });
  }
};

// Legacy endpoint for backward compatibility
export const getTop50CoinList = getTop30CoinList;

// Get coin list with confidence indicators
export const getCoinList = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;

    // Validate limit
    if (limit < 1 || limit > 50) {
      res.status(400).json({
        error: 'Invalid limit. Must be between 1 and 50.',
        limit: limit
      });
      return;
    }

    logInfo(`Fetching coin list with limit: ${limit}`);
    
    const service = getCoinListService();
    const coinList = await service.getCoinList(limit);
    
    res.status(200).json({
      success: true,
      data: coinList,
      count: coinList.length,
      timestamp: Date.now(),
      cache_info: {
        using_cache: coinList.length > 0 && coinList[0].lastUpdated > Date.now() - 5 * 60 * 1000,
        last_updated: coinList.length > 0 ? coinList[0].lastUpdated : null
      }
    });
    
  } catch (error) {
    logError('Error in getCoinList controller', error as Error);
    res.status(500).json({
      error: 'Failed to fetch coin list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get specific coin data
export const getCoinData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      res.status(400).json({
        error: 'Symbol parameter is required'
      });
      return;
    }

    const normalizedSymbol = symbol.toUpperCase();
    logInfo(`Fetching data for coin: ${normalizedSymbol}`);
    
    const service = getCoinListService();
    const currentCoinList = service.getCurrentCoinList();
    const coinData = currentCoinList.find(coin => coin.symbol === normalizedSymbol);
    
    if (!coinData) {
      res.status(404).json({
        error: 'Coin not found',
        symbol: normalizedSymbol,
        message: 'Coin not found in cache. It may not be in the top coins list.'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: coinData,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logError('Error in getCoinData controller', error as Error);
    res.status(500).json({
      error: 'Failed to fetch coin data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Refresh coin list (WebSocket-only approach)
export const refreshCoinList = async (req: Request, res: Response): Promise<void> => {
  try {
    logInfo('Manual refresh of coin list requested (WebSocket-only approach)');

    const service = getCoinListService();
    service.clearCurrentCoinList();

    // Use top 30 curated coins instead of legacy volume-based method
    const freshCoinList = await service.getTop30CoinList();

    res.status(200).json({
      success: true,
      data: freshCoinList,
      count: freshCoinList.length,
      timestamp: Date.now(),
      message: 'Coin list refreshed using real-time WebSocket data'
    });

  } catch (error) {
    logError('Error in refreshCoinList controller', error as Error);
    res.status(500).json({
      error: 'Failed to refresh coin list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get coin list statistics
export const getCoinListStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getCoinListService();

    // Use current coin list instead of generating new one (prevents overriding curated list)
    const coinList = service.getCurrentCoinList();
    
    // Calculate statistics
    const stats = {
      total_coins: coinList.length,
      buy_signals: {
        '5m': coinList.filter(c => c.confidence['5m'].action === 'BUY').length,
        '15m': coinList.filter(c => c.confidence['15m'].action === 'BUY').length,
        '1h': coinList.filter(c => c.confidence['1h'].action === 'BUY').length,
        '4h': coinList.filter(c => c.confidence['4h'].action === 'BUY').length,
        '1d': coinList.filter(c => c.confidence['1d'].action === 'BUY').length,
      },
      sell_signals: {
        '5m': coinList.filter(c => c.confidence['5m'].action === 'SELL').length,
        '15m': coinList.filter(c => c.confidence['15m'].action === 'SELL').length,
        '1h': coinList.filter(c => c.confidence['1h'].action === 'SELL').length,
        '4h': coinList.filter(c => c.confidence['4h'].action === 'SELL').length,
        '1d': coinList.filter(c => c.confidence['1d'].action === 'SELL').length,
      },
      hold_signals: {
        '5m': coinList.filter(c => c.confidence['5m'].action === 'HOLD').length,
        '15m': coinList.filter(c => c.confidence['15m'].action === 'HOLD').length,
        '1h': coinList.filter(c => c.confidence['1h'].action === 'HOLD').length,
        '4h': coinList.filter(c => c.confidence['4h'].action === 'HOLD').length,
        '1d': coinList.filter(c => c.confidence['1d'].action === 'HOLD').length,
      },
      average_confidence: {
        '5m': Math.round(coinList.reduce((sum, c) => sum + c.confidence['5m'].confidence, 0) / coinList.length),
        '15m': Math.round(coinList.reduce((sum, c) => sum + c.confidence['15m'].confidence, 0) / coinList.length),
        '1h': Math.round(coinList.reduce((sum, c) => sum + c.confidence['1h'].confidence, 0) / coinList.length),
        '4h': Math.round(coinList.reduce((sum, c) => sum + c.confidence['4h'].confidence, 0) / coinList.length),
        '1d': Math.round(coinList.reduce((sum, c) => sum + c.confidence['1d'].confidence, 0) / coinList.length),
      },
      average_strength: {
        '5m': Math.round(coinList.reduce((sum, c) => sum + c.confidence['5m'].strength, 0) / coinList.length),
        '15m': Math.round(coinList.reduce((sum, c) => sum + c.confidence['15m'].strength, 0) / coinList.length),
        '1h': Math.round(coinList.reduce((sum, c) => sum + c.confidence['1h'].strength, 0) / coinList.length),
        '4h': Math.round(coinList.reduce((sum, c) => sum + c.confidence['4h'].strength, 0) / coinList.length),
        '1d': Math.round(coinList.reduce((sum, c) => sum + c.confidence['1d'].strength, 0) / coinList.length),
      },
      price_changes: {
        positive: coinList.filter(c => c.priceChange24h > 0).length,
        negative: coinList.filter(c => c.priceChange24h < 0).length,
        neutral: coinList.filter(c => c.priceChange24h === 0).length,
      },
      last_updated: coinList.length > 0 ? Math.min(...coinList.map(c => c.lastUpdated)) : null
    };
    
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logError('Error in getCoinListStats controller', error as Error);
    res.status(500).json({
      error: 'Failed to fetch coin list statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get performance statistics
export const getCoinListPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getCoinListService();
    const stats = service.getPerformanceStats();

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });

  } catch (error) {
    logError('Error in getCoinListPerformance controller', error as Error);
    res.status(500).json({
      error: 'Failed to fetch performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Reset performance statistics
export const resetCoinListPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getCoinListService();
    service.resetPerformanceStats();

    res.status(200).json({
      success: true,
      message: 'Performance statistics reset successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    logError('Error in resetCoinListPerformance controller', error as Error);
    res.status(500).json({
      error: 'Failed to reset performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Clear current coin list (called when user navigates away)
export const clearCoinList = async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getCoinListService();
    service.clearCurrentCoinList();

    logInfo('Cleared current coin list - user navigated away from coin-list page');

    res.status(200).json({
      success: true,
      message: 'Current coin list cleared successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    logError('Error clearing current coin list', error as Error);
    res.status(500).json({
      error: 'Failed to clear current coin list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Cleanup function for graceful shutdown
export const cleanupCoinListService = () => {
  if (coinListService) {
    coinListService.stopRealTimeUpdates();
    coinListService = null;
  }
};
