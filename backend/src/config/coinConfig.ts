/**
 * Centralized coin configuration for the crypto assistant
 * This ensures all services use the same coin lists and are synchronized
 * Top 50 coins are fetched dynamically from Binance WebSocket when needed
 */



// Top 50 best cryptocurrencies by market cap and established reputation
// These are the most reliable, liquid, and established coins in the crypto market
const TOP_50_BEST_COINS = [
  // Top 10 - Most established and liquid
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'AVAXUSDT', 'LINKUSDT',

  // Top 11-20 - Major altcoins with strong fundamentals
  'DOTUSDT', 'LTCUSDT', 'SHIBUSDT', 'UNIUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'HBARUSDT',

  // Top 21-30 - Established projects with good liquidity
  'ETCUSDT', 'NEARUSDT', 'ALGOUSDT', 'MANAUSDT', 'SANDUSDT', 'AXSUSDT', 'FLOWUSDT', 'EGLDUSDT', 'XTZUSDT', 'CHZUSDT',

  // Top 31-40 - DeFi & Layer 1/2 Protocols
  'THETAUSDT', 'APEUSDT', 'OPUSDT', 'ARBUSDT', 'INJUSDT', 'SUIUSDT', 'APTUSDT', 'SEIUSDT', 'BCHUSDT', 'PEPEUSDT',

  // Top 41-50 - Gaming, Utility & Infrastructure
  'AAVEUSDT', 'DASHUSDT', 'ZECUSDT', 'QTUMUSDT', 'GALAUSDT', 'ENJUSDT', 'IMXUSDT', 'GRTUSDT', 'FETUSDT', 'RENDERUSDT'
];



// Get top 50 best coins directly from curated list (eliminates all-tickers stream)
// This removes the massive bandwidth consumption from the !ticker@arr stream
export function fetchTop50CoinsFromWebSocket(): Promise<string[]> {
  return new Promise((resolve) => {
    console.log('Using curated top 50 best coins (no all-tickers stream needed)...');

    // Return our curated list directly - these are already the best established coins
    // Individual ticker streams will validate availability when they connect
    const selectedCoins = TOP_50_BEST_COINS.slice(0, 50);

    console.log(`✅ Selected ${selectedCoins.length} coins from curated list`);
    console.log('Coins:', selectedCoins.join(', '));

    // Resolve immediately - no WebSocket needed, eliminates all-tickers bandwidth usage
    resolve(selectedCoins);
  });
}

// Legacy function for backward compatibility
export function fetchTop30CoinsFromWebSocket(): Promise<string[]> {
  return new Promise((resolve) => {
    console.log('Using curated top 30 best coins (legacy endpoint)...');
    const selectedCoins = TOP_50_BEST_COINS.slice(0, 30);
    console.log(`✅ Selected ${selectedCoins.length} coins from curated list (legacy)`);
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
  'PAXGUSDT', 'CROUSDT', 'MKRUSDT', 'COMPUSDT', 'SNXUSDT', 'YFIUSDT', 'SUSHIUSDT',
  'CAKEUSDT', 'BATUSDT', 'ZRXUSDT', 'OMGUSDT', 'LRCUSDT', 'RLCUSDT', 'STORJUSDT', 'BANDUSDT',
  'ONTUSDT', 'ZILUSDT', 'IOTAUSDT', 'NEOUSDT', 'SLPUSDT', 'CHRUSDT', 'TLMUSDT', 'ALICEUSDT', 'STARUSDT',
  'ROSEUSDT', 'KAVAUSDT', 'OCEANUSDT', 'LDOUSDT', 'TONUSDT', 'ENSUSDT',

  // Coins with data issues (showing $0.00 price)
  'XMRUSDT', 'EOSUSDT'
];

// Supported timeframes for analysis
export const SUPPORTED_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

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
