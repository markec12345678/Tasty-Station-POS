import React, { useEffect, useState, useRef } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Activity, ShoppingCart, Clock, DollarSign,
    TrendingUp, Users, Zap
} from 'lucide-react';
import { getSocket } from '@/config/socket.config';
import { useOrderStore } from '@/store/useOrderStore';
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const LiveDashboard = () => {
    const { stats, getStats } = useOrderStore();
    const [liveData, setLiveData] = useState({
        newOrders: [], statusUpdates: [], qrOrders: [], paymentUpdates: [],
        connected: false, eventsPerMinute: 0,
    });
    const eventLogRef = useRef([]);

    useEffect(() => {
        getStats();
        const refreshInterval = setInterval(getStats, 30000);
        return () => clearInterval(refreshInterval);
    }, [getStats]);

    useEffect(() => {
        try {
            const socket = getSocket();

            const handleNewOrder = (order) => {
                setLiveData(prev => ({ ...prev, newOrders: [{ ...order, _t: Date.now() }, ...prev.newOrders].slice(0, 10) }));
                eventLogRef.current.unshift({ type: "newOrder", time: Date.now(), text: `New order: ${order.orderId} — ${order.clientName || 'Guest'}` });
            };
            const handleStatusUpdate = (order) => {
                setLiveData(prev => ({ ...prev, statusUpdates: [{ ...order, _t: Date.now() }, ...prev.statusUpdates].slice(0, 10) }));
                eventLogRef.current.unshift({ type: "statusUpdate", time: Date.now(), text: `${order.orderId} → ${order.status}` });
            };
            const handleQROrder = (data) => {
                setLiveData(prev => ({ ...prev, qrOrders: [{ ...data, _t: Date.now() }, ...prev.qrOrders].slice(0, 10) }));
                eventLogRef.current.unshift({ type: "qrOrder", time: Date.now(), text: `QR order: ${data.tableName} — ${data.customerName}` });
            };
            const handlePayment = (order) => {
                setLiveData(prev => ({ ...prev, paymentUpdates: [{ ...order, _t: Date.now() }, ...prev.paymentUpdates].slice(0, 10) }));
                eventLogRef.current.unshift({ type: "payment", time: Date.now(), text: `Payment: ${order.orderId} — €${order.totalAmount?.toFixed(2)}` });
            };

            socket.on("connect", () => setLiveData(prev => ({ ...prev, connected: true })));
            socket.on("disconnect", () => setLiveData(prev => ({ ...prev, connected: false })));
            socket.on("newOrder", handleNewOrder);
            socket.on("orderStatusUpdate", handleStatusUpdate);
            socket.on("qrOrderPlaced", handleQROrder);
            socket.on("paymentUpdate", handlePayment);
            setLiveData(prev => ({ ...prev, connected: socket.connected }));

            return () => {
                socket.off("connect"); socket.off("disconnect");
                socket.off("newOrder", handleNewOrder); socket.off("orderStatusUpdate", handleStatusUpdate);
                socket.off("qrOrderPlaced", handleQROrder); socket.off("paymentUpdate", handlePayment);
            };
        } catch (e) { console.warn("Socket not available"); }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            eventLogRef.current = eventLogRef.current.filter(e => e.time > now - 60000);
            setLiveData(prev => ({ ...prev, eventsPerMinute: eventLogRef.current.length }));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const recentEvents = eventLogRef.current.slice(0, 15);
    const eventColors = { newOrder: "bg-blue-500", statusUpdate: "bg-purple-500", qrOrder: "bg-emerald-500", payment: "bg-amber-500" };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn("size-2.5 rounded-full", liveData.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                    <span className="text-xs font-semibold">{liveData.connected ? "Live" : "Disconnected"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="size-3 text-amber-500" />{liveData.eventsPerMinute} events/min
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-emerald-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><DollarSign className="size-4 text-emerald-500" /><TrendingUp className="size-3 text-muted-foreground" /></div>
                    <div className="text-lg font-bold">€{(stats?.totalRevenue || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Revenue</div>
                </CardContent></Card>
                <Card className="border-blue-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><ShoppingCart className="size-4 text-blue-500" />
                    {liveData.newOrders.length > 0 && <span className="text-[9px] font-bold text-blue-500 animate-pulse">+{liveData.newOrders.length}</span>}</div>
                    <div className="text-lg font-bold">{stats?.totalOrders || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                </CardContent></Card>
                <Card className="border-amber-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><Clock className="size-4 text-amber-500" /></div>
                    <div className="text-lg font-bold">{stats?.pendingOrders || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Pending</div>
                </CardContent></Card>
                <Card className="border-purple-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><Activity className="size-4 text-purple-500" /></div>
                    <div className="text-lg font-bold">€{(stats?.avgOrderValue || 0).toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avg Order</div>
                </CardContent></Card>
            </div>

            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold flex items-center gap-2"><Activity className="size-3.5 text-primary" />Live Activity Feed</CardTitle></CardHeader>
                <CardContent className="pt-0">
                    {recentEvents.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">Waiting for events...</div>
                    ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {recentEvents.map((event, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                                    <div className={cn("size-1.5 rounded-full shrink-0", eventColors[event.type])} />
                                    <span className="flex-1 truncate">{event.text}</span>
                                    <span className="text-muted-foreground text-[10px] whitespace-nowrap">{format(new Date(event.time), "HH:mm:ss")}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {liveData.qrOrders.length > 0 && (
                <Card className="border-emerald-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold flex items-center gap-2"><Users className="size-3.5 text-emerald-500" />QR Orders (Last {liveData.qrOrders.length})</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-1">
                            {liveData.qrOrders.map((qr, i) => (
                                <div key={i} className="flex items-center justify-between text-xs py-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700">QR</Badge>
                                        <span className="font-medium">{qr.tableName}</span>
                                        <span className="text-muted-foreground">{qr.customerName}</span>
                                    </div>
                                    <span className="font-bold">€{(qr.totalAmount || 0).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default LiveDashboard;
