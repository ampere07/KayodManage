# Database Migration Guide

## Collection Name Mapping

Based on your database structure, make sure these collection names match:

### 1. Wallets Collection
- **Expected Name**: `wallets` 
- **Model**: `Wallet`
- **Fields**: user, balance, availableBalance, heldBalance, currency, isActive, isVerified, etc.

### 2. Fee Records Collection  
- **Expected Name**: `feerecords`
- **Model**: `FeeRecord` 
- **Fields**: provider, job, amount, status, paidAt, paymentMethod, dueDate, etc.

### 3. Users Collection
- **Expected Name**: `users`
- **Model**: `User`
- **Fields**: name, email, phone, location, categories, isVerified, accountStatus, etc.

## Important Notes

1. **Currency**: Your wallets use `PHP` currency, which the system now supports
2. **Fee Status**: Your fee records use statuses like `paid`, `pending`, `overdue`
3. **Provider Field**: Fee records reference users via the `provider` field

## Restart Instructions

After updating the models and controllers:

1. **Stop Backend Server**: Ctrl+C in backend terminal
2. **Restart Backend**: `pnpm dev` in Backend folder
3. **Stop Frontend Server**: Ctrl+C in frontend terminal  
4. **Restart Frontend**: `pnpm dev` in Frontend folder
5. **Clear Browser Cache**: Ctrl+Shift+R

## Testing

1. Navigate to Users page
2. Check if wallet balances show in PHP currency
3. Check if fee records display correctly
4. Test ban/suspend/restrict functionality

The system now properly queries your separate Wallet and FeeRecord collections instead of expecting embedded data in the User model.