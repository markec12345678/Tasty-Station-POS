import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { getKitchenOrders, updateOrderStatus } from "../api/client";

const C = { primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", muted: "#94a3b8", amber: "#f59e0b", blue: "#3b82f6", green: "#22c55e" };
const STATUS_COLORS = { Pending: C.amber, Preparing: C.blue, Ready: C.green };
const STATUS_ACTIONS = { Pending: { next: "Preparing", label: "Accept" }, Preparing: { next: "Ready", label: "Mark Ready" }, Ready: { next: "Completed", label: "Done" } };

export default function KitchenScreen() {
    const [orders, setOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadOrders = async () => {
        try { const res = await getKitchenOrders(); setOrders(res.data.orders || []); }
        catch (e) { console.error(e); }
        finally { setRefreshing(false); }
    };

    useEffect(() => { loadOrders(); const i = setInterval(loadOrders, 10000); return () => clearInterval(i); }, []);

    const handleStatus = async (id, next) => { try { await updateOrderStatus(id, next); loadOrders(); } catch (e) {} };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.headerRow}>
                <Text style={s.header}>Kitchen</Text>
                <View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text>
            </View>
            <FlatList
                data={orders}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                    const action = STATUS_ACTIONS[item.status];
                    return (
                        <View style={s.orderCard}>
                            <View style={s.orderHeader}>
                                <Text style={s.orderId}>#{item.orderId?.slice(-6)}</Text>
                                <View style={[s.badge, { backgroundColor: STATUS_COLORS[item.status] + "30" }]}>
                                    <Text style={[s.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
                                </View>
                            </View>
                            <Text style={s.customer}>{item.clientName || "Guest"}</Text>
                            {item.table?.name && <Text style={s.table}>Table: {item.table.name}</Text>}
                            <View style={s.items}>
                                {item.items?.map((it, i) => (
                                    <View key={i} style={s.itemRow}>
                                        <Text style={s.qty}>{it.quantity}×</Text>
                                        <Text style={s.itemName}>{it.name}</Text>
                                    </View>
                                ))}
                            </View>
                            {action && (
                                <TouchableOpacity style={[s.btn, { backgroundColor: STATUS_COLORS[item.status] }]} onPress={() => handleStatus(item._id, action.next)}>
                                    <Text style={s.btnText}>{action.label} →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrders} tintColor={C.primary} />}
                contentContainerStyle={{ padding: 16, gap: 12 }}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    headerRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
    header: { color: C.text, fontSize: 24, fontWeight: "bold" },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
    liveText: { color: C.green, fontSize: 10, fontWeight: "bold" },
    orderCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 12 },
    orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    orderId: { color: C.text, fontSize: 14, fontWeight: "bold" },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: "bold" },
    customer: { color: C.text, fontSize: 16, fontWeight: "600" },
    table: { color: C.muted, fontSize: 12, marginTop: 2 },
    items: { marginTop: 12, gap: 6 },
    itemRow: { flexDirection: "row", alignItems: "flex-start" },
    qty: { color: C.primary, fontSize: 14, fontWeight: "bold", marginRight: 8 },
    itemName: { color: C.text, fontSize: 14, flex: 1 },
    btn: { borderRadius: 8, padding: 12, alignItems: "center", marginTop: 12 },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});
