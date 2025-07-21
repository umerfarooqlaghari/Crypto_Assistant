import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as portfolioController from '../controllers/portfolioController';

const router = Router();

// Portfolio management routes
router.get('/', asyncHandler(portfolioController.getPortfolio));
router.post('/', asyncHandler(portfolioController.createPortfolio));
router.put('/:id', asyncHandler(portfolioController.updatePortfolio));
router.delete('/:id', asyncHandler(portfolioController.deletePortfolio));

// Portfolio holdings routes
router.get('/:id/holdings', asyncHandler(portfolioController.getPortfolioHoldings));
router.post('/:id/holdings', asyncHandler(portfolioController.addHolding));
router.put('/:id/holdings/:holdingId', asyncHandler(portfolioController.updateHolding));
router.delete('/:id/holdings/:holdingId', asyncHandler(portfolioController.removeHolding));

// Portfolio analytics routes
router.get('/:id/performance', asyncHandler(portfolioController.getPortfolioPerformance));
router.get('/:id/allocation', asyncHandler(portfolioController.getPortfolioAllocation));
router.get('/:id/pnl', asyncHandler(portfolioController.getPortfolioPnL));
router.get('/:id/risk-metrics', asyncHandler(portfolioController.getRiskMetrics));

// Portfolio comparison routes
router.post('/compare', asyncHandler(portfolioController.comparePortfolios));

export default router;
