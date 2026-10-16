import { getProfessionIconByName, CategoryIcon } from '../constants/categoryIcons';
import { JobCategory } from '../types';

/**
 * Robustly resolves a profession name to its configured or legacy icon asset.
 * Logic synchronized with platform-wide standards for visual parity.
 */
export const resolveIconForProfession = (
  professionName: string, 
  categories: JobCategory[] = [], 
  jobIcon?: string
): CategoryIcon => {
  if (!professionName) {
    return { 
      name: 'professional-services',
      imagePath: '/assets/icons/categories/professional-services.png', 
      color: '#0F766E',
      label: 'General Service' 
    };
  }
  
  // If a direct icon path or URL is provided, use it
  if (jobIcon && (jobIcon.startsWith('http') || jobIcon.includes('.'))) {
    // Strip custom: prefix if present
    const iconFileName = jobIcon.startsWith('custom:') ? jobIcon.replace('custom:', '') : jobIcon;
    return {
      name: jobIcon,
      imagePath: jobIcon.startsWith('http') ? jobIcon : `/assets/icons/professions/${iconFileName}`,
      color: '#0F766E',
      label: professionName
    };
  }

  const cleanName = professionName.trim().toLowerCase();
  const normalizedSearch = cleanName.replace(/[^a-z0-9]/g, '');

  // 1. First, try to find the profession in categories data to get the correct icon
  if (categories && categories.length > 0) {
    for (const c of categories) {
      const prof = c.professions?.find(p => {
        const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pNorm === normalizedSearch || pNorm.includes(normalizedSearch) || normalizedSearch.includes(pNorm);
      });
      if (prof && prof.icon) {
        // Use the profession icon from categories data (has correct ImageKit path)
        return getProfessionIconByName(prof.icon, c.icon);
      }
    }
  }

  // 2. Prioritize Legacy/Fuzzy mapping fallback for known platform variants
  // This ensures that well-known trades always get their dedicated icons even if dynamic config is tricky
  const legacyMap: Record<string, string> = {
    'catering': 'custom:catering.webp',
    'painting': 'custom:painter.webp',
    'beauty': 'custom:beauty--personal-care.webp',
    'cleaning': 'custom:house-cleaning.webp',
    'carpentry': 'custom:carpentry-cabinetry.webp',
    'acrefrigeration': 'custom:ac--refrigerator.webp',
    'acref': 'custom:ac--refrigerator.webp',
    'gardening': 'custom:gardening--landscaping.webp',
    'landscaping': 'custom:gardening--landscaping.webp',
    'moving': 'custom:lipat-bahay-mover.webp',
    'delivery': 'custom:delivery.webp',
    'courier': 'custom:delivery.webp',
    'computerrepair': 'custom:computer-technician.webp',
    'itrep': 'custom:computer-technician.webp',
    'automechanic': 'custom:auto-mechanic.webp',
    'automecanic': 'custom:auto-mechanic.webp',
    'creativedesign': 'custom:graphic-design.webp',
    'graphicdesign': 'custom:graphic-design.webp',
    'logo': 'custom:graphic-design.webp',
    'housekeeping': 'custom:house-cleaning.webp',
    'handyman': 'custom:general-handyman.webp',
    'maintenance': 'custom:general-handyman.webp',
    'welding': 'custom:welding.webp',
    'architecture': 'custom:architecture-drafting.webp',
    'architectural': 'custom:architecture-drafting.webp',
    'architecturedrafting': 'custom:architecture-drafting.webp'
  };

  if (legacyMap[normalizedSearch]) {
    return getProfessionIconByName(legacyMap[normalizedSearch]);
  }

  let categoryIconStr = '';
  let iconStr = '';

  // 2. Try to find in fetched categories/professions (with normalization)
  if (categories && categories.length > 0) {
    // Try exact category match first
    const exactCat = categories.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch);
    if (exactCat) {
      return getProfessionIconByName('', exactCat.icon);
    }

    // Try profession match
    for (const c of categories) {
      // Prioritize exact match
      const exactProf = c.professions?.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch);
      if (exactProf) {
        return getProfessionIconByName(exactProf.icon || '', c.icon);
      }

      // Fallback to fuzzy match within professions
      const fuzzyProf = c.professions?.find(p => {
        const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pNorm.includes(normalizedSearch) || normalizedSearch.includes(pNorm);
      });
      if (fuzzyProf) {
        iconStr = fuzzyProf.icon || '';
        categoryIconStr = c.icon || '';
        break;
      }
    }
  }

  return getProfessionIconByName(iconStr, categoryIconStr);
};

/**
 * Letters and digits only, lower-cased: "autoMechanic", "Auto Mechanic" and
 * "auto_mechanic" all become "automechanic". Users store professions as keys
 * like "autoMechanic"; this is how a key is matched to its configured name.
 */
export const professionKey = (value: string): string =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The display name an admin configured for a stored profession value, e.g.
 * "autoMechanic" -> "Auto Mechanic" as set in Settings > Job Category. Falls back
 * to a readable form of the raw value when no configured profession (or
 * category) matches — renamed or removed ones.
 */
export const getProfessionDisplayName = (raw: string, categories: JobCategory[] = []): string => {
  const key = professionKey(raw);
  for (const category of categories) {
    const match = category.professions?.find((profession) => professionKey(profession.name) === key);
    if (match) return match.name;
  }
  const categoryMatch = categories.find((category) => professionKey(category.name) === key);
  if (categoryMatch) return categoryMatch.name;

  return String(raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};
