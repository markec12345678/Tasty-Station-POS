import React, { useEffect, useState, useMemo } from 'react';
import { useTableStore } from '@/store/useTableStore';
import { useOrderStore } from '@/store/useOrderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Armchair,
    Clock,
    Users,
    Plus,
    ChevronRight,
    Receipt,
    Coffee,
    CheckCircle2,
    ChefHat,
    Search,
    Activity,
    TrendingUp,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import TableTimer from '../components/TableTimer';

// Module-level constants (prej znotraj komponente — ESLint scope analysis jih ni sledil)
const TABLE_STATUS_COLORS = {
    Available: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800/50",
    Occupied: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800/50",
    Reserved: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800/50",
};
const ORDER_STATUS_COLORS = {
    Pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Preparing: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    Ready: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    Completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Cancelled: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const WaiterTerminal = () => {
    const { authUser } = useAuthStore();
    const { tables, getTables } = useTableStore();
    const { recentOrders, getStats } = useOrderStore();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("All"); // All | Available | Occupied | Reserved | Mine

    useEffect(() => {
        getTables();
        getStats();
        const interval = setInterval(() => {
            getTables();
            getStats();
        }, 15000);
        return () => clearInterval(interval);
    }, [getTables, getStats]);

    // Mizne, ki so dodeljene trenutnemu natakarju (preko person polja)
    const myTables = useMemo(() => {
        return tables.filter(t => t.person?._id === authUser?._id);
    }, [tables, authUser]);

    // Filter miz glede na aktivni filter in iskanje
    const filteredTables = useMemo(() => {
        let result = tables;

        if (activeFilter === "Mine") {
            result = myTables;
        } else if (activeFilter !== "All") {
            result = result.filter(t => t.status === activeFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.zone.toLowerCase().includes(q) ||
                (t.reservation?.bookedBy || "").toLowerCase().includes(q)
            );
        }

        return result;
    }, [tables, myTables, activeFilter, searchQuery]);

    // Statistike za zgornjo vrstico
    const stats = useMemo(() => {
        return {
            myActive: myTables.filter(t => t.status === 'Occupied').length,
            myReserved: myTables.filter(t => t.status === 'Reserved').length,
            availableTotal: tables.filter(t => t.status === 'Available').length,
            occupiedTotal: tables.filter(t => t.status === 'Occupied').length,
        };
    }, [tables, myTables]);

    // Moja nedavna naročila (po tistih, ki jih je ustvaril ta uporabnik)
    const myOrders = useMemo(() => {
        if (!recentOrders) return [];
        return recentOrders.filter(o => o.user?._id === authUser?._id).slice(0, 5);
    }, [recentOrders, authUser]);

    const filters = ["All", "Mine", "Available", "Occupied", "Reserved"];

    const handleQuickOrder = (_tableId) => {
        navigate('/orders');
        toast.info(`Select table and start new order`);
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b bg-card/30 backdrop-blur-sm shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Coffee className="size-6 text-primary" />
                            Waiter Terminal
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Welcome back, <span className="font-medium text-foreground">{authUser?.name || 'Waiter'}</span> — manage your tables and orders
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate('/orders')}
                        className="bg-primary hover:bg-primary/90"
                    >
                        <Plus className="size-4 mr-2" />
                        New Order
                    </Button>
                </div>

                {/* Stat kartice */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Armchair className="size-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">My Active</p>
                                <p className="text-xl font-bold text-foreground">{stats.myActive}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Clock className="size-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">My Reserved</p>
                                <p className="text-xl font-bold text-foreground">{stats.myReserved}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</p>
                                <p className="text-xl font-bold text-foreground">{stats.availableTotal}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-red-500/20 bg-red-500/5">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <Activity className="size-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Occupied</p>
                                <p className="text-xl font-bold text-foreground">{stats.occupiedTotal}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main content — dva stolpca */}
            <div className="flex-1 flex overflow-hidden">
                {/* Levi stolpec — Mize */}
                <div className="flex-1 flex flex-col overflow-hidden border-r">
                    <div className="px-6 py-4 flex items-center justify-between gap-4 shrink-0">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                            {filters.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border",
                                        activeFilter === f
                                            ? "bg-foreground text-background border-foreground"
                                            : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    {f === "Mine" && `My Tables (${myTables.length})`}
                                    {f !== "Mine" && f}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search tables..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-9 text-xs"
                            />
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="px-6 pb-6">
                            {filteredTables.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                    <Armchair className="size-12 mb-3 opacity-20" />
                                    <p className="text-sm">No tables match the filter</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {filteredTables.map(table => (
                                        <TableMiniCard
                                            key={table._id}
                                            table={table}
                                            isMine={table.person?._id === authUser?._id}
                                            onQuickOrder={() => handleQuickOrder(table._id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Desni stolpec — Moja naročila */}
                <aside className="w-[360px] flex flex-col bg-card overflow-hidden">
                    <div className="px-4 py-4 border-b shrink-0">
                        <h2 className="font-semibold tracking-tight flex items-center gap-2">
                            <Receipt className="size-4 text-primary" />
                            My Recent Orders
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Last 5 orders you placed
                        </p>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-3">
                            {myOrders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                    <Receipt className="size-10 mb-3 opacity-20" />
                                    <p className="text-sm">No orders yet</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => navigate('/orders')}
                                    >
                                        Place first order
                                    </Button>
                                </div>
                            ) : (
                                myOrders.map(order => (
                                    <OrderMiniCard key={order._id} order={order} />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </aside>
            </div>
        </div>
    );
};

// --- Pomožna komponenta: majhna kartica mize ---
const TableMiniCard = ({ table, isMine, onQuickOrder }) => {
    const orderTotal = table.currentOrder?.totalAmount ?? 0;
    const itemCount = table.currentOrder?.items?.length ?? 0;
    const arrival = table.currentOrder?.createdAt
        ? format(new Date(table.currentOrder.createdAt), 'HH:mm')
        : null;

    return (
        <Card className={cn(
            "relative overflow-hidden transition-all hover:shadow-md cursor-default group",
            isMine && "ring-2 ring-primary/40"
        )}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base">{table.name}</h3>
                            {isMine && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                                    MINE
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{table.zone} • {table.capacity} seats</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", TABLE_STATUS_COLORS[table.status])}>
                        {table.status}
                    </Badge>
                </div>

                {table.status === 'Occupied' && (
                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                        <div className="flex justify-between">
                            <span>Customer:</span>
                            <span className="font-medium text-foreground truncate ml-2">
                                {table.currentOrder?.clientName || table.client?.name || "Walk-in"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Arrival:</span>
                            <span className="font-medium text-foreground">{arrival || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Duration:</span>
                            <TableTimer occupiedAt={table.currentOrder?.createdAt} compact />
                        </div>
                        <div className="flex justify-between">
                            <span>Items / Total:</span>
                            <span className="font-medium text-foreground">
                                {itemCount} / €{orderTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}

                {table.status === 'Reserved' && (
                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                        <div className="flex justify-between">
                            <span>Guest:</span>
                            <span className="font-medium text-foreground truncate ml-2">
                                {table.reservation?.bookedBy || "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Time:</span>
                            <span className="font-medium text-foreground">
                                {table.reservation?.date
                                    ? format(new Date(table.reservation.date), 'MMM d, HH:mm')
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Guests:</span>
                            <span className="font-medium text-foreground">
                                <Users className="size-3 inline mr-1" />
                                {table.reservation?.guests || 0}
                            </span>
                        </div>
                    </div>
                )}

                {table.status === 'Available' && (
                    <div className="mb-3 py-2 px-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-700 dark:text-emerald-400">
                        Ready for new guests
                    </div>
                )}

                {/* Akcijski gumbi */}
                <div className="flex gap-2">
                    {table.status === 'Available' && (
                        <Button
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={onQuickOrder}
                        >
                            <Plus className="size-3 mr-1" />
                            Seat & Order
                        </Button>
                    )}
                    {table.status === 'Occupied' && (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs"
                                onClick={onQuickOrder}
                            >
                                <Plus className="size-3 mr-1" />
                                Add Item
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs"
                                title="Print bill"
                            >
                                <Receipt className="size-3" />
                            </Button>
                        </>
                    )}
                    {table.status === 'Reserved' && (
                        <Button
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={onQuickOrder}
                        >
                            <CheckCircle2 className="size-3 mr-1" />
                            Check-in
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// --- Pomožna komponenta: majhna kartica naročila ---
const OrderMiniCard = ({ order }) => {
    const statusColors = {
        Pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        Preparing: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
        Ready: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
        Completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        Cancelled: "bg-red-500/10 text-red-700 dark:text-red-400",
    };

    return (
        <Card className="border-border/60 hover:border-border transition-colors">
            <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold">
                        #{String(order.orderId || '').split('-').pop()?.slice(-4) || '0000'}
                    </span>
                    <Badge variant="outline" className={cn("text-[9px] py-0", statusColors[order.status])}>
                        {order.status}
                    </Badge>
                </div>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="font-medium truncate ml-2 max-w-[140px]">
                            {order.clientName || order.client?.name || "Walk-in"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Table</span>
                        <span className="font-medium">{order.table?.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Items</span>
                        <span className="font-medium">{order.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold text-primary">Rs {(order.totalAmount || 0).toLocaleString()}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default WaiterTerminal;
