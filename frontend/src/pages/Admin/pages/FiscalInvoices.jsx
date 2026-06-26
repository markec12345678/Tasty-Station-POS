import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Receipt, Search, Filter, ChevronLeft, ChevronRight, RefreshCw,
    CheckCircle2, AlertCircle, Clock, FileText, Euro, RotateCcw
} from 'lucide-react';
import { useFiscalStore } from '@/store/useFiscalStore';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
    confirmed: { icon: CheckCircle2, color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", label: "Confirmed" },
    pending: { icon: Clock, color: "text-amber-500", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30", label: "Pending" },
    failed: { icon: AlertCircle, color: "text-red-500", badge: "bg-red-500/10 text-red-700 border-red-500/30", label: "Failed" },
    cancelled: { icon: AlertCircle, color: "text-gray-500", badge: "bg-gray-500/10 text-gray-700 border-gray-500/30", label: "Cancelled" },
};

const FiscalInvoices = () => {
    const { invoices, stats, pagination, filters, isLoading, getInvoices, getStats, retryInvoice, setFilter, clearFilters } = useFiscalStore();
    const [showFilters, setShowFilters] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => { getInvoices(1); getStats(); }, [getInvoices, getStats]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        getInvoices(newPage);
    };

    const handleApplyFilters = () => {
        getInvoices(1);
        getStats(filters.startDate, filters.endDate);
    };

    const handleClear = () => {
        clearFilters();
        setTimeout(() => { getInvoices(1); getStats(); }, 50);
    };

    const handleRetry = async (invoice) => {
        await retryInvoice(invoice._id);
    };

    const totalInvoices = stats?.total || 0;
    const confirmedCount = stats?.byStatus?.find(s => s._id === "confirmed")?.count || 0;
    const failedCount = stats?.byStatus?.find(s => s._id === "failed")?.count || 0;
    const totalRevenue = stats?.totalRevenue || 0;

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Receipt className="size-7 text-primary" />
                        Fiscal Invoices
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Davčni računi (FURS) — {totalInvoices} skupaj, {confirmedCount} potrjenih
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="size-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Invoices</p>
                                <p className="text-2xl font-bold">{totalInvoices.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle2 className="size-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Confirmed</p>
                                <p className="text-2xl font-bold text-emerald-500">{confirmedCount.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <AlertCircle className="size-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p>
                                <p className="text-2xl font-bold text-red-500">{failedCount.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Euro className="size-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                                <p className="text-xl font-bold">€{totalRevenue.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Filter className="size-4" /> Filters
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                                {showFilters ? "Hide" : "Show"}
                            </Button>
                        </div>
                    </CardHeader>
                    {showFilters && (
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Search (invoice#, ZOI, EOR)</label>
                                    <Input
                                        placeholder="Search..."
                                        value={filters.search}
                                        onChange={(e) => setFilter("search", e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Status</label>
                                    <select
                                        value={filters.status}
                                        onChange={(e) => setFilter("status", e.target.value)}
                                        className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                    >
                                        <option value="">All statuses</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="pending">Pending</option>
                                        <option value="failed">Failed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">From date</label>
                                    <Input
                                        type="date"
                                        value={filters.startDate.split("T")[0]}
                                        onChange={(e) => setFilter("startDate", e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">To date</label>
                                    <Input
                                        type="date"
                                        value={filters.endDate.split("T")[0]}
                                        onChange={(e) => setFilter("endDate", e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleApplyFilters} size="sm">
                                    <Search className="size-4 mr-2" /> Apply
                                </Button>
                                <Button onClick={handleClear} variant="outline" size="sm">Clear</Button>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Invoices table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Invoices</CardTitle>
                        <CardDescription>
                            Prikaz {invoices.length} od {pagination.total} — stran {pagination.page} od {pagination.totalPages}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Receipt className="size-8 mx-auto mb-2 animate-pulse" /> Loading...
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Receipt className="size-12 mx-auto mb-3 opacity-20" />
                                <p>No fiscal invoices found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-muted-foreground">
                                            <th className="py-2 pr-3">Invoice #</th>
                                            <th className="py-2 pr-3">Date</th>
                                            <th className="py-2 pr-3">Customer</th>
                                            <th className="py-2 pr-3 text-right">Total</th>
                                            <th className="py-2 pr-3">Tax #</th>
                                            <th className="py-2 pr-3">Status</th>
                                            <th className="py-2 pr-3">ZOI/EOR</th>
                                            <th className="py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map(inv => {
                                            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                                            const StatusIcon = cfg.icon;
                                            return (
                                                <tr
                                                    key={inv._id}
                                                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedInvoice(inv)}
                                                >
                                                    <td className="py-2.5 pr-3 font-mono text-xs font-bold">{inv.invoiceNumber}</td>
                                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(inv.issueDateTime), "MMM d, HH:mm")}
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-xs">{inv.customerName || "—"}</td>
                                                    <td className="py-2.5 pr-3 text-right font-bold">€{(inv.totals?.total || 0).toFixed(2)}</td>
                                                    <td className="py-2.5 pr-3 text-xs font-mono">{inv.taxNumber || "—"}</td>
                                                    <td className="py-2.5 pr-3">
                                                        <Badge variant="outline" className={cn("text-[10px]", cfg.badge)}>
                                                            <StatusIcon className="size-3 mr-1" />
                                                            {cfg.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-xs font-mono text-muted-foreground">
                                                        {inv.zoi ? inv.zoi.slice(0, 8) + "..." : "—"}
                                                    </td>
                                                    <td className="py-2.5">
                                                        {inv.status === "failed" && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-xs text-amber-600"
                                                                onClick={(e) => { e.stopPropagation(); handleRetry(inv); }}
                                                            >
                                                                <RotateCcw className="size-3 mr-1" />
                                                                Retry
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1}>
                                <ChevronLeft className="size-4" /> Prev
                            </Button>
                            <div className="flex items-center px-3 text-sm">{pagination.page} / {pagination.totalPages}</div>
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>
                                Next <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Invoice detail dialog */}
                {selectedInvoice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedInvoice(null)}>
                        <div className="bg-background rounded-lg border shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">Invoice Details</h2>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>✕</Button>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Invoice Number</span><span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{format(new Date(selectedInvoice.issueDateTime), "MMM d, yyyy HH:mm:ss")}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{selectedInvoice.customerName || "—"}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tax Number</span><span className="font-mono">{selectedInvoice.taxNumber}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{selectedInvoice.status}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Attempts</span><span>{selectedInvoice.attempts}</span></div>

                                <div className="border-t pt-3">
                                    <div className="text-xs font-semibold mb-2">ZOI</div>
                                    <div className="font-mono text-xs bg-muted p-2 rounded break-all">{selectedInvoice.zoi || "—"}</div>
                                </div>

                                <div>
                                    <div className="text-xs font-semibold mb-2">EOR</div>
                                    <div className="font-mono text-xs bg-muted p-2 rounded break-all">{selectedInvoice.eor || "—"}</div>
                                </div>

                                <div className="border-t pt-3 space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>€{(selectedInvoice.totals?.subtotal || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>€{(selectedInvoice.totals?.taxAmount || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between font-bold"><span>Total</span><span>€{(selectedInvoice.totals?.total || 0).toFixed(2)}</span></div>
                                </div>

                                {selectedInvoice.taxBreakdown?.length > 0 && (
                                    <div className="border-t pt-3">
                                        <div className="text-xs font-semibold mb-2">Tax Breakdown</div>
                                        {selectedInvoice.taxBreakdown.map((tb, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span>DDV {tb.rate}%</span>
                                                <span>Base: €{tb.base.toFixed(2)} → Tax: €{tb.tax.toFixed(2)} → Gross: €{tb.gross.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedInvoice.fiscalQR && (
                                    <div className="border-t pt-3">
                                        <div className="text-xs font-semibold mb-2">Fiscal QR Content</div>
                                        <div className="font-mono text-xs bg-muted p-2 rounded break-all">{selectedInvoice.fiscalQR}</div>
                                    </div>
                                )}

                                {selectedInvoice.error?.message && (
                                    <div className="border-t pt-3">
                                        <div className="text-xs font-semibold mb-1 text-red-500">Error</div>
                                        <div className="text-xs text-red-600 bg-red-500/5 p-2 rounded">{selectedInvoice.error.message}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default FiscalInvoices;
