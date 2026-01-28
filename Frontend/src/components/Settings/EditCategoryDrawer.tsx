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
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [professions, setProfessions] = useState<Profession[]>(category.professions);
  const [editingProfessionId, setEditingProfessionId] = useState<string | null>(null);
  const [editingProfessionName, setEditingProfessionName] = useState('');
  const [editingProfessionIcon, setEditingProfessionIcon] = useState<string | undefined>(undefined);
  const [showProfessionIconPicker, setShowProfessionIconPicker] = useState<string | null>(null);
  const [uploadingProfessionIcon, setUploadingProfessionIcon] = useState<string | null>(null);
  const [newProfessionName, setNewProfessionName] = useState('');
  const [isAddingProfession, setIsAddingProfession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const professionFileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentProfessionForUpload, setCurrentProfessionForUpload] = useState<string | null>(null);

  const handleEditProfession = (profession: Profession) => {
    setEditingProfessionId(profession._id);
    setEditingProfessionName(profession.name);
    setEditingProfessionIcon(profession.icon);
  };

  const handleSaveProfessionEdit = () => {
    if (!editingProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    setProfessions(prev =>
      prev.map(prof =>
        prof._id === editingProfessionId
          ? { ...prof, name: editingProfessionName.trim(), icon: editingProfessionIcon }
          : prof
      )
    );
    setEditingProfessionId(null);
    setEditingProfessionName('');
    setEditingProfessionIcon(undefined);
  };

  const handleCancelProfessionEdit = () => {
    setEditingProfessionId(null);
    setEditingProfessionName('');
    setEditingProfessionIcon(undefined);
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
      
      if (editingProfessionId === currentProfessionForUpload) {
        setEditingProfessionIcon(response.iconName);
      } else {
        setProfessions(prev =>
          prev.map(prof =>
            prof._id === currentProfessionForUpload
              ? { ...prof, icon: response.iconName }
              : prof
          )
        );
      }
      
      setShowProfessionIconPicker(null);
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

  const handleSelectProfessionIcon = (professionId: string, iconName: string) => {
    if (editingProfessionId === professionId) {
      setEditingProfessionIcon(iconName);
    } else {
      setProfessions(prev =>
        prev.map(prof =>
          prof._id === professionId
            ? { ...prof, icon: iconName }
            : prof
        )
      );
    }
    setShowProfessionIconPicker(null);
  };

  const triggerProfessionIconUpload = (professionId: string) => {
    setCurrentProfessionForUpload(professionId);
    professionFileInputRef.current?.click();
  };

  const getProfessionIconName = (profession: Profession) => {
    if (editingProfessionId === profession._id && editingProfessionIcon !== undefined) {
      return editingProfessionIcon;
    }
    return profession.icon;
  };

  const getProfessionIconData = (profession: Profession) => {
    const iconName = getProfessionIconName(profession);
    return getProfessionIconByName(iconName || '', categoryIcon);
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

        <div className="flex-1 overflow-y-auto p-6">
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
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Professions
              </label>
              <button
                onClick={() => setIsAddingProfession(true)}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Add
              </button>
            </div>

            {isAddingProfession && (
              <div className="mb-3 p-3 border border-gray-300 rounded-lg bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProfessionName}
                    onChange={(e) => setNewProfessionName(e.target.value)}
                    placeholder="New profession name"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddProfession();
                      if (e.key === 'Escape') {
                        setIsAddingProfession(false);
                        setNewProfessionName('');
                      }
                    }}
                  />
                  <button
                    onClick={handleAddProfession}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingProfession(false);
                      setNewProfessionName('');
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
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

            <div className="space-y-2">
              {professions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No professions yet. Add your first profession.
                </p>
              ) : (
                professions.map((profession) => (
                  <div key={profession._id}>
                    {editingProfessionId === profession._id ? (
                      <div className="p-3 border border-gray-300 rounded-lg bg-white">
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={editingProfessionName}
                            onChange={(e) => setEditingProfessionName(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveProfessionEdit();
                              if (e.key === 'Escape') handleCancelProfessionEdit();
                            }}
                          />
                        </div>
                        
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Profession Icon
                          </label>
                          <div className="flex items-center gap-2">
                            <div 
                              className="flex-shrink-0 p-2 rounded-lg border border-gray-300" 
                              style={{ backgroundColor: `${getProfessionIconData(profession).color}15` }}
                            >
                              <img 
                                src={getProfessionIconData(profession).imagePath}
                                alt="Profession icon"
                                className="w-5 h-5"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                            <button
                              onClick={() => setShowProfessionIconPicker(
                                showProfessionIconPicker === profession._id ? null : profession._id
                              )}
                              className="flex-1 px-3 py-2 text-xs text-left border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>Change Icon</span>
                            </button>
                          </div>
                          
                          {showProfessionIconPicker === profession._id && (
                            <div className="mt-2 p-3 border border-gray-300 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => triggerProfessionIconUpload(profession._id)}
                                disabled={uploadingProfessionIcon === profession._id}
                                className="w-full mb-3 px-3 py-2 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-600 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {uploadingProfessionIcon === profession._id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="w-4 h-4" />
                                    <span>Upload Custom</span>
                                  </>
                                )}
                              </button>
                              
                              <div className="grid grid-cols-5 gap-1">
                                {getAllIcons().map((icon) => (
                                  <button
                                    key={icon.name}
                                    onClick={() => handleSelectProfessionIcon(profession._id, icon.name)}
                                    className={`p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                                      getProfessionIconName(profession) === icon.name
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    style={{ backgroundColor: `${icon.color}10` }}
                                    title={icon.label}
                                  >
                                    <img 
                                      src={icon.imagePath}
                                      alt={icon.label}
                                      className="w-4 h-4 mx-auto"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveProfessionEdit}
                            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelProfessionEdit}
                            className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex-shrink-0 p-2 rounded-lg border border-gray-200" 
                          style={{ backgroundColor: `${getProfessionIconData(profession).color}15` }}
                        >
                          <img 
                            src={getProfessionIconData(profession).imagePath}
                            alt="Profession icon"
                            className="w-4 h-4"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleEditProfession(profession)}
                          className="flex-1 px-4 py-2.5 text-left text-sm bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {profession.name}
                        </button>
                        <button
                          onClick={() => handleDeleteProfession(profession._id)}
                          className="p-2.5 text-red-600 hover:bg-red-50 border border-gray-300 rounded-lg transition-colors"
                          title="Delete profession"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
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
    </>
  );
};

export default EditCategoryDrawer;
