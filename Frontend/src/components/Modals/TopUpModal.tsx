import React from 'react';
import { X as XIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Transaction } from '../../types';
import { getInitials, formatPHPCurrency, getUser } from '../../utils';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number) => {
    return formatPHPCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace('PHP', '₱');
  };

  const customer = getUser(transaction);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />

      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* User Information */}
              {customer && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">User Information</h4>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      {customer?.profileImage ? (
                        <img
                          src={customer.profileImage}
                          alt={customer.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xl font-medium text-blue-600">
                            {getInitials(customer?.name || 'Unknown')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{customer?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{customer?.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[120px]">Name:</p>
                      <p className="text-gray-900 font-medium">{customer?.name || 'N/A'}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[120px]">Email:</p>
                      <p className="text-gray-900 break-all">{customer?.email || 'N/A'}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[120px]">Phone:</p>
                      <p className="text-gray-900">{customer?.phone || 'N/A'}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[120px]">Location:</p>
                      <p className="text-gray-900">{customer?.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Information */}
              <div className="pt-6 border-t border-gray-200">
                <h4 className="text-sm font-bold text-gray-900 mb-4">Transaction Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Transaction ID:</p>
                    <p className="text-gray-900 font-mono break-all flex-1">{transaction._id}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Type:</p>
                    <p className="text-gray-900 font-medium capitalize">{transaction.type?.replace('_', ' ')}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Status:</p>
                    <p className="text-gray-900 font-medium capitalize">{transaction.status}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Amount:</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Payment Method:</p>
                    <p className="text-gray-900 font-medium capitalize">{transaction.paymentMethod || 'N/A'}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Description:</p>
                    <p className="text-gray-900">{transaction.description}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <p className="text-gray-600 min-w-[120px]">Date:</p>
                    <div>
                      <p className="text-gray-900">
                        {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TopUpModal;
