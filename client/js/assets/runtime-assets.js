/**
 * @fileoverview Runtime asset loader with caching and graceful fallback
 * 
 * Provides a caching layer for imported 3D assets (GLB/GLTF models, textures)
 * with fallback handling when assets fail to load.
 */

class RuntimeAssets {
  /**
   * @param {Object} options
   * @param {Function} options.loader - Async function to load an asset from a source path
   * @param {Function} options.fallbackFactory - Function to create fallback asset (key, source, error) => asset
   */
  constructor({ loader, fallbackFactory }) {
    this.loader = loader
    this.fallbackFactory = fallbackFactory
    this.cache = new Map()
  }

  /**
   * Load an asset by key, caching the result.
   * On load failure, creates a fallback via fallbackFactory.
   * 
   * @param {string} key - Unique cache key for the asset
   * @param {string} source - Source path/URL for the asset
   * @returns {Promise<any>} The loaded asset or fallback
   */
  async load(key, source) {
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    try {
      const loaded = await this.loader(source)
      this.cache.set(key, loaded)
      return loaded
    } catch (error) {
      const fallback = this.fallbackFactory(key, source, error)
      this.cache.set(key, fallback)
      return fallback
    }
  }
}

// Expose globally for browser runtime
window.RuntimeAssets = RuntimeAssets