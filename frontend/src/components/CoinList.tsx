'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { getApiUrl, getWebSocketUrl, API_CONFIG } from '../utils/api';
import NotificationSystem from './NotificationSystem';

interface ConfidenceSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;
  color: 'green' | 'red' | 'yellow';
  // Pattern data captured at signal generation time for notification consistency
  chartPatterns?: any[];
  candlestickPatterns?: any[];
  technicalIndicators?: any;
  reasoning?: string[];
}

interface CoinListItem {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume: number;
  marketCap?: number;
  confidence: {
    '5m': ConfidenceSignal;
    '15m': ConfidenceSignal;
    '1h': ConfidenceSignal;
    '4h': ConfidenceSignal;
    '1d': ConfidenceSignal;
  };
  lastUpdated: number;
}

interface CoinListStats {
  total_coins: number;
  buy_signals: Record<string, number>;
  sell_signals: Record<string, number>;
  hold_signals: Record<string, number>;
  average_confidence: Record<string, number>;
  average_strength: Record<string, number>;
  price_changes: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export default function CoinList() {
  const [coins, setCoins] = useState<CoinListItem[]>([]);
  const [stats, setStats] = useState<CoinListStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSignal, setFilterSignal] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<{lastUpdate: number, isActive: boolean} | null>(null);

  // Notification cron job state
  const [notificationCronActive, setNotificationCronActive] = useState(false);

  // Use ref to access current coins data in cron job
  const coinsRef = useRef<CoinListItem[]>([]);

