import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "../store/authStore";

const C = { primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", muted: "#94a3b8", border: "#334155", error: "#ef4444" };

export default function LoginScreen() {
    const { login, isLoading } = useAuthStore();
    const [email, setEmail] = useState("admin@pos.com");
    const [password, setPassword] = useState("password123");
    const [error, setError] = useState("");

    const handleLogin = async () => {
        setError("");
        try { const ok = await login(email, password); if (!ok) setError("Invalid credentials"); }
        catch (e) { setError(e.response?.data?.message || "Login failed"); }
    };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.card}>
                <Text style={s.title}>Tasty Station</Text>
                <Text style={s.subtitle}>POS Mobile</Text>
                <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted} value={password} onChangeText={setPassword} secureTextEntry />
                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity style={s.button} onPress={handleLogin} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign In</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 32, gap: 12 },
    title: { color: C.text, fontSize: 28, fontWeight: "bold", textAlign: "center" },
    subtitle: { color: C.primary, fontSize: 14, textAlign: "center", marginBottom: 20 },
    input: { backgroundColor: C.bg, borderRadius: 8, padding: 14, color: C.text, fontSize: 16, borderWidth: 1, borderColor: C.border },
    button: { backgroundColor: C.primary, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    error: { color: C.error, fontSize: 14, textAlign: "center" },
});
