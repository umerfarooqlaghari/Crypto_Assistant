'use client';

import { TrendingUp, TrendingDown, Activity, Eye } from 'lucide-react';

interface Pattern {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  description: string;
}

interface PatternAnalysisProps {
  chartPatterns: Pattern[];
  candlestickPatterns: Pattern[];
}

export default function PatternAnalysis({ chartPatterns, candlestickPatterns }: PatternAnalysisProps) {
  const getPatternColor = (type: string) => {
    switch (type) {
      case 'BULLISH': return 'text-green-400';
      case 'BEARISH': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getPatternBgColor = (type: string) => {
    switch (type) {
      case 'BULLISH': return 'bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-500/40';
      case 'BEARISH': return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-red-500/40';
      default: return 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border-yellow-500/40';
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'BULLISH': return <TrendingUp className="w-4 h-4" />;
      case 'BEARISH': return <TrendingDown className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const PatternCard = ({ pattern, type }: { pattern: Pattern; type: string }) => (
    <div className={`p-3 rounded-lg border ${getPatternBgColor(pattern.type)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={getPatternColor(pattern.type)}>
            {getPatternIcon(pattern.type)}
          </div>
          <span className="font-medium text-gray-100 text-sm">{pattern.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm px-2 py-1 rounded ${getPatternBgColor(pattern.type)} ${getPatternColor(pattern.type)}`}>
            {pattern.type}
          </span>
          <span className={`text-sm font-semibold ${getConfidenceColor(pattern.confidence)}`}>
            {pattern.confidence}%
          </span>
          <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                pattern.confidence >= 80 ? 'bg-green-500' :
                pattern.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${pattern.confidence}%` }}
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-400 line-clamp-1">{pattern.description}</p>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-black/90 backdrop-blur-md rounded-xl p-4 border border-gray-600/30 shadow-xl h-fit">

      {/* Scrollable content with max height */}
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
        {/* Chart Patterns */}
        <div>
          <h4 className="text-base font-medium text-gray-100 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            Chart Patterns
          </h4>
          {chartPatterns.length > 0 ? (
            <div className="space-y-2">
              {chartPatterns.slice(0, 2).map((pattern, index) => (
                <PatternCard key={index} pattern={pattern} type="Chart Pattern" />
              ))}
              {chartPatterns.length > 2 && (
                <div className="text-center p-2 bg-gray-700/20 rounded">
                  <p className="text-gray-400 text-sm">+{chartPatterns.length - 2} more patterns</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded border border-gray-600/30 text-center">
              <p className="text-gray-400 text-sm">No chart patterns detected</p>
            </div>
          )}
        </div>

        {/* Candlestick Patterns */}
        <div>
          <h4 className="text-base font-medium text-gray-100 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-300 rounded-full" />
            Candlestick Patterns
          </h4>
          {candlestickPatterns.length > 0 ? (
            <div className="space-y-2">
              {candlestickPatterns.slice(0, 2).map((pattern, index) => (
                <PatternCard key={index} pattern={pattern} type="Candlestick Pattern" />
              ))}
              {candlestickPatterns.length > 2 && (
                <div className="text-center p-2 bg-gray-700/20 rounded">
                  <p className="text-gray-400 text-sm">+{candlestickPatterns.length - 2} more patterns</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 bg-gradient-to-r from-gray-700/20 to-gray-600/10 rounded border border-gray-600/30 text-center">
              <p className="text-gray-400 text-xs">No candlestick patterns detected</p>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
