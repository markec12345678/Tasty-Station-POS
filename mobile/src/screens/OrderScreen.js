import React, { useEffect, useState, useCallback } from "react";
import {
    SafeAreaView, View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, Modal, TextInput, Alert
} from "react-native";
import { getMenu, getTables, createOrder } from "../api/client";
import { enqueueOrder, isOnline, startAutoFlush } from "../api/offlineQueue";
import { Ionicons } from "@expo/vector-icons";

const C = {
    primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc",
    muted: "#94a3b8", border: "#334155", green: "#22c55e", red: "#ef4444",
    amber: "#f59e0b", blue: "#3b82f6",
};

export default function OrderScreen() {
    const [menu, setMenu] = useState([]);
    const [tables, setTables] = useState([]);
    const [cart, setCart] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [showTables, setShowTables] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        try {
            const [menuRes, tableRes] = await Promise.all([getMenu(), getTables()]);
            setMenu(menuRes.data.items || []);
            setTables(tableRes.data.tables || []);
        } catch (e) {
            console.error("Load error:", e);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(c => c._id === item._id);
            if (existing) {
                return prev.map(c => c._id === item._id ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { ...item, qty: 1 }];
        });
    };

    const removeFromCart = (id) => {
        setCart(prev => {
            const existing = prev.find(c => c._id === id);
            if (existing && existing.qty > 1) {
                return prev.map(c => c._id === id ? { ...c, qty: c.qty - 1 } : c);
            }
            return prev.filter(c => c._id !== id);
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const handlePlaceOrder = async () => {
        if (cart.length === 0) return;
        if (!customerName.trim()) {
            Alert.alert("Info", "Vnesite ime stranke");
            return;
        }

        const orderData = {
            type: selectedTable ? "Dine-in" : "Takeaway",
            paymentMethod: "Cash",
            items: cart.map(item => ({
                menuItem: item._id,
                quantity: item.qty,
            })),
            clientName: customerName,
            clientPhone: "",
            tableId: selectedTable?._id || null,
        };

        setSubmitting(true);

        // Check if online
        const online = await isOnline();

        if (!online) {
            // Offline — enqueue to SQLite
            await enqueueOrder(orderData);
            Alert.alert("📱 Offline", "Naročilo shranjeno lokalno. Poslano bo ko internet vrne.");
            setCart([]);
            setCustomerName("");
            setSelectedTable(null);
            setShowCart(false);
            setSubmitting(false);
            return;
        }

        try {
            await createOrder(orderData);
            Alert.alert("✅ Uspeh", "Naročilo oddano!");
            setCart([]);
            setCustomerName("");
            setSelectedTable(null);
            setShowCart(false);
        } catch (e) {
            // Network error — try offline queue
            if (e.code === "ERR_NETWORK" || !e.response) {
                await enqueueOrder(orderData);
                Alert.alert("📱 Offline", "Brez povezave — naročilo shranjeno lokalno.");
                setCart([]);
                setCustomerName("");
                setSelectedTable(null);
                setShowCart(false);
            } else {
                const msg = e.response?.data?.message || "Napaka pri oddaji";
                Alert.alert("❌ Napaka", msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={s.menuItem} onPress={() => addToCart(item)}>
            <View style={s.menuLeft}>
                <View style={[s.vegBadge, { backgroundColor: item.isVeg ? C.green : C.red }]}>
                    <Text style={s.vegText}>{item.isVeg ? "V" : "N"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.menuName}>{item.name}</Text>
                    <Text style={s.menuDesc} numberOfLines={1}>{item.description}</Text>
                    <View style={s.badgeRow}>
                        {item.spiceLevel && item.spiceLevel !== "mild" && (
                            <View style={[s.spiceBadge, { backgroundColor: C.amber + "30" }]}>
                                <Text style={[s.spiceText, { color: C.amber }]}>{item.spiceLevel}</Text>
                            </View>
                        )}
                        <Text style={s.prepTime}>~{item.preparationTime || 15}min</Text>
                    </View>
                </View>
            </View>
            <View style={s.menuRight}>
                <Text style={s.menuPrice}>€{item.price.toFixed(2)}</Text>
                <Ionicons name="add-circle" size={24} color={C.primary} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={s.headerRow}>
                <Text style={s.header}>New Order</Text>
                <TouchableOpacity onPress={() => setShowTables(true)} style={s.tableBtn}>
                    <Ionicons name="restaurant" size={16} color={C.text} />
                    <Text style={s.tableBtnText}>
                        {selectedTable ? selectedTable.name : "Select Table"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Menu list */}
            <FlatList
                data={menu}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.primary} />}
                contentContainerStyle={{ padding: 16, gap: 8 }}
            />

            {/* Floating cart bar */}
            {cartCount > 0 && (
                <TouchableOpacity style={s.cartBar} onPress={() => setShowCart(true)}>
                    <View style={s.cartLeft}>
                        <Ionicons name="cart" size={20} color="#fff" />
                        <Text style={s.cartCount}>{cartCount}</Text>
                    </View>
                    <Text style={s.cartTotal}>€{cartTotal.toFixed(2)}</Text>
                    <Text style={s.cartAction}>Review →</Text>
                </TouchableOpacity>
            )}

            {/* Cart Modal */}
            <Modal visible={showCart} animationType="slide" transparent={true}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Cart ({cartCount})</Text>
                            <TouchableOpacity onPress={() => setShowCart(false)}>
                                <Ionicons name="close" size={24} color={C.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Customer name */}
                        <TextInput
                            style={s.input}
                            placeholder="Customer name"
                            placeholderTextColor={C.muted}
                            value={customerName}
                            onChangeText={setCustomerName}
                        />

                        {/* Selected table */}
                        {selectedTable && (
                            <View style={s.selectedTableRow}>
                                <Ionicons name="restaurant" size={16} color={C.primary} />
                                <Text style={s.selectedTableText}>Table: {selectedTable.name} ({selectedTable.zone})</Text>
                                <TouchableOpacity onPress={() => { setSelectedTable(null); setShowTables(true); }}>
                                    <Text style={s.changeText}>Change</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Cart items */}
                        <FlatList
                            data={cart}
                            keyExtractor={(item) => item._id}
                            style={{ flex: 1 }}
                            renderItem={({ item }) => (
                                <View style={s.cartItem}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.cartItemName}>{item.name}</Text>
                                        <Text style={s.cartItemPrice}>€{item.price.toFixed(2)} each</Text>
                                    </View>
                                    <View style={s.qtyControls}>
                                        <TouchableOpacity onPress={() => removeFromCart(item._id)} style={s.qtyBtn}>
                                            <Text style={s.qtyBtnText}>−</Text>
                                        </TouchableOpacity>
                                        <Text style={s.qtyValue}>{item.qty}</Text>
                                        <TouchableOpacity onPress={() => addToCart(item)} style={s.qtyBtn}>
                                            <Text style={s.qtyBtnText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={s.cartItemTotal}>€{(item.price * item.qty).toFixed(2)}</Text>
                                </View>
                            )}
                        />

                        {/* Total + Submit */}
                        <View style={s.cartFooter}>
                            <View style={s.totalRow}>
                                <Text style={s.totalLabel}>Total</Text>
                                <Text style={s.totalValue}>€{cartTotal.toFixed(2)}</Text>
                            </View>
                            <TouchableOpacity
                                style={[s.submitBtn, submitting && { opacity: 0.5 }]}
                                onPress={handlePlaceOrder}
                                disabled={submitting}
                            >
                                <Text style={s.submitBtnText}>
                                    {submitting ? "Submitting..." : `Place Order • €${cartTotal.toFixed(2)}`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Table selection Modal */}
            <Modal visible={showTables} animationType="slide" transparent={true}>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Table</Text>
                            <TouchableOpacity onPress={() => setShowTables(false)}>
                                <Ionicons name="close" size={24} color={C.muted} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={tables}
                            keyExtractor={(item) => item._id}
                            numColumns={2}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        s.tableCard,
                                        selectedTable?._id === item._id && { borderColor: C.primary, borderWidth: 2 }
                                    ]}
                                    onPress={() => { setSelectedTable(item); setShowTables(false); }}
                                >
                                    <Ionicons
                                        name="restaurant"
                                        size={24}
                                        color={item.status === "Available" ? C.green : item.status === "Occupied" ? C.red : C.amber}
                                    />
                                    <Text style={s.tableName}>{item.name}</Text>
                                    <Text style={s.tableZone}>{item.zone}</Text>
                                    <Text style={s.tableSeats}>{item.capacity} seats</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={[s.submitBtn, { backgroundColor: C.muted }]}
                            onPress={() => { setSelectedTable(null); setShowTables(false); }}
                        >
                            <Text style={s.submitBtnText}>Takeaway (no table)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
    header: { color: C.text, fontSize: 24, fontWeight: "bold" },
    tableBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    tableBtnText: { color: C.text, fontSize: 12, fontWeight: "600" },
    menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8 },
    menuLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    vegBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    vegText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
    menuName: { color: C.text, fontSize: 16, fontWeight: "600" },
    menuDesc: { color: C.muted, fontSize: 12, marginTop: 2 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    spiceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    spiceText: { fontSize: 9, fontWeight: "bold" },
    prepTime: { color: C.muted, fontSize: 10 },
    menuRight: { alignItems: "flex-end", gap: 4 },
    menuPrice: { color: C.primary, fontSize: 16, fontWeight: "bold" },
    // Cart bar
    cartBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.primary, paddingVertical: 16, paddingHorizontal: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    cartLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    cartCount: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    cartTotal: { color: "#fff", fontSize: 18, fontWeight: "bold" },
    cartAction: { color: "#fff", fontSize: 14 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", padding: 20 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { color: C.text, fontSize: 20, fontWeight: "bold" },
    input: { backgroundColor: C.card, borderRadius: 8, padding: 14, color: C.text, fontSize: 16, marginBottom: 12 },
    selectedTableRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 8, padding: 12, marginBottom: 12 },
    selectedTableText: { color: C.text, fontSize: 14, flex: 1 },
    changeText: { color: C.primary, fontSize: 12, fontWeight: "600" },
    // Cart item
    cartItem: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8 },
    cartItemName: { color: C.text, fontSize: 14, fontWeight: "600" },
    cartItemPrice: { color: C.muted, fontSize: 11, marginTop: 2 },
    qtyControls: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 12 },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
    qtyBtnText: { color: C.text, fontSize: 18, fontWeight: "bold" },
    qtyValue: { color: C.text, fontSize: 16, fontWeight: "bold", minWidth: 24, textAlign: "center" },
    cartItemTotal: { color: C.primary, fontSize: 14, fontWeight: "bold", minWidth: 60, textAlign: "right" },
    // Footer
    cartFooter: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, marginTop: 8 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    totalLabel: { color: C.text, fontSize: 18, fontWeight: "bold" },
    totalValue: { color: C.primary, fontSize: 22, fontWeight: "bold" },
    submitBtn: { backgroundColor: C.primary, borderRadius: 12, padding: 16, alignItems: "center" },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    // Table card
    tableCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 16, margin: 4, alignItems: "center", borderWidth: 1, borderColor: C.border },
    tableName: { color: C.text, fontSize: 14, fontWeight: "bold", marginTop: 8 },
    tableZone: { color: C.muted, fontSize: 11, marginTop: 2 },
    tableSeats: { color: C.muted, fontSize: 10, marginTop: 2 },
});
