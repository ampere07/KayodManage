import React from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Transaction } from '../../types';
import { getInitials, formatPHPCurrency, getUser, getToUser } from '../../utils';
import { transactionsService } from '../../services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SidebarContext } from '../Layout/Layout';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onStatusUpdate?: (transactionId: string, status: string, type?: string) => Promise<void>;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onStatusUpdate
}) => {
  const { setIsHeaderHidden } = React.useContext(SidebarContext);

  React.useEffect(() => {
    if (setIsHeaderHidden) {
      setIsHeaderHidden(isOpen);
    }
    return () => {
      if (setIsHeaderHidden) {
        setIsHeaderHidden(false);
      }
    };
  }, [isOpen, setIsHeaderHidden]);

  if (!transaction) return null;

  const formatCurrency = (amount: number) => {
    return formatPHPCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace('PHP', '₱');
  };

  const customer = getUser(transaction);
  const provider =
    (transaction as any).toUser ||
    (transaction as any).toUserIdDetails ||
    getToUser(transaction) ||
    (transaction as any).toUserId ||
    null;
  const isFeeRecord = transaction.transactionType === 'fee_record';
  const isWithdrawal = transaction.type === 'withdrawal';
  const isRefundRequest = (transaction.type || '').toLowerCase().includes('refund');
  const isPendingRefund = isRefundRequest && transaction.status === 'pending';

  // For refund requests, override customer/provider to show refund requester and job poster
  let displayCustomer: any = customer;
  let displayProvider: any = provider;
  if (isRefundRequest) {
    displayCustomer = (transaction as any).fromUser || getUser(transaction); // refund requester
    const job = (transaction as any).job || (transaction as any).jobId;
    displayProvider =
      (transaction as any).toUser ||
      (transaction as any).toUserIdDetails ||
      job?.assignedToId ||
      job?.assignedTo ||
      job?.jobPosterDetails ||
      job?.jobPoster ||
      job?.userIdDetails ||
      job?.userId ||
      job?.providerDetails ||
      job?.provider ||
      getToUser(transaction) ||
      (transaction as any).toUserId ||
      provider;
  }

  const getName = (user: any) =>
    (user && typeof user === 'object' && (user.name || user.fullName || user.username || user.email || user._id)) ||
    (typeof user === 'string' ? user : undefined);
  const getEmail = (user: any) => (user && typeof user === 'object' && user.email) || undefined;
  const getPhone = (user: any) => (user && typeof user === 'object' && (user.phone || user.contactNumber)) || undefined;
  const getLocation = (user: any) =>
    (user && typeof user === 'object' && (user.location || user.address || user.addressLine)) || undefined;
  const getId = (user: any) =>
    (user && typeof user === 'object' && user._id) || (typeof user === 'string' ? user : undefined);

  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => transactionsService.approveRefund(transaction._id),
    onSuccess: () => {
      toast.success('Refund approved');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to approve refund';
      toast.error(msg);
    }
  });

  const declineMutation = useMutation({
    mutationFn: () => transactionsService.declineRefund(transaction._id),
    onSuccess: () => {
      toast.success('Refund request declined');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to decline refund';
      toast.error(msg);
    }
  });

  // Render fee record layout
  if (isFeeRecord) {
    console.log('Rendering fee record layout');
    return createPortal(
      <>
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity"
          onClick={onClose}
        />

        <div
          className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-[101] transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
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
              <div className={`px-6 py-6 ${transaction.status === 'completed'
                ? 'bg-green-100'
                : transaction.status === 'pending'
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
                }`}>
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

            <div className={`p-6 border-t border-gray-200 bg-gray-50 ${isRefundRequest ? 'flex items-center justify-between gap-3' : ''}`}>
              {isRefundRequest ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineMutation.mutate()}
                      disabled={declineMutation.isPending || approveMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                    <button
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending || declineMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve & Refund
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // Withdrawal transaction layout
  if (isWithdrawal) {
    const user = customer;

    return createPortal(
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity" onClick={onClose} />

        <div
          className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-[101] transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
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
              {/* Amount Section */}
              <div className={`px-6 py-6 ${transaction.status === 'completed'
                ? 'bg-green-100'
                : transaction.status === 'pending'
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
                }`}>
                <p className="text-sm text-gray-600 mb-2">Withdrawal Amount</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
              </div>

              <div className="p-6">

                {/* User Information */}
                {user && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">User Information</h4>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-shrink-0">
                        {user?.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-xl font-medium text-orange-600">
                              {getInitials(user?.name || 'Unknown')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-12">Name:</span>
                          <p className="text-sm font-medium text-gray-900">{user?.name || 'Unknown'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 w-12">Email:</span>
                          <p className="text-xs text-gray-500">{user?.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[120px]">Phone:</p>
                        <p className="text-gray-900">{user?.phone || 'N/A'}</p>
                      </div>

                      <div className="flex items-start gap-2">
                        <p className="text-gray-600 min-w-[120px]">Location:</p>
                        <p className="text-gray-900">{user?.location || 'N/A'}</p>
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

            <div className={`p-6 border-t border-gray-200 bg-gray-50 ${isRefundRequest ? 'flex items-center justify-between gap-3' : ''}`}>
              {isRefundRequest ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineMutation.mutate()}
                      disabled={declineMutation.isPending || approveMutation.isPending || !isPendingRefund}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                    <button
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending || declineMutation.isPending || !isPendingRefund}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve & Refund
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // Regular transaction layout
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] transition-opacity" onClick={onClose} />

      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-[101] transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
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
                  <h4 className="text-base font-bold text-gray-900 mb-6">{isRefundRequest ? 'Refund Requester Information:' : 'Customer Information:'}</h4>

                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                      <span className="text-3xl font-bold text-blue-600">{getInitials(displayCustomer?.name || 'Unknown')}</span>
                    </div>
                    <p className="text-base font-medium text-gray-900 text-center">{displayCustomer?.username || displayCustomer?.name || 'Unknown'}</p>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">First Name:</p>
                      <p className="text-gray-900">{displayCustomer?.name?.split(' ')[0] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Last Name:</p>
                      <p className="text-gray-900">{displayCustomer?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">KYD:</p>
                      <p className="text-gray-900 font-mono">{displayCustomer?._id || transaction._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Email:</p>
                      <p className="text-gray-900 break-all">{displayCustomer?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Contact Number:</p>
                      <p className="text-gray-900">{displayCustomer?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Address:</p>
                      <p className="text-gray-900">{displayCustomer?.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Provider Information */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 mb-6">Provider Information:</h4>

                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-3">
                      <span className="text-3xl font-bold text-green-600">{getInitials(displayProvider?.name || 'Unknown')}</span>
                    </div>
                    <p className="text-base font-medium text-gray-900 text-center">{displayProvider?.username || displayProvider?.name || 'Unknown'}</p>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">First Name:</p>
                      <p className="text-gray-900">{displayProvider?.name?.split(' ')[0] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Last Name:</p>
                      <p className="text-gray-900">{displayProvider?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">KYD:</p>
                      <p className="text-gray-900 font-mono">{(displayProvider as any)?._id || transaction._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Email:</p>
                      <p className="text-gray-900 break-all">{(displayProvider as any)?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Contact Number:</p>
                      <p className="text-gray-900">{(displayProvider as any)?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Address:</p>
                      <p className="text-gray-900">{(displayProvider as any)?.location || 'N/A'}</p>
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
                    <p className="text-gray-600 flex-1">{displayCustomer?.name || 'N/A'}</p>
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

          <div className={`p-6 border-t border-gray-200 bg-gray-50 ${isRefundRequest ? 'flex items-center justify-between gap-3' : ''}`}>
            {isRefundRequest ? (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending || approveMutation.isPending || !isPendingRefund}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </button>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending || declineMutation.isPending || !isPendingRefund}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve & Refund
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default TransactionDetailsModal;
