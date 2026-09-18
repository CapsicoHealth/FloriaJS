# IndexedDB LRU Cache Module

`WebContent/floria.v2.0/module-indexdb-lru.js` is a small persistent LRU cache built on IndexedDB.

Logical caches (`create('apiCache', ...)`) are **not** separate IndexedDB object stores. They share one physical store (`entries` in database `FloriaLRUCache`) so adding a cache never requires a schema version bump — the original v1 design opened the DB at a hardcoded version and then bumped it per store, which broke as soon as a second store was created.

The module opens the existing database at whatever version the browser already has, then upgrades only if `entries` is missing. Old per-store object stores are dropped (cache data is not migrated).

## When IndexedDB is unavailable

IndexedDB can be missing or unusable:

- Browser / OS / enterprise policy (`IndexedDBEnabled`, `dom.indexedDB.enabled`)
- Some private/incognito modes (historically Safari)
- Storage partitioned or blocked
- Open blocked by another tab during a version upgrade (this module times out and degrades)

**localStorage is not a fallback.** Quota is ~5MB and JSON stringify of a large payload will throw. The module instead keeps an in-memory LRU for the **current page session** and `isPersistent()` returns `false`. Callers that care (e.g. cohort insights) should warn the user that reloads will refetch.

```javascript
await FloriaIndexedDBLRU.create('apiCache', 100, 7);
if (FloriaIndexedDBLRU.isPersistent() == false) {
    const { reason } = FloriaIndexedDBLRU.getAvailability();
    console.warn('Cache is memory-only:', reason);
}
```

## Import

From Floria app code (mounted as `/static/floria.v2.0/`):

```javascript
import { FloriaIndexedDBLRU } from "/static/floria.v2.0/module-indexdb-lru.js";
```

From this docs folder (needs a local http server; ES modules will not load from `file://`):

```javascript
import { FloriaIndexedDBLRU } from '../WebContent/floria.v2.0/module-indexdb-lru.js';
```

## API

### create(storeName, maxSizeCount=20, maxAgeDays=7)

Registers a logical store. Safe to call more than once (last size/age wins). Does **not** throw if IndexedDB cannot be opened — it falls back to memory.

Returns the metadata object, including `persistent`.

### get(storeName, name) → Promise<any|null>

Returns the value, or `null` if missing/expired. A successful get **touches** recency, so eviction is true LRU (the previous implementation only updated `dt` on put, i.e. FIFO). Expired rows are deleted.

### put(storeName, name, data) → Promise<void>

Stores structured-cloneable data. If the logical store is over `maxSizeCount`, the least-recently-used entries (oldest `dt`) are deleted. `QuotaExceededError` evicts half the store and retries once; if IndexedDB still fails, the write is kept in memory and the module degrades.

### delete(storeName, name) / clear(storeName)

Remove one key, or every key in that logical store.

### count(storeName) / getAllKeys(storeName)

Entry count and the logical keys (`name` values, not internal composite ids).

### isPersistent() / getAvailability()

`isPersistent()` is `true` only after a successful IndexedDB open. `getAvailability()` returns `{ persistent, reason }`.

## Typical pattern

```javascript
import { FloriaIndexedDBLRU } from "/static/floria.v2.0/module-indexdb-lru.js";

await FloriaIndexedDBLRU.create('apiCache', 100, 7);

async function fetchData(key, url) {
    let data = await FloriaIndexedDBLRU.get('apiCache', key);
    if (data == null) {
        const response = await fetch(url);
        data = await response.json();
        await FloriaIndexedDBLRU.put('apiCache', key, data);
    }
    return data;
}
```

Application-level freshness (e.g. a server `lastPublished` stamp) is **your** responsibility. This module only expires by age and evicts by LRU.

## Schema

Physical object store `entries`:

```javascript
{
    id:    storeName + '\x1f' + name, // keyPath
    store: storeName,                 // index "store"
    name:  name,
    dt:    number,                    // last get/put; index "store_dt"
    data:  any                        // structured-cloneable
}
```

Inspect in DevTools → Application → IndexedDB → `FloriaLRUCache` → `entries`.

## Concurrency

- **Same tab:** mutating operations on a logical store are serialized with an in-page mutex.
- **Other tabs:** `navigator.locks` is used when the browser provides it. Without Web Locks, IndexedDB transactions still isolate writes, but two tabs can each evict based on a stale count. That is acceptable for a cache.
- The in-memory `Map` used in earlier versions did **not** coordinate across tabs, despite what the old docs claimed.

## Data rules

- Values must be structured-cloneable (no functions, DOM nodes, or `Promise`s). `DataCloneError` is rethrown.
- Do not put live class instances if you need methods after `get()` — store plain JSON and re-wrap.
- Origin quota is browser-dependent (tens of MB to more than 1GB). Huge values can still fail; the memory fallback will hold them only until reload.

## Demo

`docs/module-indexdb-lru-example.html` — serve the FloriaJS repo over http and open that file.