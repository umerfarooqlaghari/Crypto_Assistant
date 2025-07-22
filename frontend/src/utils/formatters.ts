/**
 * Utility functions for formatting numbers, prices, and other values
 */

/**
 * Format price values with smart decimal handling for small cryptocurrencies
 */
export const formatPrice = (price: number): string => {
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

/**
 * Format indicator values with smart decimal handling
 */
export const formatIndicatorValue = (value: number, decimals: number = 2): string => {
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

/**
 * Format percentage values
 */
export const formatPercentage = (percentage: number): string => {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return '0.00%';
  }
  return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

/**
 * Format large numbers with compact notation
 */
export const formatLargeNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
};

/**
 * Format volume with compact notation
 */
export const formatVolume = (volume: number): string => {
  if (volume === null || volume === undefined || isNaN(volume)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(volume);
};

/**
 * Safe number conversion with default value
 */
export const safeNumber = (value: number, defaultValue: number = 0): number => {
  return (value === null || value === undefined || isNaN(value)) ? defaultValue : value;
};

/**
 * Format price change with color indication
 */
export const formatPriceChange = (change: number): { text: string; color: string } => {
  const formattedChange = formatPercentage(change);
  const color = change >= 0 ? 'text-green-400' : 'text-red-400';
  return { text: formattedChange, color };
};

/**
 * Get confidence color based on value
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return 'text-green-400';
  if (confidence >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Get confidence background color based on value
 */
export const getConfidenceBg = (confidence: number): string => {
  if (confidence >= 80) return 'bg-green-500';
  if (confidence >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};
