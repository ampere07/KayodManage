/**
 * Icon Cache Service
 * Preloads and caches profession icons for faster loading
 */

interface CachedIcon {
  url: string;
  blob: Blob;
  objectUrl: string;
  timestamp: number;
}

class IconCacheService {
  private cache: Map<string, CachedIcon> = new Map();
  private preloadQueue: Set<string> = new Set();
  private isPreloading = false;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CONCURRENT_DOWNLOADS = 6;

  /**
   * Preload profession icons from the categories
   */
  async preloadProfessionIcons(categories: any[]): Promise<void> {
    if (this.isPreloading) {
      console.log('[IconCache] Preload already in progress');
      return;
    }

    this.isPreloading = true;
    console.log('[IconCache] Starting profession icons preload');

    const iconUrls = new Set<string>();

    // Collect all unique icon URLs from categories and professions
    categories.forEach(category => {
      if (category.icon && category.icon.startsWith('ik:')) {
        const url = this.convertIkPathToUrl(category.icon);
        iconUrls.add(url);
      }

      category.professions?.forEach((profession: any) => {
        if (profession.icon && profession.icon.startsWith('ik:')) {
          const url = this.convertIkPathToUrl(profession.icon);
          iconUrls.add(url);
        }
      });
    });

    console.log(`[IconCache] Found ${iconUrls.size} unique icons to preload`);

    // Add to preload queue
    iconUrls.forEach(url => this.preloadQueue.add(url));

    // Process queue with concurrency limit
    await this.processPreloadQueue();

    this.isPreloading = false;
    console.log(`[IconCache] Preload complete. Cached ${this.cache.size} icons`);
  }

  /**
   * Process the preload queue with concurrency control
   */
  private async processPreloadQueue(): Promise<void> {
    const urls = Array.from(this.preloadQueue);
    this.preloadQueue.clear();

    // Process in batches
    for (let i = 0; i < urls.length; i += this.MAX_CONCURRENT_DOWNLOADS) {
      const batch = urls.slice(i, i + this.MAX_CONCURRENT_DOWNLOADS);
      await Promise.allSettled(batch.map(url => this.cacheIcon(url)));
    }
  }

  /**
   * Cache a single icon
   */
  private async cacheIcon(url: string): Promise<void> {
    // Check if already cached and not expired
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return;
    }

    try {
      // Add optimization parameters to ImageKit URL
      const optimizedUrl = this.addImageKitOptimizations(url);
      
      const response = await fetch(optimizedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Clean up old object URL if exists
      if (cached?.objectUrl) {
        URL.revokeObjectURL(cached.objectUrl);
      }

      this.cache.set(url, {
        url,
        blob,
        objectUrl,
        timestamp: Date.now(),
      });

      console.log(`[IconCache] Cached: ${url.split('/').pop()}`);
    } catch (error) {
      console.error(`[IconCache] Failed to cache ${url}:`, error);
    }
  }

  /**
   * Get cached icon URL or return optimized ImageKit URL
   * Note: We preload images to warm up the browser cache, but return
   * optimized ImageKit URLs instead of blob URLs to avoid lifecycle issues
   */
  getCachedIconUrl(ikPath: string): string {
    const url = this.convertIkPathToUrl(ikPath);
    
    // Always return optimized ImageKit URL
    // The preloading ensures the image is in browser cache for instant display
    return this.addImageKitOptimizations(url);
  }

  /**
   * Convert ik: path to full ImageKit URL
   */
  private convertIkPathToUrl(ikPath: string): string {
    const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/9vpn8u272';
    if (ikPath.startsWith('ik:')) {
      const path = ikPath.replace('ik:', '');
      return `${IMAGEKIT_URL_ENDPOINT}${path}`;
    }
    return ikPath;
  }

  /**
   * Add ImageKit optimization parameters to URL
   */
  private addImageKitOptimizations(url: string): string {
    if (!url.includes('ik.imagekit.io')) {
      return url;
    }

    // Add transformation parameters for faster loading
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tr=w-256,h-256,q-80,f-auto`;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.cache.forEach((cached, url) => {
      if (now - cached.timestamp >= this.CACHE_DURATION) {
        URL.revokeObjectURL(cached.objectUrl);
        expired.push(url);
      }
    });

    expired.forEach(url => this.cache.delete(url));
    
    if (expired.length > 0) {
      console.log(`[IconCache] Cleared ${expired.length} expired cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.forEach(cached => {
      URL.revokeObjectURL(cached.objectUrl);
    });
    this.cache.clear();
    console.log('[IconCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const iconCacheService = new IconCacheService();
