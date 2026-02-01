import React, { useState, useEffect, useMemo } from 'react';
import { X, GripVertical, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { settingsService } from '../../services';
import { getProfessionIconByName } from '../../constants/categoryIcons';

interface Profession {
  _id: string;
  name: string;
  icon?: string;
  categoryName: string;
  categoryIcon?: string;
  isQuickAccess?: boolean;
  quickAccessOrder?: number;
}

interface QuickAccessManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allProfessions: Profession[];
}

const QuickAccessManager: React.FC<QuickAccessManagerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allProfessions,
}) => {
  const [selectedProfessions, setSelectedProfessions] = useState<Profession[]>([]);
  const [availableProfessions, setAvailableProfessions] = useState<Profession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && allProfessions) {
      // Filter and sort quick access professions
      const quickAccess = allProfessions
        .filter(p => p.isQuickAccess)
        .sort((a, b) => (a.quickAccessOrder || 0) - (b.quickAccessOrder || 0));

      // Get available professions (not in quick access)
      const available = allProfessions.filter(p => !p.isQuickAccess);

      setSelectedProfessions(quickAccess);
      setAvailableProfessions(available);
    }
  }, [isOpen, allProfessions]);

  const filteredAvailable = useMemo(() => {
    return availableProfessions.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableProfessions, searchQuery]);

  const groupedProfessions = useMemo(() => {
    return filteredAvailable.reduce((acc, profession) => {
      if (!acc[profession.categoryName]) {
        acc[profession.categoryName] = [];
      }
      acc[profession.categoryName].push(profession);
      return acc;
    }, {} as Record<string, Profession[]>);
  }, [filteredAvailable]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const categories = Object.keys(groupedProfessions);
      setExpandedCategories(new Set(categories));
    }
  }, [searchQuery, groupedProfessions]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const items = Array.from(selectedProfessions);
    const draggedItem = items[draggedIndex];

    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    setSelectedProfessions(items);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addProfession = (profession: Profession) => {
    if (selectedProfessions.length >= 8) {
      setError('Maximum 8 quick access professions allowed');
      return;
    }

    setSelectedProfessions([...selectedProfessions, profession]);
    setAvailableProfessions(availableProfessions.filter(p => p._id !== profession._id));
    setError(null);
  };

  const removeProfession = (profession: Profession) => {
    setSelectedProfessions(selectedProfessions.filter(p => p._id !== profession._id));
    setAvailableProfessions([...availableProfessions, profession]);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const professions = selectedProfessions.map(p => ({
        professionId: p._id,
      }));

      await settingsService.updateQuickAccessProfessions(professions);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update quick access professions');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
      <div className="bg-white shadow-xl w-full max-w-2xl h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Quick Access Professions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select and reorder up to 8 professions to display on the client home screen
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Selected Professions */}
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Quick Access ({selectedProfessions.length}/8)
              </h3>
              {selectedProfessions.length > 0 && (
                <button
                  onClick={() => {
                    setAvailableProfessions([...availableProfessions, ...selectedProfessions]);
                    setSelectedProfessions([]);
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="px-6 pb-6">
              {selectedProfessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 py-10">
                  <Star className="w-12 h-12 mb-2" />
                  <p className="text-sm">No professions selected</p>
                  <p className="text-xs">Add professions from below</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {selectedProfessions.map((profession, index) => {
                    const professionIcon = getProfessionIconByName(profession.icon || '', profession.categoryIcon);
                    return (
                      <div
                        key={profession._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`relative flex flex-col items-center cursor-move group ${draggedIndex === index ? 'opacity-50' : ''
                          }`}
                      >
                        <div className="absolute top-1 right-1 z-10">
                          <button
                            onClick={() => removeProfession(profession)}
                            className="p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-700 text-center line-clamp-2 leading-tight mb-1.5 h-8 px-1">
                          {profession.name}
                        </span>
                        <div
                          className="w-16 h-16 rounded-lg flex items-center justify-center border-2 transition-all"
                          style={{
                            backgroundColor: `${professionIcon.color}15`,
                            borderColor: draggedIndex === index ? '#3b82f6' : '#e5e7eb'
                          }}
                        >
                          <img
                            src={professionIcon.imagePath}
                            alt={profession.name}
                            className="w-10 h-10"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-400 mt-1">
                          #{index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Available Professions */}
          <div className="border-b border-gray-200">
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Available Professions ({filteredAvailable.length})
              </h3>

              <input
                type="text"
                placeholder="Search professions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {Object.keys(groupedProfessions).length === 0 ? (
                <div className="text-center py-10 text-gray-400 px-6">
                  <p className="text-sm">No professions available</p>
                </div>
              ) : (
                Object.entries(groupedProfessions).map(([categoryName, professions]) => {
                  const isExpanded = expandedCategories.has(categoryName);
                  return (
                    <div key={categoryName} className="border-t border-gray-200 first:border-t-0">
                      <button
                        onClick={() => toggleCategory(categoryName)}
                        className="w-full flex items-center justify-between px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{categoryName}</span>
                        </div>
                        <span className="text-xs text-gray-500">({professions.length})</span>
                      </button>

                      {isExpanded && (
                        <div className="bg-white">
                          {professions.map((profession) => (
                            <button
                              key={profession._id}
                              onClick={() => addProfession(profession)}
                              disabled={selectedProfessions.length >= 8}
                              className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed border-t border-gray-100 first:border-t-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {profession.name}
                                </p>
                              </div>
                              <span className="text-blue-600 text-xl">+</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {selectedProfessions.length === 0 ? (
              'Add professions to get started'
            ) : (
              `${selectedProfessions.length} profession${selectedProfessions.length !== 1 ? 's' : ''} selected`
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || selectedProfessions.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAccessManager;
