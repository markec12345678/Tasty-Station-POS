import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from "axios";
import {
    CheckCircle2, Clock, ChefHat, Utensils, XCircle, Loader2,
    Receipt, ArrowLeft, Search
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const publicApi = axios.create({
    baseURL: import.meta.env.DEV || window.location.hostname === "localhost"
        ? "http://localhost:3000/api/public"
        : "/api/public",
    withCredentials: false,
});

const STATUS_STEPS = ["Pending", "Preparing", "Ready", "Completed"];
const STATUS_ICONS = { Pending: Clock, Preparing: ChefHat, Ready: Utensils, Completed: CheckCircle2, Cancelled: XCircle };
const STATUS_LABELS = { Pending: "Prejeto", Preparing: "V pripravi", Ready: "Pripravljeno", Completed: "Zaključeno", Cancelled: "Preklicano" };

const OrderTracking = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [, setTimeline] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchId, setSearchId] = useState("");

    const fetchOrder = async (id) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await publicApi.get(`/track/${id}`);
            setOrder(res.data.order);
            setTimeline(res.data.timeline);
        } catch (err) {
            setError(err.response?.data?.message || "Naročilo ni najdeno");
            setOrder(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) fetchOrder(orderId);
    }, [orderId]);

    // Auto-refresh vsakih 10 sekund
    useEffect(() => {
        if (!order || order.status === "Completed" || order.status === "Cancelled") return;
        const interval = setInterval(() => fetchOrder(order.orderId), 10000);
        return () => clearInterval(interval);
    }, [order]);

    const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;
    const isCancelled = order?.status === "Cancelled";

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchId.trim()) {
            window.location.href = `/track/${searchId.trim()}`;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                            <Receipt className="size-4 text-primary-foreground" />
                        </div>
                        <h1 className="font-bold text-sm">Sledenje naročila</h1>
                    </div>
                    <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="size-3 inline mr-1" />
                        Nazaj
                    </a>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Search bar (če ni orderId v URL) */}
                {!orderId && (
                    <Card className="p-4">
                        <form onSubmit={handleSearch} className="space-y-3">
                            <label className="text-sm font-medium">Vnesite številko naročila</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="npr. QR-1234567890-456"
                                    value={searchId}
                                    onChange={(e) => setSearchId(e.target.value)}
                                />
                                <Button type="submit"><Search className="size-4" /></Button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-16">
                        <Loader2 className="size-10 mx-auto mb-3 text-primary animate-spin" />
                        <p className="text-muted-foreground text-sm">Iskanje naročila...</p>
                    </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                    <div className="text-center py-16">
                        <XCircle className="size-12 mx-auto mb-3 text-red-500" />
                        <p className="font-semibold mb-1">Naročilo ni najdeno</p>
                        <p className="text-sm text-muted-foreground mb-4">{error}</p>
                        <form onSubmit={handleSearch} className="flex gap-2 max-w-xs mx-auto">
                            <Input placeholder="Poskusi znova..." value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                            <Button type="submit"><Search className="size-4" /></Button>
                        </form>
                    </div>
                )}

                {/* Order details */}
                {order && !isLoading && (
                    <>
                        {/* Status card */}
                        <div className="bg-card border rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Številka naročila</p>
                                    <p className="font-mono font-bold text-lg">{order.orderId}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Miza</p>
                                    <p className="font-bold">{order.table || "—"}</p>
                                </div>
                            </div>

                            {/* Status timeline */}
                            {!isCancelled ? (
                                <div className="flex items-center justify-between pt-4">
                                    {STATUS_STEPS.map((step, idx) => {
                                        const Icon = STATUS_ICONS[step];
                                        const isDone = idx <= currentStepIndex;
                                        const isCurrent = idx === currentStepIndex;
                                        return (
                                            <div key={step} className="flex flex-col items-center flex-1 relative">
                                                {/* Connector line */}
                                                {idx > 0 && (
                                                    <div className={cn(
                                                        "absolute top-4 left-0 right-1/2 h-0.5 -translate-y-1/2",
                                                        isDone ? "bg-primary" : "bg-muted"
                                                    )} />
                                                )}
                                                {idx < STATUS_STEPS.length - 1 && (
                                                    <div className={cn(
                                                        "absolute top-4 right-0 left-1/2 h-0.5 -translate-y-1/2",
                                                        idx < currentStepIndex ? "bg-primary" : "bg-muted"
                                                    )} />
                                                )}
                                                {/* Icon circle */}
                                                <div className={cn(
                                                    "size-8 rounded-full flex items-center justify-center border-2 z-10 transition-all",
                                                    isDone ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground",
                                                    isCurrent && "ring-4 ring-primary/20 scale-110"
                                                )}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] mt-1.5 font-medium",
                                                    isDone ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {STATUS_LABELS[step]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 py-4 text-red-500">
                                    <XCircle className="size-5" />
                                    <span className="font-semibold">Naročilo je bilo preklicano</span>
                                </div>
                            )}
                        </div>

                        {/* Order items */}
                        <div className="bg-card border rounded-xl p-5">
                            <h3 className="font-semibold text-sm mb-3">Artikli ({order.items?.length || 0})</h3>
                            <div className="space-y-2">
                                {order.items?.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="size-6 rounded bg-muted flex items-center justify-center text-xs font-bold">{item.quantity}×</span>
                                            <span>{item.name}</span>
                                        </div>
                                        <span className="text-muted-foreground">€{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t mt-3 pt-3 flex justify-between font-bold">
                                <span>Skupaj</span>
                                <span className="text-primary">€{order.totalAmount?.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground text-center">
                            {order.status !== "Completed" && order.status !== "Cancelled"
                                ? "🔄 Status se samodejno osvežuje vsakih 10 sekund"
                                : `Naročilo izdano: ${format(new Date(order.createdAt), "d.MM.yyyy HH:mm")}`
                            }
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OrderTracking;
