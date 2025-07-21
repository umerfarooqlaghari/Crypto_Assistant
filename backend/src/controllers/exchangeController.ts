import { Request, Response } from 'express';
import { getPriceFromExchange, getOHLCVFromExchange } from '../Services/ccxtService';
import { ValidationError, ExchangeError } from '../middleware/errorHandler';
import { logInfo, logError, logExchangeOperation } from '../utils/logger';
import { config } from '../config/config';

// Get supported exchanges
export const getSupportedExchanges = async (req: Request, res: Response): Promise<void> => {
  try {
    const exchanges = config.supportedExchanges.map(exchange => ({
      id: exchange,
      name: exchange.charAt(0).toUpperCase() + exchange.slice(1),
      status: 'active', // In production, check actual status
      features: {
        spot: true,
        futures: exchange !== 'bitstamp', // Most support futures except some
        options: ['binance', 'okx'].includes(exchange),
        margin: ['binance', 'kraken', 'bitfinex'].includes(exchange),
      },
    }));

    res.json({
      total: exchanges.length,
      exchanges,
    });
  } catch (error) {
    logError('Error fetching supported exchanges', error as Error);
    res.status(500).json({ error: 'Failed to fetch exchanges' });
  }
};

// Get exchange information
export const getExchangeInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange } = req.params;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    // Mock exchange info - in production, fetch from exchange API
    const exchangeInfo = {
      id: exchange,
      name: exchange.charAt(0).toUpperCase() + exchange.slice(1),
      country: getExchangeCountry(exchange),
      founded: getExchangeFounded(exchange),
      website: `https://${exchange}.com`,
      fees: {
        trading: {
          maker: 0.1,
          taker: 0.1,
        },
        withdrawal: 'varies',
      },
      limits: {
        minTrade: 10,
        maxTrade: 1000000,
      },
      features: {
        spot: true,
        futures: exchange !== 'bitstamp',
        options: ['binance', 'okx'].includes(exchange),
        margin: ['binance', 'kraken', 'bitfinex'].includes(exchange),
      },
    };

    res.json(exchangeInfo);
  } catch (error) {
    logError(`Error fetching exchange info for ${req.params.exchange}`, error as Error);
    res.status(500).json({ error: 'Failed to fetch exchange info' });
  }
};

// Get exchange status
export const getExchangeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange } = req.params;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    // Mock status check - in production, ping exchange API
    const status = {
      exchange,
      status: 'operational',
      uptime: 99.9,
      lastChecked: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
      issues: [],
    };

    res.json(status);
  } catch (error) {
    logError(`Error checking exchange status for ${req.params.exchange}`, error as Error);
    res.status(500).json({ error: 'Failed to check exchange status' });
  }
};

// Get exchange markets
export const getExchangeMarkets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange } = req.params;
    const { type = 'spot', active = true } = req.query;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    // Mock markets data - in production, fetch from exchange API
    const markets = config.defaultTradingPairs.map(pair => ({
      symbol: pair,
      base: pair.split('/')[0],
      quote: pair.split('/')[1],
      active: active === 'true',
      type,
      spot: type === 'spot',
      future: type === 'future',
      precision: {
        amount: 8,
        price: 2,
      },
      limits: {
        amount: { min: 0.001, max: 1000000 },
        price: { min: 0.01, max: 1000000 },
      },
    }));

    res.json({
      exchange,
      total: markets.length,
      markets,
    });
  } catch (error) {
    logError(`Error fetching markets for ${req.params.exchange}`, error as Error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
};

// Get ticker for a symbol
export const getTicker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange, symbol } = req.params;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    logExchangeOperation(exchange, 'getTicker', symbol);
    const price = await getPriceFromExchange(exchange, symbol);

    // Mock additional ticker data
    const ticker = {
      symbol,
      exchange,
      last: price,
      bid: price * 0.999,
      ask: price * 1.001,
      high: price * 1.05,
      low: price * 0.95,
      volume: Math.random() * 1000000,
      change: (Math.random() - 0.5) * 0.1,
      changePercent: (Math.random() - 0.5) * 10,
      timestamp: new Date().toISOString(),
    };

    res.json(ticker);
  } catch (error) {
    throw new ExchangeError(`Error fetching ticker: ${(error as Error).message}`, req.params.exchange);
  }
};

