import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Plus, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { JobCategory } from '../../types/configuration.types';
import AddCategoryModal from './AddCategoryModal';
import EditCategoryDrawer from './EditCategoryDrawer';
import QuickAccessManager from './QuickAccessManager';
import { getIconByName, getDefaultIconForCategory, getProfessionIconByName, getProfessionIconFromName } from '../../constants/categoryIcons';
import { useJobCategories } from '../../hooks/useJobs';
import { useSocket } from '../../context/SocketContext';

const EXPANDED_CATEGORIES_KEY = 'settings-expanded-categories';

const JobCategoryConfiguration: React.FC = () => {
  const queryClient = useQueryClient();
  const { categories, isLoading } = useJobCategories();
  const { socket } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editingCategory, setEditingCategory] = useState<JobCategory | null>(null);
  const [editingProfession, setEditingProfession] = useState<any | null>(null);
  const [showQuickAccessManager, setShowQuickAccessManager] = useState(false);

  // Load expanded categories from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_CATEGORIES_KEY);
      if (saved) {
        setExpandedCategories(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.error('Failed to load expanded categories from localStorage:', error);
    }
  }, []);

  // Expand all categories by default when categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      const allCategoryIds: Set<string> = new Set(categories.map((cat: JobCategory) => cat._id as string));
      setExpandedCategories(allCategoryIds);
    }
  }, [categories]);

  // Save expanded categories to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_CATEGORIES_KEY, JSON.stringify(Array.from(expandedCategories)));
    } catch (error) {
      console.error('Failed to save expanded categories to localStorage:', error);
    }
  }, [expandedCategories]);

  // Listen for real-time profession icon updates
  useEffect(() => {
    if (!socket) return;

    const handleConfigurationUpdate = (data: any) => {
      if (data.type === 'profession' && (data.action === 'icon-updated' || data.action === 'updated' || data.action === 'deleted')) {
        // Invalidate job-categories cache to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['job-categories'] });
      }
    };

    socket.on('configuration:updated', handleConfigurationUpdate);

    return () => {
      socket.off('configuration:updated', handleConfigurationUpdate);
    };
  }, [socket, queryClient]);

  const loadCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['job-categories'] });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleEditClick = (category: JobCategory) => {
    setEditingCategory(category);
    setEditingProfession(null);
    setShowEditDrawer(true);
  };

  const handleProfessionClick = (category: JobCategory, profession: any) => {
    setEditingCategory(category);
    setEditingProfession(profession);
    setShowEditDrawer(true);
  };

  const getAllProfessions = () => {
    const allProfessions: any[] = [];
    categories.forEach(category => {
      category.professions.forEach(profession => {
        allProfessions.push({
          ...profession,
          categoryName: category.name,
          categoryIcon: category.icon,
        });
      });
    });
    return allProfessions;
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.professions.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with Search and Add Button */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-full md:flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowQuickAccessManager(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap text-sm"
            >
              <Star className="w-4 h-4" />
              <span>Quick Access</span>
            </button>
            <button
              onClick={() => {
                setShowAddCategoryModal(true);
                setEditingProfession(null);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="md:hidden">Add</span>
              <span className="hidden md:inline">Add Job Category</span>
            </button>
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg mb-2">No categories found</p>
            <p className="text-sm">Create your first job category to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories.has(category._id);
              const iconName = category.icon || getDefaultIconForCategory(category.name);
              const categoryIcon = getIconByName(iconName);

              return (
                <div key={category._id} className="border-b border-gray-200">
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategory(category._id)}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-gray-600">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 leading-tight">{category.name}</span>
                        <span className="text-xs text-gray-500">
                          {category.professions.length} profession{category.professions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(category);
                        }}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Expanded Professions */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-6 py-4">
                      {category.professions.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No professions yet. Click Edit to add professions.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4">
                          {category.professions.map((profession) => {
                            // If profession has an icon field, resolve it; otherwise auto-generate from profession name
                            const professionIcon = profession.icon
                              ? getProfessionIconByName(profession.icon, category.icon)
                              : getProfessionIconFromName(profession.name, category.icon);
                            // Add cache-busting parameter using profession's updatedAt timestamp
                            const iconPath = profession.icon?.startsWith('ik:')
                              ? `${professionIcon.imagePath}?v=${new Date(profession.updatedAt).getTime()}`
                              : professionIcon.imagePath;
                            return (
                              <div
                                key={profession._id}
                                className="flex flex-col items-center w-full sm:w-24 group relative cursor-pointer"
                                onClick={() => handleProfessionClick(category, profession)}
                              >
                                <div className="h-8 w-full flex items-end justify-center mb-2">
                                  <span className="text-xs text-gray-700 text-center line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors break-words hyphens-auto w-full">
                                    {profession.name}
                                  </span>
                                </div>
                                <div
                                  className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                                >
                                  <div className="absolute inset-0 m-auto w-12 h-12 rounded-xl bg-orange-100/80 group-hover:bg-blue-100/80 transition-colors"></div>
                                  <img
                                    src={iconPath}
                                    alt={profession.name}
                                    className="relative z-10 w-16 h-16 object-contain drop-shadow-sm transition-opacity opacity-100"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      // Fallback to the default icon if the profession icon fails to load
                                      target.src = `/assets/icons/Default_Icon.webp`;
                                    }}
                                  />
                                </div>
                                {/* Edit indicator on hover */}
                                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="bg-blue-600 text-white rounded-full p-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddCategoryModal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onSuccess={loadCategories}
      />

      {editingCategory && (
        <EditCategoryDrawer
          isOpen={showEditDrawer}
          onClose={() => {
            setShowEditDrawer(false);
            setEditingCategory(null);
            setEditingProfession(null);
          }}
          onSuccess={loadCategories}
          category={editingCategory}
          profession={editingProfession}
        />
      )}

      <QuickAccessManager
        isOpen={showQuickAccessManager}
        onClose={() => setShowQuickAccessManager(false)}
        onSuccess={loadCategories}
        allProfessions={getAllProfessions()}
      />
    </div>
  );
};

export default JobCategoryConfiguration;
