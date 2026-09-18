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
 *
 * Logical stores (create/get/put/...) share one IndexedDB object store so adding a
 * cache never requires a version bump. If IndexedDB is missing, disabled by policy,
 * or fails to open, operations fall back to an in-memory LRU for the page session.
 *
 * Recency (`dt`) is updated on both put() and get(), so eviction is true LRU.
 * Cross-tab exclusion uses the Web Locks API when available; otherwise a per-page
 * mutex serializes same-tab callers only.
 */

const DB_NAME = "FloriaLRUCache";
const ENTRIES_STORE = "entries";
const OPEN_TIMEOUT_MS = 4000;
const KEY_SEP = "\x1f";

const STORE_METADATA = new Map();
const LOCK_REGISTRY = new Map();
const MEMORY = new Map(); // storeName -> Map(name -> {dt, data})

let _dbPromise = null;
let _persistent = false;
let _availabilityReason = "not initialized; call create() first";

function now() {
  return Date.now();
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function entryId(storeName, name) {
  return storeName + KEY_SEP + name;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * Per-page mutex. JS is single-threaded, so the only race is overlapping awaits.
 */
async function acquirePageLock(key) {
  while (LOCK_REGISTRY.has(key)) {
    await LOCK_REGISTRY.get(key);
  }
  let releaseFn;
  const lockPromise = new Promise(resolve => { releaseFn = resolve; });
  LOCK_REGISTRY.set(key, lockPromise);
  return () => {
    LOCK_REGISTRY.delete(key);
    releaseFn();
  };
}

/**
 * Prefer Web Locks (cross-tab). Fall back to an in-page mutex.
 */
async function withLock(key, fn) {
  if (typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function") {
    return navigator.locks.request("floria-lru:" + key, fn);
  }
  const release = await acquirePageLock(key);
  try {
    return await fn();
  } finally {
    release();
  }
}

function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isQuotaError(err) {
  if (err == null) return false;
  return err.name === "QuotaExceededError" || err.code === 22;
}

function indexedDBAvailable() {
  try {
    return typeof indexedDB !== "undefined" && indexedDB != null;
  } catch (e) {
    return false;
  }
}

function openIndexedDB(version) {
  return new Promise((resolve, reject) => {
    if (indexedDBAvailable() == false) {
      reject(new Error("IndexedDB is not present in this browser"));
      return;
    }

    let request;
    try {
      request = version == null ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    } catch (e) {
      reject(e);
      return;
    }

    request.onblocked = () => {
      console.warn("FloriaIndexedDBLRU: open/upgrade blocked by another tab holding the database");
    };

    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        _dbPromise = null;
      };
      db.onclose = () => {
        _dbPromise = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // v1 created one object store per logical cache. Collapse to a single store.
      const existing = Array.from(db.objectStoreNames);
      for (let i = 0; i < existing.length; ++i) {
        if (existing[i] !== ENTRIES_STORE)
          db.deleteObjectStore(existing[i]);
      }
      if (db.objectStoreNames.contains(ENTRIES_STORE) == false) {
        const os = db.createObjectStore(ENTRIES_STORE, { keyPath: "id" });
        os.createIndex("store", "store", { unique: false });
        os.createIndex("store_dt", ["store", "dt"], { unique: false });
      }
    };
  });
}

function openDatabase() {
  if (_dbPromise != null)
    return _dbPromise;

  _dbPromise = (async function() {
    const db = await openIndexedDB(null);
    if (db.objectStoreNames.contains(ENTRIES_STORE) == true)
      return db;
    const nextVersion = db.version + 1;
    db.close();
    return openIndexedDB(nextVersion);
  })();

  return _dbPromise;
}

async function probePersistent() {
  if (_persistent == true && _dbPromise != null)
    return true;
  if (indexedDBAvailable() == false) {
    _persistent = false;
    _availabilityReason = "IndexedDB is not present (disabled browser, private mode, or corporate policy).";
    return false;
  }
  try {
    await withTimeout(openDatabase(), OPEN_TIMEOUT_MS, "IndexedDB open");
    _persistent = true;
    _availabilityReason = null;
    return true;
  } catch (e) {
    _dbPromise = null;
    _persistent = false;
    _availabilityReason = (e && e.message) ? e.message : String(e);
    console.warn("FloriaIndexedDBLRU: falling back to in-memory cache:", _availabilityReason);
    return false;
  }
}

function degrade(reason) {
  _persistent = false;
  _availabilityReason = reason || "IndexedDB operation failed";
  _dbPromise = null;
  console.warn("FloriaIndexedDBLRU: " + _availabilityReason + " — using in-memory cache for this page session.");
}

function memMap(storeName) {
  let m = MEMORY.get(storeName);
  if (m == null) {
    m = new Map();
    MEMORY.set(storeName, m);
  }
  return m;
}

function memGet(storeName, name, metadata) {
  const m = memMap(storeName);
  const rec = m.get(name);
  if (rec == null)
    return null;
  if ((now() - rec.dt) > metadata.maxAgeMs) {
    m.delete(name);
    return null;
  }
  rec.dt = now();
  return rec.data;
}

function memPut(storeName, name, data, metadata) {
  const m = memMap(storeName);
  m.set(name, { dt: now(), data: data });
  while (m.size > metadata.maxSizeCount) {
    let oldestKey = null;
    let oldestDt = Infinity;
    for (const [k, v] of m) {
      if (v.dt < oldestDt) {
        oldestDt = v.dt;
        oldestKey = k;
      }
    }
    if (oldestKey == null)
      break;
    m.delete(oldestKey);
  }
}

function memDelete(storeName, name) {
  memMap(storeName).delete(name);
}

function memClear(storeName) {
  MEMORY.delete(storeName);
}

function memCount(storeName) {
  return memMap(storeName).size;
}

function memKeys(storeName) {
  return Array.from(memMap(storeName).keys());
}

function cursorDeleteOldest(index, range, n, skipId) {
  return new Promise((resolve, reject) => {
    if (n <= 0) {
      resolve(0);
      return;
    }
    const request = index.openCursor(range, "next");
    let left = n;
    let deleted = 0;
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor == null || left <= 0) {
        resolve(deleted);
        return;
      }
      if (skipId != null && cursor.value && cursor.value.id === skipId) {
        cursor.continue();
        return;
      }
      cursor.delete();
      deleted++;
      left--;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, name, metadata) {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES_STORE, "readwrite");
  const os = tx.objectStore(ENTRIES_STORE);
  const rec = await idbReq(os.get(entryId(storeName, name)));
  if (rec == null)
    return null;
  if ((now() - rec.dt) > metadata.maxAgeMs) {
    await idbReq(os.delete(rec.id));
    return null;
  }
  rec.dt = now();
  await idbReq(os.put(rec));
  return rec.data;
}

async function idbPut(storeName, name, data, metadata) {
  const db = await openDatabase();
  const id = entryId(storeName, name);
  const record = { id: id, store: storeName, name: name, dt: now(), data: data };

  const writeOnce = async function() {
    const tx = db.transaction(ENTRIES_STORE, "readwrite");
    const os = tx.objectStore(ENTRIES_STORE);
    await idbReq(os.put(record));
    const storeIndex = os.index("store");
    const count = await idbReq(storeIndex.count(IDBKeyRange.only(storeName)));
    if (count > metadata.maxSizeCount) {
      const dtIndex = os.index("store_dt");
      const range = IDBKeyRange.bound([storeName, 0], [storeName, Number.MAX_SAFE_INTEGER]);
      await cursorDeleteOldest(dtIndex, range, count - metadata.maxSizeCount, id);
    }
  };

  try {
    await writeOnce();
  } catch (e) {
    if (isQuotaError(e) == false)
      throw e;
    const tx = db.transaction(ENTRIES_STORE, "readwrite");
    const os = tx.objectStore(ENTRIES_STORE);
    const dtIndex = os.index("store_dt");
    const range = IDBKeyRange.bound([storeName, 0], [storeName, Number.MAX_SAFE_INTEGER]);
    const storeIndex = os.index("store");
    const count = await idbReq(storeIndex.count(IDBKeyRange.only(storeName)));
    await cursorDeleteOldest(dtIndex, range, Math.max(1, Math.ceil(count / 2)), id);
    await writeOnce();
  }
}

async function idbDelete(storeName, name) {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES_STORE, "readwrite");
  const os = tx.objectStore(ENTRIES_STORE);
  await idbReq(os.delete(entryId(storeName, name)));
}

