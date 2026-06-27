/**
 * OfflineQueue — IndexedDB-based order queue for offline resilience.
 *
 * Kadarkoli POST /api/orders ali /api/public/order faila (network error),
 * se order shrani v IndexedDB in se samodejno retry-a ko internet vrne.
 *
 * Delovanje:
 *   1. onlineStatus.js zazna offline → prikaže banner
 *   2. OfflineQueue.enqueue(orderData) shrani v IndexedDB
 *   3. Ko internet vrne, OfflineQueue.flush() pošlje vse čakajoče
 *   4. Conflict resolution: če server vrne 409 (duplicate), označi kot conflicted
 */

const DB_NAME = "tasty-station-pos";
const DB_VERSION = 1;
const STORE_NAME = "offline-queue";

let db = null;

const openDB = () => {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB not supported"));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                store.createIndex("status", "status", { unique: false });
                store.createIndex("createdAt", "createdAt", { unique: false });
                store.createIndex("type", "type", { unique: false });
            }
        };
    });
};

const ensureDB = async () => {
    if (!db) {
        await openDB();
    }
    return db;
};

/**
 * Doda operacijo v offline queue.
 *
 * @param {Object} data — podatki o operaciji
 *   - type: "order" | "payment" | "status-update"
 *   - endpoint: API URL (npr. "/api/orders")
 *   - method: "POST" | "PATCH"
 *   - body: request body
 *   - tableId: povezana miza (za prikaz)
 * @returns {Number} ID v queue-ju
 */
const enqueue = async (data) => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const record = {
            ...data,
            status: "pending",
            attempts: 0,
            createdAt: new Date().toISOString(),
            lastAttempt: null,
        };

        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Pridrne vse čakajoče operacije.
 */
const getPending = async () => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("status");
        const request = index.getAll("pending");
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Posodobi status zapisa v queue-ju.
 */
const updateStatus = async (id, status, error = null) => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const record = getRequest.result;
            if (!record) return resolve(null);

            record.status = status;
            record.lastAttempt = new Date().toISOString();
            record.attempts = (record.attempts || 0) + 1;
            if (error) record.error = error;
            if (status === "synced") record.syncedAt = new Date().toISOString();

            const putRequest = store.put(record);
            putRequest.onsuccess = () => resolve(record);
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

/**
 * Izbriše syncane zapise (cleanup).
 */
const cleanSynced = async () => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("status");
        const request = index.openCursor("synced");

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Pošlje vse pending operacije na server.
 * Uporablja exponential backoff (attempts × 2s, max 30s).
 */
const flush = async (axiosInstance) => {
    const pending = await getPending();
    if (pending.length === 0) return { flushed: 0, errors: 0 };

    let flushed = 0;
    let errors = 0;

    for (const record of pending) {
        // Exponential backoff — če je bil pred kratkim poskus, počakaj
        if (record.lastAttempt) {
            const backoffMs = Math.min(record.attempts * 2000, 30000);
            const elapsed = Date.now() - new Date(record.lastAttempt).getTime();
            if (elapsed < backoffMs) continue;
        }

        // Max 5 poskusov, potem označi kot failed
        if (record.attempts >= 5) {
            await updateStatus(record.id, "failed", "Max retry attempts exceeded");
            errors++;
            continue;
        }

        try {
            const config = {
                method: record.method || "POST",
                url: record.endpoint,
            };
            if (record.body) config.data = record.body;

            const response = await axiosInstance(config);

            if (response.status >= 200 && response.status < 300) {
                await updateStatus(record.id, "synced");
                flushed++;
            } else {
                // Conflict (409) — verjetno duplikat, označi kot synced
                if (response.status === 409) {
                    await updateStatus(record.id, "conflicted", "Duplicate order detected");
                } else {
                    await updateStatus(record.id, "pending", `HTTP ${response.status}`);
                    errors++;
                }
            }
        } catch (error) {
            // Network error — ostane pending, poskusi kasneje
            await updateStatus(record.id, "pending", error.message);
            errors++;
        }
    }

    // Clean up synced records
    await cleanSynced();

    return { flushed, errors, remaining: pending.length - flushed - errors };
};

/**
 * Vrne število čakajočih operacij (za UI indicator).
 */
const getPendingCount = async () => {
    const pending = await getPending();
    return pending.length;
};

/**
 * Vrne vse zapise (za debug UI).
 */
const getAll = async () => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Izbriše vse zapise (za debug/cleanup).
 */
const clearAll = async () => {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
        const tx = database.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const offlineQueue = {
    enqueue,
    getPending,
    updateStatus,
    flush,
    getPendingCount,
    getAll,
    clearAll,
    cleanSynced,
};
