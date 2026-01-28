import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import SideModal from '../SideModal';
import { settingsService } from '../../services';

interface AddProfessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryId: string;
  categoryName: string;
}

const AddProfessionModal: React.FC<AddProfessionModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  categoryId,
  categoryName
}) => {
  const [professionName, setProfessionName] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!professionName.trim()) {
      setError('Profession name is required');
      return;
    }

    try {
      setLoading(true);
      
      const professionResponse = await settingsService.createProfession({ 
        name: professionName.trim(),
        categoryId 
      });
      
      if (iconFile && professionResponse.success && professionResponse.profession) {
        const uploadResponse = await settingsService.uploadProfessionIcon(iconFile, professionName.trim());
        if (uploadResponse.success) {
          await settingsService.updateProfession(professionResponse.profession._id, {
            icon: uploadResponse.iconName
          });
        }
      }
      
      setProfessionName('');
      setIconFile(null);
      setIconPreview(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create profession');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideModal isOpen={isOpen} onClose={onClose} title={`Add Profession to ${categoryName}`} width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profession Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={professionName}
              onChange={(e) => setProfessionName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Software Developer, Cyber Security"
              required
            />
          </div>

          <div>
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
              {iconPreview && (
                <div className="w-16 h-16 border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <img src={iconPreview} alt="Preview" className="w-12 h-12 object-contain" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              PNG or JPG, max 5MB. Icon will be saved as: {professionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'profession-name'}.png
            </p>
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
              <span>Add Profession</span>
            )}
          </button>
        </div>
      </form>
    </SideModal>
  );
};

export default AddProfessionModal;
