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
  rule?: {
    id: string;
    name: string;
    description?: string;
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
}

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

        {/* Signal Details */}
        {notification.signalData && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Signal Analysis Details</h3>
            
            {/* Basic Signal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Exchange</div>
                <div className="text-lg font-semibold">{notification.signalData.exchange}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Current Price</div>
                <div className="text-lg font-semibold">${notification.signalData.currentPrice.toFixed(2)}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Processing Time</div>
                <div className="text-lg font-semibold">{notification.signalData.processingTimeMs || 0}ms</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400">Generated At</div>
                <div className="text-lg font-semibold">{new Date(notification.signalData.generatedAt).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Technical Indicators */}
            {notification.signalData.technicalIndicators && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Technical Indicators</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(notification.signalData.technicalIndicators).map(([key, value]) => (
                    <div key={key} className="bg-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="text-lg font-semibold">
                        {typeof value === 'number' ? value.toFixed(2) :
                         typeof value === 'object' && value !== null ? JSON.stringify(value) :
                         String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart Patterns */}
            {notification.signalData.chartPatterns && notification.signalData.chartPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Chart Patterns Detected</h4>
                <div className="space-y-3">
                  {notification.signalData.chartPatterns.map((pattern, index) => (
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
            {notification.signalData.candlestickPatterns && notification.signalData.candlestickPatterns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Candlestick Patterns</h4>
                <div className="space-y-3">
                  {notification.signalData.candlestickPatterns.map((pattern, index) => (
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
            {notification.signalData.reasoning && notification.signalData.reasoning.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-3">Analysis Reasoning</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <ul className="space-y-2">
                    {notification.signalData.reasoning.map((reason, index) => (
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
