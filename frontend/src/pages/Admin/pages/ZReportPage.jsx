import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    FileText, BarChart3, Download, RefreshCw, Euro,
    Receipt, TrendingUp, AlertCircle, Wallet, Calendar, Printer
} from 'lucide-react';
import { useZReportStore } from '@/store/useZReportStore';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const ZReportPage = () => {
    const { zReport, xReport, isLoading, getZReport, getXReport } = useZReportStore();
    const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [activeTab, setActiveTab] = useState("z"); // "z" | "x"

    useEffect(() => {
        if (activeTab === "z") getZReport(reportDate);
        else getXReport();
    }, [activeTab, reportDate]);

    const handleRefresh = () => {
        if (activeTab === "z") getZReport(reportDate);
        else getXReport();
        toast.success("Report refreshed");
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (!zReport) return;
        const headers = ["Order ID", "Time", "Customer", "Table", "Type", "Payment", "Total", "Service", "Cashier"];
        const rows = zReport.orders.map(o => [
            o.orderId, o.time, o.customer, o.table, o.type, o.paymentMethod,
            o.total.toFixed(2), (o.serviceCharge || 0).toFixed(2), o.cashier
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `z-report-${reportDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported");
    };

    const report = activeTab === "z" ? zReport : xReport;

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <FileText className="size-7 text-primary" />
                            {activeTab === "z" ? "Z-Report" : "X-Report"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeTab === "z"
                                ? "Dnevni zaključek blagajne — end of day reconciliation"
                                : "Trenutno stanje — mid-day snapshot"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                        </Button>
                        {activeTab === "z" && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!zReport}>
                                    <Download className="size-4 mr-1" /> CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrint} disabled={!zReport}>
                                    <Printer className="size-4 mr-1" /> Print
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tabs + Date */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex rounded-lg border bg-background p-0.5">
                        <button onClick={() => setActiveTab("z")} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", activeTab === "z" ? "bg-foreground text-background" : "text-muted-foreground")}>
                            Z-Report (Daily)
                        </button>
                        <button onClick={() => setActiveTab("x")} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", activeTab === "x" ? "bg-foreground text-background" : "text-muted-foreground")}>
                            X-Report (Live)
                        </button>
                    </div>
                    {activeTab === "z" && (
                        <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-40" />
                    )}
                </div>

                {isLoading ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <FileText className="size-12 mx-auto mb-3 opacity-20 animate-pulse" /> Loading report...
                    </div>
                ) : !report ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <AlertCircle className="size-12 mx-auto mb-3 opacity-20" /> No data available
                    </div>
                ) : activeTab === "z" ? (
                    <ZReportView report={zReport} />
                ) : (
                    <XReportView report={xReport} />
                )}
            </div>
        </div>
    );
};

// === Z-Report View ===
const ZReportView = ({ report }) => {
    if (!report) return null;
    const s = report.summary;

    return (
        <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-emerald-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><Euro className="size-4 text-emerald-500" /></div>
                    <div className="text-xl font-bold">€{(s.totalRevenue || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Revenue</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><Receipt className="size-4 text-blue-500" /></div>
                    <div className="text-xl font-bold">{s.orderCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><TrendingUp className="size-4 text-purple-500" /></div>
                    <div className="text-xl font-bold">€{(s.avgOrderValue || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avg Order</div>
                </CardContent></Card>
                <Card className="border-red-500/20"><CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1"><AlertCircle className="size-4 text-red-500" /></div>
                    <div className="text-xl font-bold text-red-500">{s.cancelledCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Cancelled</div>
                </CardContent></Card>
            </div>

            {/* Tax Breakdown */}
            <Card>
                <CardHeader><CardTitle className="text-sm">DDV Breakdown</CardTitle></CardHeader>
                <CardContent>
                    <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground border-b">
                            <th className="py-2 text-left">Rate</th><th className="py-2 text-right">Base</th>
                            <th className="py-2 text-right">Tax</th><th className="py-2 text-right">Gross</th><th className="py-2 text-right">Count</th>
                        </tr></thead>
                        <tbody>
                            {report.taxBreakdown?.map((t, i) => (
                                <tr key={i} className="border-b">
                                    <td className="py-2 font-bold">{t.rate}%</td>
                                    <td className="py-2 text-right">€{t.base.toFixed(2)}</td>
                                    <td className="py-2 text-right">€{t.tax.toFixed(2)}</td>
                                    <td className="py-2 text-right">€{t.gross.toFixed(2)}</td>
                                    <td className="py-2 text-right">{t.count}</td>
                                </tr>
                            ))}
                            <tr className="font-bold">
                                <td className="py-2">Total</td>
                                <td className="py-2 text-right">€{(s.totalBase || 0).toFixed(2)}</td>
                                <td className="py-2 text-right">€{(s.totalTax || 0).toFixed(2)}</td>
                                <td className="py-2 text-right">€{(s.totalRevenue || 0).toFixed(2)}</td>
                                <td className="py-2 text-right">{s.orderCount}</td>
                            </tr>
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Payment + Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle className="text-sm">Payment Methods</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {report.paymentBreakdown?.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="capitalize">{p.method}</span>
                                <div className="flex gap-4">
                                    <span className="text-muted-foreground">{p.count}×</span>
                                    <span className="font-bold">€{p.total.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm">Order Types</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {report.orderTypeBreakdown?.map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span>{t.type}</span>
                                <div className="flex gap-4">
                                    <span className="text-muted-foreground">{t.count}×</span>
                                    <span className="font-bold">€{t.total.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Cash Drawer */}
            <Card className="border-amber-500/20">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4 text-amber-500" /> Cash Drawer Reconciliation</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><div className="text-xs text-muted-foreground">Opening Float</div><div className="font-bold">€{(report.cashDrawer?.openingFloat || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Cash Sales</div><div className="font-bold text-emerald-500">€{(report.cashDrawer?.cashSales || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Expected</div><div className="font-bold">€{(report.cashDrawer?.expectedInDrawer || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Counted</div><div className="font-bold text-amber-500">{report.cashDrawer?.countedInDrawer != null ? `€${report.cashDrawer.countedInDrawer.toFixed(2)}` : "—"}</div></div>
                    </div>
                </CardContent>
            </Card>

            {/* Fiscal Info */}
            <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Receipt className="size-4 text-primary" /> Fiscal Summary</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><div className="text-xs text-muted-foreground">First Invoice</div><div className="font-mono font-bold">{report.fiscal?.firstInvoice}</div></div>
                        <div><div className="text-xs text-muted-foreground">Last Invoice</div><div className="font-mono font-bold">{report.fiscal?.lastInvoice}</div></div>
                        <div><div className="text-xs text-muted-foreground">Confirmed</div><div className="font-bold text-emerald-500">{report.fiscal?.confirmed}</div></div>
                        <div><div className="text-xs text-muted-foreground">Failed</div><div className="font-bold text-red-500">{report.fiscal?.failed}</div></div>
                    </div>
                </CardContent>
            </Card>

            {/* Order list */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Orders ({report.orders?.length})</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="text-muted-foreground border-b sticky top-0 bg-card">
                                <th className="py-2 text-left">Time</th><th className="py-2 text-left">Order ID</th>
                                <th className="py-2 text-left">Customer</th><th className="py-2 text-left">Table</th>
                                <th className="py-2 text-left">Payment</th><th className="py-2 text-right">Total</th>
                            </tr></thead>
                            <tbody>
                                {report.orders?.map((o, i) => (
                                    <tr key={i} className="border-b hover:bg-muted/30">
                                        <td className="py-1.5">{o.time}</td>
                                        <td className="py-1.5 font-mono">{o.orderId}</td>
                                        <td className="py-1.5">{o.customer}</td>
                                        <td className="py-1.5">{o.table || "—"}</td>
                                        <td className="py-1.5">{o.paymentMethod}</td>
                                        <td className="py-1.5 text-right font-bold">€{o.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// === X-Report View ===
const XReportView = ({ report }) => {
    if (!report) return null;
    const s = report.summary || {};

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-emerald-500/20"><CardContent className="p-3">
                    <Euro className="size-4 text-emerald-500 mb-1" />
                    <div className="text-xl font-bold">€{(s.totalRevenue || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Revenue Today</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                    <Receipt className="size-4 text-blue-500 mb-1" />
                    <div className="text-xl font-bold">{s.orderCount || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                </CardContent></Card>
                <Card className="border-amber-500/20"><CardContent className="p-3">
                    <AlertCircle className="size-4 text-amber-500 mb-1" />
                    <div className="text-xl font-bold text-amber-500">{report.pending || 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Pending</div>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                    <TrendingUp className="size-4 text-purple-500 mb-1" />
                    <div className="text-xl font-bold">€{(s.avgOrderValue || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Avg Order</div>
                </CardContent></Card>
            </div>

            {/* Payment breakdown */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Payment Methods</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {report.paymentBreakdown?.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{p._id}</span>
                            <div className="flex gap-4">
                                <span className="text-muted-foreground">{p.count}×</span>
                                <span className="font-bold">€{(p.total || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Hourly data */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Hourly Revenue</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex items-end gap-1 h-32">
                        {report.hourlyData?.map((h, i) => {
                            const max = Math.max(...(report.hourlyData?.map(d => d.revenue) || [1]), 1);
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group">
                                    <div className="text-[9px] font-bold mb-1 opacity-0 group-hover:opacity-100">€{(h.revenue || 0).toFixed(0)}</div>
                                    <div className="w-full bg-primary/70 rounded-t hover:bg-primary transition-colors"
                                        style={{ height: `${((h.revenue || 0) / max) * 100}%`, minHeight: "4px" }}
                                        title={`${h._id}:00 — ${h.orders} orders, €${(h.revenue || 0).toFixed(0)}`}
                                    />
                                    <div className="text-[9px] text-muted-foreground mt-1">{h._id}h</div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ZReportPage;