// Get all tickers
export const getAllTickers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange } = req.params;
    const { symbols } = req.query;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    const symbolList = symbols ? 
      (symbols as string).split(',') : 
      config.defaultTradingPairs.slice(0, 10); // Limit to 10 for demo

    const tickerPromises = symbolList.map(async (symbol) => {
      try {
        const price = await getPriceFromExchange(exchange, symbol.trim());
        return {
          symbol: symbol.trim(),
          last: price,
          change: (Math.random() - 0.5) * 0.1,
          changePercent: (Math.random() - 0.5) * 10,
          volume: Math.random() * 1000000,
        };
      } catch (error) {
        return {
          symbol: symbol.trim(),
          error: (error as Error).message,
        };
      }
    });

    const tickers = await Promise.all(tickerPromises);

    res.json({
      exchange,
      total: tickers.length,
      tickers,
    });
  } catch (error) {
    throw new ExchangeError(`Error fetching tickers: ${(error as Error).message}`, req.params.exchange);
  }
};

// Get order book
export const getOrderBook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange, symbol } = req.params;
    const { limit = 20 } = req.query;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    // Mock order book data
    const price = await getPriceFromExchange(exchange, symbol);
    const orderBook = {
      symbol,
      exchange,
      bids: Array.from({ length: Number(limit) }, (_, i) => [
        price * (1 - (i + 1) * 0.001),
        Math.random() * 10,
      ]),
      asks: Array.from({ length: Number(limit) }, (_, i) => [
        price * (1 + (i + 1) * 0.001),
        Math.random() * 10,
      ]),
      timestamp: new Date().toISOString(),
    };

    res.json(orderBook);
  } catch (error) {
    throw new ExchangeError(`Error fetching order book: ${(error as Error).message}`, req.params.exchange);
  }
};

// Get recent trades
export const getRecentTrades = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange, symbol } = req.params;
    const { limit = 50 } = req.query;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    const price = await getPriceFromExchange(exchange, symbol);
    
    // Mock trades data
    const trades = Array.from({ length: Number(limit) }, (_, i) => ({
      id: `trade_${i}`,
      price: price * (1 + (Math.random() - 0.5) * 0.01),
      amount: Math.random() * 10,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
    }));

    res.json({
      symbol,
      exchange,
      total: trades.length,
      trades,
    });
  } catch (error) {
    throw new ExchangeError(`Error fetching trades: ${(error as Error).message}`, req.params.exchange);
  }
};

// Get OHLCV data
export const getOHLCV = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange, symbol } = req.params;
    const { timeframe = '1h', limit = 100, since } = req.query;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    const ohlcv = await getOHLCVFromExchange(
      exchange,
      symbol,
      timeframe as string,
      Number(limit),
      since ? Number(since) : undefined
    );

    res.json({
      symbol,
      exchange,
      timeframe,
      total: ohlcv.length,
      data: ohlcv,
    });
  } catch (error) {
    throw new ExchangeError(`Error fetching OHLCV: ${(error as Error).message}`, req.params.exchange);
  }
};

// Get candles (alias for OHLCV)
export const getCandles = async (req: Request, res: Response): Promise<void> => {
  return getOHLCV(req, res);
};

// Compare prices across exchanges
export const comparePrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const { exchanges } = req.query;

    const exchangeList = exchanges ? 
      (exchanges as string).split(',') : 
      config.supportedExchanges.slice(0, 5);

    const pricePromises = exchangeList.map(async (exchange) => {
      try {
        const price = await getPriceFromExchange(exchange.trim(), symbol);
        return { exchange: exchange.trim(), price, status: 'success' };
      } catch (error) {
        return { 
          exchange: exchange.trim(), 
          price: null, 
          status: 'error', 
          error: (error as Error).message 
        };
      }
    });

    const results = await Promise.all(pricePromises);
    const validPrices = results.filter(r => r.status === 'success' && r.price !== null);

    if (validPrices.length === 0) {
      throw new ExchangeError('No valid prices found for comparison', 'price-comparison');
    }

    const prices = validPrices.map(r => r.price!);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const spread = Math.max(...prices) - Math.min(...prices);

    res.json({
      symbol,
      timestamp: new Date().toISOString(),
      comparison: results,
      summary: {
        averagePrice: avgPrice,
        spread,
        spreadPercentage: (spread / avgPrice) * 100,
        highestPrice: Math.max(...prices),
        lowestPrice: Math.min(...prices),
      },
    });
  } catch (error) {
    throw new ExchangeError(`Error comparing prices: ${(error as Error).message}`, 'price-comparison');
  }
};

