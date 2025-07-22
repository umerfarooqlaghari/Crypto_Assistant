'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface Symbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  volume: number;
  priceChange24h: number;
}

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

export default function SymbolSelector({ selectedSymbol, onSymbolChange }: SymbolSelectorProps) {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [filteredSymbols, setFilteredSymbols] = useState<Symbol[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch available symbols
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/enhanced-signals/symbols');
        if (response.ok) {
          const data = await response.json();
          setSymbols(data.symbols);
          setFilteredSymbols(data.symbols);
        }
      } catch (error) {
        console.error('Error fetching symbols:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  // Filter symbols based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = symbols.filter(symbol =>
        symbol.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        symbol.baseAsset.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSymbols(filtered);
    } else {
      setFilteredSymbols(symbols);
    }
  }, [searchTerm, symbols]);

  const handleSymbolSelect = (symbol: string) => {
    onSymbolChange(symbol);
    setIsOpen(false);
    setSearchTerm('');
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

  const formatVolume = (volume: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(volume);
  };

  const selectedSymbolData = symbols.find(s => s.symbol === selectedSymbol);

  return (
    <div className="relative">
      {/* Selected Symbol Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-gradient-to-r from-gray-700/50 to-gray-600/30 backdrop-blur-md rounded-lg px-4 py-3 border border-gray-500/40 hover:from-gray-600/60 hover:to-gray-500/40 transition-all min-w-[200px] shadow-lg"
      >
        <div className="flex-1 text-left">
          <div className="text-white font-semibold">{selectedSymbol}</div>
          {selectedSymbolData && (
            <div className="text-sm text-gray-300">
              {formatPrice(selectedSymbolData.price)}
              <span className={`ml-2 ${
                selectedSymbolData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {selectedSymbolData.priceChange24h >= 0 ? '+' : ''}
                {selectedSymbolData.priceChange24h.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-300 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-b from-gray-800/95 to-black/95 backdrop-blur-md rounded-lg border border-gray-600/40 shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-500/40 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          {/* Symbol List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">Loading symbols...</div>
            ) : filteredSymbols.length === 0 ? (
              <div className="p-4 text-center text-gray-400">No symbols found</div>
            ) : (
              filteredSymbols.slice(0, 50).map((symbol) => (
                <button
                  key={symbol.symbol}
                  onClick={() => handleSymbolSelect(symbol.symbol)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 ${
                    symbol.symbol === selectedSymbol ? 'bg-blue-500/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{symbol.symbol}</div>
                      <div className="text-sm text-gray-400">
                        {symbol.baseAsset}/{symbol.quoteAsset}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm">
                        {formatPrice(symbol.price)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Vol: {formatVolume(symbol.volume)}
                      </div>
                    </div>
                    <div className={`text-sm font-medium ml-3 ${
                      symbol.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {symbol.priceChange24h >= 0 ? '+' : ''}
                      {symbol.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
