'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../../../utils/api';
import TimeframeAnalysisSection from '../../../components/TimeframeAnalysisSection';

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

        {/* Notification Details Card */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
          {/* Top Section - Notification Message */}
          <div className="bg-yellow-100 p-4 border-l-4 border-yellow-500">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      notification.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                      notification.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {notification.priority} Priority
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      notification.signal === 'BUY' ? 'bg-green-100 text-green-800' :
                      notification.signal === 'SELL' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {notification.signal}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">
                    {notification.message.split(notification.symbol).map((part, index, array) => (
                      <span key={index}>
                        {part}
                        {index < array.length - 1 && (
                          <Link
                            href={`/?symbol=${notification.symbol}`}
                            className="text-blue-600 hover:text-blue-800 underline font-semibold"
                          >
                            {notification.symbol}
                          </Link>
                        )}
                      </span>
                    ))}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span>📅 {new Date(notification.createdAt).toLocaleDateString()}, {new Date(notification.createdAt).toLocaleTimeString()}</span>
                    <span>⏱️ Timeframe: {notification.timeframe === 'multi' ? notification.triggeredTimeframes?.join(', ') || 'Multiple' : notification.timeframe || '5m'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Signal Details */}
          <div className="bg-gray-900 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Signal Strength */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Signal Strength</h4>
                <div className="text-2xl font-bold text-blue-400 mb-2">{(notification.strength || 49).toFixed(1)}%</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(notification.strength || 49, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Confidence Level */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Confidence Level</h4>
                <div className="text-2xl font-bold text-green-400 mb-2">{(notification.confidence || 98).toFixed(1)}%</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(notification.confidence || 98, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Symbol */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Symbol</h4>
                <div className="text-2xl font-bold text-white mb-2">{notification.symbol}</div>
                <div className="text-xs text-gray-500 mb-3">Timeframe: {notification.timeframe === 'multi' ? 'Multi' : notification.timeframe || '5m'}</div>
                <Link
                  href={`/?symbol=${notification.symbol}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  📊 Go to coin analysis
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Render timeframes */}
        {notification.timeframe === 'multi' && notification.triggeredTimeframes ? (
          // Multi-timeframe notification - show each timeframe separately
          <div className="space-y-8">
            {notification.triggeredTimeframes.map((timeframe: string) => (
              <TimeframeAnalysisSection
                key={timeframe}
                timeframe={timeframe}
                notification={notification}
                symbol={notification.symbol}
                exchange={notification.exchange || 'binance'}
                currentPrice={notification.currentPrice}
              />
            ))}
          </div>
        ) : (
          // Single timeframe notification
          <TimeframeAnalysisSection
            timeframe={notification.timeframe || '15m'}
            notification={notification}
            symbol={notification.symbol}
            exchange={notification.exchange || 'binance'}
            currentPrice={notification.currentPrice}
          />
        )}


      </div>
    </div>
  );
}

