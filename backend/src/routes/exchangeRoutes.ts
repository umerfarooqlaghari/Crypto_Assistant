import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
// import * as exchangeController from '../controllers/exchangeController';
import * as exchangeController from '../controllers/exchangeController';

const router = Router();

// Exchange information routes
router.get('/', asyncHandler(exchangeController.getSupportedExchanges));
router.get('/:exchange/info', asyncHandler(exchangeController.getExchangeInfo));
router.get('/:exchange/status', asyncHandler(exchangeController.getExchangeStatus));
router.get('/:exchange/markets', asyncHandler(exchangeController.getExchangeMarkets));

// Price data routes
router.get('/:exchange/ticker/:symbol', asyncHandler(exchangeController.getTicker));
router.get('/:exchange/tickers', asyncHandler(exchangeController.getAllTickers));
router.get('/:exchange/orderbook/:symbol', asyncHandler(exchangeController.getOrderBook));
router.get('/:exchange/trades/:symbol', asyncHandler(exchangeController.getRecentTrades));

// OHLCV data routes
router.get('/:exchange/ohlcv/:symbol', asyncHandler(exchangeController.getOHLCV));
router.get('/:exchange/candles/:symbol/:timeframe', asyncHandler(exchangeController.getCandles));

// Multi-exchange comparison routes
router.get('/compare/prices/:symbol', asyncHandler(exchangeController.comparePrices));
router.get('/compare/spreads/:symbol', asyncHandler(exchangeController.getSpreadAnalysis));
router.get('/arbitrage/opportunities', asyncHandler(exchangeController.getArbitrageOpportunities));

// Exchange connectivity routes
router.get('/:exchange/ping', asyncHandler(exchangeController.pingExchange));
router.get('/health-check', asyncHandler(exchangeController.healthCheckAllExchanges));

export default router;
