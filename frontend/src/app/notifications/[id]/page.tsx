'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getApiUrl } from '../../../utils/api';

interface DetailedNotification {
  id: string;
  title: string;
  message: string;
  type: 'STRONG_SIGNAL' | 'ALERT' | 'WARNING';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  hasVisual: boolean;
  symbol: string;
  signal: string;
  confidence?: number;
  strength?: number;
  timeframe?: string;
  ruleId?: string;
  ruleName?: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
  // Technical analysis data stored directly in notification
  technicalIndicators?: any;
  chartPatterns?: any[];
  candlestickPatterns?: any[];
  triggeredTimeframes?: string[];
  analysisReasoning?: string[];
  currentPrice?: number;
  exchange?: string;
  rule?: {
    id: string;
    name: string;
    description?: string;
    minConfidence?: number;
    minStrength?: number;
    requiredTimeframes?: number;
    requiredSignalType?: string;
    specificTimeframes?: string[];
  };
  signalData?: {
    id: string;
    symbol: string;
    exchange: string;
    timeframe: string;
    signal: string;
    confidence: number;
    strength: number;
    currentPrice: number;
    technicalIndicators?: any;
    chartPatterns?: any[];
    candlestickPatterns?: any[];
    reasoning?: string[];
    generatedAt: string;
    processingTimeMs?: number;
  };
  multiTimeframeData?: Array<{
    timeframe: string;
    signalData: {
      id: string;
      symbol: string;
      exchange: string;
      timeframe: string;
      signal: string;
      confidence: number;
      strength: number;
      currentPrice: number;
      technicalIndicators?: any;
      chartPatterns?: any[];
      candlestickPatterns?: any[];
      reasoning?: string[];
      generatedAt: string;
      processingTimeMs?: number;
    };
  }>;
}

// Helper function to render progress bar
const ProgressBar = ({ value, label, color = 'blue' }: { value: number; label: string; color?: string }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500'
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

// Helper function to format technical indicator value
const formatIndicatorValue = (key: string, value: any): string => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'object' && value !== null) {
    // Handle specific indicator objects
    if (key.toLowerCase().includes('macd') && value.histogram !== undefined) {
      return `${value.histogram > 0 ? 'Bullish' : 'Bearish'} (${value.histogram.toFixed(2)})`;
    }
    if (key.toLowerCase().includes('rsi')) {
      const rsiValue = value.value || value.rsi || value;
      if (typeof rsiValue === 'number') {
        if (rsiValue > 70) return `Overbought (${rsiValue.toFixed(1)})`;
        if (rsiValue < 30) return `Oversold (${rsiValue.toFixed(1)})`;
        return `Neutral (${rsiValue.toFixed(1)})`;
      }
    }
    if (key.toLowerCase().includes('bollinger')) {
      return value.position || 'N/A';
    }
    if (key.toLowerCase().includes('movingaverages') && value.ema12 !== undefined && value.ema26 !== undefined) {
      const trend = value.ema12 > value.ema26 ? 'Bullish' : value.ema12 < value.ema26 ? 'Bearish' : 'Neutral';
      return `${trend} (EMA12: ${value.ema12.toFixed(2)}, EMA26: ${value.ema26.toFixed(2)})`;
    }
    return JSON.stringify(value);
  }
  return String(value);
};

