import React, { useState } from 'react';
import { X, Plus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { settingsService } from '../../services';
import toast from 'react-hot-toast';
import { getAllIcons, getIconByName, getDefaultIconForCategory, getProfessionIconByName } from '../../constants/categoryIcons';

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
}

const EditCategoryDrawer: React.FC<EditCategoryDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
}) => {
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryIcon, setCategoryIcon] = useState(category.icon || getDefaultIconForCategory(category.name));
  const [iconTimestamp, setIconTimestamp] = useState(Date.now());
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [professions, setProfessions] = useState<Profession[]>(category.professions);
  const [editingProfession, setEditingProfession] = useState<Profession | null>(null);
  const [editingProfessionName, setEditingProfessionName] = useState('');
  const [editingProfessionIcon, setEditingProfessionIcon] = useState<string | undefined>(undefined);
  const [showProfessionIconPicker, setShowProfessionIconPicker] = useState(false);
  const [uploadingProfessionIcon, setUploadingProfessionIcon] = useState<string | null>(null);
  const [professionIconTimestamps, setProfessionIconTimestamps] = useState<Record<string, number>>({});
  const [newProfessionName, setNewProfessionName] = useState('');
  const [isAddingProfession, setIsAddingProfession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const professionFileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentProfessionForUpload, setCurrentProfessionForUpload] = useState<string | null>(null);

  const handleEditProfession = (profession: Profession) => {
    setEditingProfession(profession);
    setEditingProfessionName(profession.name);
    setEditingProfessionIcon(profession.icon);
  };

  const handleSaveProfessionEdit = () => {
    if (!editingProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    if (editingProfession) {
      setProfessions(prev =>
        prev.map(prof =>
          prof._id === editingProfession._id
            ? { ...prof, name: editingProfessionName.trim(), icon: editingProfessionIcon }
            : prof
        )
      );
    }
    setEditingProfession(null);
    setEditingProfessionName('');
    setEditingProfessionIcon(undefined);
    setShowProfessionIconPicker(false);
  };

  const handleCancelProfessionEdit = () => {
    setEditingProfession(null);
    setEditingProfessionName('');
    setEditingProfessionIcon(undefined);
    setShowProfessionIconPicker(false);
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
      
      setShowProfessionIconPicker(false);
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

  const handleSelectProfessionIcon = (iconName: string) => {
    setEditingProfessionIcon(iconName);
    if (editingProfession) {
      setProfessionIconTimestamps(prev => ({
        ...prev,
        [editingProfession._id]: Date.now()
      }));
    }
    setShowProfessionIconPicker(false);
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
    const iconData = getProfessionIconByName(iconName || '', categoryIcon);
    const timestamp = professionIconTimestamps[profession._id] || Date.now();
    return {
      ...iconData,
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Icon
            </label>
            <div className="flex items-center gap-3">
              <div 
                className="flex-shrink-0 p-3 rounded-lg border border-gray-300" 
                style={{ backgroundColor: `${getIconByName(categoryIcon).color}15` }}
              >
                <img 
                  src={`${getIconByName(categoryIcon).imagePath}?t=${iconTimestamp}`}
                  alt={getIconByName(categoryIcon).label}
                  className="w-6 h-6"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="flex-1 px-4 py-2.5 text-left border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Change Icon</span>
              </button>
            </div>

            {showIconPicker && (
              <div className="mt-3 p-4 border border-gray-300 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
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
                  {getAllIcons().map((icon) => (
                    <button
                      key={icon.name}
                      onClick={() => {
                        setCategoryIcon(icon.name);
                        setIconTimestamp(Date.now());
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
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">
                Professions ({professions.length})
              </label>
              <button
                onClick={() => setIsAddingProfession(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {isAddingProfession && (
              <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <input
                  type="text"
                  value={newProfessionName}
                  onChange={(e) => setNewProfessionName(e.target.value)}
                  placeholder="New profession name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddProfession();
                    if (e.key === 'Escape') {
                      setIsAddingProfession(false);
                      setNewProfessionName('');
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddProfession}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingProfession(false);
                      setNewProfessionName('');
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

            {professions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-sm">No professions yet</p>
                <p className="text-xs mt-1">Click Add to create your first profession</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {professions.map((profession) => {
                  const professionIcon = getProfessionIconData(profession);

                  return (
                    <div
                      key={profession._id}
                      className="relative group flex flex-col items-center"
                    >
                      <div
                        onClick={() => handleEditProfession(profession)}
                        className="w-full aspect-square rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center p-3 relative group"
                        style={{ backgroundColor: `${professionIcon.color}08` }}
                      >
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                          style={{ backgroundColor: `${professionIcon.color}15` }}
                        >
                          <img 
                            src={professionIcon.imagePath}
                            alt={profession.name}
                            className="w-8 h-8" 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-900 text-center font-medium line-clamp-2 leading-tight">
                          {profession.name}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfession(profession._id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white border border-red-200 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          title="Delete profession"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showDeleteConfirm ? (
          <div className="px-6 py-4 border-t border-gray-200 bg-red-50">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Delete Category
                </h3>
                <p className="text-xs text-gray-600">
                  Are you sure you want to delete "{categoryName}"? This will also delete all {professions.length} profession(s) under this category. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                disabled={saving || deleting}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Category</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                    onClick={() => setShowProfessionIconPicker(!showProfessionIconPicker)}
                    className="flex-1 px-4 py-2.5 text-left border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Change Icon</span>
                  </button>
                </div>

                {showProfessionIconPicker && (
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <button
                      type="button"
                      onClick={triggerProfessionIconUpload}
                      disabled={uploadingProfessionIcon === editingProfession._id}
                      className="w-full mb-4 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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
                    
                    <div className="border-t border-gray-300 pt-3 mb-3">
                      <p className="text-xs text-gray-600 font-medium">Or choose from existing:</p>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {getAllIcons().map((icon) => (
                        <button
                          key={icon.name}
                          onClick={() => handleSelectProfessionIcon(icon.name)}
                          className={`p-2.5 rounded-lg border-2 transition-all hover:scale-105 ${
                            getProfessionIconName(editingProfession) === icon.name
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
                      ))}
                    </div>
                  </div>
                )}
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
