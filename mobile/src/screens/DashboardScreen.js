import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { getStats, getMyOrders } from "../api/client";
import { useAuthStore } from "../store/authStore";

const C = { primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", muted: "#94a3b8", green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b" };

export default function DashboardScreen() {
    const { user, logout } = useAuthStore();
    const [stats, setStats] = useState(null);
    const [orders, setOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [s, o] = await Promise.all([getStats(), getMyOrders()]);
            setStats(s.data.stats); setOrders(o.data.orders || []);
        } catch (e) { console.error(e); }
        finally { setRefreshing(false); }
    };

    useEffect(() => { loadData(); const i = setInterval(loadData, 30000); return () => clearInterval(i); }, []);

    return (
        <SafeAreaView style={s2.container}>
            <View style={s2.headerRow}>
                <View><Text style={s2.header}>Dashboard</Text><Text style={s2.userName}>Welcome, {user?.name || "User"}</Text></View>
                <TouchableOpacity onPress={logout} style={s2.logoutBtn}><Text style={s2.logoutText}>Logout</Text></TouchableOpacity>
            </View>
            <View style={s2.statsRow}>
                <View style={s2.statCard}><Text style={s2.statLabel}>Revenue</Text><Text style={[s2.statValue, { color: C.green }]}>€{(stats?.totalRevenue || 0).toFixed(0)}</Text></View>
                <View style={s2.statCard}><Text style={s2.statLabel}>Orders</Text><Text style={[s2.statValue, { color: C.blue }]}>{stats?.totalOrders || 0}</Text></View>
                <View style={s2.statCard}><Text style={s2.statLabel}>Pending</Text><Text style={[s2.statValue, { color: C.amber }]}>{stats?.pendingOrders || 0}</Text></View>
            </View>
            <Text style={s2.sectionTitle}>Recent Orders</Text>
            <FlatList
                data={orders.slice(0, 10)}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <View style={s2.orderRow}>
                        <View style={{ flex: 1 }}><Text style={s2.orderCustomer}>{item.clientName || "Guest"}</Text><Text style={s2.orderMeta}>{item.orderId} • {item.items?.length || 0} items</Text></View>
                        <Text style={s2.orderTotal}>€{(item.totalAmount || 0).toFixed(2)}</Text>
                    </View>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.primary} />}
                contentContainerStyle={{ padding: 16, gap: 8 }}
            />
        </SafeAreaView>
    );
}

const s2 = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
    header: { color: C.text, fontSize: 24, fontWeight: "bold" },
    userName: { color: C.muted, fontSize: 12, marginTop: 2 },
    logoutBtn: { backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    logoutText: { color: C.amber, fontSize: 12, fontWeight: "600" },
    statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
    statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: "center" },
    statLabel: { color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
    statValue: { fontSize: 20, fontWeight: "bold", marginTop: 4 },
    sectionTitle: { color: C.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 16, paddingTop: 8 },
    orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 14 },
    orderCustomer: { color: C.text, fontSize: 14, fontWeight: "600" },
    orderMeta: { color: C.muted, fontSize: 11, marginTop: 2 },
    orderTotal: { color: C.primary, fontSize: 16, fontWeight: "bold" },
});
