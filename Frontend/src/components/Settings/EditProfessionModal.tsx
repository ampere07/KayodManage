import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { settingsService } from '../../services';

interface EditProfessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profession: { _id: string; name: string; icon?: string };
  categoryName: string;
}

const EditProfessionModal: React.FC<EditProfessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  profession,
  categoryName,
}) => {
  const [name, setName] = useState(profession.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setIconFile(file);
      setError('');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Profession name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let iconName = profession.icon;
      
      if (iconFile) {
        const uploadResponse = await settingsService.uploadProfessionIcon(iconFile, name.trim(), profession.icon);
        if (uploadResponse.success) {
          iconName = uploadResponse.iconName;
        }
      }
      
      await settingsService.updateProfession(profession._id, { 
        name: name.trim(),
        icon: iconName
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profession');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Profession</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <input
              type="text"
              value={categoryName}
              disabled
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="professionName" className="block text-sm font-medium text-gray-700 mb-2">
              Profession Name
            </label>
            <input
              type="text"
              id="professionName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Plumber"
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profession Icon (Optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                  disabled={loading}
                >
                  <Upload className="w-4 h-4" />
                  {iconFile ? iconFile.name : 'Choose Icon'}
                </button>
              </div>
              {(iconPreview || profession.icon) && (
                <div className="w-16 h-16 border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Preview" className="w-12 h-12 object-contain" />
                  ) : profession.icon ? (
                    <img 
                      src={`/assets/icons/professions/${profession.icon.replace('custom:', '')}?t=${Date.now()}`} 
                      alt={profession.name} 
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : null}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              PNG or JPG, max 5MB. Icon will be saved as: {name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.png
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Profession'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfessionModal;
