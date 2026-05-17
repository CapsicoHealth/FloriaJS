/* ===========================================================================
 * Copyright (C) 2025 CapsicoHealth Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/**
 * IndexedDB LRU Cache Module
 * Provides a persistent LRU cache implementation using IndexedDB with support for:
 * - Multiple stores with configurable max size and age
 * - Race condition handling for multi-tab scenarios
 * - Simple async/await interface
 */

const DB_NAME = "FloriaLRUCache";
const DB_VERSION = 1;

// Store metadata registry
const STORE_METADATA = new Map();

// Lock management for race condition prevention
const LOCK_REGISTRY = new Map();

/**
 * Acquire a lock for a specific operation to prevent race conditions
 * @param {string} key - Lock identifier
 * @returns {Promise<Function>} Release function
 */
async function acquireLock(key) {
  while (LOCK_REGISTRY.has(key)) {
    await LOCK_REGISTRY.get(key);
  }
  
  let releaseFn;
  const lockPromise = new Promise(resolve => {
    releaseFn = resolve;
  });
  
  LOCK_REGISTRY.set(key, lockPromise);
  
  return () => {
    LOCK_REGISTRY.delete(key);
    releaseFn();
  };
}

/**
 * Open or create the IndexedDB database
 * @param {string} storeName - Name of the object store
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create store if it doesn't exist
      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: "name" });
        objectStore.createIndex("name", "name", { unique: true });
        objectStore.createIndex("dt", "dt", { unique: false });
      }
    };
  });
}

/**
 * Ensure object store exists in the database
 * @param {string} storeName - Name of the object store
 * @returns {Promise<void>}
 */
async function ensureStoreExists(storeName) {
  const db = await openDatabase(storeName);
  
  // If store doesn't exist, we need to close and reopen with version bump
  if (!db.objectStoreNames.contains(storeName)) {
    const currentVersion = db.version;
    db.close();
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, currentVersion + 1);
      
      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const objectStore = db.createObjectStore(storeName, { keyPath: "name" });
          objectStore.createIndex("name", "name", { unique: true });
          objectStore.createIndex("dt", "dt", { unique: false });
        }
      };
    });
  }
  
  db.close();
}

/**
 * Get current timestamp
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Convert days to milliseconds
 * @param {number} days
 * @returns {number}
 */
function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