// Helper function to get indicator signal
const getIndicatorSignal = (key: string, value: any): 'Bullish' | 'Bearish' | 'Neutral' => {
  if (typeof value === 'object' && value !== null) {
    if (key.toLowerCase().includes('macd') && value.histogram !== undefined) {
      return value.histogram > 0 ? 'Bullish' : 'Bearish';
    }
    if (key.toLowerCase().includes('rsi')) {
      const rsiValue = value.value || value.rsi || value;
      if (typeof rsiValue === 'number') {
        if (rsiValue > 70) return 'Bearish';
        if (rsiValue < 30) return 'Bullish';
        return 'Neutral';
      }
    }
    if (key.toLowerCase().includes('ema') && value.trend) {
      return value.trend === 'up' ? 'Bullish' : value.trend === 'down' ? 'Bearish' : 'Neutral';
    }
    if (key.toLowerCase().includes('movingaverages') && value.ema12 !== undefined && value.ema26 !== undefined) {
      // Calculate EMA trend: EMA12 > EMA26 = Bullish, EMA12 < EMA26 = Bearish
      if (value.ema12 > value.ema26) return 'Bullish';
      if (value.ema12 < value.ema26) return 'Bearish';
      return 'Neutral';
    }
    if (key.toLowerCase().includes('bollinger') && value.position) {
      if (value.position.includes('above')) return 'Bullish';
      if (value.position.includes('below')) return 'Bearish';
      return 'Neutral';
    }
  }
  return 'Neutral';
};

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [notification, setNotification] = useState<DetailedNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchNotificationDetails(params.id as string);
    }
  }, [params.id]);

  const fetchNotificationDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`/api/notifications/${id}`));
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification details');
      }
      
      const data = await response.json();
      setNotification(data.data);
      
      // Mark as read if not already read
      if (!data.data.isRead) {
        markAsRead(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(getApiUrl(`/api/notifications/${id}/read`), {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'STRONG_SIGNAL':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'ALERT':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'WARNING':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-red-500 bg-red-50';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-50';
      case 'LOW':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'SELL':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'HOLD':
        return <Minus className="h-5 w-5 text-yellow-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'SELL':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'HOLD':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading notification details...</p>
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Error Loading Notification</h1>
          <p className="text-gray-400 mb-4">{error || 'Notification not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">Notification Details</h1>
        </div>

        {/* Notification Overview */}
        <div className={`border-l-4 rounded-lg p-6 mb-6 ${getPriorityColor(notification.priority)}`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900">{notification.title}</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${notification.priority === 'HIGH' ? 'bg-red-100 text-red-800' : notification.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {notification.priority} Priority
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSignalColor(notification.signal)}`}>
                    {getSignalIcon(notification.signal)}
                    <span className="ml-1">{notification.signal}</span>
                  </span>
                </div>
              </div>
              <p className="text-gray-700 mb-4">{notification.message}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(notification.createdAt).toLocaleString()}
                </div>
                {notification.timeframe && (
                  <span>Timeframe: {notification.timeframe}</span>
                )}
                {notification.ruleName && (
                  <span>Rule: {notification.ruleName}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Signal Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Signal Strength</h3>
            <div className="text-3xl font-bold text-blue-400">{(notification.strength || 0).toFixed(1)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(notification.strength || 0, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Confidence Level</h3>
            <div className="text-3xl font-bold text-green-400">{(notification.confidence || 0).toFixed(1)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(notification.confidence || 0, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Symbol</h3>
            <Link
              href={`/analysis/${notification.symbol.toLowerCase()}`}
              className="inline-block hover:bg-gray-700 rounded-lg p-2 -m-2 transition-colors group"
            >
              <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                {notification.symbol}
              </div>
              <div className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to analyze →
              </div>
            </Link>
            <div className="text-sm text-gray-400 mt-2">
              Timeframe: {notification.timeframe || 'N/A'}
            </div>

            {/* Go to Analysis Button */}
            <Link
              href={`/analysis/${notification.symbol.toLowerCase()}`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              Go to coin analysis
            </Link>
          </div>
        </div>

        {/* Technical Analysis Section */}
        {notification.timeframe === 'multi' && notification.triggeredTimeframes ? (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Multi-Timeframe Technical Analysis</h3>
            <p className="text-gray-300 mb-6">
              This notification was triggered across {notification.triggeredTimeframes.length} timeframes: {' '}
              <span className="font-medium text-blue-400">
                {notification.triggeredTimeframes.join(', ')}
              </span>
            </p>

            {/* Timeframe Analysis Boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {notification.triggeredTimeframes.map((timeframe) => (
                <div key={timeframe} className="bg-gray-700 rounded-lg p-5 border border-gray-600">
                  {/* Timeframe Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-blue-400">{timeframe}</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      notification.signal === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      notification.signal === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {notification.signal}
                    </span>
                  </div>

                  {/* Confidence and Strength Bars */}
                  <div className="mb-4">
                    <ProgressBar
                      value={notification.confidence || 0}
                      label="Confidence"
                      color={(notification.confidence || 0) >= 70 ? 'green' : (notification.confidence || 0) >= 50 ? 'yellow' : 'red'}
                    />
                    <ProgressBar
                      value={notification.strength || 0}
                      label="Strength"
                      color={(notification.strength || 0) >= 70 ? 'green' : (notification.strength || 0) >= 50 ? 'yellow' : 'red'}
                    />
                  </div>

                  {/* Technical Indicators Summary */}
                  {notification.technicalIndicators && notification.technicalIndicators[timeframe] && notification.technicalIndicators[timeframe].technicalIndicators && (
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-gray-300 mb-2">Technical Indicators:</h5>
                      <div className="space-y-1 text-sm">
                        {Object.entries(notification.technicalIndicators[timeframe].technicalIndicators)
                          .filter(([key]) => ['rsi', 'macd', 'ema', 'bollinger', 'movingaverages'].some(indicator =>
                            key.toLowerCase().includes(indicator)
                          ))
                          .map(([key, value]) => {
                            const signal = getIndicatorSignal(key, value);
                            let displayName = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();

                            // Special handling for moving averages to show as "EMA TREND"
                            if (key.toLowerCase().includes('movingaverages')) {
                              displayName = 'EMA TREND';
                            }

                            return (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-400">{displayName}:</span>
                                <span className={`font-medium ${
                                  signal === 'Bullish' ? 'text-green-400' :
                                  signal === 'Bearish' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                  {signal}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Chart and Candlestick Patterns */}
                  <div className="text-sm">
                    {notification.technicalIndicators && notification.technicalIndicators[timeframe] && notification.technicalIndicators[timeframe].chartPatterns && notification.technicalIndicators[timeframe].chartPatterns.length > 0 && (
                      <div className="mb-2">
                        <span className="text-gray-400">Chart Patterns: </span>
                        <span className="text-blue-400">
                          {notification.technicalIndicators[timeframe].chartPatterns
                            .map((p: any) => p.name || p.type || 'Pattern').join(', ')}
                        </span>
                      </div>
                    )}
                    {notification.technicalIndicators && notification.technicalIndicators[timeframe] && notification.technicalIndicators[timeframe].candlestickPatterns && notification.technicalIndicators[timeframe].candlestickPatterns.length > 0 && (
                      <div>
                        <span className="text-gray-400">Candlestick Patterns: </span>
                        <span className="text-orange-400">
                          {notification.technicalIndicators[timeframe].candlestickPatterns
                            .map((p: any) => p.name || p.type || 'Pattern').join(', ')}
                        </span>
                      </div>
                    )}
                    {/* Show "No patterns detected" if no patterns are found */}
                    {notification.technicalIndicators && notification.technicalIndicators[timeframe] &&
                     (!notification.technicalIndicators[timeframe].chartPatterns || notification.technicalIndicators[timeframe].chartPatterns.length === 0) &&
                     (!notification.technicalIndicators[timeframe].candlestickPatterns || notification.technicalIndicators[timeframe].candlestickPatterns.length === 0) && (
                      <div className="text-gray-500 text-xs">
                        No chart or candlestick patterns detected
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (notification.technicalIndicators || notification.chartPatterns || notification.candlestickPatterns) ? (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Technical Analysis Summary</h3>

            {/* Basic Signal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Exchange</div>
                <div className="text-lg font-semibold">{notification.exchange || 'binance'}</div>
              </div>
              {notification.currentPrice && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Current Price</div>
                  <div className="text-lg font-semibold">${notification.currentPrice.toFixed(2)}</div>
                </div>
              )}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Timeframe</div>
                <div className="text-lg font-semibold">{notification.timeframe || 'N/A'}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Generated At</div>
                <div className="text-lg font-semibold">{new Date(notification.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Confidence and Strength Bars */}
            <div className="mb-6 max-w-md">
              <ProgressBar
                value={notification.confidence || 0}
                label="Confidence"
                color={(notification.confidence || 0) >= 70 ? 'green' : (notification.confidence || 0) >= 50 ? 'yellow' : 'red'}
              />
              <ProgressBar
                value={notification.strength || 0}
                label="Strength"
                color={(notification.strength || 0) >= 70 ? 'green' : (notification.strength || 0) >= 50 ? 'yellow' : 'red'}
              />
            </div>

            {/* Technical Indicators Summary */}
            {notification.technicalIndicators && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Technical Indicators</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(notification.technicalIndicators)
                    .filter(([key]) => ['rsi', 'macd', 'ema', 'bollinger', 'movingaverages'].some(indicator =>
                      key.toLowerCase().includes(indicator)
                    ))
                    .map(([key, value]) => {
                      const signal = getIndicatorSignal(key, value);
                      let displayName = key.replace(/([A-Z])/g, ' $1').trim();

                      // Special handling for moving averages to show as "EMA Trend"
                      if (key.toLowerCase().includes('movingaverages')) {
                        displayName = 'EMA Trend';
                      }

                      const formattedValue = formatIndicatorValue(key, value);
                      return (
                        <div key={key} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-sm text-gray-400 capitalize">{displayName}</div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              signal === 'Bullish' ? 'bg-green-500/20 text-green-400' :
                              signal === 'Bearish' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {signal}
                            </span>
                          </div>
                          <div className="text-sm text-gray-300">{formattedValue}</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Chart Patterns */}
            {notification.chartPatterns && notification.chartPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Chart Patterns Detected</h4>
                <div className="space-y-3">
                  {notification.chartPatterns.map((pattern: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{pattern.name || `Pattern ${index + 1}`}</div>
                          <div className="text-sm text-gray-400">{pattern.description || 'Chart pattern detected'}</div>
                        </div>
                        {pattern.confidence && (
                          <div className="text-right">
                            <div className="text-sm text-gray-400">Confidence</div>
                            <div className="font-semibold">{(pattern.confidence * 100).toFixed(1)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Candlestick Patterns */}
            {notification.candlestickPatterns && notification.candlestickPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Candlestick Patterns</h4>
                <div className="space-y-3">
                  {notification.candlestickPatterns.map((pattern: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{pattern.name || `Pattern ${index + 1}`}</div>
                          <div className="text-sm text-gray-400">{pattern.description || 'Candlestick pattern detected'}</div>
                        </div>
                        {pattern.strength && (
                          <div className="text-right">
                            <div className="text-sm text-gray-400">Strength</div>
                            <div className="font-semibold">{pattern.strength.toFixed(1)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {notification.analysisReasoning && notification.analysisReasoning.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-3">Analysis Reasoning</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <ul className="space-y-2">
                    {notification.analysisReasoning.map((reason: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : null}



        {/* Single timeframe notifications - show technical analysis if available */}
        {notification.timeframe && notification.timeframe !== 'multi' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Technical Analysis - {notification.timeframe.toUpperCase()}</h3>

            {/* Basic Signal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Exchange</div>
                <div className="text-lg font-semibold">{notification.exchange || 'binance'}</div>
              </div>
              {notification.currentPrice && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Price at Signal</div>
                  <div className="text-lg font-semibold">${notification.currentPrice.toFixed(2)}</div>
                </div>
              )}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Timeframe</div>
                <div className="text-lg font-semibold">{notification.timeframe.toUpperCase()}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Generated At</div>
                <div className="text-lg font-semibold">{new Date(notification.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Show confidence and strength */}
            {(notification.confidence !== undefined || notification.strength !== undefined) && (
              <div className="mb-6 max-w-md">
                {notification.confidence !== undefined && (
                  <ProgressBar
                    value={notification.confidence}
                    label="Confidence"
                    color={notification.confidence >= 70 ? 'green' : notification.confidence >= 50 ? 'yellow' : 'red'}
                  />
                )}
                {notification.strength !== undefined && (
                  <ProgressBar
                    value={notification.strength}
                    label="Strength"
                    color={notification.strength >= 70 ? 'green' : notification.strength >= 50 ? 'yellow' : 'red'}
                  />
                )}
              </div>
            )}

            {/* Technical Indicators */}
            {notification.technicalIndicators && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Technical Indicators</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(notification.technicalIndicators)
                    .filter(([key]) => ['rsi', 'macd', 'ema', 'bollinger', 'movingaverages'].some(indicator =>
                      key.toLowerCase().includes(indicator)
                    ))
                    .map(([key, value]) => {
                      const signal = getIndicatorSignal(key, value);
                      let displayName = key.replace(/([A-Z])/g, ' $1').trim();

                      // Special handling for moving averages to show as "EMA Trend"
                      if (key.toLowerCase().includes('movingaverages')) {
                        displayName = 'EMA Trend';
                      }

                      const formattedValue = formatIndicatorValue(key, value);
                      return (
                        <div key={key} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-sm text-gray-400">{displayName}</div>
                            <div className={`text-sm font-semibold ${
                              signal === 'Bullish' ? 'text-green-400' :
                              signal === 'Bearish' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {signal}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">{formattedValue}</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Chart Patterns */}
            {notification.chartPatterns && Array.isArray(notification.chartPatterns) && notification.chartPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Chart Patterns</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notification.chartPatterns.map((pattern: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Pattern</div>
                      <div className="text-lg font-semibold">{pattern.name || pattern.type || 'Unknown Pattern'}</div>
                      {pattern.confidence && (
                        <div className="text-sm text-gray-300">Confidence: {pattern.confidence}%</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Candlestick Patterns */}
            {notification.candlestickPatterns && Array.isArray(notification.candlestickPatterns) && notification.candlestickPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Candlestick Patterns</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notification.candlestickPatterns.map((pattern: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Pattern</div>
                      <div className="text-lg font-semibold">{pattern.name || pattern.type || 'Unknown Pattern'}</div>
                      {pattern.strength && (
                        <div className="text-sm text-gray-300">Strength: {pattern.strength}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Reasoning */}
            {notification.analysisReasoning && Array.isArray(notification.analysisReasoning) && notification.analysisReasoning.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Analysis Reasoning</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <ul className="space-y-2">
                    {notification.analysisReasoning.map((reason: string, index: number) => (
                      <li key={index} className="text-gray-300">• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fallback for notifications without proper timeframe data */}
        {!notification.timeframe && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Notification Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Exchange</div>
                <div className="text-lg font-semibold">{notification.exchange || 'binance'}</div>
              </div>
              {notification.currentPrice && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Current Price</div>
                  <div className="text-lg font-semibold">${notification.currentPrice.toFixed(2)}</div>
                </div>
              )}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Generated At</div>
                <div className="text-lg font-semibold">{new Date(notification.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>

            <div className="text-gray-300">
              This notification was generated without specific timeframe analysis.
              It may be based on general market conditions or rule-specific criteria.
            </div>
          </div>
        )}

        {/* Notification Rule Details */}
        {notification.rule && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Triggered Rule</h3>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="font-semibold text-lg mb-2">{notification.rule.name}</div>
              {notification.rule.description && (
                <div className="text-gray-300">{notification.rule.description}</div>
              )}
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-gray-400">Rule ID: {notification.rule.id}</span>
                <span className="text-gray-400">
                  Visual: {notification.hasVisual ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Notifications
          </button>
        </div>
      </div>
    </div>
  );
}
