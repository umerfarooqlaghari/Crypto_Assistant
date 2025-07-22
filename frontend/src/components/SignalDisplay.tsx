'use client';

import { TrendingUp, TrendingDown, Activity, Target, Shield, DollarSign } from 'lucide-react';

interface SignalData {
  symbol: string;
  timeframe: string;
  timestamp: string;
  currentPrice: number;
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

interface SignalDisplayProps {
  signalData: SignalData;
  loading: boolean;
}

export default function SignalDisplay({ signalData, loading }: SignalDisplayProps) {
  // Validate signal data
  if (!signalData || !signalData.signal) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
        <div className="text-center text-gray-400">
          No signal data available
        </div>
      </div>
    );
  }
  const getSignalColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-400';
      case 'SELL': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getSignalBgColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-500/40';
      case 'SELL': return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-red-500/40';
      default: return 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border-yellow-500/40';
    }
  };

  const getSignalIcon = (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUp className="w-6 h-6" />;
      case 'SELL': return <TrendingDown className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700/50 rounded mb-4"></div>
          <div className="h-4 bg-gray-700/50 rounded mb-2"></div>
          <div className="h-4 bg-gray-700/50 rounded mb-2"></div>
          <div className="h-4 bg-gray-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
      <h3 className="text-xl font-semibold text-gray-100 mb-6 flex items-center gap-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        Trading Signal
      </h3>
      
      {/* Main Signal */}
      <div className={`rounded-lg p-4 mb-6 border ${getSignalBgColor(signalData.signal.action)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={getSignalColor(signalData.signal.action)}>
              {getSignalIcon(signalData.signal.action)}
            </div>
            <div>
              <div className={`text-2xl font-bold ${getSignalColor(signalData.signal.action)}`}>
                {signalData.signal.action}
              </div>
              <div className="text-sm text-gray-300">
                {signalData.symbol} • {signalData.timeframe}
              </div>
            </div>
          </div>
          
          {/* Confidence Meter */}
          <div className="text-right">
            <div className="text-sm text-gray-300 mb-1">Confidence</div>
            <div className={`text-2xl font-bold ${getConfidenceColor(signalData.signal.confidence)}`}>
              {signalData.signal.confidence}%
            </div>
            <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getConfidenceBg(signalData.signal.confidence)} transition-all duration-500`}
                style={{ width: `${signalData.signal.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Strength Indicator */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-300 mb-1">
            <span>Signal Strength</span>
            <span>{Math.round(signalData.signal.strength)}/100</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gray-400 to-gray-500 transition-all duration-500"
              style={{ width: `${signalData.signal.strength}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trading Levels - Only show for BUY and HOLD signals (spot trading) */}
      {signalData.signal.action !== 'SELL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Entry & Stop Loss */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-700/30 to-gray-600/20 rounded-lg border border-gray-500/40">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-300" />
              <span className="text-sm text-gray-300">Entry</span>
            </div>
            <span className="font-semibold text-gray-100">{formatPrice(signalData.signal.entry)}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-900/30 to-red-800/20 rounded-lg border border-red-500/40">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-300">Stop Loss</span>
            </div>
            <span className="font-semibold text-gray-100">{formatPrice(signalData.signal.stopLoss)}</span>
          </div>
        </div>

        {/* Take Profits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-900/30 to-green-800/20 rounded-lg border border-green-500/40">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">TP1</span>
            </div>
            <span className="font-semibold text-gray-100">{formatPrice(signalData.signal.takeProfit1)}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-900/30 to-green-800/20 rounded-lg border border-green-500/40">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">TP2</span>
            </div>
            <span className="font-semibold text-gray-100">{formatPrice(signalData.signal.takeProfit2)}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-900/30 to-green-800/20 rounded-lg border border-green-500/40">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">TP3</span>
            </div>
            <span className="font-semibold text-gray-100">{formatPrice(signalData.signal.takeProfit3)}</span>
          </div>
        </div>
      </div>
      )}

      {/* Reasoning */}
      <div>
        <h4 className="text-lg font-semibold text-gray-100 mb-3">Analysis Reasoning</h4>
        <div className="space-y-2">
          {signalData.signal.reasoning.map((reason, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-gray-300">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
