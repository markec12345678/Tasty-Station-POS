import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ScrollArea, ScrollBar
} from "@/components/ui/scroll-area";
import {
    Shield, Search, Filter, ChevronLeft, ChevronRight, Trash2,
    Activity, AlertCircle, CheckCircle2, Clock, User, Database
} from 'lucide-react';
import { useAuditStore } from '@/store/useAuditStore';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const ACTION_COLORS = {
    login: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    login_failed: "bg-red-500/10 text-red-700 dark:text-red-400",
    logout: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
    order_create: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    order_payment: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    order_status_update: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    backup_download: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    backup_restore: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    loyalty_redeem: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

const STATUS_ICONS = {
    success: CheckCircle2,
    failed: AlertCircle,
    warning: AlertCircle,
};

const STATUS_COLORS = {
    success: "text-emerald-500",
    failed: "text-red-500",
    warning: "text-amber-500",
};

const AuditLog = () => {
    const {
        logs, stats, pagination, filters, isLoading,
        getLogs, getStats, setFilter, clearFilters, deleteOlder,
    } = useAuditStore();

    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        getLogs(1);
        getStats();
    }, [getLogs, getStats]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        getLogs(newPage);
    };

    const handleApplyFilters = () => {
        getLogs(1);
        getStats(filters.startDate, filters.endDate);
    };

    const handleClear = () => {
        clearFilters();
        setTimeout(() => {
            getLogs(1);
            getStats();
        }, 50);
    };

    const handleDeleteOlder = async () => {
        const date = prompt("Delete logs older than (YYYY-MM-DD):");
        if (!date) return;
        const result = await deleteOlder(date);
        if (result.success) {
            toast.success(result.message);
            getLogs(1);
            getStats();
        } else {
            toast.error("Failed to delete logs");
        }
    };

    const totalActions = stats?.total || 0;
    const failedCount = stats?.byStatus?.find(s => s._id === "failed")?.count || 0;
    const topActions = stats?.byAction?.slice(0, 5) || [];

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Shield className="size-7 text-primary" />
                            Audit Log
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Sledenje vseh akcij v sistemu — {pagination.total} skupaj zapisov
                        </p>
                    </div>
                    <Button variant="outline" onClick={handleDeleteOlder} className="text-red-600 hover:text-red-700">
                        <Trash2 className="size-4 mr-2" />
                        Cleanup old logs
                    </Button>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Activity className="size-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Actions</p>
                                <p className="text-2xl font-bold">{totalActions.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle2 className="size-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Successful</p>
                                <p className="text-2xl font-bold">
                                    {(stats?.byStatus?.find(s => s._id === "success")?.count || 0).toLocaleString()}
                                </p>
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
                                <User className="size-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Users</p>
                                <p className="text-2xl font-bold">{stats?.topUsers?.length || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Top actions chart */}
                {topActions.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Top Actions</CardTitle>
                            <CardDescription>Najpogostejše akcije v sistemu</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {topActions.map((action, _idx) => {
                                    const max = topActions[0].count;
                                    const pct = (action.count / max) * 100;
                                    return (
                                        <div key={action._id} className="flex items-center gap-3">
                                            <div className="w-40 text-xs font-medium truncate">{action._id}</div>
                                            <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                                                <div
                                                    className="h-full bg-primary/70 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="w-16 text-right text-xs font-bold">{action.count}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Filter className="size-4" />
                                Filters
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                {showFilters ? "Hide" : "Show"}
                            </Button>
                        </div>
                    </CardHeader>
                    {showFilters && (
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Search</label>
                                    <Input
                                        placeholder="Description or email..."
                                        value={filters.search}
                                        onChange={(e) => setFilter("search", e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Action</label>
                                    <select
                                        value={filters.action}
                                        onChange={(e) => setFilter("action", e.target.value)}
                                        className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                    >
                                        <option value="">All actions</option>
                                        <option value="login">Login</option>
                                        <option value="login_failed">Login failed</option>
                                        <option value="logout">Logout</option>
                                        <option value="order_create">Order create</option>
                                        <option value="order_payment">Order payment</option>
                                        <option value="order_status_update">Order status</option>
                                        <option value="backup_download">Backup download</option>
                                        <option value="backup_restore">Backup restore</option>
                                        <option value="loyalty_redeem">Loyalty redeem</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Status</label>
                                    <select
                                        value={filters.status}
                                        onChange={(e) => setFilter("status", e.target.value)}
                                        className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                    >
                                        <option value="">All statuses</option>
                                        <option value="success">Success</option>
                                        <option value="failed">Failed</option>
                                        <option value="warning">Warning</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Entity</label>
                                    <select
                                        value={filters.entity}
                                        onChange={(e) => setFilter("entity", e.target.value)}
                                        className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                    >
                                        <option value="">All entities</option>
                                        <option value="order">Order</option>
                                        <option value="menu_item">Menu item</option>
                                        <option value="table">Table</option>
                                        <option value="user">User</option>
                                        <option value="backup">Backup</option>
                                        <option value="loyalty">Loyalty</option>
                                        <option value="auth">Auth</option>
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
                                    <Search className="size-4 mr-2" />
                                    Apply filters
                                </Button>
                                <Button onClick={handleClear} variant="outline" size="sm">
                                    Clear
                                </Button>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Logs table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Activity Log</CardTitle>
                        <CardDescription>
                            Prikaz {logs.length} od {pagination.total} zapisov — stran {pagination.page} od {pagination.totalPages}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Activity className="size-8 mx-auto mb-2 animate-pulse" />
                                Loading...
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Database className="size-12 mx-auto mb-3 opacity-20" />
                                <p>No audit log entries match your filters</p>
                            </div>
                        ) : (
                            <ScrollArea className="w-full">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-muted-foreground">
                                            <th className="py-2 pr-3">Time</th>
                                            <th className="py-2 pr-3">User</th>
                                            <th className="py-2 pr-3">Action</th>
                                            <th className="py-2 pr-3">Description</th>
                                            <th className="py-2 pr-3">Status</th>
                                            <th className="py-2">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => {
                                            const StatusIcon = STATUS_ICONS[log.status] || AlertCircle;
                                            return (
                                                <tr key={log._id} className="border-b hover:bg-muted/50 transition-colors">
                                                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                                                        <Clock className="size-3 inline mr-1 opacity-50" />
                                                        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                                                    </td>
                                                    <td className="py-2.5 pr-3">
                                                        <div className="text-xs">
                                                            <div className="font-medium">{log.user?.name || log.userEmail || "System"}</div>
                                                            {log.userRole && (
                                                                <div className="text-muted-foreground capitalize">{log.userRole}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 pr-3">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] font-mono",
                                                                ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"
                                                            )}
                                                        >
                                                            {log.action}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2.5 pr-3 text-xs">{log.description}</td>
                                                    <td className="py-2.5 pr-3">
                                                        <div className={cn("flex items-center gap-1", STATUS_COLORS[log.status])}>
                                                            <StatusIcon className="size-3.5" />
                                                            <span className="text-xs capitalize">{log.status}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-xs text-muted-foreground font-mono">
                                                        {log.ipAddress || "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Showing {(pagination.page - 1) * pagination.limit + 1}-
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                            >
                                <ChevronLeft className="size-4" />
                                Prev
                            </Button>
                            <div className="flex items-center px-3 text-sm">
                                {pagination.page} / {pagination.totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasNext}
                            >
                                Next
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AuditLog;
