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

  // Get indicator signal
  const getIndicatorSignal = (key: string, value: any): string => {
    if (typeof value === 'object' && value?.signal) {
      return value.signal;
    }
    if (key.toLowerCase().includes('rsi')) {
      const rsiValue = typeof value === 'number' ? value : (value?.value || 0);
      if (rsiValue > 70) return 'Sell';
      if (rsiValue < 30) return 'Buy';
      return 'Neutral';
    }
    if (key.toLowerCase().includes('macd')) {
      return typeof value === 'object' ? (value?.signal || 'Neutral') : 'Neutral';
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
            {Object.entries(technicalIndicators)
              .filter(([key]) => ['rsi', 'macd', 'ema', 'bollinger', 'movingaverages'].some(indicator =>
                key.toLowerCase().includes(indicator)
              ))
              .map(([key, value]) => {
                const signal = getIndicatorSignal(key, value);
                let displayName = key.replace(/([A-Z])/g, ' $1').trim();

                // Special handling for moving averages to show as "EMA Trend"
                if (key.toLowerCase().includes('movingaverages')) {
                  displayName = 'EMA Trend';
                }

                // Get signal badge color
                const getSignalBadgeColor = (signal: string) => {
                  if (signal.toLowerCase().includes('buy') || signal.toLowerCase().includes('bullish')) {
                    return 'bg-green-600 text-white';
                  }
                  if (signal.toLowerCase().includes('sell') || signal.toLowerCase().includes('bearish')) {
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
                        {signal}
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
                <div key={index}>
                  <div className="font-medium">{pattern.name || pattern.type || 'Double Top'}</div>
                  <div className="text-sm text-gray-400">{pattern.description || 'Bearish reversal'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <div>
                <div className="font-medium">Double Top</div>
                <div className="text-sm text-gray-400">Bearish reversal</div>
              </div>
              <div>
                <div className="font-medium">Descending Triangle</div>
                <div className="text-sm text-gray-400">Bearish forecast</div>
              </div>
            </div>
          )}

          {/* Candlestick Patterns */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Candlestick Patterns</h4>
            {candlestickPatterns.length > 0 ? (
              <div className="space-y-3">
                {candlestickPatterns.map((pattern: any, index: number) => (
                  <div key={index}>
                    <div className="font-medium">{pattern.name || pattern.type || 'Evening Star'}</div>
                    <div className="text-sm text-gray-400">{pattern.description || 'Indicates bearish reversal'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="font-medium">Evening Star</div>
                <div className="text-sm text-gray-400">Indicates bearish reversal</div>
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
          View Full Analysis for {symbol}
        </Link>
      </div>
    </div>
  );
}
