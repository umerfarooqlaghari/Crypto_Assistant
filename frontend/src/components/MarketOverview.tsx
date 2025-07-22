'use client';

import { useState, useEffect } from 'react';
import { Globe, TrendingUp, TrendingDown, Volume2 } from 'lucide-react';
import { getApiUrl, API_CONFIG } from '../utils/api';

interface MarketData {
  globalData: {
    totalMarketCap: number;
    totalVolume: number;
    marketCapChange24h: number;
    activeCryptocurrencies: number;
  } | null;
  topGainers: Array<{
    symbol: string;
    price: number;
    change: number;
    volume: number;
  }>;
  topLosers: Array<{
    symbol: string;
    price: number;
    change: number;
    volume: number;
  }>;
  topByVolume: Array<{
    symbol: string;
    price: number;
    change: number;
    volume: number;
  }>;
}

export default function MarketOverview() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume'>('gainers');

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MARKET_OVERVIEW));
        if (response.ok) {
          const data = await response.json();
          setMarketData(data);
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price === null || price === undefined || isNaN(price)) {
      return '$0.00';
    }

    // Handle very small numbers (less than $0.01)
    if (price < 0.01 && price > 0) {
      // For extremely small numbers, use scientific notation
      if (price < 0.000000001) {
        return `$${price.toExponential(3)}`;
      } else {
        // Show up to 15 decimal places for small numbers
        const significantDigits = Math.max(2, Math.ceil(-Math.log10(price)) + 3);
        const maxDigits = Math.min(significantDigits, 15);

        // Use toFixed for better control over decimal places
        const formatted = price.toFixed(maxDigits);
        // Remove trailing zeros
        const trimmed = formatted.replace(/\.?0+$/, '');
        return `$${trimmed}`;
      }
    }

    // For normal prices (>= $0.01)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(price);
  };

  const formatLargeNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getTabData = () => {
    if (!marketData) return [];
    
    switch (activeTab) {
      case 'gainers': return marketData.topGainers;
      case 'losers': return marketData.topLosers;
      case 'volume': return marketData.topByVolume;
      default: return [];
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-white/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <Globe className="w-5 h-5 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-100">Market Overview</h3>
      </div>

      {/* Global Stats */}
      {marketData?.globalData && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
            <div className="text-sm text-gray-400 mb-1">Market Cap</div>
            <div className="text-lg font-semibold text-gray-100">
              ${formatLargeNumber(marketData.globalData.totalMarketCap)}
            </div>
            <div className={`text-sm ${getChangeColor(marketData.globalData.marketCapChange24h)}`}>
              {formatPercentage(marketData.globalData.marketCapChange24h)}
            </div>
          </div>
          
          <div className="p-3 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
            <div className="text-sm text-gray-400 mb-1">24h Volume</div>
            <div className="text-lg font-semibold text-gray-100">
              ${formatLargeNumber(marketData.globalData.totalVolume)}
            </div>
            <div className="text-sm text-gray-400">
              {marketData.globalData.activeCryptocurrencies} coins
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gradient-to-r from-gray-700/30 to-gray-600/20 rounded-lg p-1 mb-4">
        <button
          onClick={() => setActiveTab('gainers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'gainers'
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Gainers
        </button>
        <button
          onClick={() => setActiveTab('losers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'losers'
              ? 'bg-red-500/20 text-red-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Losers
        </button>
        <button
          onClick={() => setActiveTab('volume')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'volume'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          Volume
        </button>
      </div>

      {/* Symbol List */}
      <div className="space-y-2">
        {getTabData().slice(0, 5).map((item, index) => (
          <div key={item.symbol} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30 hover:from-gray-600/30 hover:to-gray-500/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-400 w-4">
                {index + 1}
              </div>
              <div>
                <div className="font-medium text-gray-100">{item.symbol}</div>
                <div className="text-sm text-gray-400">
                  Vol: {formatLargeNumber(item.volume)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-100 font-medium">
                {formatPrice(item.price)}
              </div>
              <div className={`text-sm font-medium ${getChangeColor(item.change)}`}>
                {formatPercentage(item.change)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
