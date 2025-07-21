import ccxt from 'ccxt';
import { config } from '../config/config';
import { ExchangeError, NetworkError } from '../middleware/errorHandler';
import { logExchangeOperation, logError } from '../utils/logger';

// Exchange instance cache
const exchangeInstances: Map<string, any> = new Map();

// Initialize exchange with configuration
const initializeExchange = (exchangeId: string): any => {
    try {
        const exchangeClass = (ccxt as any)[exchangeId];
        if (!exchangeClass) {
            throw new ExchangeError(`Exchange ${exchangeId} is not supported`, exchangeId);
        }

        // Get exchange configuration
        const exchangeConfig = config.exchanges[exchangeId as keyof typeof config.exchanges];

        const exchange = new exchangeClass({
            apiKey: exchangeConfig?.apiKey,
            secret: exchangeConfig?.secretKey,
            timeout: 30000,
            enableRateLimit: true,
            sandbox: config.nodeEnv === 'development',
        });

        exchangeInstances.set(exchangeId, exchange);
        return exchange;
    } catch (error: any) {
        logError(`Failed to initialize exchange ${exchangeId}`, error);
        throw new ExchangeError(`Failed to initialize exchange ${exchangeId}: ${error.message}`, exchangeId);
    }
};

// Get or create exchange instance
const getExchange = (exchangeId: string): any => {
    if (!exchangeInstances.has(exchangeId)) {
        return initializeExchange(exchangeId);
    }
    return exchangeInstances.get(exchangeId)!;
};

// Legacy function for backward compatibility
export const getBTCPriceFromExchange = async (exchangeId: string, symbol: string): Promise<number> => {
    return getPriceFromExchange(exchangeId, symbol);
};

// Enhanced price fetching function
export const getPriceFromExchange = async (exchangeId: string, symbol: string): Promise<number> => {
    try {
        logExchangeOperation(exchangeId, 'fetchTicker', symbol);

        const exchange = getExchange(exchangeId);
        const ticker = await exchange.fetchTicker(symbol);

        if (!ticker || !ticker.last) {
            throw new ExchangeError(`No price data available for ${symbol} on ${exchangeId}`, exchangeId);
        }

        return ticker.last;
    } catch (error: any) {
        if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('ENOTFOUND')) {
            throw new NetworkError(`Network error connecting to ${exchangeId}`, `${exchangeId}/ticker/${symbol}`);
        }

        logError(`Error fetching price from ${exchangeId}`, error, { symbol });
        throw new ExchangeError(`Error fetching price from ${exchangeId}: ${error?.message || 'Unknown error'}`, exchangeId, 'fetchTicker');
    }
};

// Get OHLCV data
export const getOHLCVFromExchange = async (
    exchangeId: string,
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100,
    since?: number
): Promise<number[][]> => {
    try {
        logExchangeOperation(exchangeId, 'fetchOHLCV', symbol);

        const exchange = getExchange(exchangeId);

        if (!exchange.has['fetchOHLCV']) {
            throw new ExchangeError(`Exchange ${exchangeId} does not support OHLCV data`, exchangeId);
        }

        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, since, limit);

        if (!ohlcv || ohlcv.length === 0) {
            throw new ExchangeError(`No OHLCV data available for ${symbol} on ${exchangeId}`, exchangeId);
        }

        return ohlcv;
    } catch (error: any) {
        logError(`Error fetching OHLCV from ${exchangeId}`, error, { symbol, timeframe, limit });
        throw new ExchangeError(`Error fetching OHLCV from ${exchangeId}: ${error?.message || 'Unknown error'}`, exchangeId, 'fetchOHLCV');
    }
};