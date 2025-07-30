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
    adx: number;
  };
  currentPrice?: number;
  compact?: boolean;
}

export default function TechnicalIndicators({ indicators, currentPrice, compact = false }: TechnicalIndicatorsProps) {
  // Calculate indicator data based on the same logic as compact section
  const calculateIndicatorData = () => {
    const indicatorData = [];

    // RSI analysis - same logic as compact section
    let rsiStatus = '';
    if (indicators.rsi > 70) {
      rsiStatus = 'BEARISH';
    } else if (indicators.rsi < 30) {
      rsiStatus = 'BULLISH';
    } else {
      rsiStatus = 'NEUTRAL';
    }
    indicatorData.push({
      name: 'RSI',
      status: rsiStatus,
      type: 'rsi'
    });

    // MACD analysis - same logic as compact section
    let macdStatus = '';
    if (indicators.macd?.MACD > indicators.macd?.signal) {
      macdStatus = 'BULLISH';
    } else {
      macdStatus = 'BEARISH';
    }
    indicatorData.push({
      name: 'MACD',
      status: macdStatus,
      type: 'macd'
    });

    // EMA analysis - same logic as compact section
    let emaStatus = '';
    if (indicators.ema20 > indicators.ema50) {
      emaStatus = 'BULLISH';
    } else {
      emaStatus = 'BEARISH';
    }
    indicatorData.push({
      name: 'EMA Trend',
      status: emaStatus,
      type: 'ema'
    });

    // Bollinger Bands analysis - same logic as compact section
    let bbStatus = '';
    if (currentPrice && indicators.bollingerBands) {
      const { upper, lower } = indicators.bollingerBands;
      if (currentPrice > upper) {
        bbStatus = 'BEARISH';
      } else if (currentPrice < lower) {
        bbStatus = 'BULLISH';
      } else {
        bbStatus = 'NEUTRAL';
      }
    } else {
      bbStatus = 'NEUTRAL';
    }
    indicatorData.push({
      name: 'Bollinger Bands',
      status: bbStatus,
      type: 'bollinger'
    });

    // ADX analysis - trend strength indicator
    let adxStatus = '';
    if (indicators.adx < 20) {
      adxStatus = 'NEUTRAL'; // Weak/no trend
    } else {
      // Direction based on EMA trend
      if (indicators.ema20 > indicators.ema50) {
        adxStatus = 'BULLISH'; // Strong uptrend
      } else {
        adxStatus = 'BEARISH'; // Strong downtrend
      }
    }
    indicatorData.push({
      name: 'ADX',
      status: adxStatus,
      type: 'adx'
    });

    // Return in fixed order (no sorting) to match compact section order
    return indicatorData;
  };

  const indicatorData = calculateIndicatorData();

  // Render specific indicator details based on type
  const renderIndicatorDetails = (type: string) => {
    switch (type) {
      case 'rsi':
        return (
          <div className="flex items-center justify-between">
            <span className={`text-base font-bold ${
              indicators.rsi > 70 ? 'text-red-400' :
              indicators.rsi < 30 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {formatIndicatorValue(safeNumber(indicators.rsi), 1)}
            </span>
            <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  indicators.rsi > 70 ? 'bg-red-500' :
                  indicators.rsi < 30 ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${indicators.rsi}%` }}
              />
            </div>
          </div>
        );

      case 'macd':
        return (
          <div className="space-y-1 text-xs">
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
        );

      case 'bollinger':
        return (
          <div className="space-y-1 text-xs">
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
        );

      case 'ema':
        return (
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">EMA 20:</span>
              <span className="text-gray-100">{formatPrice(indicators.ema20)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">EMA 50:</span>
              <span className="text-gray-100">{formatPrice(indicators.ema50)}</span>
            </div>
          </div>
        );

      case 'adx':
        return (
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">ADX:</span>
              <span className={`font-bold ${
                indicators.adx > 50 ? 'text-green-400' :
                indicators.adx >= 25 ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                {formatIndicatorValue(safeNumber(indicators.adx), 1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Trend:</span>
              <span className={`text-xs ${
                indicators.adx < 20 ? 'text-gray-400' :
                indicators.ema20 > indicators.ema50 ? 'text-green-400' : 'text-red-400'
              }`}>
                {indicators.adx < 20 ? 'Range-bound' :
                 indicators.adx > 50 ? 'Very Strong' :
                 indicators.adx >= 25 ? 'Strong' : 'Emerging'}
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Validate indicators data
  if (!indicators || typeof indicators.rsi !== 'number' || !indicators.macd || !indicators.bollingerBands || typeof indicators.adx !== 'number') {
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

  return (
    <div className={compact ? "" : "bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-6 border border-gray-600/30 shadow-xl"}>
      {!compact && (
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-100">Technical Indicators</h3>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Render indicators in responsive grid layout to fit all 5 indicators */}
        {indicatorData.map((indicator) => (
          <div key={indicator.type} className="p-3 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded-lg border border-gray-600/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span className="text-base font-bold text-gray-100">{indicator.name}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                indicator.status === 'BULLISH' ? 'text-green-400 bg-green-900/20' :
                indicator.status === 'BEARISH' ? 'text-red-400 bg-red-900/20' : 'text-yellow-400 bg-yellow-900/20'
              }`}>
                {indicator.status}
              </span>
            </div>
            {renderIndicatorDetails(indicator.type)}
          </div>
        ))}
      </div>
    </div>
  );
}
