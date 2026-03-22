import React, { useState } from 'react';
import SideModal from '../SideModal';
import { settingsService } from '../../services';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';

interface Profession {
  name: string;
  icon?: string;
}

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [categoryName, setCategoryName] = useState('');
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [editingProfession, setEditingProfession] = useState<Profession | null>(null);
  const [editingProfessionName, setEditingProfessionName] = useState('');
  const [newProfessionName, setNewProfessionName] = useState('');
  const [isAddingProfession, setIsAddingProfession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  // Listen for real-time profession icon updates
  React.useEffect(() => {
    if (!socket) return;

    const handleConfigurationUpdate = (data: any) => {
      // Handle profession icon updates if needed
    };

    socket.on('configuration:updated', handleConfigurationUpdate);

    return () => {
      socket.off('configuration:updated', handleConfigurationUpdate);
    };
  }, [socket]);

  const handleEditProfession = (profession: Profession) => {
    setEditingProfession(profession);
    setEditingProfessionName(profession.name);
  };

  const handleSaveProfessionEdit = () => {
    if (!editingProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    if (editingProfession) {
      setProfessions(prev =>
        prev.map(prof =>
          prof === editingProfession
            ? { ...prof, name: editingProfessionName.trim() }
            : prof
        )
      );
    }
    setEditingProfession(null);
    setEditingProfessionName('');
  };

  const handleCancelProfessionEdit = () => {
    setEditingProfession(null);
    setEditingProfessionName('');
  };

  const handleDeleteProfession = (professionToDelete: Profession) => {
    setProfessions(prev => prev.filter(prof => prof !== professionToDelete));
    toast.success('Profession removed');
  };

  const handleAddProfession = () => {
    if (!newProfessionName.trim()) {
      toast.error('Profession name cannot be empty');
      return;
    }

    const newProfession: Profession = {
      name: newProfessionName.trim(),
    };

    setProfessions(prev => [...prev, newProfession]);
    setNewProfessionName('');
    setIsAddingProfession(false);
    toast.success('Profession added');
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
        professions: professions.map(prof => ({ name: prof.name })),
      });
      setCategoryName('');
      setProfessions([]);
      onSuccess();
      onClose();
      toast.success('Job category created successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create job category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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

            {/* Category Icon UI removed per request */}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700">
                  Professions ({professions.length})
                </label>
                <button
                  type="button"
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
                      type="button"
                      onClick={handleAddProfession}
                      className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
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

              {professions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm">No professions yet</p>
                  <p className="text-xs mt-1">Click Add to create your first profession</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {professions.map((profession, index) => (
                    <div
                      key={index}
                      className="relative group flex flex-col items-stretch"
                    >
                      <div
                        onClick={() => handleEditProfession(profession)}
                        className="w-full aspect-square rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all cursor-pointer flex flex-col p-3 relative group"
                        style={{ backgroundColor: '#0F766E08' }}
                      >
                        <div className="flex flex-col items-center h-full">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 mb-2"
                            style={{ backgroundColor: '#0F766E15' }}
                          >
                            <img
                              src="/src/assets/icons/Default_Icon.webp"
                              alt={profession.name}
                              className="w-6 h-6"
                              onError={(e) => {
                                // Fallback to gray placeholder if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-6 h-6 bg-gray-400 rounded';
                                target.parentNode?.appendChild(fallback);
                              }}
                            />
                          </div>
                          <div className="flex-grow flex items-center">
                            <p className="text-xs text-gray-900 text-center font-medium line-clamp-2 w-full">
                              {profession.name}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfession(profession);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white border border-red-200 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          title="Delete profession"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
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

export default AddCategoryModal;
