import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, ChevronRight, Search } from 'lucide-react';
import { settingsService } from '../../services';
import { JobCategory } from '../../types/configuration.types';
import toast from 'react-hot-toast';

interface TransferProfessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profession: {
    _id: string;
    name: string;
    icon?: string;
  };
  currentCategoryId: string;
  currentCategoryName: string;
}

const TransferProfessionModal: React.FC<TransferProfessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  profession,
  currentCategoryId,
  currentCategoryName,
}) => {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setSelectedCategoryId(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getJobCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedCategoryId) {
      toast.error('Please select a target category');
      return;
    }

    try {
      setTransferring(true);
      console.log('[TransferProfession] Attempting transfer:', {
        professionId: profession._id,
        professionName: profession.name,
        targetCategoryId: selectedCategoryId,
      });
      const response = await settingsService.transferProfession(profession._id, selectedCategoryId);
      console.log('[TransferProfession] Success:', response);
      toast.success(response.message || 'Profession transferred successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[TransferProfession] Error:', error);
      console.error('[TransferProfession] Response status:', error.response?.status);
      console.error('[TransferProfession] Response data:', error.response?.data);
      console.error('[TransferProfession] Request URL:', error.config?.url);
      console.error('[TransferProfession] Request method:', error.config?.method);
      toast.error(error.response?.data?.message || 'Failed to transfer profession');
    } finally {
      setTransferring(false);
    }
  };

  // Filter out current category and apply search
  const availableCategories = categories
    .filter(cat => cat._id !== currentCategoryId)
    .filter(cat => cat.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectedCategory = categories.find(c => c._id === selectedCategoryId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[80] transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-[90] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Transfer Profession</h2>
              <p className="text-xs text-gray-500 mt-0.5">Move to another job category</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">Profession</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{profession.name}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">From</p>
              <p className="text-sm font-medium text-gray-700 truncate">{currentCategoryName}</p>
            </div>
          </div>

          {selectedCategory && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-xs text-gray-500">Moving to:</p>
                <p className="text-sm font-semibold text-indigo-600">{selectedCategory.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 mt-2">Select target category</p>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
            </div>
          ) : availableCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">
                {searchQuery ? 'No matching categories found' : 'No other categories available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableCategories.map((category) => {
                const isSelected = selectedCategoryId === category._id;
                return (
                  <button
                    key={category._id}
                    onClick={() => setSelectedCategoryId(category._id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected ? 'border-indigo-500' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isSelected ? 'text-indigo-900' : 'text-gray-900'
                      }`}>
                        {category.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {category.professions.length} profession{category.professions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            disabled={transferring}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedCategoryId || transferring}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {transferring ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Transferring...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                <span>Transfer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default TransferProfessionModal;
