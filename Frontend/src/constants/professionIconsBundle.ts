/**
 * Profession Icons Bundle
 * URL mappings for instant loading from local public folder
 * Icons are served from /assets/icons/professions/ without network requests
 */

/**
 * Static icon bundle - maps filenames to local asset URLs
 * These icons are in the public folder and load instantly without network requests
 */
export const STATIC_PROFESSION_ICONS: Record<string, string> = {
  'auto-electrician.webp': '/assets/icons/professions/auto-electrician.webp',
  'auto-mechanic.webp': '/assets/icons/professions/auto-mechanic.webp',
  'beauty--personal-care.webp': '/assets/icons/professions/beauty--personal-care.webp',
  'carpentry-cabinetry.webp': '/assets/icons/professions/carpentry-cabinetry.webp',
  'catering.webp': '/assets/icons/professions/catering.webp',
  'computer-technician.webp': '/assets/icons/professions/computer-technician.webp',
  'delivery.webp': '/assets/icons/professions/delivery.webp',
  'electrical.webp': '/assets/icons/professions/electrical.webp',
  'general-handyman.webp': '/assets/icons/professions/general-handyman.webp',
  'graphic-design.webp': '/assets/icons/professions/graphic-design.webp',
  'house-cleaning.webp': '/assets/icons/professions/house-cleaning.webp',
  'lipat-bahay-mover.webp': '/assets/icons/professions/lipat-bahay-mover.webp',
  'painting.webp': '/assets/icons/professions/painting.webp',
  'plumbing.webp': '/assets/icons/professions/plumbing.webp',
  'welding.webp': '/assets/icons/professions/welding.webp',
  'gardening--landscaping.webp': '/assets/icons/professions/gardening--landscaping.webp',
  'architectural.webp': '/assets/icons/professions/architectural.webp',
  'masonry.webp': '/assets/icons/professions/masonry.webp',
  'roofing.webp': '/assets/icons/professions/roofing.webp',
  'locksmith.webp': '/assets/icons/professions/locksmith.webp',
  'software-development.webp': '/assets/icons/professions/software-development.webp',
  'tutor--training.webp': '/assets/icons/professions/tutor--training.webp',
  'virtual-assistant.webp': '/assets/icons/professions/virtual-assistant.webp',
  'wellness.webp': '/assets/icons/professions/wellness.webp',
};

// Default icon URL
export const defaultIcon = '/assets/icons/categories/professional-services.png';

/**
 * Get static icon by filename
 * Returns bundled asset if available, null otherwise
 */
export function getStaticProfessionIcon(fileName: string): string | null {
  if (!fileName) return null;
  
  // Remove custom: prefix if present
  const cleanName = fileName.replace('custom:', '').replace('ik:', '');
  
  return STATIC_PROFESSION_ICONS[cleanName] || null;
}

/**
 * Get static icon by profession name
 * Returns bundled asset if available, default icon otherwise
 */
export function getStaticIconByProfessionName(professionName: string): string {
  if (!professionName) return defaultIcon;
  
  // Normalize profession name to match filename
  const normalized = professionName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
  
  const fileName = `${normalized}.webp`;
  return STATIC_PROFESSION_ICONS[fileName] || defaultIcon;
}
