'use client';

import { BarChart3 } from 'lucide-react';

interface TechnicalIndicatorsProps {
  indicators: {
    rsi: number;
    macd: {
      MACD: number;
      signal: number;
      histogram: number;
    };
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
    };
    ema20: number;
    ema50: number;
    stochastic: {
      k: number;
      d: number;
    };
    obv?: {
      current: number;
      trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      divergence: 'BULLISH' | 'BEARISH' | 'NONE';
    };
  };
  currentPrice?: number;
}

export default function TechnicalIndicators({ indicators, currentPrice }: TechnicalIndicatorsProps) {
  // Bollinger Bands status functions
  const getBollingerStatus = (price: number, bands: { upper: number; middle: number; lower: number }) => {
    if (price > bands.upper) return 'OVERBOUGHT';
    if (price < bands.lower) return 'OVERSOLD';
    if (price > bands.middle) return 'BULLISH';
    if (price < bands.middle) return 'BEARISH';
    return 'NEUTRAL';
  };

  const getBollingerStatusColor = (status: string) => {
    switch (status) {
      case 'OVERBOUGHT': return 'text-red-400';
      case 'OVERSOLD': return 'text-green-400';
      case 'BULLISH': return 'text-green-300';
      case 'BEARISH': return 'text-red-300';
      default: return 'text-yellow-400';
    }
  };

  // Validate indicators data
  if (!indicators || typeof indicators.rsi !== 'number' || !indicators.macd || !indicators.bollingerBands) {
    return (
      <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-100">Technical Indicators</h3>
        </div>
        <div className="text-center text-gray-400">
          No indicator data available
        </div>
      </div>
    );
  }
  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return 'text-red-400';
    if (rsi < 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getRSIStatus = (rsi: number) => {
    if (rsi > 70) return 'Overbought';
    if (rsi < 30) return 'Oversold';
    return 'Neutral';
  };

  const getMACDColor = (macd: number, signal: number) => {
    if (macd > signal) return 'text-green-400';
    return 'text-red-400';
  };

  const getMACDStatus = (macd: number, signal: number) => {
    if (macd > signal) return 'Bullish';
    return 'Bearish';
  };

  const getEMAStatus = (ema20: number, ema50: number) => {
    if (ema20 > ema50) return { status: 'Bullish', color: 'text-green-400' };
    return { status: 'Bearish', color: 'text-red-400' };
  };

  const getStochasticColor = (k: number, d: number) => {
    if (k > 80 && d > 80) return 'text-red-400';
    if (k < 20 && d < 20) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getStochasticStatus = (k: number, d: number) => {
    if (k > 80 && d > 80) return 'Overbought';
    if (k < 20 && d < 20) return 'Oversold';
    return 'Neutral';
  };

  // OBV helper functions
  const getOBVTrendColor = (trend: string) => {
    switch (trend) {
      case 'BULLISH': return 'text-green-400';
      case 'BEARISH': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getOBVDivergenceColor = (divergence: string) => {
    switch (divergence) {
      case 'BULLISH': return 'text-green-400';
      case 'BEARISH': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatOBVValue = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
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

  const safeNumber = (value: number, defaultValue: number = 0) => {
    return (value === null || value === undefined || isNaN(value)) ? defaultValue : value;
  };

  const formatIndicatorValue = (value: number, decimals: number = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }

    // For very small values, show more decimal places (up to 15)
    if (Math.abs(value) < 0.01 && value !== 0) {
      const significantDigits = Math.max(decimals, Math.ceil(-Math.log10(Math.abs(value))) + 2);
      const maxDigits = Math.min(significantDigits, 15);
      const formatted = value.toFixed(maxDigits);
      // Remove trailing zeros
      return formatted.replace(/\.?0+$/, '');
    }

    return value.toFixed(decimals);
  };

  const emaStatus = getEMAStatus(indicators.ema20, indicators.ema50);

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-100">Technical Indicators</h3>
      </div>

      <div className="space-y-4">
        {/* RSI */}
        <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">RSI (14)</span>
            <span className={`text-sm font-semibold ${getRSIColor(indicators.rsi)}`}>
              {getRSIStatus(indicators.rsi)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${getRSIColor(safeNumber(indicators.rsi))}`}>
              {formatIndicatorValue(safeNumber(indicators.rsi), 1)}
            </span>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  indicators.rsi > 70 ? 'bg-red-500' : 
                  indicators.rsi < 30 ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${indicators.rsi}%` }}
              />
            </div>
          </div>
        </div>

        {/* MACD */}
        <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">MACD</span>
            <span className={`text-sm font-semibold ${getMACDColor(indicators.macd.MACD, indicators.macd.signal)}`}>
              {getMACDStatus(indicators.macd.MACD, indicators.macd.signal)}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">MACD:</span>
              <span className="text-gray-100">{formatIndicatorValue(safeNumber(indicators.macd.MACD), 6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Signal:</span>
              <span className="text-gray-100">{formatIndicatorValue(safeNumber(indicators.macd.signal), 6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Histogram:</span>
              <span className={`${indicators.macd.histogram >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatIndicatorValue(safeNumber(indicators.macd.histogram), 6)}
              </span>
            </div>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Bollinger Bands</span>
            {currentPrice && (
              <span className={`text-sm font-semibold ${getBollingerStatusColor(getBollingerStatus(currentPrice, indicators.bollingerBands))}`}>
                {getBollingerStatus(currentPrice, indicators.bollingerBands)}
              </span>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Upper:</span>
              <span className="text-gray-100">{formatPrice(indicators.bollingerBands.upper)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Middle:</span>
              <span className="text-gray-100">{formatPrice(indicators.bollingerBands.middle)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Lower:</span>
              <span className="text-gray-100">{formatPrice(indicators.bollingerBands.lower)}</span>
            </div>
          </div>
        </div>

        {/* EMA */}
        <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">EMA Trend</span>
            <span className={`text-sm font-semibold ${emaStatus.color}`}>
              {emaStatus.status}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">EMA 20:</span>
              <span className="text-gray-100">{formatPrice(indicators.ema20)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">EMA 50:</span>
              <span className="text-gray-100">{formatPrice(indicators.ema50)}</span>
            </div>
          </div>
        </div>

        {/* Stochastic */}
        <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Stochastic</span>
            <span className={`text-sm font-semibold ${getStochasticColor(indicators.stochastic.k, indicators.stochastic.d)}`}>
              {getStochasticStatus(indicators.stochastic.k, indicators.stochastic.d)}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">%K:</span>
              <span className="text-gray-100">{formatIndicatorValue(safeNumber(indicators.stochastic.k), 1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">%D:</span>
              <span className="text-gray-100">{formatIndicatorValue(safeNumber(indicators.stochastic.d), 1)}</span>
            </div>
          </div>
        </div>

        {/* OBV (On-Balance Volume) */}
        {indicators.obv && (
          <div className="p-4 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">OBV (On-Balance Volume)</span>
              <span className={`text-sm font-semibold ${getOBVTrendColor(indicators.obv.trend)}`}>
                {indicators.obv.trend}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Current:</span>
                <span className="text-gray-100">{formatOBVValue(indicators.obv.current)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trend:</span>
                <span className={getOBVTrendColor(indicators.obv.trend)}>{indicators.obv.trend}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Divergence:</span>
                <span className={getOBVDivergenceColor(indicators.obv.divergence)}>
                  {indicators.obv.divergence === 'NONE' ? 'None' : indicators.obv.divergence}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
