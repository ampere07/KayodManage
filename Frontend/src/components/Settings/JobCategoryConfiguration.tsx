import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { settingsService } from '../../services';
import { JobCategory } from '../../types/configuration.types';
import AddCategoryModal from './AddCategoryModal';
import EditCategoryDrawer from './EditCategoryDrawer';
import toast from 'react-hot-toast';
import { getIconByName, getDefaultIconForCategory } from '../../constants/categoryIcons';

const JobCategoryConfiguration: React.FC = () => {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editingCategory, setEditingCategory] = useState<JobCategory | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getJobCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
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
    setShowEditDrawer(true);
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.professions.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with Search and Add Button */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Job Category
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
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
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 p-2 rounded-lg" style={{ backgroundColor: `${categoryIcon.color}15` }}>
                          <img 
                            key={category._id + iconName}
                            src={categoryIcon.imagePath} 
                            alt={categoryIcon.label}
                            className="w-5 h-5" 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              console.log('Image load error:', categoryIcon.imagePath);
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{category.name}</span>
                      </div>
                      
                      <span className="text-xs text-gray-500">
                        ({category.professions.length} profession{category.professions.length !== 1 ? 's' : ''})
                      </span>
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
                        <div className="grid grid-cols-3 gap-3">
                          {category.professions.map((profession) => (
                            <div
                              key={profession._id}
                              className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg"
                            >
                              <span className="text-sm text-gray-900">{profession.name}</span>
                            </div>
                          ))}
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
          }}
          onSuccess={loadCategories}
          category={editingCategory}
        />
      )}
    </div>
  );
};

export default JobCategoryConfiguration;
