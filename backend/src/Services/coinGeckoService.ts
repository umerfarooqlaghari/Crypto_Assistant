import axios from 'axios';
import { logDebug, logError, logInfo } from '../utils/logger';
import { config } from '../config/config';

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  total_volume: number;
  circulating_supply: number;
  max_supply: number;
  image: string;
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    market_cap_rank: number;
    circulating_supply: number;
    max_supply: number;
  };
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  developer_score: number;
  community_score: number;
  liquidity_score: number;
  public_interest_score: number;
}

export interface CoinGeckoGlobalData {
  active_cryptocurrencies: number;
  upcoming_icos: number;
  ongoing_icos: number;
  ended_icos: number;
  markets: number;
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { [key: string]: number };
  market_cap_change_percentage_24h_usd: number;
}

export interface CoinGeckoTrendingCoin {
  id: string;
  coin_id: number;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  slug: string;
  price_btc: number;
  score: number;
}

export class CoinGeckoService {
  private baseURL = 'https://api.coingecko.com/api/v3';
  private apiKey: string | undefined;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  constructor() {
    this.apiKey = config.externalApis.coingecko.apiKey;
  }

  private getHeaders() {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }
    
    return headers;
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Get top cryptocurrencies by market cap
  async getTopCoins(limit: number = 100, page: number = 1): Promise<CoinGeckoCoin[]> {
    try {
      const cacheKey = `top-coins-${limit}-${page}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      logDebug(`Fetching top ${limit} coins from CoinGecko`);
      
      const response = await axios.get(`${this.baseURL}/coins/markets`, {
        headers: this.getHeaders(),
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page,
          sparkline: false,
          price_change_percentage: '24h,7d'
        }
      });

      const coins: CoinGeckoCoin[] = response.data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        current_price: coin.current_price,
        market_cap: coin.market_cap,
        market_cap_rank: coin.market_cap_rank,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        price_change_percentage_7d: coin.price_change_percentage_7d_in_currency,
        total_volume: coin.total_volume,
        circulating_supply: coin.circulating_supply,
        max_supply: coin.max_supply,
        image: coin.image
      }));

      this.setCachedData(cacheKey, coins);
      logInfo(`Fetched ${coins.length} coins from CoinGecko`);
      return coins;
    } catch (error) {
      logError('Error fetching top coins from CoinGecko', error as Error);
      throw error;
    }
  }

  // Get detailed coin information
  async getCoinDetails(coinId: string): Promise<CoinGeckoMarketData> {
    try {
      const cacheKey = `coin-details-${coinId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      logDebug(`Fetching details for coin: ${coinId}`);
      
      const response = await axios.get(`${this.baseURL}/coins/${coinId}`, {
        headers: this.getHeaders(),
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: true,
          developer_data: true,
          sparkline: false
        }
      });

      const coin = response.data;
      const marketData: CoinGeckoMarketData = {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        market_data: {
          current_price: coin.market_data.current_price,
          market_cap: coin.market_data.market_cap,
          total_volume: coin.market_data.total_volume,
          price_change_percentage_24h: coin.market_data.price_change_percentage_24h,
          price_change_percentage_7d: coin.market_data.price_change_percentage_7d,
          price_change_percentage_30d: coin.market_data.price_change_percentage_30d,
          market_cap_rank: coin.market_cap_rank,
          circulating_supply: coin.market_data.circulating_supply,
          max_supply: coin.market_data.max_supply
        },
        sentiment_votes_up_percentage: coin.sentiment_votes_up_percentage || 0,
        sentiment_votes_down_percentage: coin.sentiment_votes_down_percentage || 0,
        developer_score: coin.developer_score || 0,
        community_score: coin.community_score || 0,
        liquidity_score: coin.liquidity_score || 0,
        public_interest_score: coin.public_interest_score || 0
      };

      this.setCachedData(cacheKey, marketData);
      return marketData;
    } catch (error) {
      logError(`Error fetching coin details for ${coinId}`, error as Error);
      throw error;
    }
  }

