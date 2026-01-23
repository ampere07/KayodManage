import React from 'react';
import { X as XIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Transaction } from '../../types';
import { getInitials, formatPHPCurrency, getUser, getToUser } from '../../utils';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  transaction
}) => {
  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number) => {
    return formatPHPCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace('PHP', '₱');
  };

  const customer = getUser(transaction);
  const provider = getToUser(transaction) || customer;
  const isFeeRecord = transaction.transactionType === 'fee_record';

  // Render fee record layout
  if (isFeeRecord) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />

        <div
          className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
                <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Transaction ID:</span> <span className="font-mono">{transaction._id}</span></p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Financial Information */}
                <div className="px-6 pt-6 pb-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Kayod Platform Fee</p>
                      <p className="text-3xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Job Fee Amount</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(transaction.job?.budget || transaction.jobId?.budget || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Customer & Provider Information */}
                <div className="relative">
                  {/* Vertical separator line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -ml-px"></div>
                  
                  <div className="px-6 py-6">
                    <div className="grid grid-cols-2 gap-4">
                    {/* Customer Information */}
                    <div className="pr-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">Customer Information:</h4>

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
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">First Name:</p>
                        <p className="text-gray-900 font-medium">{customer?.name?.split(' ')[0] || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Last Name:</p>
                        <p className="text-gray-900 font-medium">{customer?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">KYD:</p>
                        <p className="text-gray-900 font-mono font-medium break-all">{customer?._id || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Email:</p>
                        <p className="text-gray-900 font-medium break-all">{customer?.email || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Contact Number:</p>
                        <p className="text-gray-900 font-medium">{customer?.phone || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Address:</p>
                        <p className="text-gray-900 font-medium">{customer?.location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Information */}
                  <div className="pl-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">Provider Information:</h4>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-shrink-0">
                        {provider?.profileImage ? (
                          <img
                            src={provider.profileImage}
                            alt={provider.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-xl font-medium text-green-600">
                              {getInitials(provider?.name || 'Unknown')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{provider?.name || 'Unknown'}</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">First Name:</p>
                        <p className="text-gray-900 font-medium">{provider?.name?.split(' ')[0] || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Last Name:</p>
                        <p className="text-gray-900 font-medium">{provider?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">KYD:</p>
                        <p className="text-gray-900 font-mono font-medium break-all">{provider?._id || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Email:</p>
                        <p className="text-gray-900 font-medium break-all">{provider?.email || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Contact Number:</p>
                        <p className="text-gray-900 font-medium">{provider?.phone || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[90px]">Address:</p>
                        <p className="text-gray-900 font-medium">{provider?.location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Job Information */}
                <div className="px-6 py-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">Job Information:</h4>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Job Title:</p>
                      <p className="text-gray-900 font-medium flex-1">
                        {transaction.job?.title || transaction.jobId?.title || 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Job Category:</p>
                      <p className="text-gray-900 font-medium capitalize">
                        {transaction.job?.category || transaction.jobId?.category || 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Job ID:</p>
                      <p className="text-gray-900 font-mono text-sm break-all flex-1">
                        {transaction.job?._id || transaction.jobId?._id || 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Created By:</p>
                      <p className="text-gray-900 font-medium">{customer?.name || 'N/A'}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Created At:</p>
                      <div>
                        <p className="text-gray-900 font-medium">
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

                    <div className="flex items-start gap-2">
                      <p className="text-gray-600 min-w-[110px]">Job Location:</p>
                      <p className="text-gray-900 font-medium">{customer?.location || 'N/A'}</p>
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
  }

  // Regular transaction layout
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
            <div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
              <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Transaction ID:</span> <span className="font-mono">{transaction._id}</span></p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
              {/* Customer & Provider Information */}
              <div className="px-6 pt-6 pb-6">
                <div className="grid grid-cols-2 gap-8">
                {/* Customer Information */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 mb-6">Customer Information:</h4>

                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                      <span className="text-3xl font-bold text-blue-600">{getInitials(customer?.name || 'Unknown')}</span>
                    </div>
                    <p className="text-base font-medium text-gray-900">Username</p>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">First Name:</p>
                      <p className="text-gray-900">{customer?.name?.split(' ')[0] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Last Name:</p>
                      <p className="text-gray-900">{customer?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">KYD:</p>
                      <p className="text-gray-900 font-mono">{transaction._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Email:</p>
                      <p className="text-gray-900 break-all">{customer?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Contact Number:</p>
                      <p className="text-gray-900">{customer?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Address:</p>
                      <p className="text-gray-900">{customer?.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Provider Information */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 mb-6">Provider Information:</h4>

                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-3">
                      <span className="text-3xl font-bold text-green-600">{getInitials(provider?.name || 'Unknown')}</span>
                    </div>
                    <p className="text-base font-medium text-gray-900">Username</p>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">First Name:</p>
                      <p className="text-gray-900">{provider?.name?.split(' ')[0] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Last Name:</p>
                      <p className="text-gray-900">{provider?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">KYD:</p>
                      <p className="text-gray-900 font-mono">{transaction._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Email:</p>
                      <p className="text-gray-900 break-all">{provider?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Contact Number:</p>
                      <p className="text-gray-900">{provider?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Address:</p>
                      <p className="text-gray-900">{provider?.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              {/* Job Information */}
              <div className="px-6 py-6">
                <h4 className="text-sm font-bold text-gray-900 mb-4">Job Information:</h4>

                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Job Title:</p>
                    <p className="text-gray-900 flex-1">{transaction.job?.title || transaction.jobId?.title || 'N/A'}</p>
                  </div>
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Job Category:</p>
                    <p className="text-gray-600 flex-1 capitalize">
                      {transaction.job?.category || transaction.jobId?.category || 'N/A'}
                    </p>
                  </div>
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Job ID:</p>
                    <p className="text-gray-600 flex-1 font-mono text-xs">
                      {transaction.job?._id || transaction.jobId?._id || 'N/A'}
                    </p>
                  </div>
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Created By:</p>
                    <p className="text-gray-600 flex-1">{customer?.name || 'N/A'}</p>
                  </div>
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Created At:</p>
                    <div className="flex-1">
                      <p className="text-gray-600">
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
                  <div className="flex">
                    <p className="font-semibold text-gray-700 w-32">Job Location:</p>
                    <p className="text-gray-600 flex-1">{customer?.location || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              {/* Financial Information */}
              <div className="px-6 pt-6">
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-gray-700">Job Fee Amount:</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
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

export default TransactionDetailsModal;
