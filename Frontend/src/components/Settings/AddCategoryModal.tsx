import React, { useState } from 'react';
import SideModal from '../SideModal';
import { settingsService } from '../../services';
import { getAllIcons, getIconByName } from '../../constants/categoryIcons';
import { Image as ImageIcon } from 'lucide-react';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('it-support');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingIcon(true);
      const response = await settingsService.uploadCategoryIcon(
        file,
        categoryName || 'new-category'
      );
      setCategoryIcon(response.iconName);
      setShowIconPicker(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setLoading(true);
      await settingsService.createJobCategory({ 
        name: categoryName.trim(),
        icon: categoryIcon
      });
      setCategoryName('');
      setCategoryIcon('it-support');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create job category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideModal isOpen={isOpen} onClose={onClose} title="Add Job Category" width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Electrical, IT, Construction"
              required
            />
          </div>

          {/* Category Icon */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Icon
            </label>
            <div className="flex items-center gap-3">
              <div 
                className="flex-shrink-0 p-3 rounded-lg border border-gray-300" 
                style={{ backgroundColor: `${getIconByName(categoryIcon).color}15` }}
              >
                <img 
                  src={getIconByName(categoryIcon).imagePath}
                  alt={getIconByName(categoryIcon).label}
                  className="w-6 h-6"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="flex-1 px-4 py-2.5 text-left border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Choose Icon</span>
              </button>
            </div>

            {/* Icon Picker */}
            {showIconPicker && (
              <div className="mt-3 p-4 border border-gray-300 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
                {/* Upload Image Option */}
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingIcon}
                    className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploadingIcon ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        <span>Upload Custom Image</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">PNG, JPG up to 5MB</p>
                </div>

                <div className="border-t border-gray-300 pt-4">
                  <p className="text-xs text-gray-600 font-medium mb-3">Or choose from existing:</p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {getAllIcons().map((icon) => {
                    return (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => {
                          setCategoryIcon(icon.name);
                          setShowIconPicker(false);
                        }}
                        className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                          categoryIcon === icon.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{ backgroundColor: `${icon.color}10` }}
                        title={icon.label}
                      >
                        <img 
                          src={icon.imagePath}
                          alt={icon.label}
                          className="w-5 h-5 mx-auto"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <span>Add Category</span>
            )}
          </button>
        </div>
      </form>
    </SideModal>
  );
};

export default AddCategoryModal;