  // Get global cryptocurrency market data
  async getGlobalData(): Promise<CoinGeckoGlobalData> {
    try {
      const cacheKey = 'global-data';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      logDebug('Fetching global market data from CoinGecko');
      
      const response = await axios.get(`${this.baseURL}/global`, {
        headers: this.getHeaders()
      });

      const globalData: CoinGeckoGlobalData = {
        active_cryptocurrencies: response.data.data.active_cryptocurrencies,
        upcoming_icos: response.data.data.upcoming_icos,
        ongoing_icos: response.data.data.ongoing_icos,
        ended_icos: response.data.data.ended_icos,
        markets: response.data.data.markets,
        total_market_cap: response.data.data.total_market_cap,
        total_volume: response.data.data.total_volume,
        market_cap_percentage: response.data.data.market_cap_percentage,
        market_cap_change_percentage_24h_usd: response.data.data.market_cap_change_percentage_24h_usd
      };

      this.setCachedData(cacheKey, globalData);
      return globalData;
    } catch (error) {
      logError('Error fetching global data from CoinGecko', error as Error);
      throw error;
    }
  }

  // Get trending coins
  async getTrendingCoins(): Promise<CoinGeckoTrendingCoin[]> {
    try {
      const cacheKey = 'trending-coins';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      logDebug('Fetching trending coins from CoinGecko');
      
      const response = await axios.get(`${this.baseURL}/search/trending`, {
        headers: this.getHeaders()
      });

      const trendingCoins: CoinGeckoTrendingCoin[] = response.data.coins.map((item: any) => ({
        id: item.item.id,
        coin_id: item.item.coin_id,
        name: item.item.name,
        symbol: item.item.symbol,
        market_cap_rank: item.item.market_cap_rank,
        thumb: item.item.thumb,
        small: item.item.small,
        large: item.item.large,
        slug: item.item.slug,
        price_btc: item.item.price_btc,
        score: item.item.score
      }));

      this.setCachedData(cacheKey, trendingCoins);
      return trendingCoins;
    } catch (error) {
      logError('Error fetching trending coins from CoinGecko', error as Error);
      throw error;
    }
  }

  // Search for coins
  async searchCoins(query: string): Promise<any[]> {
    try {
      logDebug(`Searching for coins with query: ${query}`);
      
      const response = await axios.get(`${this.baseURL}/search`, {
        headers: this.getHeaders(),
        params: { query }
      });

      return response.data.coins.slice(0, 10); // Limit to top 10 results
    } catch (error) {
      logError(`Error searching for coins with query: ${query}`, error as Error);
      throw error;
    }
  }

  // Get coin price by symbol (convert to CoinGecko ID)
  async getCoinPrice(symbol: string): Promise<number> {
    try {
      // First, search for the coin to get its ID
      const searchResults = await this.searchCoins(symbol);
      if (searchResults.length === 0) {
        throw new Error(`Coin not found: ${symbol}`);
      }

      const coinId = searchResults[0].id;
      const coinDetails = await this.getCoinDetails(coinId);
      
      return coinDetails.market_data.current_price.usd;
    } catch (error) {
      logError(`Error getting price for ${symbol}`, error as Error);
      throw error;
    }
  }

  // Get market sentiment analysis
  async getMarketSentiment(coinId: string): Promise<{
    bullish: number;
    bearish: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    try {
      const coinDetails = await this.getCoinDetails(coinId);
      
      const bullish = coinDetails.sentiment_votes_up_percentage;
      const bearish = coinDetails.sentiment_votes_down_percentage;
      
      let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      if (bullish > bearish + 10) {
        sentiment = 'BULLISH';
      } else if (bearish > bullish + 10) {
        sentiment = 'BEARISH';
      } else {
        sentiment = 'NEUTRAL';
      }

      return { bullish, bearish, sentiment };
    } catch (error) {
      logError(`Error getting market sentiment for ${coinId}`, error as Error);
      throw error;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    logInfo('CoinGecko cache cleared');
  }
}
