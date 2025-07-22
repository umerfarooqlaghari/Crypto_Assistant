'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Clock } from 'lucide-react';
import { getApiUrl, getWebSocketUrl, API_CONFIG } from '../utils/api';
import SymbolSelector from './SymbolSelector';
import TimeframeSelector from './TimeframeSelector';
import SignalDisplay from './SignalDisplay';
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

export default function CryptoAssistant() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
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
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Crypto Assistant
          </h1>
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

      {/* Current Price Display */}
      {(realTimeData || signalData) && (
        <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 mb-6 border border-gray-600/30 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">{selectedSymbol}</h2>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-gray-100">
                  {formatPrice(realTimeData?.price || signalData?.currentPrice || 0)}
                </span>
                <span className={`text-lg font-medium ${
                  (realTimeData?.priceChange24h || parseFloat(signalData?.marketData?.priceChange24h || '0')) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatPercentage(realTimeData?.priceChange24h || parseFloat(signalData?.marketData?.priceChange24h || '0'))}
                </span>
              </div>
            </div>
            <div className="text-right">
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
      )}

      {/* Signal Display */}
      {signalData && signalData.signal && signalData.technicalIndicators && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <SignalDisplay signalData={signalData} loading={loading} />
          </div>
          <div>
            <TechnicalIndicators
              indicators={signalData.technicalIndicators}
              currentPrice={realTimeData?.price || signalData?.currentPrice || 0}
            />
          </div>
        </div>
      )}

      {/* Pattern Analysis */}
      {signalData && signalData.chartPatterns && signalData.candlestickPatterns && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PatternAnalysis
            chartPatterns={signalData.chartPatterns}
            candlestickPatterns={signalData.candlestickPatterns}
          />
          <MarketOverview />
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
