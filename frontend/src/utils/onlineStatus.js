/**
 * Online status hook — zazna online/offline in prikaže banner.
 *
 * Uporaba:
 *   import { useOnlineStatus } from '@/utils/onlineStatus';
 *   const { isOnline, pendingCount, retrySync } = useOnlineStatus();
 */

import { useState, useEffect, useCallback } from "react";
import { offlineQueue } from "./offlineQueue";
import axiosInstance from "../axios/axiosInstace";

export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Poslušaj online/offline event-e
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-flush ko internet vrne
            retrySync();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Tudi ping server vsakih 30s kot health check
        const healthCheck = setInterval(async () => {
            try {
                await axiosInstance.get("/users/me", { timeout: 5000 });
                if (!navigator.onLine) {
                    // Browser pravi offline, ampak server je dosegljiv
                    setIsOnline(true);
                }
            } catch (error) {
                if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") {
                    setIsOnline(false);
                }
            }
        }, 30000);

        // Osveži pending count
        const refreshCount = async () => {
            try {
                const count = await offlineQueue.getPendingCount();
                setPendingCount(count);
            } catch (e) {}
        };
        refreshCount();
        const countInterval = setInterval(refreshCount, 5000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            clearInterval(healthCheck);
            clearInterval(countInterval);
        };
    }, []);

    const retrySync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await offlineQueue.flush(axiosInstance);
            if (result.flushed > 0) {
                console.log(`[Offline] Synced ${result.flushed} operations`);
            }
            const count = await offlineQueue.getPendingCount();
            setPendingCount(count);
        } catch (error) {
            console.error("[Offline] Sync failed:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    return {
        isOnline,
        pendingCount,
        isSyncing,
        retrySync,
    };
};
