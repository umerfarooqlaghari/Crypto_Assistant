import { Request, Response } from 'express';
import { getBinanceService, getTechnicalAnalysisService, getCoinGeckoService } from '../Services/serviceManager';
import EnhancedSignalOrchestrator from '../Services/enhancedSignalOrchestrator';
import { logSignalGeneration, logError, logInfo } from '../utils/logger';
import { ExchangeError } from '../middleware/errorHandler';
import { BinanceSymbol } from '../Services/binanceService';

// Lazy initialization to avoid accessing services before ServiceManager is initialized
let sharedSignalOrchestrator: EnhancedSignalOrchestrator | null = null;

const getServices = () => {
  // Create singleton EnhancedSignalOrchestrator to avoid duplicate BinanceService instances
  if (!sharedSignalOrchestrator) {
    sharedSignalOrchestrator = new EnhancedSignalOrchestrator();
  }

  return {
    binanceService: getBinanceService(),
    coinGeckoService: getCoinGeckoService(),
    technicalAnalysis: getTechnicalAnalysisService(),
    signalOrchestrator: sharedSignalOrchestrator
  };
};

// Get all available trading symbols
export const getAvailableSymbols = async (_req: Request, res: Response) => {
    try {
        logInfo('Fetching available trading symbols');

        const { binanceService } = getServices();
        const symbols = await (binanceService as any).getAllSymbols();
        
        // Filter and format for frontend
        const majorPairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'];

        // Ensure major pairs are always included
        const majorSymbols = symbols.filter((symbol: BinanceSymbol) => majorPairs.includes(symbol.symbol));
        const otherSymbols = symbols
            .filter((symbol: BinanceSymbol) => !majorPairs.includes(symbol.symbol) && parseFloat(symbol.volume) > 1000000)
            .slice(0, 90); // Leave room for major pairs

        const allSymbols = [...majorSymbols, ...otherSymbols]
            .slice(0, 100) // Top 100 total
            .map(symbol => ({
                symbol: symbol.symbol,
                baseAsset: symbol.baseAsset,
                quoteAsset: symbol.quoteAsset,
                price: parseFloat(symbol.price),
                volume: parseFloat(symbol.volume),
                priceChange24h: parseFloat(symbol.priceChangePercent)
            }));

        const formattedSymbols = allSymbols;

        res.json({
            total: formattedSymbols.length,
            symbols: formattedSymbols,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logError('Error fetching available symbols', error);
        throw new ExchangeError(`Error fetching symbols: ${error?.message || 'Unknown error'}`, 'symbol-service');
    }
};

// Enhanced signal generation with comprehensive analysis
export const generateAdvancedSignals = async (req: Request, res: Response) => {
    try {
        const { symbol, timeframe = '1h' } = req.query;

        if (!symbol) {
            return res.status(400).json({
                error: 'Symbol is required',
                message: 'Please provide a trading symbol (e.g., BTCUSDT)',
            });
        }

        logInfo(`Generating advanced signals for ${symbol} on ${timeframe}`);

        const { binanceService, technicalAnalysis } = getServices();

        // Get current price and market data
        const [currentPrice, ticker24hr] = await Promise.all([
            (binanceService as any).getCurrentPrice(symbol as string),
            (binanceService as any).getTicker24hr(symbol as string)
        ]);

        // Calculate technical indicators
        const indicators = await technicalAnalysis.calculateIndicators(
            'binance',
            symbol as string,
            timeframe as string
        );

        // Get OHLCV data for pattern analysis
        const ohlcv = await (binanceService as any).getOHLCV(symbol as string, timeframe as string, 100);

        // Detect chart patterns
        const chartPatterns = technicalAnalysis.detectChartPatterns(ohlcv, indicators);

        // Detect candlestick patterns
        const candlestickPatterns = technicalAnalysis.detectCandlestickPatterns(ohlcv);

        // Generate comprehensive trading signal
        const tradingSignal = technicalAnalysis.generateTradingSignal(
            currentPrice,
            indicators,
            chartPatterns,
            candlestickPatterns
        );

        logSignalGeneration(
            symbol as string, 
            timeframe as string, 
            tradingSignal.action, 
            tradingSignal.confidence
        );

        return res.json({
            symbol,
            timeframe,
            timestamp: new Date().toISOString(),
            currentPrice,
            marketData: {
                price: ticker24hr.price,
                priceChange24h: ticker24hr.priceChangePercent,
                volume: ticker24hr.volume, // Quote asset volume (USD value)
                high24h: ticker24hr.high,
                low24h: ticker24hr.low
            },
            technicalIndicators: {
                rsi: indicators.rsi,
                macd: {
                    MACD: indicators.macd.MACD,
                    signal: indicators.macd.signal,
                    histogram: indicators.macd.histogram
                },
                bollingerBands: {
                    upper: indicators.bollingerBands.upper,
                    middle: indicators.bollingerBands.middle,
                    lower: indicators.bollingerBands.lower
                },
                ema20: indicators.ema20,
                ema50: indicators.ema50,
                adx: indicators.adx
            },
            chartPatterns,
            candlestickPatterns,
            signal: {
                action: tradingSignal.action,
                confidence: Math.round(tradingSignal.confidence),
                strength: Math.round(tradingSignal.strength),
                entry: tradingSignal.entry,
                stopLoss: tradingSignal.stopLoss,
                takeProfit1: tradingSignal.takeProfit1,
                takeProfit2: tradingSignal.takeProfit2,
                takeProfit3: tradingSignal.takeProfit3,
                reasoning: tradingSignal.reasoning
            }
        });
    } catch (error: any) {
        logError(`Error generating advanced signals for ${req.query.symbol}`, error);
        return res.status(500).json({
            error: 'Internal server error',
            message: `Error generating advanced signals: ${error?.message || 'Unknown error'}`
        });
    }
};

// Get multi-timeframe analysis
export const getMultiTimeframeAnalysis = async (req: Request, res: Response) => {
    try {
        const { symbol } = req.query;
        const timeframes = ['5m', '15m', '4h'];

        if (!symbol) {
            return res.status(400).json({
                error: 'Symbol is required',
                message: 'Please provide a trading symbol (e.g., BTCUSDT)',
            });
        }

        logInfo(`Generating multi-timeframe analysis for ${symbol}`);

        const { binanceService, technicalAnalysis } = getServices();

        const analysisPromises = timeframes.map(async (timeframe: string) => {
            try {
                const indicators = await technicalAnalysis.calculateIndicators(
                    'binance',
                    symbol as string,
                    timeframe
                );

                const ohlcv = await (binanceService as any).getOHLCV(symbol as string, timeframe, 50);
                const chartPatterns = technicalAnalysis.detectChartPatterns(ohlcv, indicators);
                const candlestickPatterns = technicalAnalysis.detectCandlestickPatterns(ohlcv);

                const currentPrice = await (binanceService as any).getCurrentPrice(symbol as string);
                const signal = technicalAnalysis.generateTradingSignal(
                    currentPrice, indicators, chartPatterns, candlestickPatterns
                );

                return {
                    timeframe,
                    signal: signal.action,
                    confidence: Math.round(signal.confidence),
                    strength: Math.round(signal.strength),
                    rsi: Math.round(indicators.rsi * 100) / 100,
                    trend: indicators.ema20 > indicators.ema50 ? 'BULLISH' : 'BEARISH'
                };
            } catch (error) {
                logError(`Error analyzing ${timeframe} for ${symbol}`, error as Error);
                return {
                    timeframe,
                    signal: 'HOLD',
                    confidence: 0,
                    strength: 0,
                    rsi: 50,
                    trend: 'NEUTRAL',
                    error: 'Analysis failed'
                };
            }
        });

        const results = await Promise.all(analysisPromises);
        
        // Calculate overall consensus
        const validResults = results.filter(r => !r.error);
        const buySignals = validResults.filter(r => r.signal === 'BUY').length;
        const sellSignals = validResults.filter(r => r.signal === 'SELL').length;
        
        let consensus: 'BUY' | 'SELL' | 'HOLD';
        if (buySignals > sellSignals) {
            consensus = 'BUY';
        } else if (sellSignals > buySignals) {
            consensus = 'SELL';
        } else {
            consensus = 'HOLD';
        }

        const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

        return res.json({
            symbol,
            timestamp: new Date().toISOString(),
            consensus: {
                signal: consensus,
                confidence: Math.round(avgConfidence),
                agreement: Math.round((Math.max(buySignals, sellSignals) / validResults.length) * 100)
            },
            timeframes: results
        });
    } catch (error: any) {
        logError(`Error generating multi-timeframe analysis for ${req.query.symbol}`, error);
        return res.status(500).json({
            error: 'Internal server error',
            message: `Error generating multi-timeframe analysis: ${error?.message || 'Unknown error'}`
        });
    }
};

// Get market overview with top movers
export const getMarketOverview = async (_req: Request, res: Response) => {
    try {
        logInfo('Fetching market overview');

        const { binanceService, coinGeckoService } = getServices();

        const [symbols, globalData] = await Promise.all([
            (binanceService as any).getAllSymbols(),
            coinGeckoService.getGlobalData().catch(() => null)
        ]);

        // Get top gainers and losers
        const sortedByChange = symbols
            .filter((s: any) => parseFloat(s.volume) > 100000)
            .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));

        const topGainers = sortedByChange.slice(0, 10).map((s: any) => ({
            symbol: s.symbol,
            price: parseFloat(s.price),
            change: parseFloat(s.priceChangePercent),
            volume: parseFloat(s.volume)
        }));

        const topLosers = sortedByChange.slice(-10).reverse().map((s: any) => ({
            symbol: s.symbol,
            price: parseFloat(s.price),
            change: parseFloat(s.priceChangePercent),
            volume: parseFloat(s.volume)
        }));

        // Get top by volume
        const topByVolume = symbols
            .sort((a: BinanceSymbol, b: BinanceSymbol) => parseFloat(b.volume) - parseFloat(a.volume))
            .slice(0, 10)
            .map((s: BinanceSymbol) => ({
                symbol: s.symbol,
                price: parseFloat(s.price),
                change: parseFloat(s.priceChangePercent),
                volume: parseFloat(s.volume)
            }));

        res.json({
            timestamp: new Date().toISOString(),
            globalData: globalData ? {
                totalMarketCap: globalData.total_market_cap.usd,
                totalVolume: globalData.total_volume.usd,
                marketCapChange24h: globalData.market_cap_change_percentage_24h_usd,
                activeCryptocurrencies: globalData.active_cryptocurrencies
            } : null,
            topGainers,
            topLosers,
            topByVolume
        });
    } catch (error: any) {
        logError('Error fetching market overview', error);
        throw new ExchangeError(`Error fetching market overview: ${error?.message || 'Unknown error'}`, 'market-service');
    }
};

