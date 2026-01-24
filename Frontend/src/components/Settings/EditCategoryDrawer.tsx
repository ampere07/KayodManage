import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { settingsService } from '../../services';
import toast from 'react-hot-toast';

interface Profession {
  _id: string;
  name: string;
}

interface EditCategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: {
    _id: string;
    name: string;
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
  const [professions, setProfessions] = useState<Profession[]>(category.professions);
  const [editingProfessionId, setEditingProfessionId] = useState<string | null>(null);
  const [editingProfessionName, setEditingProfessionName] = useState('');
  const [newProfessionName, setNewProfessionName] = useState('');
  const [isAddingProfession, setIsAddingProfession] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEditProfession = (profession: Profession) => {
    setEditingProfessionId(profession._id);
    setEditingProfessionName(profession.name);
  };

  const handleSaveProfessionEdit = () => {
    if (!editingProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    setProfessions(prev =>
      prev.map(prof =>
        prof._id === editingProfessionId
          ? { ...prof, name: editingProfessionName.trim() }
          : prof
      )
    );
    setEditingProfessionId(null);
    setEditingProfessionName('');
  };

  const handleCancelProfessionEdit = () => {
    setEditingProfessionId(null);
    setEditingProfessionName('');
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

  const handleConfirm = async () => {
    setSaving(true);
    
    try {
      const updates: Promise<any>[] = [];
      
      // Update category name if changed
      if (categoryName.trim() !== category.name) {
        updates.push(
          settingsService.updateJobCategory(category._id, { name: categoryName.trim() })
        );
      }
      
      // Update professions that changed
      professions.forEach((prof) => {
        const original = category.professions.find(p => p._id === prof._id);
        if (original && prof.name !== original.name) {
          updates.push(
            settingsService.updateProfession(prof._id, { name: prof.name })
          );
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Category</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Category Name */}
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

          {/* Professions Section */}
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

            {/* Add Profession Input */}
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

            {/* Professions List */}
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
                        <div className="flex gap-2">
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
                          <button
                            onClick={handleSaveProfessionEdit}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelProfessionEdit}
                            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditProfession(profession)}
                        className="w-full px-4 py-2.5 text-left text-sm bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {profession.name}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
};

export default EditCategoryDrawer;
