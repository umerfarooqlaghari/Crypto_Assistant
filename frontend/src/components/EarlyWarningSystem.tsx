import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, getWebSocketUrl } from '../utils/api';
import { io, Socket } from 'socket.io-client';

interface EarlyWarningAlert {
  id: string;
  symbol: string;
  alertType: 'PUMP_LIKELY' | 'DUMP_LIKELY' | 'NEUTRAL';
  confidence: number;
  timeEstimateMin: number;
  timeEstimateMax: number;
  triggeredBy: string[];
  currentPrice: number;
  volume24h?: number;
  priceChange24h?: number;
  createdAt: string;
  triggeredAt?: string;
  phase1Score: number;
  phase2Score: number;
  phase3Score: number;
  volumeSpike?: any;
  rsiMomentum?: any;
  emaConvergence?: any;
  bidAskImbalance?: any;
  priceAction?: any;
  whaleActivity?: any;
  isActive?: boolean;
  isResolved?: boolean;
  actualOutcome?: string;
  accuracyScore?: number;
}



const EarlyWarningSystem: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<EarlyWarningAlert[]>([]);
  const [allAlerts, setAllAlerts] = useState<EarlyWarningAlert[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('recent');
  const [socket, setSocket] = useState<Socket | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch recent alerts count for badge
  const fetchRecentCount = async () => {
    try {
      const response = await fetch(getApiUrl('/api/early-warnings/recent-count'));
      if (response.ok) {
        const data = await response.json();
        setRecentCount(data.data.count);
      }
    } catch (error) {
      console.error('Error fetching recent alerts count:', error);
    }
  };

  // Fetch all alerts from database
  const fetchAllAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/early-warnings/history?limit=100'));
      if (response.ok) {
        const data = await response.json();
        setAllAlerts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching all alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh all alerts from database
  const refreshAllAlerts = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(getApiUrl('/api/early-warnings/history?limit=100'));
      if (response.ok) {
        const data = await response.json();
        setAllAlerts(data.data || []);
      }
    } catch (error) {
      console.error('Error refreshing all alerts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle panel toggle
  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      if (activeTab === 'all') {
        fetchAllAlerts();
      }
      // Recent alerts are handled by WebSocket, no need to fetch
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'recent' | 'all') => {
    setActiveTab(tab);
    if (tab === 'all') {
      fetchAllAlerts();
    }
    // Recent alerts are handled by WebSocket, no need to fetch
  };

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Initialize WebSocket connection for real-time alerts
  useEffect(() => {
    const socketConnection = io(getWebSocketUrl(), {
      transports: ['websocket', 'polling']
    });

    socketConnection.on('connect', () => {
      console.log('🚨 Early Warning System connected to WebSocket');
    });

    socketConnection.on('disconnect', () => {
      console.log('🚨 Early Warning System disconnected from WebSocket');
    });

    // Listen for new early warning alerts
    socketConnection.on('earlyWarning', (alert: any) => {
      console.log('🚨 New early warning alert received:', alert.symbol, alert.alertType);

      // Add to recent alerts (in-memory)
      setRecentAlerts(prev => {
        const newAlert = {
          id: alert.id || `early_${Date.now()}_${alert.symbol}`,
          symbol: alert.symbol,
          alertType: alert.alertType,
          confidence: alert.confidence,
          timeEstimateMin: parseInt(alert.timeEstimate?.split('-')[0]) || 0,
          timeEstimateMax: parseInt(alert.timeEstimate?.split('-')[1]) || 0,
          triggeredBy: alert.triggeredBy || [],
          currentPrice: alert.currentPrice,
          createdAt: alert.timestamp || new Date().toISOString(),
          phase1Score: alert.phase1Score || 0,
          phase2Score: alert.phase2Score || 0,
          phase3Score: alert.phase3Score || 0
        };

        // Keep only last 20 recent alerts
        const updated = [newAlert, ...prev].slice(0, 20);
        return updated;
      });

      // Update recent count
      setRecentCount(prev => prev + 1);
    });

    setSocket(socketConnection);

    return () => {
      console.log('🚨 Early Warning System unmounting - closing WebSocket connection');
      socketConnection.disconnect();
    };
  }, []);

  // Fetch recent count on mount and periodically
  useEffect(() => {
    fetchRecentCount();
    const interval = setInterval(fetchRecentCount, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch recent count on mount and periodically
  useEffect(() => {
    fetchRecentCount();
    const interval = setInterval(fetchRecentCount, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Format time estimate
  const formatTimeEstimate = (min: number, max: number) => {
    if (min < 1 && max < 1) {
      return `${Math.round(min * 60)}-${Math.round(max * 60)}s`;
    }
    return `${min}-${max}m`;
  };

  // Get alert type color
  const getAlertTypeColor = (alertType: string) => {
    switch (alertType) {
      case 'PUMP_LIKELY':
        return 'text-green-300 bg-green-600/20 border border-green-500/30';
      case 'DUMP_LIKELY':
        return 'text-red-300 bg-red-600/20 border border-red-500/30';
      default:
        return 'text-yellow-300 bg-yellow-600/20 border border-yellow-500/30';
    }
  };

  // Get alert type icon
  const getAlertTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'PUMP_LIKELY':
        return '📈';
      case 'DUMP_LIKELY':
        return '📉';
      default:
        return '⚠️';
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertTime = new Date(dateString);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Warning Icon Button */}
      <button
        onClick={handleToggle}
        className="relative p-3 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-lg transition-all duration-200 border border-yellow-400/30 hover:border-yellow-400/50"
        title="Early Warning Alerts"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>

        {/* Badge for recent alerts count */}
        {recentCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
            {recentCount > 9 ? '9+' : recentCount}
          </span>
        )}
      </button>

      {/* Early Warning Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 z-50 max-h-96 overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-yellow-900/20 to-orange-900/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ⚡ Early Warning System
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex mt-3 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => handleTabChange('recent')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'recent'
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                Recent ({recentAlerts.length})
              </button>
              <button
                onClick={() => handleTabChange('all')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {activeTab === 'all' && (
                <button
                  onClick={refreshAllAlerts}
                  disabled={refreshing}
                  className="ml-2 p-2 hover:bg-yellow-700 rounded transition-colors disabled:opacity-50 text-gray-300 hover:text-white"
                  title="Refresh all alerts"
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto bg-gray-900">
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mx-auto"></div>
                <p className="mt-2 text-white">Loading alerts...</p>
              </div>
            ) : (
              <div className="p-3">
                {(activeTab === 'recent' ? recentAlerts : allAlerts).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-white">No {activeTab} alerts</p>
                  </div>
                ) : (
                  (activeTab === 'recent' ? recentAlerts : allAlerts).map((alert) => (
                    <div key={alert.id} className="mb-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors border border-gray-700/50 hover:border-gray-600">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">{getAlertTypeIcon(alert.alertType || 'NEUTRAL')}</span>
                            <span className="font-bold text-white text-lg">{alert.symbol}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getAlertTypeColor(alert.alertType || 'NEUTRAL')}`}>
                              {(alert.alertType || 'NEUTRAL').replace('_', ' ')}
                            </span>
                          </div>

                          <div className="text-sm text-gray-300 mb-3">
                            <div className="flex items-center gap-4">
                              <span className="bg-blue-600/20 px-2 py-1 rounded text-blue-300">Confidence: {alert.confidence}%</span>
                              {alert.timeEstimateMin && alert.timeEstimateMax && (
                                <span className="bg-purple-600/20 px-2 py-1 rounded text-purple-300">ETA: {formatTimeEstimate(alert.timeEstimateMin, alert.timeEstimateMax)}</span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-gray-400">
                            {alert.triggeredBy && (
                              <div className="mb-2 text-gray-300">
                                <span className="font-medium">Triggered by:</span> {alert.triggeredBy.join(', ')}
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {alert.phase1Score !== undefined && <span className="bg-blue-600/20 px-2 py-1 rounded text-blue-300 text-xs">Volume & Momentum: {alert.phase1Score}</span>}
                              {alert.phase2Score !== undefined && <span className="bg-purple-600/20 px-2 py-1 rounded text-purple-300 text-xs">Order Flow: {alert.phase2Score}</span>}
                              {alert.phase3Score !== undefined && <span className="bg-orange-600/20 px-2 py-1 rounded text-orange-300 text-xs">Whale Activity: {alert.phase3Score}</span>}
                              <span className="ml-auto text-gray-500 text-xs">{formatTimeAgo(alert.createdAt || alert.triggeredAt || new Date().toISOString())}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarlyWarningSystem;