// Enhanced signal processing with configurable thresholds and notifications
export const generateEnhancedSignalWithNotifications = async (req: Request, res: Response) => {
    try {
        const { symbol, timeframe = '1h', exchange = 'binance' } = req.query;

        if (!symbol) {
            throw new ExchangeError('Symbol parameter is required', 'validation');
        }

        logInfo(`Generating enhanced signal with notifications for ${symbol} ${timeframe}`);

        const { signalOrchestrator } = getServices();

        const result = await signalOrchestrator.processSignal(
            symbol as string,
            timeframe as string,
            exchange as string
        );

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logError('Error generating enhanced signal', error);
        throw new ExchangeError(`Error generating enhanced signal: ${error?.message || 'Unknown error'}`, 'enhanced-signal-service');
    }
};

// Multi-timeframe analysis with notifications
export const generateMultiTimeframeWithNotifications = async (req: Request, res: Response) => {
    try {
        const { symbol, timeframes, exchange = 'binance' } = req.query;

        if (!symbol) {
            throw new ExchangeError('Symbol parameter is required', 'validation');
        }

        const customTimeframes = timeframes ? (timeframes as string).split(',') : undefined;

        logInfo(`Generating multi-timeframe analysis with notifications for ${symbol}`);

        const { signalOrchestrator } = getServices();

        const result = await signalOrchestrator.processMultiTimeframeSignal(
            symbol as string,
            customTimeframes,
            exchange as string
        );

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logError('Error generating multi-timeframe analysis', error);
        throw new ExchangeError(`Error generating multi-timeframe analysis: ${error?.message || 'Unknown error'}`, 'multi-timeframe-service');
    }
};