async function idbClear(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES_STORE, "readwrite");
  const os = tx.objectStore(ENTRIES_STORE);
  const index = os.index("store");
  await new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(storeName));
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor == null) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function idbCount(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES_STORE, "readonly");
  const os = tx.objectStore(ENTRIES_STORE);
  return idbReq(os.index("store").count(IDBKeyRange.only(storeName)));
}

async function idbKeys(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(ENTRIES_STORE, "readonly");
  const os = tx.objectStore(ENTRIES_STORE);
  const index = os.index("store");
  return new Promise((resolve, reject) => {
    const keys = [];
    const request = index.openCursor(IDBKeyRange.only(storeName));
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor == null) {
        resolve(keys);
        return;
      }
      keys.push(cursor.value.name);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function requireMetadata(storeName, method) {
  const metadata = STORE_METADATA.get(storeName);
  if (metadata == null)
    throw new Error("FloriaIndexedDBLRU." + method + ": store '" + storeName + "' not created. Call create() first.");
  return metadata;
}

export var FloriaIndexedDBLRU = {

  /**
   * Create (or reconfigure) a logical cache store.
   * Never throws because of IndexedDB unavailability — falls back to memory.
   * @returns {Promise<Object>} Store metadata including `persistent`
   */
  create: async function(storeName, maxSizeCount=20, maxAgeDays=7) {
    if (!storeName || typeof storeName !== "string")
      throw new Error("storeName must be a non-empty string");
    if (typeof maxSizeCount !== "number" || maxSizeCount < 1)
      throw new Error("maxSizeCount must be a positive number");
    if (typeof maxAgeDays !== "number" || maxAgeDays <= 0)
      throw new Error("maxAgeDays must be a positive number");

    const persistent = await probePersistent();
    const metadata = {
      storeName: storeName,
      maxSizeCount: maxSizeCount,
      maxAgeDays: maxAgeDays,
      maxAgeMs: daysToMs(maxAgeDays),
      persistent: persistent
    };
    STORE_METADATA.set(storeName, metadata);
    return metadata;
  },

  /**
   * Whether the last create()/probe succeeded in opening IndexedDB.
   * False means get/put are in-memory only for this page session.
   */
  isPersistent: function() {
    return _persistent == true;
  },

  /**
   * @returns {{persistent:boolean, reason:string|null}}
   */
  getAvailability: function() {
    return { persistent: _persistent == true, reason: _availabilityReason };
  },

  get: async function(storeName, name) {
    if (!storeName || !name) {
      console.warn("FloriaIndexedDBLRU.get: storeName and name are required");
      return null;
    }
    const metadata = STORE_METADATA.get(storeName);
    if (metadata == null) {
      console.warn("FloriaIndexedDBLRU.get: store '" + storeName + "' not created. Call create() first.");
      return null;
    }

    return withLock(storeName, async () => {
      if (_persistent == true) {
        try {
          return await idbGet(storeName, name, metadata);
        } catch (e) {
          degrade("IndexedDB get failed: " + (e && e.message ? e.message : e));
        }
      }
      return memGet(storeName, name, metadata);
    });
  },

  put: async function(storeName, name, data) {
    if (!storeName || !name)
      throw new Error("storeName and name are required");
    const metadata = requireMetadata(storeName, "put");

    return withLock(storeName, async () => {
      if (_persistent == true) {
        try {
          await idbPut(storeName, name, data, metadata);
          return;
        } catch (e) {
          if (e && e.name === "DataCloneError")
            throw e;
          degrade("IndexedDB put failed: " + (e && e.message ? e.message : e));
        }
      }
      memPut(storeName, name, data, metadata);
    });
  },

  clear: async function(storeName) {
    if (!storeName)
      throw new Error("storeName is required");
    requireMetadata(storeName, "clear");

    return withLock(storeName, async () => {
      memClear(storeName);
      if (_persistent == true) {
        try {
          await idbClear(storeName);
        } catch (e) {
          degrade("IndexedDB clear failed: " + (e && e.message ? e.message : e));
        }
      }
    });
  },

  delete: async function(storeName, name) {
    if (!storeName || !name)
      throw new Error("storeName and name are required");
    requireMetadata(storeName, "delete");

    return withLock(storeName, async () => {
      memDelete(storeName, name);
      if (_persistent == true) {
        try {
          await idbDelete(storeName, name);
        } catch (e) {
          degrade("IndexedDB delete failed: " + (e && e.message ? e.message : e));
        }
      }
    });
  },

  count: async function(storeName) {
    if (!storeName)
      throw new Error("storeName is required");
    requireMetadata(storeName, "count");
    if (_persistent == true) {
      try {
        return await idbCount(storeName);
      } catch (e) {
        degrade("IndexedDB count failed: " + (e && e.message ? e.message : e));
      }
    }
    return memCount(storeName);
  },

  getAllKeys: async function(storeName) {
    if (!storeName)
      throw new Error("storeName is required");
    requireMetadata(storeName, "getAllKeys");
    if (_persistent == true) {
      try {
        return await idbKeys(storeName);
      } catch (e) {
        degrade("IndexedDB getAllKeys failed: " + (e && e.message ? e.message : e));
      }
    }
    return memKeys(storeName);
  }
};