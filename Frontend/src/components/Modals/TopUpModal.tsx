import React from 'react';
import type { Transaction } from '../../types';
import TransactionDetailsModal from './TransactionDetailsModal';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onStatusUpdate?: (transactionId: string, status: string, type?: string) => Promise<void>;
}

/**
 * A top-up's details. Top-ups use the same panel as every other transaction
 * (it shows their channel, Xendit reference and when they were credited);
 * this name stays for the callers that import it.
 */
const TopUpModal: React.FC<TopUpModalProps> = (props) => <TransactionDetailsModal {...props} />;

export default TopUpModal;