export var FloriaIndexedDBLRU = {
  
  /**
   * Create or retrieve an LRU cache store
   * @param {string} storeName - Name of the store
   * @param {number} maxSizeCount - Maximum number of entries in the store
   * @param {number} maxAgeDays - Maximum age of entries in days
   * @returns {Promise<Object>} Store configuration object
   */
  create: async function(storeName, maxSizeCount=20, maxAgeDays=7) {
    if (!storeName || typeof storeName !== "string") {
      throw new Error("storeName must be a non-empty string");
    }
    
    // Ensure the store exists in IndexedDB
    await ensureStoreExists(storeName);
    
    // Store metadata for this store
    const metadata = {
      storeName: storeName,
      maxSizeCount: maxSizeCount,
      maxAgeDays: maxAgeDays,
      maxAgeMs: daysToMs(maxAgeDays)
    };
    
    STORE_METADATA.set(storeName, metadata);
    
    return metadata;
  },
  
  /**
   * Get an entry from the cache
   * @param {string} storeName - Name of the store
   * @param {string} name - Key to retrieve
   * @returns {Promise<any|null>} The data if found and valid, null otherwise
   */
  get: async function(storeName, name) {
    if (!storeName || !name) {
      console.warn("FloriaIndexedDBLRU.get: storeName and name are required");
      return null;
    }
    
    const metadata = STORE_METADATA.get(storeName);
    if (!metadata) {
      console.warn("FloriaIndexedDBLRU.get: store '" + storeName + "' not created. Call create() first.");
      return null;
    }
    
    const release = await acquireLock(storeName + ":" + name);
    
    try {
      const db = await openDatabase(storeName);
      
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(name);
        
        request.onerror = () => {
          console.error("Error retrieving entry:", request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          const record = request.result;
          
          if (!record) {
            db.close();
            resolve(null);
            return;
          }
          
          // Check if record is expired
          const age = now() - record.dt;
          if (age > metadata.maxAgeMs) {
            // Record is expired, delete it
            const deleteRequest = objectStore.delete(name);
            
            deleteRequest.onerror = () => {
              console.error("Error deleting expired entry:", deleteRequest.error);
            };
            
            deleteRequest.onsuccess = () => {
              db.close();
              resolve(null);
            };
          } else {
            db.close();
            resolve(record.data);
          }
        };
      });
    } finally {
      release();
    }
  },
  
  /**
   * Put an entry into the cache
   * @param {string} storeName - Name of the store
   * @param {string} name - Key to store
   * @param {any} data - Data to store
   * @returns {Promise<void>}
   */
  put: async function(storeName, name, data) {
    if (!storeName || !name) {
      throw new Error("storeName and name are required");
    }
    
    const metadata = STORE_METADATA.get(storeName);
    if (!metadata) {
      throw new Error("Store '" + storeName + "' not created. Call create() first.");
    }
    
    const release = await acquireLock(storeName + ":" + name);
    
    try {
      const db = await openDatabase(storeName);
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        
        // Create the record
        const record = {
          name: name,
          dt: now(),
          data: data
        };
        
        // Put the record
        const putRequest = objectStore.put(record);
        
        putRequest.onerror = () => {
          console.error("Error putting entry:", putRequest.error);
          reject(putRequest.error);
        };
        
        putRequest.onsuccess = () => {
          // Check if we need to evict old entries
          const countRequest = objectStore.count();
          
          countRequest.onsuccess = () => {
            const count = countRequest.result;
            
            if (count > metadata.maxSizeCount) {
              // Need to delete oldest entries
              const index = objectStore.index("dt");
              const cursorRequest = index.openCursor(null, "next"); // Oldest first
              let deleteCount = count - metadata.maxSizeCount;
              
              cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor && deleteCount > 0) {
                  objectStore.delete(cursor.primaryKey);
                  deleteCount--;
                  cursor.continue();
                } else {
                  db.close();
                  resolve();
                }
              };
              
              cursorRequest.onerror = () => {
                console.error("Error during eviction:", cursorRequest.error);
                db.close();
                reject(cursorRequest.error);
              };
            } else {
              db.close();
              resolve();
            }
          };
          
          countRequest.onerror = () => {
            console.error("Error counting entries:", countRequest.error);
            db.close();
            reject(countRequest.error);
          };
        };
      });
    } finally {
      release();
    }
  },
  
  /**
   * Clear all entries from a store
   * @param {string} storeName - Name of the store
   * @returns {Promise<void>}
   */
  clear: async function(storeName) {
    if (!storeName) {
      throw new Error("storeName is required");
    }
    
    const release = await acquireLock(storeName + ":__clear__");
    
    try {
      const db = await openDatabase(storeName);
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.clear();
        
        request.onerror = () => {
          console.error("Error clearing store:", request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          db.close();
          resolve();
        };
      });
    } finally {
      release();
    }
  },
  
  /**
   * Delete a specific entry from the cache
   * @param {string} storeName - Name of the store
   * @param {string} name - Key to delete
   * @returns {Promise<void>}
   */
  delete: async function(storeName, name) {
    if (!storeName || !name) {
      throw new Error("storeName and name are required");
    }
    
    const release = await acquireLock(storeName + ":" + name);
    
    try {
      const db = await openDatabase(storeName);
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.delete(name);
        
        request.onerror = () => {
          console.error("Error deleting entry:", request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          db.close();
          resolve();
        };
      });
    } finally {
      release();
    }
  },
  
  /**
   * Get the count of entries in a store
   * @param {string} storeName - Name of the store
   * @returns {Promise<number>}
   */
  count: async function(storeName) {
    if (!storeName) {
      throw new Error("storeName is required");
    }
    
    const db = await openDatabase(storeName);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.count();
      
      request.onerror = () => {
        console.error("Error counting entries:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    });
  },
  
  /**
   * Get all keys in a store
   * @param {string} storeName - Name of the store
   * @returns {Promise<Array<string>>}
   */
  getAllKeys: async function(storeName) {
    if (!storeName) {
      throw new Error("storeName is required");
    }
    
    const db = await openDatabase(storeName);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.getAllKeys();
      
      request.onerror = () => {
        console.error("Error getting all keys:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    });
  }
};
