/**
 * Mobile Offline Queue — SQLite-based order queue for React Native.
 *
 * Uporablja expo-sqlite za lokalno shranjevanje naročil ko ni interneta.
 * Ko internet vrne, se vsa čakajoča naročila samodejno pošljejo.
 */

import * as SQLite from "expo-sqlite";
import * as Network from "expo-network";
import { createOrder } from "./client";

const DB_NAME = "tasty_station_offline.db";

let db = null;

const initDB = async () => {
    if (db) return db;
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_data TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            last_attempt TEXT,
            error TEXT
        );
    `);
    return db;
};

export const enqueueOrder = async (orderData) => {
    const database = await initDB();
    await database.runAsync(
        "INSERT INTO offline_orders (order_data, status) VALUES (?, 'pending')",
        [JSON.stringify(orderData)]
    );
    console.log("[OfflineQueue] Order enqueued");
};

export const getPendingOrders = async () => {
    const database = await initDB();
    const rows = await database.getAllAsync(
        "SELECT * FROM offline_orders WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return rows || [];
};

export const updateOrderStatus = async (id, status, error = null) => {
    const database = await initDB();
    await database.runAsync(
        "UPDATE offline_orders SET status = ?, attempts = attempts + 1, last_attempt = datetime('now'), error = ? WHERE id = ?",
        [status, error, id]
    );
};

export const cleanSynced = async () => {
    const database = await initDB();
    await database.runAsync("DELETE FROM offline_orders WHERE status = 'synced'");
};

export const flushQueue = async () => {
    const pending = await getPendingOrders();
    if (pending.length === 0) return { flushed: 0, errors: 0 };

    let flushed = 0;
    let errors = 0;

    for (const record of pending) {
        if (record.attempts >= 5) {
            await updateOrderStatus(record.id, "failed", "Max retries exceeded");
            errors++;
            continue;
        }

        try {
            const orderData = JSON.parse(record.order_data);
            const res = await createOrder(orderData);

            if (res.data?.success) {
                await updateOrderStatus(record.id, "synced");
                flushed++;
            }
        } catch (error) {
            if (error.response?.status === 409) {
                await updateOrderStatus(record.id, "conflicted", "Duplicate");
            } else {
                await updateOrderStatus(record.id, "pending", error.message);
                errors++;
            }
        }
    }

    await cleanSynced();
    return { flushed, errors, remaining: pending.length - flushed - errors };
};

export const getPendingCount = async () => {
    const database = await initDB();
    const row = await database.getFirstAsync(
        "SELECT COUNT(*) as count FROM offline_orders WHERE status = 'pending'"
    );
    return row?.count || 0;
};

export const isOnline = async () => {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected && state.isInternetReachable;
};

/**
 * Auto-flush loop — kliči ob startupu in ko internet vrne.
 */
export const startAutoFlush = (onSyncComplete) => {
    const checkAndFlush = async () => {
        const online = await isOnline();
        if (!online) return;

        const count = await getPendingCount();
        if (count === 0) return;

        console.log(`[OfflineQueue] Auto-flushing ${count} orders...`);
        const result = await flushQueue();
        if (result.flushed > 0 && onSyncComplete) {
            onSyncComplete(result);
        }
    };

    // Check immediately
    checkAndFlush();

    // Check every 30 seconds
    const interval = setInterval(checkAndFlush, 30000);
    return () => clearInterval(interval);
};
