import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { getMenu } from "../api/client";

const C = { primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", muted: "#94a3b8", border: "#334155", green: "#22c55e", red: "#ef4444" };

export default function MenuScreen() {
    const [menu, setMenu] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadMenu = async () => {
        try { const res = await getMenu(); setMenu(res.data.items || []); }
        catch (e) { console.error("Menu error:", e); }
        finally { setRefreshing(false); }
    };

    useEffect(() => { loadMenu(); }, []);

    return (
        <SafeAreaView style={s.container}>
            <Text style={s.header}>Menu</Text>
            <FlatList
                data={menu}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <View style={s.menuItem}>
                        <View style={s.left}>
                            <View style={[s.vegBadge, { backgroundColor: item.isVeg ? C.green : C.red }]}>
                                <Text style={s.vegText}>{item.isVeg ? "V" : "N"}</Text>
                            </View>
                            <View>
                                <Text style={s.name}>{item.name}</Text>
                                <Text style={s.desc} numberOfLines={1}>{item.description}</Text>
                            </View>
                        </View>
                        <Text style={s.price}>€{item.price.toFixed(2)}</Text>
                    </View>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMenu} tintColor={C.primary} />}
                contentContainerStyle={{ padding: 16, gap: 8 }}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { color: C.text, fontSize: 24, fontWeight: "bold", padding: 16 },
    menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8 },
    left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    vegBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    vegText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
    name: { color: C.text, fontSize: 16, fontWeight: "600" },
    desc: { color: C.muted, fontSize: 12, marginTop: 2 },
    price: { color: C.primary, fontSize: 16, fontWeight: "bold" },
});
