'use client';

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

export default function TimeframeSelector({ selectedTimeframe, onTimeframeChange }: TimeframeSelectorProps) {
  const timeframes = [
    { value: '1m', label: '1m', description: '1 Minute' },
    { value: '15m', label: '15m', description: '15 Minutes' },
    { value: '30m', label: '30m', description: '30 Minutes' },
    { value: '4h', label: '4h', description: '4 Hours' }
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300 mr-2">Timeframe:</span>
      <div className="flex bg-gradient-to-r from-gray-700/50 to-gray-600/30 backdrop-blur-md rounded-lg p-1 border border-gray-500/40 shadow-lg">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe.value}
            onClick={() => onTimeframeChange(timeframe.value)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
              selectedTimeframe === timeframe.value
                ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-black shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
            }`}
            title={timeframe.description}
          >
            {timeframe.label}
          </button>
        ))}
      </div>
    </div>
  );
}
