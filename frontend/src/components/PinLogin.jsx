import React, { useState, useEffect } from 'react';
import { Delete, Fingerprint, Loader2, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import axiosInstance from "@/axios/axiosInstace";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";

/**
 * PinLogin — hitri PIN login za POS terminal.
 *
 * 4-mestna koda namesto email/password.
 * Po vnosu 4. številke se samodejno prijavi.
 *
 * Uporaba:
 *   <PinLogin onClose={() => setShowPin(false)} />
 */
const PinLogin = ({ onClose }) => {
    const { login: _login } = useAuthStore(); // eslint-disable-line no-unused-vars
    const [pin, setPin] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleDigit = (digit) => {
        if (pin.length >= 4 || isLoading) return;
        const newPin = pin + digit;
        setPin(newPin);
        setError("");

        if (newPin.length === 4) {
            handleSubmit(newPin);
        }
    };

    const handleDelete = () => {
        setPin(pin.slice(0, -1));
        setError("");
    };

    const handleSubmit = async (pinValue) => {
        setIsLoading(true);
        setError("");
        try {
            const res = await axiosInstance.post("/users/pin-login", { pin: pinValue });
            if (res.data.success) {
                toast.success(`Welcome, ${res.data.user.name}`);
                onClose?.();
            }
        } catch (err) {
            setError(err.response?.data?.message || "Invalid PIN");
            setPin("");
        } finally {
            setIsLoading(false);
        }
    };

    // Keyboard support
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
            else if (e.key === "Backspace") handleDelete();
            else if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [pin, isLoading]);

    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border rounded-2xl shadow-2xl p-8 w-full max-w-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Fingerprint className="size-6 text-primary" />
                        <h2 className="text-lg font-bold">PIN Login</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                </div>

                {/* PIN dots */}
                <div className="flex justify-center gap-3 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={cn(
                            "size-4 rounded-full border-2 transition-all",
                            i < pin.length
                                ? "bg-primary border-primary scale-110"
                                : "border-muted-foreground/30",
                            error && "border-red-500 animate-shake"
                        )} />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="text-center text-red-500 text-sm mb-4 animate-pulse">
                        {error}
                    </div>
                )}

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-3">
                    {digits.map(d => (
                        <button
                            key={d}
                            onClick={() => handleDigit(d)}
                            disabled={isLoading}
                            className="aspect-square rounded-xl bg-muted hover:bg-muted/70 text-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                            {d}
                        </button>
                    ))}
                    <button
                        onClick={handleDelete}
                        disabled={isLoading || pin.length === 0}
                        className="aspect-square rounded-xl bg-muted hover:bg-muted/70 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                    >
                        <Delete className="size-6" />
                    </button>
                    <button
                        onClick={() => handleDigit("0")}
                        disabled={isLoading}
                        className="aspect-square rounded-xl bg-muted hover:bg-muted/70 text-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                    >
                        0
                    </button>
                    <div className="aspect-square flex items-center justify-center">
                        {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    Enter your 4-digit PIN to sign in
                </p>
            </div>
        </div>
    );
};

export default PinLogin;
