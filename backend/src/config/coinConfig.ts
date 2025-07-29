/**
 * Centralized coin configuration for the crypto assistant
 * This ensures all services use the same coin lists and are synchronized
 * Top 50 coins are fetched dynamically from Binance WebSocket when needed
 */



// Top 30 best cryptocurrencies by market cap and established reputation
// These are the most reliable, liquid, and established coins in the crypto market
const TOP_30_BEST_COINS = [
  // Top 10 - Most established and liquid
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'AVAXUSDT', 'LINKUSDT',

  // Top 11-20 - Major altcoins with strong fundamentals
  'DOTUSDT', 'LTCUSDT', 'SHIBUSDT', 'UNIUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'HBARUSDT',

  // Top 21-30 - Established projects with good liquidity
  'ETCUSDT', 'NEARUSDT', 'ALGOUSDT', 'MANAUSDT', 'SANDUSDT', 'AXSUSDT', 'FLOWUSDT', 'EGLDUSDT', 'XTZUSDT', 'CHZUSDT'
];



// Get top 30 best coins directly from curated list (eliminates all-tickers stream)
// This removes the massive bandwidth consumption from the !ticker@arr stream
export function fetchTop30CoinsFromWebSocket(): Promise<string[]> {
  return new Promise((resolve) => {
    console.log('Using curated top 30 best coins (no all-tickers stream needed)...');

    // Return our curated list directly - these are already the best established coins
    // Individual ticker streams will validate availability when they connect
    const selectedCoins = TOP_30_BEST_COINS.slice(0, 30);

    console.log(`✅ Selected ${selectedCoins.length} coins from curated list`);
    console.log('Coins:', selectedCoins.join(', '));

    // Resolve immediately - no WebSocket needed, eliminates all-tickers bandwidth usage
    resolve(selectedCoins);
  });
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
export const SUPPORTED_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

// Get all coins that should be tracked (top 30 from WebSocket)
export async function getAllTrackedCoins(): Promise<string[]> {
  const topCoins = await fetchTop30CoinsFromWebSocket();
  return [...topCoins];
}

// Check if a coin should be excluded
export function isCoinExcluded(symbol: string): boolean {
  return EXCLUDED_COINS.includes(symbol);
}

// Check if a coin is in the top coins list
export async function isTopCoin(symbol: string): Promise<boolean> {
  const topCoins = await fetchTop30CoinsFromWebSocket();
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
  const topCoins = await fetchTop30CoinsFromWebSocket();
  const trackedCoins = await getAllTrackedCoins();

  return {
    topCoins: topCoins.length,
    excludedCoins: EXCLUDED_COINS.length,
    supportedTimeframes: SUPPORTED_TIMEFRAMES.length,
    totalTrackedCoins: trackedCoins.length
  };
}
