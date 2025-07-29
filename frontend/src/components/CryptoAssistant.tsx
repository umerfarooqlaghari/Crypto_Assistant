'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Clock, List, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl, getWebSocketUrl, API_CONFIG } from '../utils/api';
import SymbolSelector from './SymbolSelector';
import TimeframeSelector from './TimeframeSelector';

import TechnicalIndicators from './TechnicalIndicators';
import PatternAnalysis from './PatternAnalysis';
import MarketOverview from './MarketOverview';

interface RealTimeData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume: number;
  timestamp: number;
  technicalAnalysis?: {
    indicators: any;
    chartPatterns: any[];
    candlestickPatterns: any[];
    signal: any;
  };
}

interface SignalData {
  symbol: string;
  timeframe: string;
  timestamp: string;
  currentPrice: number;
  marketData: any;
  technicalIndicators: any;
  chartPatterns: any[];
  candlestickPatterns: any[];
  signal: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    strength: number;
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    reasoning: string[];
  };
}

interface CryptoAssistantProps {
  initialSymbol?: string;
}

export default function CryptoAssistant({ initialSymbol = 'BTCUSDT' }: CryptoAssistantProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [realTimeData, setRealTimeData] = useState<RealTimeData | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Use ref to avoid stale closure in WebSocket callback
  const selectedSymbolRef = useRef(selectedSymbol);

  // Update ref when symbol changes
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(getWebSocketUrl(), {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      // Subscribe to the selected symbol
      newSocket.emit('subscribe', { symbols: [selectedSymbol] });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    newSocket.on('priceUpdate', (data: RealTimeData) => {
      console.log('Received price update:', data.symbol, data.price, 'Current symbol:', selectedSymbolRef.current); // Debug log
      // Only update if this is the currently selected symbol
      if (data.symbol === selectedSymbolRef.current) {
        console.log('Updating price for selected symbol:', data.symbol, data.price);
        setRealTimeData(data);
        setLastUpdate(new Date());
      } else {
        console.log('Ignoring price update for non-selected symbol:', data.symbol);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Subscribe to new symbol when selection changes
  useEffect(() => {
    if (socket && isConnected) {
      console.log('Subscribing to symbol:', selectedSymbol); // Debug log
      // Clear previous signal data when switching symbols
      setSignalData(null);
      setRealTimeData(null);
      setLoading(true);

      socket.emit('subscribe', { symbols: [selectedSymbol] });
      fetchSignalData();
    }
  }, [selectedSymbol, selectedTimeframe, socket, isConnected]);

  // Fetch signal data from API
  const fetchSignalData = useCallback(async () => {
    setLoading(true);
    console.log(`Fetching signal data for ${selectedSymbol} ${selectedTimeframe}`);

    try {
      const response = await fetch(
        getApiUrl(API_CONFIG.ENDPOINTS.ADVANCED_SIGNALS, {
          symbol: selectedSymbol,
          timeframe: selectedTimeframe
        })
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Received signal data:', data);
        setSignalData(data);
      } else {
        console.error('Failed to fetch signal data:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        // Clear signal data on error
        setSignalData(null);
      }
    } catch (error) {
      console.error('Error fetching signal data:', error);
      // Clear signal data on error
      setSignalData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedTimeframe]);

  // Auto-refresh signal data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchSignalData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSignalData, loading]);



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

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              <List className="w-4 h-4" />
              Back to Coin List
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Crypto Analysis
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-300">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <SymbolSelector 
            selectedSymbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
          />
          <TimeframeSelector 
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
          />
          {lastUpdate && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Reorganized Above-the-Fold Layout */}
      {(realTimeData || signalData) && signalData && signalData.signal && signalData.technicalIndicators && (
        <div className="space-y-4 mb-6">
          {/* Top Row: Coin Details + Confidence & Signal Strength + Pattern Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Coin Details */}
            <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-4 border border-gray-600/30 shadow-xl">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h2 className="text-xl font-semibold text-gray-100 mb-3">{selectedSymbol}</h2>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-gray-100">
                    {formatPrice(realTimeData?.price || signalData?.currentPrice || 0)}
                  </span>
                  <span className={`text-lg font-medium ${
                    (realTimeData?.priceChange24h || parseFloat(signalData?.marketData?.priceChange24h || '0')) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(realTimeData?.priceChange24h || parseFloat(signalData?.marketData?.priceChange24h || '0'))}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">24h Volume</div>
                  <div className="text-lg font-semibold text-gray-100">
                    {new Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      maximumFractionDigits: 2
                    }).format(realTimeData?.volume || parseFloat(signalData?.marketData?.volume || '0'))}
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence & Signal Strength with Buy/Sell/Hold */}
            <div className={`bg-gradient-to-br backdrop-blur-md rounded-xl p-4 border shadow-xl ${
              signalData.signal.action === 'BUY' ? 'from-green-900/30 to-green-800/20 border-green-500/40' :
              signalData.signal.action === 'SELL' ? 'from-red-900/30 to-red-800/20 border-red-500/40' :
              'from-yellow-900/30 to-yellow-800/20 border-yellow-500/40'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`${
                    signalData.signal.action === 'BUY' ? 'text-green-400' :
                    signalData.signal.action === 'SELL' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {signalData.signal.action === 'BUY' ? '📈' : signalData.signal.action === 'SELL' ? '📉' : '⚡'}
                  </div>
                  <span className={`text-xl font-bold ${
                    signalData.signal.action === 'BUY' ? 'text-green-400' :
                    signalData.signal.action === 'SELL' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {signalData.signal.action}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Timeframe</div>
                  <div className="text-lg font-bold text-white">{signalData.timeframe}</div>
                </div>
              </div>

              {/* Confidence Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">Confidence</span>
                  <span className="text-sm font-semibold text-white">{signalData.signal.confidence}%</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      signalData.signal.confidence >= 80 ? 'bg-green-500' :
                      signalData.signal.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(signalData.signal.confidence, 100)}%` }}
                  />
                </div>
              </div>

              {/* Strength Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-400">Strength</span>
                  <span className="text-sm font-semibold text-white">{signalData.signal.strength}%</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      signalData.signal.strength >= 80 ? 'bg-blue-500' :
                      signalData.signal.strength >= 60 ? 'bg-purple-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${Math.min(signalData.signal.strength, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Pattern Analysis */}
            <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-4 border border-gray-600/30 shadow-xl">
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                {/* Pattern Summary */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="text-green-400 font-semibold text-lg">
                      {[...(signalData.chartPatterns || []), ...(signalData.candlestickPatterns || [])].filter(p => p.type === 'BULLISH').length}
                    </div>
                    <div className="text-xs text-gray-400">Bullish</div>
                  </div>
                  <div>
                    <div className="text-red-400 font-semibold text-lg">
                      {[...(signalData.chartPatterns || []), ...(signalData.candlestickPatterns || [])].filter(p => p.type === 'BEARISH').length}
                    </div>
                    <div className="text-xs text-gray-400">Bearish</div>
                  </div>
                  <div>
                    <div className="text-yellow-400 font-semibold text-lg">
                      {[...(signalData.chartPatterns || []), ...(signalData.candlestickPatterns || [])].filter(p => p.type === 'NEUTRAL').length}
                    </div>
                    <div className="text-xs text-gray-400">Neutral</div>
                  </div>
                </div>

                {/* Top Patterns */}
                <div className="space-y-2">
                  {[...(signalData.chartPatterns || []), ...(signalData.candlestickPatterns || [])]
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 3)
                    .map((pattern, index) => (
                      <div key={index} className="text-center">
                        <div className="text-sm text-gray-300 mb-1">{pattern.name}</div>
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            pattern.type === 'BULLISH' ? 'bg-green-900/30 text-green-400' :
                            pattern.type === 'BEARISH' ? 'bg-red-900/30 text-red-400' :
                            'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {pattern.type}
                          </span>
                          <span className="text-white font-semibold">{pattern.confidence}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>


        </div>
      )}

      {/* Detailed Sections (Below the fold - user can scroll to see these) */}
      {signalData && signalData.signal && signalData.technicalIndicators && (
        <div className="space-y-6 mb-6">
          {/* Bottom Row: Detailed Technical Indicators + Pattern Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detailed Technical Indicators */}
            <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
              <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                Detailed Technical Analysis
              </h3>
              <TechnicalIndicators
                indicators={signalData.technicalIndicators}
                currentPrice={realTimeData?.price || signalData?.currentPrice || 0}
                compact={true}
              />
            </div>

            {/* Chart Pattern + Candlestick Pattern Analysis */}
            <PatternAnalysis
              chartPatterns={signalData.chartPatterns}
              candlestickPatterns={signalData.candlestickPatterns}
            />
          </div>

          {/* Trading Levels (Only for BUY/HOLD signals) */}
          {signalData.signal.action !== 'SELL' && (
            <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-4 border border-gray-600/30 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <div className="w-4 h-4 text-gray-400">🎯</div>
                Trading Levels
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                  <div className="text-gray-400 mb-1">Entry</div>
                  <div className="font-semibold text-white">{formatPrice(signalData.signal.entry)}</div>
                </div>
                <div className="text-center p-2 bg-red-900/20 rounded-lg border border-red-500/30">
                  <div className="text-gray-400 mb-1">Stop Loss</div>
                  <div className="font-semibold text-red-400">{formatPrice(signalData.signal.stopLoss)}</div>
                </div>
                <div className="text-center p-2 bg-green-900/20 rounded-lg border border-green-500/30">
                  <div className="text-gray-400 mb-1">TP1</div>
                  <div className="font-semibold text-green-400">{formatPrice(signalData.signal.takeProfit1)}</div>
                </div>
                <div className="text-center p-2 bg-green-900/20 rounded-lg border border-green-500/30">
                  <div className="text-gray-400 mb-1">TP2</div>
                  <div className="font-semibold text-green-400">{formatPrice(signalData.signal.takeProfit2)}</div>
                </div>
                <div className="text-center p-2 bg-green-900/20 rounded-lg border border-green-500/30">
                  <div className="text-gray-400 mb-1">TP3</div>
                  <div className="font-semibold text-green-400">{formatPrice(signalData.signal.takeProfit3)}</div>
                </div>
              </div>

              {/* Risk/Reward Summary */}
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                  <div className="text-gray-400 mb-1">Risk/Reward</div>
                  <div className="font-semibold text-white">
                    {signalData.signal.stopLoss && signalData.signal.takeProfit1 ?
                      (((signalData.signal.takeProfit1 - signalData.signal.entry) / (signalData.signal.entry - signalData.signal.stopLoss))).toFixed(2) :
                      'N/A'
                    }
                  </div>
                </div>
                <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                  <div className="text-gray-400 mb-1">Potential Gain</div>
                  <div className="font-semibold text-green-400">
                    {signalData.signal.takeProfit1 ?
                      `${(((signalData.signal.takeProfit1 - signalData.signal.entry) / signalData.signal.entry) * 100).toFixed(1)}%` :
                      'N/A'
                    }
                  </div>
                </div>
                <div className="text-center p-2 bg-gray-700/30 rounded-lg">
                  <div className="text-gray-400 mb-1">Max Risk</div>
                  <div className="font-semibold text-red-400">
                    {signalData.signal.stopLoss ?
                      `${(((signalData.signal.entry - signalData.signal.stopLoss) / signalData.signal.entry) * 100).toFixed(1)}%` :
                      'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Market Overview and Signal Reasoning Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Overview */}
            <MarketOverview />

            {/* Signal Reasoning */}
            <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
              <h3 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Signal Reasoning
              </h3>
              <div className="space-y-2">
                {signalData.signal.reasoning?.map((reason, index) => (
                  <div key={index} className="flex items-start gap-2 text-gray-300">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !signalData && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg">Loading signals for {selectedSymbol}...</p>
          <p className="text-gray-400 text-sm">Analyzing {selectedTimeframe} timeframe</p>
        </div>
      )}
    </div>
  );
}