// Get spread analysis
export const getSpreadAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    
    // Use the compare prices logic but focus on spread analysis
    await comparePrices(req, res);
  } catch (error) {
    throw new ExchangeError(`Error analyzing spreads: ${(error as Error).message}`, 'spread-analysis');
  }
};

// Get arbitrage opportunities
export const getArbitrageOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols = 'BTC/USDT,ETH/USDT', minSpread = 0.5 } = req.query;

    const symbolList = (symbols as string).split(',');
    const opportunities = [];

    for (const symbol of symbolList) {
      try {
        const pricePromises = config.supportedExchanges.slice(0, 5).map(async (exchange) => {
          try {
            const price = await getPriceFromExchange(exchange, symbol.trim());
            return { exchange, price };
          } catch {
            return null;
          }
        });

        const results = (await Promise.all(pricePromises)).filter(Boolean);
        
        if (results.length >= 2) {
          const prices = results.map(r => r!.price);
          const maxPrice = Math.max(...prices);
          const minPrice = Math.min(...prices);
          const spreadPercentage = ((maxPrice - minPrice) / minPrice) * 100;

          if (spreadPercentage >= Number(minSpread)) {
            const buyExchange = results.find(r => r!.price === minPrice)!.exchange;
            const sellExchange = results.find(r => r!.price === maxPrice)!.exchange;

            opportunities.push({
              symbol: symbol.trim(),
              buyExchange,
              sellExchange,
              buyPrice: minPrice,
              sellPrice: maxPrice,
              spread: maxPrice - minPrice,
              spreadPercentage,
              potentialProfit: spreadPercentage - 0.2, // Minus estimated fees
            });
          }
        }
      } catch (error) {
        logError(`Error checking arbitrage for ${symbol}`, error as Error);
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      minSpreadThreshold: Number(minSpread),
      total: opportunities.length,
      opportunities: opportunities.sort((a, b) => b.spreadPercentage - a.spreadPercentage),
    });
  } catch (error) {
    throw new ExchangeError(`Error finding arbitrage opportunities: ${(error as Error).message}`, 'arbitrage');
  }
};

// Ping exchange
export const pingExchange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { exchange } = req.params;

    if (!config.supportedExchanges.includes(exchange)) {
      throw new ValidationError(`Exchange ${exchange} is not supported`);
    }

    const startTime = Date.now();
    
    // Try to fetch a simple ticker to test connectivity
    try {
      await getPriceFromExchange(exchange, 'BTC/USDT');
      const responseTime = Date.now() - startTime;

      res.json({
        exchange,
        status: 'online',
        responseTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.json({
        exchange,
        status: 'offline',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logError(`Error pinging exchange ${req.params.exchange}`, error as Error);
    res.status(500).json({ error: 'Failed to ping exchange' });
  }
};

// Health check all exchanges
export const healthCheckAllExchanges = async (req: Request, res: Response): Promise<void> => {
  try {
    const healthPromises = config.supportedExchanges.map(async (exchange) => {
      const startTime = Date.now();
      try {
        await getPriceFromExchange(exchange, 'BTC/USDT');
        return {
          exchange,
          status: 'online',
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          exchange,
          status: 'offline',
          error: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(healthPromises);
    const onlineCount = results.filter(r => r.status === 'online').length;

    res.json({
      timestamp: new Date().toISOString(),
      total: results.length,
      online: onlineCount,
      offline: results.length - onlineCount,
      exchanges: results,
    });
  } catch (error) {
    logError('Error performing health check', error as Error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
};

// Helper functions
function getExchangeCountry(exchange: string): string {
  const countries: { [key: string]: string } = {
    binance: 'Malta',
    coinbase: 'United States',
    kraken: 'United States',
    bitfinex: 'British Virgin Islands',
    bitstamp: 'Luxembourg',
    kucoin: 'Seychelles',
    bybit: 'Singapore',
    okx: 'Malta',
    huobi: 'Singapore',
    gate: 'Cayman Islands',
  };
  return countries[exchange] || 'Unknown';
}

function getExchangeFounded(exchange: string): number {
  const founded: { [key: string]: number } = {
    binance: 2017,
    coinbase: 2012,
    kraken: 2011,
    bitfinex: 2012,
    bitstamp: 2011,
    kucoin: 2017,
    bybit: 2018,
    okx: 2013,
    huobi: 2013,
    gate: 2013,
  };
  return founded[exchange] || 2020;
}
