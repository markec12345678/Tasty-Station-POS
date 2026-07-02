import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users,
    BarChart3, PieChart, Clock, CreditCard, RefreshCw, Calendar
} from 'lucide-react';
import { useReportsStore } from '@/store/useReportsStore';
import { cn } from "@/lib/utils";

const PERIODS = [
    { value: "daily", label: "Today" },
    { value: "weekly", label: "This Week" },
    { value: "monthly", label: "This Month" },
    { value: "yearly", label: "This Year" },
];

const ReportsDashboard = () => {
    const { dashboard, categoryPerformance, isLoading: _isLoading, period: _period, getDashboard, getCategoryPerformance } = useReportsStore();
    const [filter, setFilter] = useState("monthly");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [showCustom, setShowCustom] = useState(false);

    useEffect(() => {
        if (!showCustom) {
            getDashboard(filter);
            getCategoryPerformance(filter);
        }
    }, [getDashboard, getCategoryPerformance, filter, showCustom]);

    const handleApplyCustom = () => {
        if (!customStart || !customEnd) return;
        getDashboard("", customStart, customEnd);
        getCategoryPerformance("");
    };

    const summary = dashboard?.summary || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, uniqueClients: 0 };
    const profitLoss = dashboard?.profitLoss || { totalRevenue: 0, totalCost: 0, profit: 0, margin: 0 };
    const salesTrend = dashboard?.salesTrend || [];
    const topItems = dashboard?.topItems || [];
    const cashiers = dashboard?.cashierCollections || [];
    const orderStatuses = dashboard?.orderStatusBreakdown || [];
    const paymentMethods = dashboard?.paymentMethodBreakdown || [];
    const hourlyDistribution = dashboard?.hourlyDistribution || [];

    // Charts: max values for bars
    const maxRevenue = Math.max(...salesTrend.map(s => s.revenue), 1);
    const maxHourlyOrders = Math.max(...hourlyDistribution.map(h => h.orders), 1);
    const maxCategoryRevenue = Math.max(...categoryPerformance.map(c => c.totalRevenue), 1);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <BarChart3 className="size-7 text-primary" />
                            Reports Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Celovit pregled prodaje, profitov in trendov
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Period selector */}
                        <div className="flex rounded-lg border bg-background p-0.5">
                            {PERIODS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => { setFilter(p.value); setShowCustom(false); }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        !showCustom && filter === p.value
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustom(!showCustom)}
                        >
                            <Calendar className="size-4" />
                        </Button>
                    </div>
                </div>

                {/* Custom date range */}
                {showCustom && (
                    <Card>
                        <CardContent className="p-4 flex items-end gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">Start date</label>
                                <Input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">End date</label>
                                <Input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <Button onClick={handleApplyCustom} disabled={!customStart || !customEnd}>
                                Apply
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Summary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <DollarSign className="size-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue</p>
                                <p className="text-xl font-bold">€{(summary.totalRevenue || 0).toFixed(0)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <ShoppingBag className="size-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Orders</p>
                                <p className="text-xl font-bold">{summary.totalOrders || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <TrendingUp className="size-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Order</p>
                                <p className="text-xl font-bold">€{(summary.avgOrderValue || 0).toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                <Users className="size-5 text-pink-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Clients</p>
                                <p className="text-xl font-bold">{summary.uniqueClients || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Profit & Loss */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Profit & Loss</CardTitle>
                        <CardDescription>Finančni pregled obdobja</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-xs text-muted-foreground">Revenue</div>
                                <div className="text-xl font-bold text-emerald-500">€{(profitLoss.totalRevenue || 0).toFixed(0)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Cost</div>
                                <div className="text-xl font-bold text-red-500">€{(profitLoss.totalCost || 0).toFixed(0)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Profit</div>
                                <div className="text-xl font-bold text-primary">€{(profitLoss.profit || 0).toFixed(0)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Margin</div>
                                <div className="text-xl font-bold">{(profitLoss.margin || 0).toFixed(1)}%</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sales trend chart */}
                {salesTrend.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="size-4 text-primary" />
                                Sales Trend
                            </CardTitle>
                            <CardDescription>Časovni pregled prihodka in števila naročil</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {salesTrend.slice(-15).map((point, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="w-32 text-xs text-muted-foreground truncate">{point._id}</div>
                                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                                            <div
                                                className="h-full bg-primary/70 rounded-full transition-all flex items-center justify-end pr-2"
                                                style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                                            >
                                                <span className="text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                                                    €{point.revenue.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-16 text-xs text-muted-foreground text-right">
                                            {point.orders} ord
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top selling items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShoppingBag className="size-4 text-primary" />
                                Top Selling Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topItems.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
                            ) : (
                                <div className="space-y-2">
                                    {topItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded border">
                                            <div className="flex items-center gap-2">
                                                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-sm font-medium">{item.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold">{item.totalQuantity}×</div>
                                                <div className="text-xs text-muted-foreground">€{item.totalRevenue.toFixed(0)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment methods */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="size-4 text-primary" />
                                Payment Methods
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {paymentMethods.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
                            ) : (
                                <div className="space-y-2">
                                    {paymentMethods.map((pm, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded border">
                                            <span className="text-sm font-medium">{pm._id}</span>
                                            <div className="text-right">
                                                <div className="text-sm font-bold">{pm.count}×</div>
                                                <div className="text-xs text-muted-foreground">€{(pm.totalAmount || 0).toFixed(0)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Cashier collections */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="size-4 text-primary" />
                                Top Cashiers
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {cashiers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
                            ) : (
                                <div className="space-y-2">
                                    {cashiers.map((c, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded border">
                                            <div>
                                                <div className="text-sm font-medium">{c.cashierName}</div>
                                                <div className="text-xs text-muted-foreground">{c.orderCount} orders</div>
                                            </div>
                                            <div className="text-sm font-bold text-emerald-500">
                                                €{(c.totalCollected || 0).toFixed(0)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Order statuses */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PieChart className="size-4 text-primary" />
                                Order Status Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {orderStatuses.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
                            ) : (
                                <div className="space-y-2">
                                    {orderStatuses.map((s, idx) => {
                                        const total = orderStatuses.reduce((sum, x) => sum + x.count, 0);
                                        const pct = (s.count / total * 100).toFixed(0);
                                        return (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-24 text-sm">{s._id}</div>
                                                <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary/50 rounded-full"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <div className="w-20 text-right text-xs">
                                                    {s.count} ({pct}%)
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Hourly distribution */}
                {hourlyDistribution.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                Hourly Distribution
                            </CardTitle>
                            <CardDescription>Kdaj so vrhunski časi (peak hours)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-1 h-32">
                                {hourlyDistribution.map((h, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center group">
                                        <div className="text-[9px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {h.orders}
                                        </div>
                                        <div
                                            className="w-full bg-primary/70 rounded-t hover:bg-primary transition-colors"
                                            style={{ height: `${(h.orders / maxHourlyOrders) * 100}%`, minHeight: "4px" }}
                                            title={`${h._id}:00 — ${h.orders} orders, €${h.revenue.toFixed(0)}`}
                                        />
                                        <div className="text-[9px] text-muted-foreground mt-1">{h._id}h</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Category performance */}
                {categoryPerformance.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PieChart className="size-4 text-primary" />
                                Category Performance
                            </CardTitle>
                            <CardDescription>Uspešnost po kategorijah menija</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {categoryPerformance.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="w-32 text-sm font-medium truncate">{cat.categoryName}</div>
                                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                                            <div
                                                className="h-full bg-primary/70 rounded-full flex items-center justify-end pr-2"
                                                style={{ width: `${(cat.totalRevenue / maxCategoryRevenue) * 100}%` }}
                                            >
                                                <span className="text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                                                    €{cat.totalRevenue.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-20 text-right text-xs text-muted-foreground">
                                            {cat.totalQuantity} prodano
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
};

export default ReportsDashboard;
