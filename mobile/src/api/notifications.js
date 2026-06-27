/**
 * Push notification service for React Native mobile app.
 * Uses expo-notifications for cross-platform push (Android FCM + iOS APNs).
 *
 * Setup:
 *   1. npm install expo-notifications
 *   2. app.json: add "expo-notifications" plugin
 *   3. Register push token with backend
 *   4. Backend sends push via Expo Push API
 *
 * Flow:
 *   Mobile app → registerForPushNotifications() → get Expo push token
 *   → POST /api/users/push-token → store on User model
 *   Backend → sendPushNotification(token, title, body) → Expo Push API
 *   → delivered to device (FCM Android / APNs iOS)
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import api from "./client";

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Request permission and get Expo push token.
 * Call this on app startup after login.
 *
 * @returns {string|null} Expo push token or null if denied
 */
export const registerForPushNotifications = async () => {
    try {
        // Check existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request if not granted
        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            console.log("[Push] Permission denied");
            return null;
        }

        // Get Expo push token
        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: "tasty-station-pos",
        })).data;

        console.log("[Push] Token:", token);

        // Register with backend
        try {
            await api.post("/users/push-token", { pushToken: token });
            console.log("[Push] Token registered with backend");
        } catch (e) {
            console.warn("[Push] Failed to register token:", e.message);
        }

        // Configure Android channel
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("orders", {
                name: "Orders",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#0d9488",
                sound: true,
            });
            await Notifications.setNotificationChannelAsync("kitchen", {
                name: "Kitchen",
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 250, 500],
                lightColor: "#f59e0b",
                sound: true,
            });
        }

        return token;
    } catch (error) {
        console.error("[Push] Registration error:", error);
        return null;
    }
};

/**
 * Listen for incoming notifications while app is foregrounded.
 *
 * @param {Function} callback — (notification) => void
 * @returns {Function} cleanup function
 */
export const useNotificationListener = (callback) => {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
};

/**
 * Listen for notification taps (when user taps notification to open app).
 *
 * @param {Function} callback — (response) => void
 * @returns {Function} cleanup function
 */
export const useNotificationTapListener = (callback) => {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
};

/**
 * Schedule a local notification (no server needed).
 * Useful for order-ready alerts when app is in background.
 *
 * @param {Object} params — { title, body, data, channelId, seconds }
 */
export const scheduleLocalNotification = async (params) => {
    const { title, body, data = {}, channelId = "orders", seconds = 0 } = params;

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: true,
            channelId,
        },
        trigger: seconds > 0 ? { seconds } : null,
    });

    return id;
};

/**
 * Cancel all scheduled notifications.
 */
export const cancelAllNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Get badge count.
 */
export const getBadgeCount = async () => {
    return await Notifications.getBadgeCountAsync();
};

/**
 * Set badge count.
 */
export const setBadgeCount = async (count) => {
    await Notifications.setBadgeCountAsync(count);
};
