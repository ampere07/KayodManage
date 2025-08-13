/**
 * Currency utility functions for Philippine Peso (PHP)
 */

/**
 * Format a number as PHP currency
 * @param amount - The amount to format
 * @param options - Optional formatting options
 * @returns Formatted currency string
 */
export const formatPHPCurrency = (
  amount: number, 
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  } = {}
): string => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true
  } = options;

  if (showSymbol) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits,
      maximumFractionDigits
    }).format(amount);
  } else {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits,
      maximumFractionDigits
    }).format(amount);
  }
};

/**
 * Format currency for display in compact form (e.g., 1.2K, 1.5M)
 * @param amount - The amount to format
 * @returns Compact formatted currency string
 */
export const formatCompactPHPCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(1)}K`;
  } else {
    return formatPHPCurrency(amount);
  }
};

/**
 * Parse a currency string to number
 * @param currencyString - Currency string to parse
 * @returns Parsed number or 0 if invalid
 */
export const parsePHPCurrency = (currencyString: string): number => {
  if (!currencyString) return 0;
  
  // Remove currency symbol and commas, then parse
  const cleanString = currencyString
    .replace(/[₱$,\s]/g, '')
    .replace(/[^\d.-]/g, '');
    
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Validate if a string represents a valid currency amount
 * @param currencyString - String to validate
 * @returns Boolean indicating if valid
 */
export const isValidPHPCurrency = (currencyString: string): boolean => {
  const parsed = parsePHPCurrency(currencyString);
  return !isNaN(parsed) && parsed >= 0;
};

/**
 * Format currency for input fields (without symbol)
 * @param amount - The amount to format
 * @returns Formatted string for input
 */
export const formatCurrencyInput = (amount: number): string => {
  return formatPHPCurrency(amount, { showSymbol: false });
};

/**
 * Budget type labels for display
 */
export const BUDGET_TYPES = {
  fixed: 'Fixed Price',
  hourly: 'Per Hour',
  daily: 'Per Day',
  weekly: 'Per Week',
  monthly: 'Per Month',
  project: 'Per Project'
} as const;

/**
 * Format budget with type
 * @param amount - Budget amount
 * @param budgetType - Type of budget
 * @returns Formatted budget string
 */
export const formatBudgetWithType = (amount: number, budgetType: string): string => {
  const formattedAmount = formatPHPCurrency(amount);
  const typeLabel = BUDGET_TYPES[budgetType as keyof typeof BUDGET_TYPES] || budgetType;
  return `${formattedAmount} (${typeLabel})`;
};

// Export default currency formatter for convenience
export const formatCurrency = formatPHPCurrency;