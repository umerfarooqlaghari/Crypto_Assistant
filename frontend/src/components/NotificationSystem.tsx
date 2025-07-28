'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info, RefreshCw, Eye } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl, getApiUrl } from '../utils/api';
import Link from 'next/link';

interface NotificationPayload {
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
}

interface NotificationSystemProps {
  enableVisual?: boolean;
}

export default function NotificationSystem({
  enableVisual = true
}: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [allNotifications, setAllNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const socketConnection = io(getWebSocketUrl(), {
      transports: ['websocket', 'polling']
    });

    socketConnection.on('connect', () => {
      console.log('🔔 Notification system connected');
    });

    socketConnection.on('notification', (notification: NotificationPayload) => {
      handleNewNotification(notification);
    });

    socketConnection.on('disconnect', () => {
      console.log('🔔 Notification system disconnected');
    });

    setSocket(socketConnection);

    // Fetch initial unread count and notifications
    fetchUnreadCount();
    fetchAllNotifications();

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(getApiUrl('/api/notifications/unread-count'));
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Fetch all notifications
  const fetchAllNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/notifications?limit=100'));
      if (response.ok) {
        const data = await response.json();
        setAllNotifications(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh notifications
  const refreshNotifications = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchAllNotifications(),
        fetchUnreadCount()
      ]);
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNewNotification = (notification: NotificationPayload) => {
    // Add to notifications list (persist until page refresh)
    setNotifications(prev => {
      // Check if notification already exists to avoid duplicates
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;

      const updated = [notification, ...prev];
      return updated; // Don't limit, keep all until page refresh
    });

    // Update unread count
    setUnreadCount(prev => prev + 1);

    // Show visual notification if enabled
    if (enableVisual && notification.hasVisual && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/crypto-icon.png', // You'll need to add this file
          tag: notification.id
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/crypto-icon.png',
              tag: notification.id
            });
          }
        });
      }
    }

    // Auto-hide toast notification after 10 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 10000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllRecentNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(getApiUrl(`/api/notifications/${id}/read`), {
        method: 'PUT'
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(getApiUrl('/api/notifications/mark-all-read'), {
        method: 'PUT'
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'STRONG_SIGNAL':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'ALERT':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'WARNING':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-red-500 bg-red-50';
      case 'MEDIUM':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'LOW':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'text-green-600 bg-green-100';
      case 'SELL':
        return 'text-red-600 bg-red-100';
      case 'HOLD':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        {showPanel && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={refreshNotifications}
                    disabled={refreshing}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    title="Refresh notifications"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                  {!showAllNotifications && notifications.length > 0 && (
                    <button
                      onClick={clearAllRecentNotifications}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                      title="Clear all recent notifications"
                    >
                      Clear All
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowPanel(false)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAllNotifications(false)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                    !showAllNotifications
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  Recent ({notifications.length})
                  {notifications.length > 0 && !showAllNotifications && (
                    <span className="ml-1 inline-flex items-center justify-center w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAllNotifications(true);
                    if (allNotifications.length === 0) {
                      fetchAllNotifications();
                    }
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                    showAllNotifications
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  All Notifications
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading notifications...
                </div>
              ) : (
                (() => {
                  const displayNotifications = showAllNotifications ? allNotifications : notifications;
                  return displayNotifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {showAllNotifications ? 'No notifications found' : 'No recent notifications'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {displayNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <button
                                  onClick={() => {
                                    removeNotification(notification.id);
                                    markAsRead(notification.id);
                                  }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-xs">
                                  <span className={`px-2 py-1 rounded-full font-medium ${getSignalColor(notification.signal)}`}>
                                    {notification.signal}
                                  </span>
                                  <span className="text-gray-500">
                                    C:{(notification.confidence || 0).toFixed(1)}%
                                  </span>
                                  <span className="text-gray-500">
                                    S:{(notification.strength || 0).toFixed(1)}%
                                  </span>
                                  {notification.timeframe && (
                                    <span className="text-gray-500">
                                      {notification.timeframe}
                                    </span>
                                  )}
                                </div>
                                <Link
                                  href={`/notifications/${notification.id}`}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => setShowPanel(false)}
                                >
                                  <Eye className="h-3 w-3" />
                                  Details
                                </Link>
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                {new Date(notification.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

            {(() => {
              const displayNotifications = showAllNotifications ? allNotifications : notifications;
              return displayNotifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-700">
                      {displayNotifications.length} {showAllNotifications ? 'total' : 'recent'} notification{displayNotifications.length !== 1 ? 's' : ''}
                    </div>
                    {unreadCount > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        {unreadCount} unread
                      </div>
                    )}
                    {!showAllNotifications && notifications.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Notifications persist until page refresh
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Enhanced Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
        {notifications.slice(0, 5).map((notification, index) => (
          <div
            key={`toast-${notification.id}`}
            className={`w-full bg-gradient-to-r ${
              notification.priority === 'HIGH'
                ? 'from-red-500 to-red-600'
                : notification.priority === 'MEDIUM'
                ? 'from-yellow-500 to-yellow-600'
                : 'from-green-500 to-green-600'
            } shadow-2xl rounded-xl border border-white/20 backdrop-blur-sm transform transition-all duration-500 ease-out animate-slide-in-right`}
            style={{
              animationDelay: `${index * 100}ms`,
              transform: `translateY(${index * 4}px) scale(${1 - index * 0.02})`
            }}
          >
            <div className="p-4 text-white">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    {notification.type === 'STRONG_SIGNAL' ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : notification.type === 'ALERT' ? (
                      <AlertCircle className="h-5 w-5 text-white" />
                    ) : (
                      <Info className="h-5 w-5 text-white" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-white truncate">
                      {notification.symbol} {notification.signal}
                    </p>
                    <span className="text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
                      {notification.priority}
                    </span>
                  </div>

                  <p className="text-xs text-white/90 mb-2 line-clamp-2">
                    {notification.message}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-1">
                        <span className="text-xs font-medium text-white">
                          C: {(notification.confidence || 0).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-1">
                        <span className="text-xs font-medium text-white">
                          S: {(notification.strength || 0).toFixed(0)}%
                        </span>
                      </div>
                      {notification.timeframe && (
                        <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-1">
                          <span className="text-xs font-medium text-white">
                            {notification.timeframe}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors duration-200"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4 text-white/80 hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar for visual appeal */}
              <div className="mt-3 w-full bg-white/20 rounded-full h-1">
                <div
                  className="bg-white h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(notification.confidence || 0, notification.strength || 0)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
