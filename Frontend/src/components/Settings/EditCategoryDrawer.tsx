import React, { useState } from 'react';
import { X, Plus, Trash2, ImageIcon, Search } from 'lucide-react';
import { settingsService } from '../../services';
import { getDefaultIconForCategory, getIconByName, getProfessionIconByName, getAllIcons } from '../../constants/categoryIcons';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';

interface Profession {
  _id: string;
  name: string;
  icon?: string;
}

interface EditCategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: {
    _id: string;
    name: string;
    icon?: string;
    professions: Profession[];
  };
  profession?: Profession | null; // Optional profession to edit
}

const EditCategoryDrawer: React.FC<EditCategoryDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
  profession: initialProfession,
}) => {
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryIcon, setCategoryIcon] = useState(category.icon || getDefaultIconForCategory(category.name));
  const [iconTimestamp, setIconTimestamp] = useState(Date.now());
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [professions, setProfessions] = useState<Profession[]>(category.professions);
  const [editingProfession, setEditingProfession] = useState<Profession | null>(initialProfession || null);
  const [editingProfessionName, setEditingProfessionName] = useState(initialProfession?.name || '');
  const [editingProfessionIcon, setEditingProfessionIcon] = useState<string | undefined>(initialProfession?.icon || undefined);
  const [uploadingProfessionIcon, setUploadingProfessionIcon] = useState<string | null>(null);
  const [professionIconTimestamps, setProfessionIconTimestamps] = useState<Record<string, number>>({});
  const [newProfessionName, setNewProfessionName] = useState('');
  const [professionSearchQuery, setProfessionSearchQuery] = useState('');
  const [isAddingProfession, setIsAddingProfession] = useState(false);
  const [isEditingProfession, setIsEditingProfession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const professionFileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentProfessionForUpload, setCurrentProfessionForUpload] = useState<string | null>(null);
  const { socket } = useSocket();

  // Filter professions based on search query
  const filteredProfessions = professions.filter(profession =>
    profession.name.toLowerCase().includes(professionSearchQuery.toLowerCase())
  );

  // Handle initial profession when drawer opens
  React.useEffect(() => {
    if (isOpen && initialProfession) {
      setEditingProfession(initialProfession);
      setEditingProfessionName(initialProfession.name);
      setEditingProfessionIcon(initialProfession.icon);
      // Don't open add form, just set the profession for editing
    } else if (!isOpen) {
      // Reset when drawer closes
      setEditingProfession(null);
      setEditingProfessionName('');
      setEditingProfessionIcon(undefined);
      setIsAddingProfession(false);
      setIsEditingProfession(false);
      setProfessionSearchQuery('');
    }
  }, [isOpen, initialProfession]);

  // Listen for real-time profession icon updates
  React.useEffect(() => {
    if (!socket) return;

    const handleConfigurationUpdate = (data: any) => {
      if (data.type === 'profession' && data.action === 'icon-updated') {
        // Update the timestamp to force icon refresh
        setIconTimestamp(Date.now());
        
        // Update the profession icon timestamps for cache busting
        setProfessionIconTimestamps(prev => ({
          ...prev,
          [data.professionId]: Date.now()
        }));
        
        // If this profession is currently being edited, update its icon
        if (editingProfession && editingProfession._id === data.professionId) {
          setEditingProfessionIcon(data.iconName);
          setEditingProfession(prev => prev ? { ...prev, icon: data.iconName } : null);
        }
        
        // Update the profession in the list
        setProfessions(prev =>
          prev.map(prof =>
            prof._id === data.professionId
              ? { ...prof, icon: data.iconName }
              : prof
          )
        );
      }
    };

    socket.on('configuration:updated', handleConfigurationUpdate);

    return () => {
      socket.off('configuration:updated', handleConfigurationUpdate);
    };
  }, [socket, editingProfession]);

  const handleEditProfession = (profession: Profession) => {
    setEditingProfession(profession);
    setEditingProfessionName(profession.name);
    setEditingProfessionIcon(profession.icon);
    setIsEditingProfession(true);
    setIsAddingProfession(false);
  };

  const handleSaveProfessionEdit = async () => {
    if (!editingProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    try {
      if (editingProfession) {
        // Update existing profession
        const updateData: any = {};
        if (editingProfessionName.trim() !== editingProfession.name) {
          updateData.name = editingProfessionName.trim();
        }
        if (editingProfessionIcon !== editingProfession.icon) {
          updateData.icon = editingProfessionIcon;
        }

        if (Object.keys(updateData).length > 0) {
          await settingsService.updateProfession(editingProfession._id, updateData);
          
          setProfessions(prev =>
            prev.map(prof =>
              prof._id === editingProfession._id
                ? { ...prof, ...updateData }
                : prof
            )
          );
          
          toast.success('Profession updated successfully');
        }
      } else {
        // Add new profession
        const response = await settingsService.createProfession({
          name: editingProfessionName.trim(),
          categoryId: category._id,
        });
        
        setProfessions(prev => [...prev, response.profession]);
        toast.success('Profession added successfully');
      }
      
      // Reset editing state
      setEditingProfession(null);
      setEditingProfessionName('');
      setEditingProfessionIcon(undefined);
      setIsAddingProfession(false);
      setIsEditingProfession(false);
      setNewProfessionName('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save profession');
    }
  };

  const handleCancelProfessionEdit = () => {
    setEditingProfession(null);
    setEditingProfessionName('');
    setEditingProfessionIcon(undefined);
    setIsAddingProfession(false);
    setIsEditingProfession(false);
  };

  const handleDeleteProfession = async (professionId: string) => {
    try {
      await settingsService.deleteProfession(professionId);
      setProfessions(prev => prev.filter(prof => prof._id !== professionId));
      toast.success('Profession deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete profession');
    }
  };

  const handleDeleteCategory = async () => {
    setDeleting(true);
    try {
      await settingsService.deleteJobCategory(category._id);
      toast.success('Category deleted successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddProfession = async () => {
    if (!newProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    try {
      const response = await settingsService.createProfession({
        name: newProfessionName.trim(),
        categoryId: category._id,
      });
      
      setProfessions(prev => [...prev, response.profession]);
      setNewProfessionName('');
      setIsAddingProfession(false);
      toast.success('Profession added successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add profession');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingIcon(true);
      const response = await settingsService.uploadCategoryIcon(
        file, 
        categoryName || category.name,
        category.icon
      );
      setCategoryIcon(response.iconName);
      setIconTimestamp(Date.now());
      setShowIconPicker(false);
      toast.success('Icon uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProfessionFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentProfessionForUpload) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const profession = professions.find(p => p._id === currentProfessionForUpload);
    if (!profession) return;

    try {
      setUploadingProfessionIcon(currentProfessionForUpload);
      const response = await settingsService.uploadProfessionIcon(
        file,
        profession.name,
        profession.icon
      );
      
      if (editingProfession && editingProfession._id === currentProfessionForUpload) {
        setEditingProfessionIcon(response.iconName);
        setEditingProfession(prev => prev ? { ...prev, icon: response.iconName } : null);
      }
      
      setProfessions(prev =>
        prev.map(prof =>
          prof._id === currentProfessionForUpload
            ? { ...prof, icon: response.iconName }
            : prof
        )
      );
      
      setProfessionIconTimestamps(prev => ({
        ...prev,
        [currentProfessionForUpload]: Date.now()
      }));
      
      // Also update the main icon timestamp to force refresh
      setIconTimestamp(Date.now());
      
      toast.success('Profession icon uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload profession icon');
    } finally {
      setUploadingProfessionIcon(null);
      setCurrentProfessionForUpload(null);
      if (professionFileInputRef.current) {
        professionFileInputRef.current.value = '';
      }
    }
  };

  const triggerProfessionIconUpload = () => {
    if (editingProfession) {
      setCurrentProfessionForUpload(editingProfession._id);
      professionFileInputRef.current?.click();
    }
  };

  const getProfessionIconName = (profession: Profession) => {
    if (editingProfession && editingProfession._id === profession._id && editingProfessionIcon !== undefined) {
      return editingProfessionIcon;
    }
    return profession.icon;
  };

  const getProfessionIconData = (profession: Profession) => {
    const iconName = getProfessionIconName(profession);

    // If profession has no icon, use the default icon
    if (!iconName) {
      const timestamp = professionIconTimestamps[profession._id] || iconTimestamp;
      return {
        color: '#0F766E', // Use consistent color for all profession icons
        imagePath: `/src/assets/icons/Default_Icon.webp?t=${timestamp}`
      };
    }

    const iconData = getProfessionIconByName(iconName, categoryIcon);
    // Use the most recent timestamp for this profession
    const timestamp = professionIconTimestamps[profession._id] || iconTimestamp;
    return {
      ...iconData,
      color: '#0F766E', // Use consistent color for all profession icons
      imagePath: `${iconData.imagePath}?t=${timestamp}`
    };
  };

  const handleConfirm = async () => {
    setSaving(true);
    
    try {
      const updates: Promise<any>[] = [];
      
      if (categoryName.trim() !== category.name || categoryIcon !== category.icon) {
        const updateData: any = {};
        if (categoryName.trim() !== category.name) {
          updateData.name = categoryName.trim();
        }
        if (categoryIcon !== category.icon) {
          updateData.icon = categoryIcon;
        }
        updates.push(
          settingsService.updateJobCategory(category._id, updateData)
        );
      }
      
      professions.forEach((prof) => {
        const original = category.professions.find(p => p._id === prof._id);
        if (original) {
          const nameChanged = prof.name !== original.name;
          const originalIcon = original.icon || undefined;
          const currentIcon = prof.icon || undefined;
          const iconChanged = currentIcon !== originalIcon;
          
          if (nameChanged || iconChanged) {
            const updateData: { name?: string; icon?: string } = {};
            if (nameChanged) updateData.name = prof.name;
            if (iconChanged) updateData.icon = currentIcon;
            
            updates.push(
              settingsService.updateProfession(prof._id, updateData)
            );
          }
        }
      });

      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success('Changes saved successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Category</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Automotive Services"
            />
          </div>

          {/* Category icon UI removed per request */}

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">
                Professions ({professions.length})
              </label>
              <button
                onClick={() => {
                  setIsAddingProfession(true);
                  setIsEditingProfession(false);
                  setEditingProfession(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Search Bar */}
            {professions.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search professions..."
                  value={professionSearchQuery}
                  onChange={(e) => setProfessionSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {(isAddingProfession || isEditingProfession) && (
              <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={editingProfessionName}
                  onChange={(e) => setEditingProfessionName(e.target.value)}
                  placeholder={isEditingProfession ? "Edit profession name" : "New profession name"}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveProfessionEdit();
                    }
                    if (e.key === 'Escape') {
                      setIsAddingProfession(false);
                      setIsEditingProfession(false);
                      setNewProfessionName('');
                      setEditingProfession(null);
                      setEditingProfessionName('');
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfessionEdit}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {isEditingProfession ? 'Update' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingProfession(false);
                      setIsEditingProfession(false);
                      setNewProfessionName('');
                      setEditingProfession(null);
                      setEditingProfessionName('');
                    }}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <input
              ref={professionFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfessionFileUpload}
              className="hidden"
            />

            {filteredProfessions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-sm">
                  {professionSearchQuery ? 'No professions found' : 'No professions yet'}
                </p>
                <p className="text-xs mt-1">
                  {professionSearchQuery ? 'Try a different search term' : 'Click Add to create your first profession'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProfessions.map((profession) => {
                  const professionIcon = getProfessionIconData(profession);

                  return (
                    <div
                      key={profession._id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all group cursor-pointer"
                      onClick={() => handleEditProfession(profession)}
                    >
                      {/* Icon on the left - larger, no border */}
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0">
                        <img 
                          src={professionIcon.imagePath}
                          alt={profession.name}
                          className="w-12 h-12 object-contain" 
                        />
                      </div>
                      
                      {/* Profession name on the right */}
                      <div className="flex-1">
                        <p className="text-base text-gray-900 font-medium">
                          {profession.name}
                        </p>
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfession(profession._id);
                        }}
                        className="p-2 bg-white border border-red-200 text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                        title="Delete profession"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showDeleteConfirm ? (
          <div className="px-6 py-4 border-t border-gray-200 bg-red-50">
            <div className="text-center mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Delete "{categoryName}"?
              </h3>
              <p className="text-sm text-gray-600">
                This will delete {professions.length} profession{professions.length !== 1 ? 's' : ''} in this category. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              disabled={saving || deleting}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Category</span>
              <span className="sm:hidden">Delete</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={saving || deleting}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>

      {editingProfession && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-[60]"
            onClick={handleCancelProfessionEdit}
          />
          <div className="fixed bottom-0 right-0 w-full max-w-md bg-white rounded-t-2xl shadow-2xl z-[70] animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Edit Profession</h3>
              <button
                onClick={handleCancelProfessionEdit}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profession Name
                </label>
                <input
                  type="text"
                  value={editingProfessionName}
                  onChange={(e) => setEditingProfessionName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Auto Electrician"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProfessionEdit();
                    if (e.key === 'Escape') handleCancelProfessionEdit();
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="flex-shrink-0 p-3 rounded-lg border-2 border-gray-300" 
                    style={{ 
                      backgroundColor: `${getProfessionIconData(editingProfession).color}15` 
                    }}
                  >
                    <img 
                      src={getProfessionIconData(editingProfession).imagePath}
                      alt="Icon"
                      className="w-7 h-7" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <button
                    onClick={triggerProfessionIconUpload}
                    disabled={uploadingProfessionIcon === editingProfession._id}
                    className="flex-1 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploadingProfessionIcon === editingProfession._id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        <span>Upload Custom Image</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleCancelProfessionEdit}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfessionEdit}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default EditCategoryDrawer;
