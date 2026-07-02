import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Brain, TrendingDown, AlertTriangle, Package, RefreshCw,
    Sparkles, Calendar, ArrowDown, ArrowUp, ShoppingBag
} from 'lucide-react';
import { useForecastStore } from '@/store/useForecastStore';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const URGENCY_COLORS = {
    HIGH: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    LOW: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const ACTION_COLORS = {
    REORDER: "bg-red-500/10 text-red-700 dark:text-red-400",
    INCREASE_STOCK: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    DECREASE_STOCK: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    MONITOR: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const ForecastPage = () => {
    const { forecast, isLoading, period: _period, getForecast } = useForecastStore();
    const [selectedDays, setSelectedDays] = useState(30);

    useEffect(() => {
        getForecast(selectedDays);
    }, [getForecast, selectedDays]);

    const handleRefresh = () => {
        getForecast(selectedDays);
        toast.success("Forecast refreshed");
    };

    const summary = forecast?.summary || "";
    const insights = forecast?.insights || [];
    const recommendations = forecast?.recommendations || [];
    const items = forecast?.items || [];
    const predictedShortages = forecast?.predictedShortages || [];
    const isAIPowered = forecast?.aiPowered || false;

    // Stats
    const lowStockItems = items.filter(i => i.needsReorder);
    const criticalItems = items.filter(i => i.daysUntilDepletion !== null && i.daysUntilDepletion <= 3);
    const totalInventoryValue = items.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit || 0), 0);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Brain className="size-7 text-primary" />
                            AI Inventory Forecast
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Napoved porabe z Gemini AI + statistika
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Period selector */}
                        <div className="flex rounded-lg border bg-background p-0.5">
                            {[7, 30, 60, 90].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setSelectedDays(d)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        selectedDays === d
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* AI Status banner */}
                <Card className={cn(
                    "border-l-4",
                    isAIPowered ? "border-l-purple-500 bg-purple-500/5" : "border-l-amber-500 bg-amber-500/5"
                )}>
                    <CardContent className="p-4 flex items-center gap-3">
                        {isAIPowered ? (
                            <Sparkles className="size-5 text-purple-500" />
                        ) : (
                            <AlertTriangle className="size-5 text-amber-500" />
                        )}
                        <div className="flex-1">
                            <div className="font-semibold text-sm">
                                {isAIPowered ? "AI-Powered Forecast (Gemini)" : "Statistical Forecast (AI disabled)"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {isAIPowered
                                    ? "Napoveduje Gemini AI z upoštevanjem trendov, vikendov in lead-time"
                                    : "Dodaj GEMINI_API_KEY v backend .env za AI napovedi"}
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-background">
                            <Calendar className="size-3 mr-1" />
                            {selectedDays} dni
                        </Badge>
                    </CardContent>
                </Card>

                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="size-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Items Tracked</p>
                                <p className="text-2xl font-bold">{items.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <AlertTriangle className="size-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Need Reorder</p>
                                <p className="text-2xl font-bold text-red-500">{lowStockItems.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <TrendingDown className="size-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Critical (≤3d)</p>
                                <p className="text-2xl font-bold text-amber-500">{criticalItems.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <ShoppingBag className="size-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stock Value</p>
                                <p className="text-xl font-bold">€{totalInventoryValue.toFixed(0)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Summary + Insights */}
                {summary && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Brain className="size-4 text-primary" />
                                AI Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{summary}</p>
                            {insights.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Insights</div>
                                    {insights.map((insight, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <Sparkles className="size-3.5 text-purple-500 mt-0.5 shrink-0" />
                                            <span>{insight}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShoppingBag className="size-4 text-primary" />
                                Reorder Recommendations
                            </CardTitle>
                            <CardDescription>Predlagana dejanja za optimalno zalogo</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {recommendations.map((rec, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={cn("text-[10px]", URGENCY_COLORS[rec.urgency])}>
                                                {rec.urgency}
                                            </Badge>
                                            <Badge variant="outline" className={cn("text-[10px]", ACTION_COLORS[rec.action])}>
                                                {rec.action.replace("_", " ")}
                                            </Badge>
                                            <div>
                                                <div className="font-medium text-sm">{rec.item}</div>
                                                <div className="text-xs text-muted-foreground">{rec.reason}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Order qty</div>
                                            <div className="font-bold text-sm">{rec.suggestedOrderQty || "—"}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Predicted shortages */}
                {predictedShortages.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="size-4 text-amber-500" />
                                Predicted Shortages
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {predictedShortages.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 rounded border bg-amber-500/5">
                                        <div className="text-sm font-medium">{s.item}</div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                                                {s.expectedDate}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                                {Math.round((s.probability || 0) * 100)}% probability
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Items detail table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Inventory Items — Forecast Details</CardTitle>
                        <CardDescription>Podrobna analiza za vsak inventory item</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Package className="size-12 mx-auto mb-3 opacity-20" />
                                <p>No inventory items available</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-muted-foreground">
                                            <th className="py-2 pr-3">Item</th>
                                            <th className="py-2 pr-3 text-right">Current</th>
                                            <th className="py-2 pr-3 text-right">Reorder At</th>
                                            <th className="py-2 pr-3 text-right">Daily Avg</th>
                                            <th className="py-2 pr-3 text-right">7d Forecast</th>
                                            <th className="py-2 pr-3 text-right">Days Left</th>
                                            <th className="py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.inventoryId} className="border-b hover:bg-muted/50">
                                                <td className="py-2.5 pr-3">
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground">{item.category} • {item.supplier}</div>
                                                </td>
                                                <td className="py-2.5 pr-3 text-right font-mono">
                                                    {item.currentStock} <span className="text-xs text-muted-foreground">{item.unit}</span>
                                                </td>
                                                <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">
                                                    {item.reorderLevel}
                                                </td>
                                                <td className="py-2.5 pr-3 text-right font-mono">
                                                    {item.dailyAverage}
                                                </td>
                                                <td className="py-2.5 pr-3 text-right font-mono">
                                                    {item.weeklyForecast}
                                                </td>
                                                <td className={cn(
                                                    "py-2.5 pr-3 text-right font-mono font-bold",
                                                    item.daysUntilDepletion === null ? "text-muted-foreground" :
                                                    item.daysUntilDepletion <= 3 ? "text-red-500" :
                                                    item.daysUntilDepletion <= 7 ? "text-amber-500" : "text-emerald-500"
                                                )}>
                                                    {item.daysUntilDepletion === null ? "∞" : `${item.daysUntilDepletion}d`}
                                                </td>
                                                <td className="py-2.5">
                                                    {item.needsReorder ? (
                                                        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 text-[10px]">
                                                            <AlertTriangle className="size-3 mr-1" />
                                                            Reorder
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
                                                            OK
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default ForecastPage;
