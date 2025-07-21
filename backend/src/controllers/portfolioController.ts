import { Request, Response } from 'express';
import { ValidationError } from '../middleware/errorHandler';
import { logInfo, logError } from '../utils/logger';

// Portfolio interfaces
export interface Portfolio {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercentage: number;
}

export interface Holding {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  addedAt: string;
}

// Mock data storage (replace with database in production)
const portfolios: Map<string, Portfolio> = new Map();
const holdings: Map<string, Holding[]> = new Map();

// Get all portfolios
export const getPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    
    const userPortfolios = Array.from(portfolios.values()).filter(
      portfolio => !userId || portfolio.userId === userId
    );

    res.json({
      total: userPortfolios.length,
      portfolios: userPortfolios,
    });
  } catch (error) {
    logError('Error fetching portfolios', error as Error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
};

// Create a new portfolio
export const createPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, userId } = req.body;

    if (!name) {
      throw new ValidationError('Portfolio name is required');
    }

    const portfolio: Portfolio = {
      id: `portfolio_${Date.now()}`,
      userId,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalValue: 0,
      totalCost: 0,
      pnl: 0,
      pnlPercentage: 0,
    };

    portfolios.set(portfolio.id, portfolio);
    holdings.set(portfolio.id, []);

    logInfo(`Portfolio created: ${portfolio.id}`, { name, userId });
    res.status(201).json(portfolio);
  } catch (error) {
    logError('Error creating portfolio', error as Error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
};

// Update a portfolio
export const updatePortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const updatedPortfolio = {
      ...portfolio,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    portfolios.set(id, updatedPortfolio);

    logInfo(`Portfolio updated: ${id}`, updates);
    res.json(updatedPortfolio);
  } catch (error) {
    logError('Error updating portfolio', error as Error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
};

// Delete a portfolio
export const deletePortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = portfolios.delete(id);
    holdings.delete(id);

    if (!deleted) {
      throw new ValidationError('Portfolio not found');
    }

    logInfo(`Portfolio deleted: ${id}`);
    res.status(204).send();
  } catch (error) {
    logError('Error deleting portfolio', error as Error);
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
};

// Get portfolio holdings
export const getPortfolioHoldings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const portfolioHoldings = holdings.get(id) || [];

    res.json({
      portfolioId: id,
      total: portfolioHoldings.length,
      holdings: portfolioHoldings,
    });
  } catch (error) {
    logError('Error fetching portfolio holdings', error as Error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
};

// Add a holding to portfolio
export const addHolding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { symbol, quantity, averagePrice } = req.body;

    if (!symbol || !quantity || !averagePrice) {
      throw new ValidationError('Symbol, quantity, and average price are required');
    }

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const holding: Holding = {
      id: `holding_${Date.now()}`,
      portfolioId: id,
      symbol,
      quantity,
      averagePrice,
      currentPrice: averagePrice, // Placeholder - fetch real price
      totalValue: quantity * averagePrice,
      pnl: 0,
      pnlPercentage: 0,
      addedAt: new Date().toISOString(),
    };

    const portfolioHoldings = holdings.get(id) || [];
    portfolioHoldings.push(holding);
    holdings.set(id, portfolioHoldings);

    logInfo(`Holding added to portfolio ${id}`, { symbol, quantity });
    res.status(201).json(holding);
  } catch (error) {
    logError('Error adding holding', error as Error);
    res.status(500).json({ error: 'Failed to add holding' });
  }
};

// Update a holding
export const updateHolding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, holdingId } = req.params;
    const updates = req.body;

    const portfolioHoldings = holdings.get(id) || [];
    const holdingIndex = portfolioHoldings.findIndex(h => h.id === holdingId);

    if (holdingIndex === -1) {
      throw new ValidationError('Holding not found');
    }

    portfolioHoldings[holdingIndex] = {
      ...portfolioHoldings[holdingIndex],
      ...updates,
    };

    holdings.set(id, portfolioHoldings);

    logInfo(`Holding updated: ${holdingId}`, updates);
    res.json(portfolioHoldings[holdingIndex]);
  } catch (error) {
    logError('Error updating holding', error as Error);
    res.status(500).json({ error: 'Failed to update holding' });
  }
};

