// Utility functions for handling verification images

interface ImageLoadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Check if an image URL is accessible
 */
export const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Load image with fallback options
 */
export const loadImageWithFallback = async (
  primaryUrl: string,
  fallbackUrl?: string
): Promise<ImageLoadResult> => {
  try {
    const primaryExists = await checkImageExists(primaryUrl);
    if (primaryExists) {
      return { success: true, url: primaryUrl };
    }

    if (fallbackUrl) {
      const fallbackExists = await checkImageExists(fallbackUrl);
      if (fallbackExists) {
        return { success: true, url: fallbackUrl };
      }
    }

    return { success: false, error: 'Image not found' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to load image' 
    };
  }
};

/**
 * Generate placeholder image URL based on image type
 */
export const getPlaceholderImage = (imageType: 'face' | 'id' | 'credential'): string => {
  const placeholders = {
    face: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNNjAgMTYwQzYwIDEzMC44IDgwLjggMTEwIDExMCAxMTBTMTYwIDEzMC44IDE2MCAxNjBINjBaIiBmaWxsPSIjOUNBM0FGIi8+CjwvbGc+',
    id: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSI0MCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSIxMjAiIHJ4PSI4IiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JRCBEb2N1bWVudDwvdGV4dD4KPC9zdmc+',
    credential: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSI0MCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSIxMjAiIHJ4PSI4IiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5DcmVkZW50aWFsPC90ZXh0Pgo8L3N2Zz4='
  };
  
  return placeholders[imageType];
};

/**
 * Create image with error handling
 */
export const createSafeImage = (src: string, alt: string, className?: string): HTMLImageElement => {
  const img = new Image();
  img.src = src;
  img.alt = alt;
  if (className) img.className = className;
  
  img.onerror = () => {
    // Set a placeholder image based on alt text
    if (alt.toLowerCase().includes('face')) {
      img.src = getPlaceholderImage('face');
    } else if (alt.toLowerCase().includes('id')) {
      img.src = getPlaceholderImage('id');
    } else {
      img.src = getPlaceholderImage('credential');
    }
  };
  
  return img;
};
