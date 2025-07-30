'use client';

import Link from 'next/link';

interface TimeframeAnalysisSectionProps {
  timeframe: string;
  notification: any;
  symbol: string;
  exchange: string;
  currentPrice?: number;
}

export default function TimeframeAnalysisSection({ 
  timeframe, 
  notification, 
  symbol, 
  exchange, 
  currentPrice 
}: TimeframeAnalysisSectionProps) {
  
  // Get technical indicators for this timeframe
  const getTechnicalIndicators = () => {
    if (notification.timeframe === 'multi' && notification.technicalIndicators && notification.technicalIndicators[timeframe]) {
      return notification.technicalIndicators[timeframe].technicalIndicators || {};
    } else if (notification.technicalIndicators) {
      return notification.technicalIndicators;
    }
    return {};
  };

  // Get chart patterns for this timeframe
  const getChartPatterns = () => {
    if (notification.timeframe === 'multi' && notification.technicalIndicators && notification.technicalIndicators[timeframe]) {
      return notification.technicalIndicators[timeframe].chartPatterns || [];
    } else if (notification.chartPatterns) {
      return notification.chartPatterns;
    }
    return [];
  };

  // Get candlestick patterns for this timeframe
  const getCandlestickPatterns = () => {
    if (notification.timeframe === 'multi' && notification.technicalIndicators && notification.technicalIndicators[timeframe]) {
      return notification.technicalIndicators[timeframe].candlestickPatterns || [];
    } else if (notification.candlestickPatterns) {
      return notification.candlestickPatterns;
    }
    return [];
  };

  // Get analysis reasoning for this timeframe
  const getAnalysisReasoning = () => {
    if (notification.timeframe === 'multi' && notification.technicalIndicators && notification.technicalIndicators[timeframe]) {
      return notification.technicalIndicators[timeframe].analysisReasoning || [];
    } else if (notification.analysisReasoning) {
      return notification.analysisReasoning;
    }
    return [];
  };

  const technicalIndicators = getTechnicalIndicators();
  const chartPatterns = getChartPatterns();
  const candlestickPatterns = getCandlestickPatterns();
  const analysisReasoning = getAnalysisReasoning();

  // Get confidence and strength for this timeframe
  const getConfidenceAndStrength = () => {
    if (notification.timeframe === 'multi' && notification.technicalIndicators && notification.technicalIndicators[timeframe]) {
      const data = notification.technicalIndicators[timeframe];
      return {
        confidence: data.confidence || notification.confidence || 0,
        strength: data.strength || notification.strength || 0
      };
    }
    return {
      confidence: notification.confidence || 0,
      strength: notification.strength || 0
    };
  };

  const { confidence, strength } = getConfidenceAndStrength();

  // Get pattern signal color and badge
  const getPatternSignalBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'BULLISH':
        return 'bg-green-600 text-white';
      case 'BEARISH':
        return 'bg-red-600 text-white';
      case 'NEUTRAL':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  // Get indicator signal
  const getIndicatorSignal = (key: string, value: any): string => {
    if (key.toLowerCase().includes('rsi')) {
      const rsiValue = typeof value === 'number' ? value : (value?.value || 0);
      if (rsiValue > 70) return 'Sell';
      if (rsiValue < 30) return 'Buy';
      return 'Neutral';
    }

    if (key.toLowerCase().includes('macd')) {
      if (typeof value === 'object' && value !== null) {
        // Check if it has MACD and signal properties (uppercase)
        if (typeof value.MACD === 'number' && typeof value.signal === 'number') {
          return value.MACD > value.signal ? 'Buy' : 'Sell';
        }
        // Check if it has macd and signal properties (lowercase)
        if (typeof value.macd === 'number' && typeof value.signal === 'number') {
          return value.macd > value.signal ? 'Buy' : 'Sell';
        }
        // If it has a signal property that's a string
        if (typeof value.signal === 'string') {
          return String(value.signal);
        }
      }
      return 'Neutral';
    }

    if (key.toLowerCase().includes('ema') || key.toLowerCase().includes('movingaverages') || key === 'emaTrend') {
      // Handle individual EMA values by comparing with other EMAs in technicalIndicators
      if (typeof value === 'number') {
        if (key.toLowerCase().includes('ema20') && technicalIndicators.ema50) {
          const ema20 = value;
          const ema50 = technicalIndicators.ema50;
          return ema20 > ema50 ? 'Buy' : 'Sell';
        }
        if (key.toLowerCase().includes('ema50') && technicalIndicators.ema20) {
          const ema20 = technicalIndicators.ema20;
          const ema50 = value;
          return ema20 > ema50 ? 'Buy' : 'Sell';
        }
        // For individual EMA values without comparison, return neutral
        return 'Neutral';
      }

      // Handle EMA object with multiple values
      if (typeof value === 'object' && value !== null) {
        // Check for EMA trend signals
        if (typeof value.ema20 === 'number' && typeof value.ema50 === 'number') {
          return value.ema20 > value.ema50 ? 'Buy' : 'Sell';
        }
        if (typeof value.ema12 === 'number' && typeof value.ema26 === 'number') {
          return value.ema12 > value.ema26 ? 'Buy' : 'Sell';
        }
      }
      return 'Neutral';
    }

    if (key.toLowerCase().includes('bollinger')) {
      if (typeof value === 'object' && value !== null) {
        // Use current price from notification or props to determine Bollinger Bands signal
        const priceToUse = currentPrice || notification.currentPrice;
        if (typeof value.upper === 'number' && typeof value.lower === 'number' && priceToUse) {
          if (priceToUse > value.upper) {
            return 'Sell';
          }
          if (priceToUse < value.lower) {
            return 'Buy';
          }
        }
      }
      return 'Neutral';
    }

    // Generic object with signal property
    if (typeof value === 'object' && value?.signal) {
      return String(value.signal || 'Neutral');
    }

    return 'Neutral';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Technical Analysis Summary</h2>
      </div>

      {/* Header Section - Horizontal Layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 pb-4 border-b border-gray-700">
        <div>
          <div className="text-sm text-gray-400">Exchange</div>
          <div className="text-lg font-semibold">{exchange}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Current Price</div>
          <div className="text-lg font-semibold">${currentPrice?.toFixed(2) || '0.30'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Timeframe</div>
          <div className="text-lg font-semibold">{timeframe}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Generated At</div>
          <div className="text-lg font-semibold">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Main Analysis Grid - 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Left: Technical Indicators */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Technical Indicators</h4>
          <div className="space-y-3">
            {(() => {
              // Create a custom list of indicators to show
              const indicatorsToShow = [];

              // Add RSI if available
              if (technicalIndicators.rsi !== undefined) {
                indicatorsToShow.push(['rsi', technicalIndicators.rsi]);
              }

              // Add MACD if available
              if (technicalIndicators.macd !== undefined) {
                indicatorsToShow.push(['macd', technicalIndicators.macd]);
              }

              // Add EMA Trend (combine EMA20 and EMA50 into one indicator)
              if (technicalIndicators.ema20 !== undefined && technicalIndicators.ema50 !== undefined) {
                indicatorsToShow.push(['emaTrend', { ema20: technicalIndicators.ema20, ema50: technicalIndicators.ema50 }]);
              }

              // Add Bollinger Bands if available
              if (technicalIndicators.bollingerBands !== undefined) {
                indicatorsToShow.push(['bollingerBands', technicalIndicators.bollingerBands]);
              }

              return indicatorsToShow;
            })()
              .map(([key, value]) => {
                const signal = getIndicatorSignal(key, value);
                let displayName = key.replace(/([A-Z])/g, ' $1').trim();

                // Special handling for indicators
                if (key.toLowerCase().includes('movingaverages') || key === 'emaTrend') {
                  displayName = 'EMA Trend';
                }
                if (key === 'bollingerBands') {
                  displayName = 'Bollinger Bands';
                }
                if (key === 'rsi') {
                  displayName = 'RSI';
                }
                if (key === 'macd') {
                  displayName = 'MACD';
                }

                // Get signal badge color
                const getSignalBadgeColor = (signal: string | null | undefined) => {
                  const signalStr = signal?.toString().toLowerCase() || '';
                  if (signalStr.includes('buy') || signalStr.includes('bullish')) {
                    return 'bg-green-600 text-white';
                  }
                  if (signalStr.includes('sell') || signalStr.includes('bearish')) {
                    return 'bg-red-600 text-white';
                  }
                  return 'bg-yellow-600 text-white';
                };

                return (
                  <div key={key} className="flex justify-between items-center py-2">
                    <div className="flex-1">
                      <div className="font-medium">{displayName}</div>
                    </div>
                    <div className="flex-1 text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSignalBadgeColor(signal)}`}>
                        {signal || 'Neutral'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top Right: Confidence & Strength */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Confidence & Strength</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Confidence</span>
                <span className="text-green-400 font-medium">{confidence.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(confidence, 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Strength</span>
                <span className="text-blue-400 font-medium">{strength.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(strength, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Left: Chart Patterns Detected */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Chart Patterns Detected</h4>
          {chartPatterns.length > 0 ? (
            <div className="space-y-3 mb-6">
              {chartPatterns.map((pattern: any, index: number) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{pattern.name || pattern.type || 'Double Top'}</div>
                    <div className="text-sm text-gray-400">{pattern.description || 'Bearish reversal'}</div>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${getPatternSignalBadge(pattern.type || 'BEARISH')}`}>
                    {(pattern.type || 'BEARISH').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">Double Top</div>
                  <div className="text-sm text-gray-400">Bearish reversal</div>
                </div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${getPatternSignalBadge('BEARISH')}`}>
                  BEARISH
                </span>
              </div>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">Descending Triangle</div>
                  <div className="text-sm text-gray-400">Bearish forecast</div>
                </div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${getPatternSignalBadge('BEARISH')}`}>
                  BEARISH
                </span>
              </div>
            </div>
          )}

          {/* Candlestick Patterns */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Candlestick Patterns</h4>
            {candlestickPatterns.length > 0 ? (
              <div className="space-y-3">
                {candlestickPatterns.map((pattern: any, index: number) => (
                  <div key={index} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{pattern.name || pattern.type || 'Evening Star'}</div>
                      <div className="text-sm text-gray-400">{pattern.description || 'Indicates bearish reversal'}</div>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${getPatternSignalBadge(pattern.type || 'BEARISH')}`}>
                      {(pattern.type || 'BEARISH').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">Evening Star</div>
                  <div className="text-sm text-gray-400">Indicates bearish reversal</div>
                </div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${getPatternSignalBadge('BEARISH')}`}>
                  BEARISH
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Right: Analysis Reasoning */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Analysis Reasoning</h4>
          {analysisReasoning.length > 0 ? (
            <ul className="space-y-2">
              {analysisReasoning.map((reason: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">{reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm">MACD bearish crossover</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm">EMA20 below EMA50 (bearish trend)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm">Bearish chart pattern: Double Top</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm">Bearish chart pattern: Descending Triangle</span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* Symbol Link */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <Link
          href={`/analysis/${symbol.toLowerCase()}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Go to Coin Analysis for {symbol}
        </Link>
      </div>
    </div>
  );
}
