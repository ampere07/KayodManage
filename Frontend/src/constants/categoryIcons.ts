export interface CategoryIcon {
  name: string;
  imagePath: string;
  color: string;
  label: string;
}

export const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  'Professional Services': 'professional-services',
  'Electronics & Technology': 'electronics-technology',
  'Construction & Trades': 'construction-trades',
  'Home & Property': 'home-property',
  'Automotive Services': 'automotive-services',
  'Health & Wellness': 'health-wellness',
  'Food & Travel': 'food-travel',
  'Events & Entertainment': 'events-entertainment',
  'Specialized Services': 'specialized-services'
};

export const CATEGORY_ICONS: Record<string, CategoryIcon> = {
  'automotive-services': { 
    name: 'automotive-services', 
    imagePath: '/assets/icons/categories/automotive-services.png', 
    color: '#B91C1C', 
    label: 'Automotive Services' 
  },
  'construction-trades': { 
    name: 'construction-trades', 
    imagePath: '/assets/icons/categories/construction--trades.png', 
    color: '#EF4444', 
    label: 'Construction & Trades' 
  },
  'electronics-technology': { 
    name: 'electronics-technology', 
    imagePath: '/assets/icons/categories/electronics--technology.png', 
    color: '#0F766E', 
    label: 'Electronics & Technology' 
  },
  'events-entertainment': { 
    name: 'events-entertainment', 
    imagePath: '/assets/icons/categories/events--entertainment.png', 
    color: '#8B5CF6', 
    label: 'Events & Entertainment' 
  },
  'food-travel': { 
    name: 'food-travel', 
    imagePath: '/assets/icons/categories/food--travel.png', 
    color: '#DC2626', 
    label: 'Food & Travel' 
  },
  'health-wellness': { 
    name: 'health-wellness', 
    imagePath: '/assets/icons/categories/health--wellness.png', 
    color: '#7C3AED', 
    label: 'Health & Wellness' 
  },
  'home-property': { 
    name: 'home-property', 
    imagePath: '/assets/icons/categories/home--property.png', 
    color: '#10B981', 
    label: 'Home & Property' 
  },
  'professional-services': { 
    name: 'professional-services', 
    imagePath: '/assets/icons/categories/professional-services.png', 
    color: '#0F766E', 
    label: 'Professional Services' 
  },
  'specialized-services': { 
    name: 'specialized-services', 
    imagePath: '/assets/icons/categories/specialized-services.png', 
    color: '#059669', 
    label: 'Specialized Services' 
  }
};

export const getIconByName = (iconName: string): CategoryIcon => {
  if (iconName.startsWith('custom:')) {
    const fileName = iconName.replace('custom:', '');
    return {
      name: iconName,
      imagePath: `/assets/icons/categories/${fileName}`,
      color: '#0F766E',
      label: fileName.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
    };
  }
  
  if (CATEGORY_ICONS[iconName]) {
    return CATEGORY_ICONS[iconName];
  }
  
  return {
    name: iconName,
    imagePath: `/assets/icons/categories/${iconName}.png`,
    color: '#0F766E',
    label: iconName,
  };
};

export const getAllIcons = (): CategoryIcon[] => {
  return Object.values(CATEGORY_ICONS);
};

export const getDefaultIconForCategory = (categoryName: string): string => {
  return DEFAULT_CATEGORY_ICONS[categoryName] || 'professional-services';
};

export const getProfessionIconByName = (iconName: string, categoryIcon?: string): CategoryIcon => {
  if (!iconName) {
    return categoryIcon ? getIconByName(categoryIcon) : getIconByName('professional-services');
  }
  
  if (iconName.startsWith('custom:')) {
    const fileName = iconName.replace('custom:', '');
    return {
      name: iconName,
      imagePath: `/assets/icons/professions/${fileName}`,
      color: '#0F766E',
      label: fileName.replace(/\.\w+$/, '').replace(/^prof-/, '').replace(/-\d+$/, '').replace(/-/g, ' '),
    };
  }
  
  if (CATEGORY_ICONS[iconName]) {
    return CATEGORY_ICONS[iconName];
  }
  
  return categoryIcon ? getIconByName(categoryIcon) : getIconByName('professional-services');
};