// Batch process multiple symbols
export const processBatchSignals = async (req: Request, res: Response) => {
    try {
        const { symbols, timeframe = '1h', exchange = 'binance' } = req.body;

        if (!symbols || !Array.isArray(symbols)) {
            throw new ExchangeError('Symbols array is required in request body', 'validation');
        }

        logInfo(`Processing batch signals for ${symbols.length} symbols`);

        const { signalOrchestrator } = getServices();

        const results = await signalOrchestrator.processBatchSignals(
            symbols,
            timeframe,
            exchange
        );

        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: symbols.length,
                    successful: results.filter((r: any) => r.saved).length,
                    totalNotifications: results.reduce((sum: any, r: any) => sum + r.notifications.length, 0)
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logError('Error processing batch signals', error);
        throw new ExchangeError(`Error processing batch signals: ${error?.message || 'Unknown error'}`, 'batch-signal-service');
    }
};

// Get processing statistics
export const getProcessingStats = async (req: Request, res: Response) => {
    try {
        const { days = 7 } = req.query;

        const { signalOrchestrator } = getServices();

        const stats = await signalOrchestrator.getProcessingStats(parseInt(days as string));

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logError('Error fetching processing stats', error);
        throw new ExchangeError(`Error fetching processing stats: ${error?.message || 'Unknown error'}`, 'stats-service');
    }
};
