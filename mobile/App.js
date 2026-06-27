import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "./store/authStore";
import { startAutoFlush } from "./api/offlineQueue";
import { registerForPushNotifications } from "./api/notifications";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import MenuScreen from "./screens/MenuScreen";
import OrderScreen from "./screens/OrderScreen";
import KitchenScreen from "./screens/KitchenScreen";
import { StatusBar } from "expo-status-bar";

const Tab = createBottomTabNavigator();

const COLORS = {
    primary: "#0d9488",
    bg: "#0f172a",
    text: "#f8fafc",
    muted: "#64748b",
};

function AppTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: "#1e293b" },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.muted,
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="New Order"
                component={OrderScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Menu"
                component={MenuScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Kitchen"
                component={KitchenScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="flame" color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}

export default function App() {
    const { isAuthenticated, init } = useAuthStore();

    useEffect(() => {
        init();
    }, [init]);

    // Start offline auto-flush when authenticated
    useEffect(() => {
        if (!isAuthenticated) return;
        const stopFlush = startAutoFlush((result) => {
            console.log(`[AutoFlush] Synced ${result.flushed} orders`);
        });
        return stopFlush;
    }, [isAuthenticated]);

    // Register for push notifications when authenticated
    useEffect(() => {
        if (!isAuthenticated) return;
        registerForPushNotifications().then(token => {
            if (token) console.log("[Push] Registered:", token);
        });
    }, [isAuthenticated]);

    return (
        <>
            <StatusBar style="light" />
            <NavigationContainer>
                {isAuthenticated ? <AppTabs /> : <LoginScreen />}
            </NavigationContainer>
        </>
    );
}
