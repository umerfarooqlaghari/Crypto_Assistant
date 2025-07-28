/**
 * Centralized coin configuration for the crypto assistant
 * This ensures all services use the same coin lists and are synchronized
 * Top 50 coins are fetched dynamically from Binance WebSocket when needed
 */

import WebSocket from 'ws';

// Fallback coins in case WebSocket fails (most reliable major cryptocurrencies)
const FALLBACK_COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT',
  'SHIBUSDT', 'AVAXUSDT', 'UNIUSDT', 'LINKUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'ETCUSDT'
];

// No caching - always fetch fresh data

// Interface for Binance WebSocket ticker data
interface BinanceWSTickerData {
  e: string;      // Event type
  E: number;      // Event time
  s: string;      // Symbol
  c: string;      // Close price
  o: string;      // Open price
  h: string;      // High price
  l: string;      // Low price
  v: string;      // Total traded base asset volume
  q: string;      // Total traded quote asset volume
  O: number;      // Statistics open time
  C: number;      // Statistics close time
  F: number;      // First trade ID
  L: number;      // Last trade ID
  n: number;      // Total number of trades
}

// Fetch top 50 coins from Binance WebSocket (called only when user visits coin-list page)
// Always fetches fresh data - no caching
export function fetchTop50CoinsFromWebSocket(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    console.log('Fetching fresh top 50 coins from Binance WebSocket...');

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
    let dataReceived = false;

    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      if (!dataReceived) {
        console.log('WebSocket timeout, using fallback coins');
        ws.close();
        resolve(FALLBACK_COINS);
      }
    }, 10000); // 10 second timeout

    ws.on('open', () => {
      console.log('Connected to Binance WebSocket for top coins fetch');
    });

    ws.on('message', (data: Buffer) => {
      try {
        const tickers: BinanceWSTickerData[] = JSON.parse(data.toString());

        if (Array.isArray(tickers) && tickers.length > 0) {
          dataReceived = true;
          clearTimeout(timeout);

          // Filter for USDT pairs and sort by quote volume
          const usdtPairs = tickers
            .filter(ticker =>
              ticker.s.endsWith('USDT') &&
              !isSymbolExcluded(ticker.s) &&
              parseFloat(ticker.q) > 1000000 // Min $1M quote volume (reduced from $10M)
            )
            .sort((a, b) => parseFloat(b.q) - parseFloat(a.q)) // Sort by quote volume desc
            .slice(0, 50) // Top 50
            .map(ticker => ticker.s);

          console.log(`Successfully fetched top ${usdtPairs.length} coins from WebSocket`);
          ws.close();
          resolve(usdtPairs);
        }
      } catch (error) {
        console.error('Error parsing WebSocket data:', error);
        clearTimeout(timeout);
        ws.close();
        resolve(FALLBACK_COINS);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearTimeout(timeout);
      resolve(FALLBACK_COINS);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
}

// Helper function to check if symbol should be excluded
function isSymbolExcluded(symbol: string): boolean {
  return EXCLUDED_COINS.includes(symbol);
}

// Coins to exclude (new, unstable, stablecoins, wrapped tokens)
export const EXCLUDED_COINS = [
  // New/unstable coins
  'SAHARAUSDT', 'ERAUSDT', 'CUSDT', 'LAUSDT', 'NEWTUSDT', 'RESOLVUSDT',
  
  // Stablecoins
  'FDUSDUSDT', 'USDCUSDT', 'TUSDUSDT', 'BUSDUSDT', 'DAIUSDT', 'USDPUSDT',
  
  // Wrapped tokens
  'WBTCUSDT', 'WETHUSDT', 'STETHUSDT', 'WBNBUSDT',
  
  // Test/demo coins
  'TESTUSDT', 'DEMOUSDT',

  // Delisted or problematic coins (getting 403 errors from Binance WebSocket)
  'FLOWUSDT', 'PAXGUSDT', 'CROUSDT', 'MKRUSDT', 'AAVEUSDT', 'COMPUSDT', 'SNXUSDT', 'YFIUSDT', 'SUSHIUSDT',
  'CAKEUSDT', 'CHZUSDT', 'ENJUSDT', 'BATUSDT', 'ZRXUSDT', 'OMGUSDT', 'LRCUSDT', 'RLCUSDT', 'STORJUSDT', 'BANDUSDT',
  'QTUMUSDT', 'ONTUSDT', 'ZILUSDT', 'IOTAUSDT', 'NEOUSDT', 'SLPUSDT', 'CHRUSDT', 'TLMUSDT', 'ALICEUSDT', 'STARUSDT',
  'ROSEUSDT', 'KAVAUSDT', 'OCEANUSDT', 'NEARUSDT', 'ALGOUSDT', 'MANAUSDT', 'SANDUSDT', 'MATICUSDT', 'APEUSDT',
  'LDOUSDT', 'OPUSDT', 'ARBUSDT', 'TONUSDT', 'FETUSDT', 'ENSUSDT', 'GRTUSDT', 'BCHUSDT', 'EOSUSDT', 'XMRUSDT',
  'DASHUSDT', 'ZECUSDT', 'AXSUSDT', 'GALAUSDT'
];

// Supported timeframes for analysis
export const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

// Get all coins that should be tracked (top 50 from WebSocket)
export async function getAllTrackedCoins(): Promise<string[]> {
  const topCoins = await fetchTop50CoinsFromWebSocket();
  return [...topCoins];
}

// Check if a coin should be excluded
export function isCoinExcluded(symbol: string): boolean {
  return EXCLUDED_COINS.includes(symbol);
}

// Check if a coin is in the top coins list
export async function isTopCoin(symbol: string): Promise<boolean> {
  const topCoins = await fetchTop50CoinsFromWebSocket();
  return topCoins.includes(symbol);
}

// Legacy function for backward compatibility
export async function isEstablishedCoin(symbol: string): Promise<boolean> {
  return await isTopCoin(symbol);
}

// Validate if a coin is valid for tracking (not excluded and meets criteria)
export async function isValidCoinForTracking(symbol: string, volume?: number, price?: number): Promise<boolean> {
  // Exclude problematic coins
  if (isCoinExcluded(symbol)) {
    return false;
  }

  // Always include established coins
  if (await isEstablishedCoin(symbol)) {
    return true;
  }

  // For other coins, check volume and validity criteria
  if (volume && price) {
    const volumeUSD = volume * price;
    return volumeUSD > 10000000; // $10M+ volume
  }

  return false;
}

// Get configuration summary
export async function getCoinConfigSummary() {
  const topCoins = await fetchTop50CoinsFromWebSocket();
  const trackedCoins = await getAllTrackedCoins();

  return {
    topCoins: topCoins.length,
    excludedCoins: EXCLUDED_COINS.length,
    supportedTimeframes: SUPPORTED_TIMEFRAMES.length,
    totalTrackedCoins: trackedCoins.length
  };
}
