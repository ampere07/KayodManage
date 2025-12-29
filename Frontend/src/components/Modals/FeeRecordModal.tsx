import React from 'react';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
}

interface Job {
  _id: string;
  title: string;
  category?: string;
}

interface Transaction {
  _id: string;
  transactionType: 'transaction' | 'fee_record';
  fromUser?: User;
  toUser?: User;
  fromUserData?: User;
  toUserData?: User;
  user?: User;
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  jobId?: Job;
  job?: Job;
  description: string;
  currency: string;
  paymentMethod?: string;
  platformFee?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  paidAt?: Date;
  dueDate?: Date;
  isFirstOffense?: boolean;
  penaltyApplied?: boolean;
  remindersSent?: number;
}

interface FeeRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('PHP', '₱');
};

const FeeRecordModal: React.FC<FeeRecordModalProps> = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  const customer = transaction.fromUserData || transaction.fromUser || transaction.user;
  const provider = transaction.toUserData || transaction.toUser || customer;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Fee Record Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Information:</h3>
              
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <span className="text-3xl font-medium text-blue-600">
                    {getInitials(customer?.name || 'Unknown')}
                  </span>
                </div>
                <p className="text-base font-medium text-gray-900">Username</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">First Name:</label>
                  <p className="text-gray-900">{customer?.name?.split(' ')[0] || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Last Name:</label>
                  <p className="text-gray-900">{customer?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">KYD:</label>
                  <p className="text-gray-900 font-mono">{transaction._id.slice(-8).toUpperCase()}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Email:</label>
                  <p className="text-gray-900 break-all">{customer?.email || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Contact Number:</label>
                  <p className="text-gray-900">{customer?.phone || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Address:</label>
                  <p className="text-gray-900">{customer?.location || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Provider Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Provider Information:</h3>
              
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <span className="text-3xl font-medium text-green-600">
                    {getInitials(provider?.name || 'Unknown')}
                  </span>
                </div>
                <p className="text-base font-medium text-gray-900">Username</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">First Name:</label>
                  <p className="text-gray-900">{provider?.name?.split(' ')[0] || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Last Name:</label>
                  <p className="text-gray-900">{provider?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">KYD:</label>
                  <p className="text-gray-900 font-mono">{transaction._id.slice(-8).toUpperCase()}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Email:</label>
                  <p className="text-gray-900 break-all">{provider?.email || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Contact Number:</label>
                  <p className="text-gray-900">{provider?.phone || 'N/A'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Address:</label>
                  <p className="text-gray-900">{provider?.location || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Information Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information:</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Job Title:</label>
                <p className="text-gray-900">{transaction.job?.title || transaction.jobId?.title || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Job Category:</label>
                <p className="text-gray-900 capitalize">{transaction.job?.category || transaction.jobId?.category || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Job ID:</label>
                <p className="text-gray-900 font-mono text-xs">{transaction.job?._id || transaction.jobId?._id || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Created By:</label>
                <p className="text-gray-900">{customer?.name || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Created At:</label>
                <div>
                  <p className="text-gray-900">{new Date(transaction.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Job Location:</label>
                <p className="text-gray-900">{customer?.location || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Financial Information Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Information:</h3>
            
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-gray-700">Kayod Fee Amount:</label>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
              </div>

              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-gray-700">Job Fee Amount:</label>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
              </div>

              <div className="flex items-baseline justify-between pt-4 border-t border-gray-100">
                <label className="text-sm font-semibold text-gray-700">Transaction ID:</label>
                <p className="text-xs text-gray-600 font-mono break-all max-w-[280px] text-right">{transaction._id}</p>
              </div>

              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-gray-700">Payment Method:</label>
                <p className="text-gray-900 capitalize">{transaction.paymentMethod || 'N/A'}</p>
              </div>

              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-gray-700">Status:</label>
                <p className="text-gray-900 capitalize font-semibold">{transaction.status}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default FeeRecordModal;
