// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  ENDPOINTS: {
    SYMBOLS: '/api/enhanced-signals/symbols',
    ADVANCED_SIGNALS: '/api/enhanced-signals/advanced',
    MARKET_OVERVIEW: '/api/enhanced-signals/market-overview',
  }
};

// Helper function to build full API URLs
export const getApiUrl = (endpoint: string, params?: Record<string, string>) => {
  const url = new URL(endpoint, API_CONFIG.BASE_URL);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  return url.toString();
};

// WebSocket URL
export const getWebSocketUrl = () => {
  return API_CONFIG.BASE_URL;
};
