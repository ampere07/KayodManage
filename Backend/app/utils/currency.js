/**
 * Currency utility functions for PHP (Philippine Peso) backend operations
 */

/**
 * Format a number as PHP currency for API responses
 * @param {number} amount - The amount to format
 * @param {Object} options - Optional formatting options
 * @returns {string} Formatted currency string
 */
const formatPHPCurrency = (amount, options = {}) => {
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
 * @param {number} amount - The amount to format
 * @returns {string} Compact formatted currency string
 */
const formatCompactPHPCurrency = (amount) => {
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
 * @param {string} currencyString - Currency string to parse
 * @returns {number} Parsed number or 0 if invalid
 */
const parsePHPCurrency = (currencyString) => {
  if (!currencyString) return 0;
  
  // Remove currency symbol and commas, then parse
  const cleanString = currencyString
    .toString()
    .replace(/[₱$,\s]/g, '')
    .replace(/[^\d.-]/g, '');
    
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Validate if a value represents a valid currency amount
 * @param {any} value - Value to validate
 * @returns {boolean} Boolean indicating if valid
 */
const isValidPHPCurrency = (value) => {
  const parsed = typeof value === 'number' ? value : parsePHPCurrency(value);
  return !isNaN(parsed) && parsed >= 0;
};

/**
 * Budget type labels for display
 */
const BUDGET_TYPES = {
  fixed: 'Fixed Price',
  hourly: 'Per Hour',
  daily: 'Per Day',
  weekly: 'Per Week',
  monthly: 'Per Month',
  project: 'Per Project'
};

/**
 * Format budget with type for API responses
 * @param {number} amount - Budget amount
 * @param {string} budgetType - Type of budget
 * @returns {Object} Object with formatted amounts and type info
 */
const formatBudgetResponse = (amount, budgetType) => {
  return {
    amount,
    formattedAmount: formatPHPCurrency(amount),
    budgetType,
    budgetTypeLabel: BUDGET_TYPES[budgetType] || budgetType,
    compactAmount: formatCompactPHPCurrency(amount)
  };
};

/**
 * Ensure amount is stored as proper number in database
 * @param {any} amount - Amount to normalize
 * @returns {number} Normalized amount
 */
const normalizeAmount = (amount) => {
  if (typeof amount === 'number') {
    return amount;
  }
  
  if (typeof amount === 'string') {
    return parsePHPCurrency(amount);
  }
  
  return 0;
};

/**
 * Round amount to 2 decimal places (standard for PHP currency)
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
const roundToCurrency = (amount) => {
  return Math.round(amount * 100) / 100;
};

module.exports = {
  formatPHPCurrency,
  formatCompactPHPCurrency,
  parsePHPCurrency,
  isValidPHPCurrency,
  formatBudgetResponse,
  normalizeAmount,
  roundToCurrency,
  BUDGET_TYPES
};