// Remove a holding
export const removeHolding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, holdingId } = req.params;

    const portfolioHoldings = holdings.get(id) || [];
    const filteredHoldings = portfolioHoldings.filter(h => h.id !== holdingId);

    if (filteredHoldings.length === portfolioHoldings.length) {
      throw new ValidationError('Holding not found');
    }

    holdings.set(id, filteredHoldings);

    logInfo(`Holding removed: ${holdingId}`);
    res.status(204).send();
  } catch (error) {
    logError('Error removing holding', error as Error);
    res.status(500).json({ error: 'Failed to remove holding' });
  }
};

// Get portfolio performance
export const getPortfolioPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    // Mock performance data
    const performance = {
      portfolioId: id,
      period,
      totalReturn: Math.random() * 0.4 - 0.2, // -20% to +20%
      totalReturnUSD: Math.random() * 10000 - 5000,
      bestPerformer: 'BTC',
      worstPerformer: 'ETH',
      volatility: Math.random() * 0.1 + 0.05,
      sharpeRatio: Math.random() * 2 + 0.5,
      maxDrawdown: Math.random() * 0.15 + 0.05,
    };

    res.json(performance);
  } catch (error) {
    logError('Error fetching portfolio performance', error as Error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
};

// Get portfolio allocation
export const getPortfolioAllocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const portfolioHoldings = holdings.get(id) || [];
    
    const allocation = portfolioHoldings.map(holding => ({
      symbol: holding.symbol,
      percentage: (holding.totalValue / portfolio.totalValue) * 100,
      value: holding.totalValue,
      quantity: holding.quantity,
    }));

    res.json({
      portfolioId: id,
      allocation,
    });
  } catch (error) {
    logError('Error fetching portfolio allocation', error as Error);
    res.status(500).json({ error: 'Failed to fetch allocation' });
  }
};

// Get portfolio P&L
export const getPortfolioPnL = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const pnlData = {
      portfolioId: id,
      totalPnL: portfolio.pnl,
      totalPnLPercentage: portfolio.pnlPercentage,
      realizedPnL: Math.random() * 5000 - 2500,
      unrealizedPnL: Math.random() * 3000 - 1500,
      dailyPnL: Math.random() * 1000 - 500,
    };

    res.json(pnlData);
  } catch (error) {
    logError('Error fetching portfolio P&L', error as Error);
    res.status(500).json({ error: 'Failed to fetch P&L' });
  }
};

// Get risk metrics
export const getRiskMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const portfolio = portfolios.get(id);
    if (!portfolio) {
      throw new ValidationError('Portfolio not found');
    }

    const riskMetrics = {
      portfolioId: id,
      var95: Math.random() * 0.1 + 0.02, // 2-12%
      cvar95: Math.random() * 0.15 + 0.03, // 3-18%
      beta: Math.random() * 2 + 0.5, // 0.5-2.5
      correlation: Math.random() * 0.8 + 0.1, // 0.1-0.9
      diversificationRatio: Math.random() * 0.5 + 0.5, // 0.5-1.0
      riskScore: Math.floor(Math.random() * 10) + 1, // 1-10
    };

    res.json(riskMetrics);
  } catch (error) {
    logError('Error fetching risk metrics', error as Error);
    res.status(500).json({ error: 'Failed to fetch risk metrics' });
  }
};

// Compare portfolios
export const comparePortfolios = async (req: Request, res: Response): Promise<void> => {
  try {
    const { portfolioIds } = req.body;

    if (!portfolioIds || !Array.isArray(portfolioIds)) {
      throw new ValidationError('Portfolio IDs array is required');
    }

    const comparison = portfolioIds.map(id => {
      const portfolio = portfolios.get(id);
      return portfolio ? {
        id,
        name: portfolio.name,
        totalValue: portfolio.totalValue,
        pnl: portfolio.pnl,
        pnlPercentage: portfolio.pnlPercentage,
      } : null;
    }).filter(Boolean);

    res.json({
      comparison,
      summary: {
        bestPerformer: comparison[0]?.id,
        worstPerformer: comparison[comparison.length - 1]?.id,
        avgReturn: comparison.reduce((sum, p) => sum + (p?.pnlPercentage || 0), 0) / comparison.length,
      },
    });
  } catch (error) {
    logError('Error comparing portfolios', error as Error);
    res.status(500).json({ error: 'Failed to compare portfolios' });
  }
};
