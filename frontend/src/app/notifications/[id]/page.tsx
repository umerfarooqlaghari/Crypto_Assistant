'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
          <h1 className="text-2xl font-bold">Technical Analysis Summary</h1>
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