  // Update ref whenever coins change
  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);



  const timeframes = [
    { key: '5m', label: '5m' },
    { key: '15m', label: '15m' },
    { key: '1h', label: '1h' },
    { key: '4h', label: '4h' },
    { key: '1d', label: '1d' }
  ] as const;



  // Check service status (this will show up in network tab)
  const checkServiceStatus = async () => {
    try {
      const response = await fetch(getApiUrl(`${API_CONFIG.ENDPOINTS.COIN_LIST}/status`));
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data.data);
        console.log('📊 Service status check:', data.data);
      }
    } catch (error) {
      console.error('Error checking service status:', error);
    }
  };

  // Fetch coin list data - ALWAYS fetches fresh data from WebSocket (no caching)
  const fetchCoinList = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      // Always use top50 endpoint which fetches fresh data from Binance WebSocket
      // This ensures every page visit gets the latest top 50 best coins by market cap and liquidity
      const [coinsResponse, statsResponse] = await Promise.all([
        fetch(getApiUrl(`${API_CONFIG.ENDPOINTS.COIN_LIST}/top50`)),
        fetch(getApiUrl(API_CONFIG.ENDPOINTS.COIN_LIST_STATS))
      ]);

      if (coinsResponse.ok && statsResponse.ok) {
        const coinsData = await coinsResponse.json();
        const statsData = await statsResponse.json();

        console.log('� Fetched coin list data:', coinsData.data?.length || 0, 'coins');
        console.log('🔍 All coins received:', coinsData.data?.map((c: any) => c.symbol) || []);

        setCoins(coinsData.data || []);
        setStats(statsData.data || null);
        setLastUpdate(new Date());
      } else {
        console.error('Failed to fetch coin list data', {
          coinsStatus: coinsResponse.status,
          statsStatus: statsResponse.status
        });
      }
    } catch (error) {
      console.error('Error fetching coin list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Notification cron job function
  const startNotificationCronJob = useCallback(async (): Promise<(() => void) | null> => {
    if (notificationCronActive) {
      console.log('🔔 Notification cron job already active');
      return null;
    }

    console.log('🔔 Starting notification cron job...');
    setNotificationCronActive(true);

    // Check notification rules every 30 seconds
    const cronInterval = setInterval(async () => {
      try {
        // Get current coins data from ref (always up-to-date)
        const currentCoins = coinsRef.current;

        // Only run if we have coins data (stops checking when user navigates away)
        if (currentCoins.length === 0) {
          console.log('🔔 Notification cron: No coins loaded - skipping rule check (user may have navigated away)');
          return;
        }

        console.log('🔔 Notification cron: Checking rules against', currentCoins.length, 'coins');

        // Call the backend endpoint to check notification rules
        const response = await fetch(getApiUrl('/api/admin/notification-rules/check'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coins: currentCoins.map((coin: CoinListItem) => ({
              symbol: coin.symbol,
              name: coin.name,
              price: coin.price,
              priceChange24h: coin.priceChange24h,
              volume: coin.volume,
              confidence: coin.confidence,
              lastUpdated: coin.lastUpdated
            }))
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🔔 Notification cron: Rules checked successfully', result);
        } else {
          console.error('🔔 Notification cron: Failed to check rules', response.status);
        }
      } catch (error) {
        console.error('🔔 Notification cron: Error checking rules', error);
      }
    }, 30000); // Check every 30 seconds

    // Store interval ID for cleanup
    return () => {
      clearInterval(cronInterval);
      setNotificationCronActive(false);
      console.log('🔔 Notification cron job stopped');
    };
  }, [notificationCronActive]); // Remove coins dependency

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const newSocket = io(getWebSocketUrl(), {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket for coin list');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    // Listen for coin list updates (full confidence refresh)
    newSocket.on('coinListUpdate', (data: { data: CoinListItem[], timestamp: number }) => {
      console.log('📊 Received full coin list update with fresh confidence scores:', data.data.length, 'coins');
      setCoins(data.data);
      setLastUpdate(new Date(data.timestamp));
    });

    // Listen for individual coin price updates (real-time WebSocket updates)
    newSocket.on('coinPriceUpdate', (data: { symbol: string, price: number, priceChange24h: number, volume: number, timestamp: number }) => {
      console.log('🔄 Real-time price update:', data.symbol, '$' + data.price.toFixed(6), data.priceChange24h.toFixed(2) + '%');

      setCoins((prevCoins: CoinListItem[]) =>
        prevCoins.map((coin: CoinListItem) =>
          coin.symbol === data.symbol
            ? { ...coin, price: data.price, priceChange24h: data.priceChange24h, volume: data.volume, lastUpdated: data.timestamp }
            : coin
        )
      );
      setLastUpdate(new Date(data.timestamp));
    });

    // Listen for individual coin confidence updates (real-time confidence calculations)
    newSocket.on('coinConfidenceUpdate', (data: { symbol: string, confidence: any, lastUpdated: number, timestamp: number }) => {
      console.log('🎯 Real-time confidence update:', data.symbol, 'confidence updated');

      setCoins((prevCoins: CoinListItem[]) =>
        prevCoins.map((coin: CoinListItem) =>
          coin.symbol === data.symbol
            ? { ...coin, confidence: data.confidence, lastUpdated: data.lastUpdated }
            : coin
        )
      );
      setLastUpdate(new Date(data.timestamp));
    });



    return () => {
      console.log('🔌 CoinList component unmounting - closing WebSocket connection');
      newSocket.close();
    };
  }, []);

  // Initial load and periodic status checks
  useEffect(() => {
    console.log('🚀 CoinList component mounted - fetching fresh top 50 coins from WebSocket...');
    fetchCoinList();
    checkServiceStatus();

    // Check service status every 30 seconds (this will show up in network tab)
    const statusInterval = setInterval(() => {
      checkServiceStatus();
    }, 30000); // 30 seconds

    return () => {
      console.log('🔄 CoinList component unmounting - clearing status check interval');
      clearInterval(statusInterval);
    };
  }, []);

  // Notification cron job useEffect - starts once when component mounts
  useEffect(() => {
    let cronCleanup: (() => void) | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    // Only start if not already active and this is the initial mount
    if (!notificationCronActive) {
      console.log('🔔 Starting notification cron job in 30 seconds...');

      startTimer = setTimeout(async () => {
        cronCleanup = await startNotificationCronJob();
      }, 30000); // Start after 30 seconds
    }

    return () => {
      console.log('🔔 CoinList component unmounting - cleaning up notification cron job');
      if (startTimer) {
        clearTimeout(startTimer);
      }
      if (cronCleanup) {
        cronCleanup();
      }
      // Clear coins data when component unmounts
      setCoins([]);
      setNotificationCronActive(false);
    };
  }, []); // Remove dependencies to prevent loop

  // Removed confidence refresh countdown timer - backend handles refresh automatically

  // Remove redundant auto-refresh since we have real-time updates via WebSocket
  // and backend handles confidence updates automatically

  // Calculate smart score for sorting (combines confidence and strength across timeframes)
  const calculateSmartScore = (coin: CoinListItem, targetAction?: 'BUY' | 'SELL' | 'HOLD') => {
    const timeframes = ['5m', '15m', '1h', '4h', '1d'] as const;
    let totalScore = 0;
    let matchingSignals = 0;

    timeframes.forEach(tf => {
      const signal = coin.confidence[tf];

      // If filtering by specific action, only count matching signals
      if (targetAction && signal.action !== targetAction) {
        return;
      }

      // Weight formula: (confidence + strength) / 2, with bonus for matching action
      let score = (signal.confidence + signal.strength) / 2;

      // Bonus for strong signals (BUY/SELL vs HOLD)
      if (signal.action !== 'HOLD') {
        score *= 1.2;
      }

      // Additional bonus for high confidence + high strength combinations
      if (signal.confidence >= 70 && signal.strength >= 70) {
        score *= 1.3;
      }

      totalScore += score;
      matchingSignals++;
    });

    // Return average score, or 0 if no matching signals
    return matchingSignals > 0 ? totalScore / matchingSignals : 0;
  };

  // Filter and sort coins based on search and signal filter
  const filteredCoins = coins
    .filter((coin: CoinListItem) => {
      const matchesSearch = coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           coin.symbol.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterSignal === 'ALL') return true;

      // Check if any timeframe has the target signal
      const timeframes = ['5m', '15m', '1h', '4h', '1d'] as const;
      return timeframes.some(tf => coin.confidence[tf]?.action === filterSignal);
    })
    .sort((a: CoinListItem, b: CoinListItem) => {
      // Smart sorting based on confidence and strength
      const targetAction = filterSignal === 'ALL' ? undefined : filterSignal;
      const scoreA = calculateSmartScore(a, targetAction);
      const scoreB = calculateSmartScore(b, targetAction);

      // Sort by score descending (highest scores first)
      return scoreB - scoreA;
    });

  // Debug logging
  console.log('🔍 Debug Info:', {
    totalCoins: coins.length,
    filteredCoins: filteredCoins.length,
    searchTerm,
    filterSignal,
    coinsWithZeroPrice: coins.filter(c => c.price === 0).length,
    filteredSymbols: filteredCoins.map(c => c.symbol)
  });



  // Format price
  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(8)}`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  // Format percentage
  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  // Get signal display
  const getSignalDisplay = (signal: ConfidenceSignal) => {
    const colors = {
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    };

    const icons = {
      BUY: <TrendingUp className="w-3 h-3" />,
      SELL: <TrendingDown className="w-3 h-3" />,
      HOLD: <Minus className="w-3 h-3" />
    };

    return (
      <div className={`px-2 py-1 rounded border text-xs font-medium flex flex-col items-center gap-0.5 ${colors[signal.color]}`}>
        <div className="flex items-center gap-1">
          {icons[signal.action]}
          <span>{signal.action}</span>
        </div>
        <div className="flex gap-1 text-xs opacity-75">
          <span>C:{signal.confidence}%</span>
          <span>S:{signal.strength}%</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg">Loading coin list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Crypto Assistant - Coin List
          </h1>
          <div className="flex items-center gap-4">
            {/* Notification System - Moved to left side */}
            <NotificationSystem />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-300">
                    {isConnected ? 'WebSocket Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Service Status */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-600/30">
              <div className={`w-2 h-2 rounded-full ${serviceStatus?.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm text-gray-300">
                Backend: <span className={`font-mono ${serviceStatus?.isActive ? 'text-green-400' : 'text-red-400'}`}>
                  {serviceStatus?.isActive ? 'Active' : 'Inactive'}
                </span>
                {serviceStatus?.lastUpdate && (
                  <span className="text-xs text-gray-500 ml-2">
                    Last: {new Date(serviceStatus.lastUpdate).toLocaleTimeString()}
                  </span>
                )}
              </span>
            </div>

            <button
              onClick={() => fetchCoinList(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing WebSocket Data...' : 'Refresh from WebSocket'}
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {timeframes.map(({ key, label }) => (
              <div key={key} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <div className="text-sm text-gray-400 mb-1">{label} Signals</div>
                <div className="flex gap-2 text-sm font-semibold text-white mb-2">
                  <span>C:{stats.average_confidence[key]}%</span>
                  <span>S:{stats.average_strength?.[key] || 0}%</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-400">B:{stats.buy_signals[key]}</span>
                  <span className="text-red-400">S:{stats.sell_signals[key]}</span>
                  <span className="text-yellow-400">H:{stats.hold_signals[key]}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search coins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Signal Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterSignal}
              onChange={(e) => setFilterSignal(e.target.value as any)}
              className="px-3 py-2 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Signals</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
              <option value="HOLD">Hold Only</option>
            </select>
          </div>
        </div>

        {lastUpdate && (
          <div className="text-sm text-gray-400">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Coin List Table */}
      <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl border border-gray-600/30 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Coin</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">Price</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-300">24h Change</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">5m</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">15m</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">1h</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">4h</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">1d</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-300">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredCoins.map((coin: CoinListItem) => (
                <tr
                  key={coin.symbol}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-white">{coin.name}</div>
                      <div className="text-sm text-gray-400">{coin.symbol}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-white">
                      {formatPrice(coin.price)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-medium ${
                      coin.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercentage(coin.priceChange24h)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSignalDisplay(coin.confidence['5m'])}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSignalDisplay(coin.confidence['15m'])}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSignalDisplay(coin.confidence['1h'])}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSignalDisplay(coin.confidence['4h'])}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSignalDisplay(coin.confidence['1d'])}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/analysis/${coin.symbol.toLowerCase()}`}
                      className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-sm hover:bg-blue-600/30 transition-colors inline-block"
                    >
                      Analyse
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCoins.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No coins found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
