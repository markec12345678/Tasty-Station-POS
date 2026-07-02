import React, { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore } from "../store/authStore";

const C = { primary: "#0d9488", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", muted: "#94a3b8", border: "#334155", error: "#ef4444" };

export default function LoginScreen() {
    const { login, loginWithPin, isLoading } = useAuthStore();
    // Popravek: prej predizpolnjeno "admin@pos.com" / "password123" — to so seed
    // demo kredencijali in predstavljajo varnostno tveganje v produkciji.
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [mode, setMode] = useState("email"); // "email" | "pin"

    const handleLogin = async () => {
        setError("");
        try {
            const ok = mode === "pin"
                ? await loginWithPin(pin)
                : await login(email, password);
            if (!ok) setError(mode === "pin" ? "Invalid PIN" : "Invalid credentials");
        } catch (e) {
            setError(e.response?.data?.message || "Login failed");
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError("");
        setPin("");
        setPassword("");
    };

    return (
        <SafeAreaView style={s.container}>
            <View style={s.card}>
                <Text style={s.title}>Tasty Station</Text>
                <Text style={s.subtitle}>POS Mobile</Text>

                {mode === "email" ? (
                    <>
                        <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                        <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted} value={password} onChangeText={setPassword} secureTextEntry />
                    </>
                ) : (
                    <>
                        <Text style={s.pinLabel}>Enter 4-digit PIN</Text>
                        <TextInput
                            style={[s.input, s.pinInput]}
                            placeholder="••••"
                            placeholderTextColor={C.muted}
                            value={pin}
                            onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={4}
                            autoFocus
                        />
                    </>
                )}

                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity style={s.button} onPress={handleLogin} disabled={isLoading || (mode === "pin" && pin.length !== 4)}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign In</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.switchMode} onPress={() => switchMode(mode === "email" ? "pin" : "email")}>
                    <Text style={s.switchModeText}>
                        {mode === "email" ? "🔑 Use PIN login instead" : "📧 Use email/password instead"}
                    </Text>
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
    pinLabel: { color: C.muted, fontSize: 14, textAlign: "center", marginTop: 8 },
    pinInput: { textAlign: "center", fontSize: 24, letterSpacing: 12, fontWeight: "bold" },
    button: { backgroundColor: C.primary, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    error: { color: C.error, fontSize: 14, textAlign: "center" },
    switchMode: { alignItems: "center", marginTop: 16, padding: 8 },
    switchModeText: { color: C.primary, fontSize: 14, textAlign: "center" },
});
