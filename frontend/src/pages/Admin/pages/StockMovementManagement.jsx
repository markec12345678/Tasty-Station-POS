import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeftRight, TrendingDown, TrendingUp, Package, Calculator,
    AlertTriangle, History, Plus, RefreshCw, Filter
} from 'lucide-react';
import { useStockMovementStore } from '@/store/useStockMovementStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useOutletStore } from '@/store/useOutletStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { can } from '@/utils/rbac';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

// Tipi gibanj z barvami in ikonami
const MOVEMENT_TYPES = {
    order:      { label: 'Order',      color: 'bg-blue-500/10 text-blue-700 border-blue-500/30',       icon: TrendingDown, sign: '-' },
    restock:    { label: 'Restock',    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', icon: TrendingUp,   sign: '+' },
    waste:      { label: 'Waste',      color: 'bg-red-500/10 text-red-700 border-red-500/30',          icon: AlertTriangle, sign: '-' },
    adjustment: { label: 'Adjustment', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30',    icon: Calculator,    sign: '±' },
    transfer:   { label: 'Transfer',   color: 'bg-purple-500/10 text-purple-700 border-purple-500/30', icon: ArrowLeftRight, sign: '±' },
    return:     { label: 'Return',     color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/30',       icon: RefreshCw,     sign: '+' },
};

const StockMovementManagement = () => {
    const {
        movements, stats, isLoading, pagination,
        getMovements, getStats, restock, adjust,
    } = useStockMovementStore();
    const { items: inventoryItems, fetchInventory } = useInventoryStore();
    const { outlets, getOutlets } = useOutletStore();
    const { authUser } = useAuthStore();
    // Popravek: prej hardcoded € — sedaj uporabljamo useCurrencyStore.format()
    const format = useCurrencyStore((s) => s.format);
    // RBAC: only inventory:update roles can restock/adjust stock
    const canUpdateStock = can(authUser?.role, 'inventory:update');
    // Outlets: samo uporabniki z outlets:read vidijo outlet filter (admin, manager)
    const canViewOutlets = can(authUser?.role, 'outlets:read');

    const [filters, setFilters] = useState({
        type: 'all',
        inventory: 'all',
        outlet: 'all',
        startDate: '',
        endDate: '',
        page: 1,
    });
    const [restockDialog, setRestockDialog] = useState(false);
    const [adjustDialog, setAdjustDialog] = useState(false);
    const [historyDialog, setHistoryDialog] = useState(null); // inventory item za stock card

    useEffect(() => {
        fetchInventory(1, 100);
        if (canViewOutlets) getOutlets();
    }, [fetchInventory, getOutlets, canViewOutlets]);

    useEffect(() => {
        const params = {};
        if (filters.type !== 'all') params.type = filters.type;
        if (filters.inventory !== 'all') params.inventory = filters.inventory;
        if (filters.outlet !== 'all') params.outlet = filters.outlet;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        params.page = filters.page;
        getMovements(params);
        getStats(filters.startDate, filters.endDate);
    }, [filters, getMovements, getStats]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const handleResetFilters = () => {
        setFilters({ type: 'all', inventory: 'all', outlet: 'all', startDate: '', endDate: '', page: 1 });
    };

    // === Stats prikaz ===
    const totalConsumed = stats?.totals?.totalConsumedValue || 0;
    const totalMovements = stats?.totals?.totalMovements || 0;
    const topConsumed = stats?.topConsumed || [];
    const byType = stats?.byType || [];

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <History className="size-7 text-primary" />
                            Stock Movements
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Audit trail vseh sprememb zaloge — poraba, dopolnitve, odpisi, korekcije.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {canUpdateStock && (
                        <Button variant="outline" onClick={() => setAdjustDialog(true)}>
                            <Calculator className="size-4 mr-2" /> Adjust
                        </Button>
                        )}
                        {canUpdateStock && (
                        <Button onClick={() => setRestockDialog(true)}>
                            <Plus className="size-4 mr-2" /> Restock
                        </Button>
                        )}
                    </div>
                </div>

                {/* Stats dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <TrendingDown className="size-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase">Total Consumed</p>
                            <p className="text-2xl font-bold">{format(totalConsumed)}</p>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <History className="size-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase">Movements</p>
                            <p className="text-2xl font-bold">{totalMovements}</p>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp className="size-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase">Restocks</p>
                            <p className="text-2xl font-bold">
                                {byType.find(t => t._id === 'restock')?.count || 0}
                            </p>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <AlertTriangle className="size-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase">Waste</p>
                            <p className="text-2xl font-bold">
                                {byType.find(t => t._id === 'waste')?.count || 0}
                            </p>
                        </div>
                    </CardContent></Card>
                </div>

                {/* Top consumed items */}
                {topConsumed.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="size-4" /> Top 5 Consumed Items
                            </CardTitle>
                            <CardDescription>Najbolj porabljeni inventory item-i v izbranem obdobju</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {topConsumed.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                {i + 1}
                                            </span>
                                            <span className="font-medium">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-muted-foreground">
                                                {item.totalConsumed.toFixed(2)} {item.unit || 'units'}
                                            </span>
                                            <span className="font-semibold">{format(item.totalValue || 0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="size-4 text-muted-foreground" />
                            <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v)}>
                                <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {Object.entries(MOVEMENT_TYPES).map(([key, t]) => (
                                        <SelectItem key={key} value={key}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={filters.inventory} onValueChange={(v) => handleFilterChange('inventory', v)}>
                                <SelectTrigger className="w-48"><SelectValue placeholder="Inventory" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Items</SelectItem>
                                    {inventoryItems.map(inv => (
                                        <SelectItem key={inv._id} value={inv._id}>{inv.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {canViewOutlets && outlets.length > 0 && (
                            <Select value={filters.outlet} onValueChange={(v) => handleFilterChange('outlet', v)}>
                                <SelectTrigger className="w-40"><SelectValue placeholder="Outlet" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Outlets</SelectItem>
                                    {outlets.map(o => (
                                        <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            )}

                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                className="w-40"
                            />
                            <span className="text-muted-foreground">→</span>
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                className="w-40"
                            />

                            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                                Reset
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Movements list */}
                {isLoading ? (
                    <Card><CardContent className="p-12 text-center text-muted-foreground">
                        <History className="size-12 mx-auto mb-3 opacity-30" />
                        Loading movements...
                    </CardContent></Card>
                ) : movements.length === 0 ? (
                    <Card><CardContent className="p-12 text-center">
                        <History className="size-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No stock movements found for the selected filters.</p>
                    </CardContent></Card>
                ) : (
                    <div className="rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr className="text-left">
                                        <th className="p-3 font-medium">Date</th>
                                        <th className="p-3 font-medium">Type</th>
                                        <th className="p-3 font-medium">Item</th>
                                        <th className="p-3 font-medium text-right">Change</th>
                                        <th className="p-3 font-medium text-right">Before</th>
                                        <th className="p-3 font-medium text-right">After</th>
                                        <th className="p-3 font-medium text-right">Value</th>
                                        <th className="p-3 font-medium">Reason</th>
                                        <th className="p-3 font-medium">User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m) => {
                                        const typeInfo = MOVEMENT_TYPES[m.type] || MOVEMENT_TYPES.adjustment;
                                        const TypeIcon = typeInfo.icon;
                                        return (
                                            <tr key={m._id} className="border-t hover:bg-muted/30">
                                                <td className="p-3 text-muted-foreground whitespace-nowrap">
                                                    {new Date(m.createdAt).toLocaleDateString('sl-SI', {
                                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </td>
                                                <td className="p-3">
                                                    <Badge className={cn('border', typeInfo.color)}>
                                                        <TypeIcon className="size-3 mr-1" />
                                                        {typeInfo.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        className="font-medium hover:underline text-left"
                                                        onClick={() => setHistoryDialog(m.inventory?._id || m.inventory)}
                                                    >
                                                        {m.inventoryName}
                                                    </button>
                                                    {m.menuItemName && (
                                                        <p className="text-xs text-muted-foreground">{m.menuItemName}</p>
                                                    )}
                                                </td>
                                                <td className={cn(
                                                    'p-3 text-right font-semibold font-mono',
                                                    m.quantityChange < 0 ? 'text-red-600' : 'text-emerald-600'
                                                )}>
                                                    {m.quantityChange > 0 ? '+' : ''}{m.quantityChange.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-right text-muted-foreground font-mono">
                                                    {m.quantityBefore.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-right font-mono">
                                                    {m.quantityAfter.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-right font-mono">
                                                    {format(m.totalValue || 0)}
                                                </td>
                                                <td className="p-3 text-muted-foreground max-w-xs truncate">
                                                    {m.reason || '—'}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {m.userName || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.total} total)
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pagination.currentPage <= 1}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pagination.currentPage >= pagination.totalPages}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* === Restock Dialog === */}
            {restockDialog && (
                <RestockDialog
                    inventoryItems={inventoryItems}
                    onClose={() => setRestockDialog(false)}
                    onRestock={async (data) => {
                        const result = await restock(data);
                        if (result.success) {
                            setRestockDialog(false);
                            fetchInventory(1, 100); // osveži inventory stanje
                        }
                        return result;
                    }}
                />
            )}

            {/* === Adjust Dialog === */}
            {adjustDialog && (
                <AdjustDialog
                    inventoryItems={inventoryItems}
                    onClose={() => setAdjustDialog(false)}
                    onAdjust={async (data) => {
                        const result = await adjust(data);
                        if (result.success) {
                            setAdjustDialog(false);
                            fetchInventory(1, 100);
                        }
                        return result;
                    }}
                />
            )}

            {/* === Stock Card History Dialog === */}
            {historyDialog && (
                <HistoryDialog
                    inventoryId={historyDialog}
                    onClose={() => setHistoryDialog(null)}
                />
            )}
        </div>
    );
};

// === Restock sub-dialog ===
const RestockDialog = ({ inventoryItems, onClose, onRestock }) => {
    const format = useCurrencyStore((s) => s.format);
    const [formData, setFormData] = useState({
        inventory: '',
        quantity: '',
        reason: '',
        costPerUnit: '',
    });
    const [saving, setSaving] = useState(false);

    const selectedItem = inventoryItems.find(i => i._id === formData.inventory);

    const handleSubmit = async () => {
        if (!formData.inventory) { toast.error("Select an inventory item"); return; }
        if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
            toast.error("Quantity must be > 0"); return;
        }
        setSaving(true);
        await onRestock({
            inventory: formData.inventory,
            quantity: parseFloat(formData.quantity),
            reason: formData.reason || 'Manual restock',
            costPerUnit: formData.costPerUnit ? parseFloat(formData.costPerUnit) : undefined,
        });
        setSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="size-5" /> Restock Inventory
                    </DialogTitle>
                    <DialogDescription>Add stock from supplier delivery.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Inventory Item *</Label>
                        <Select value={formData.inventory} onValueChange={(v) => setFormData({ ...formData, inventory: v })}>
                            <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                            <SelectContent>
                                {inventoryItems.map(inv => (
                                    <SelectItem key={inv._id} value={inv._id}>
                                        {inv.name} ({inv.quantity} {inv.unit})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem && (
                        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            Current stock: <strong>{selectedItem.quantity} {selectedItem.unit}</strong>
                            <br />Current cost: {format(selectedItem.costPerUnit || 0)}/{selectedItem.unit}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Quantity *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Cost per unit (optional)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Leave empty to keep current"
                                value={formData.costPerUnit}
                                onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Reason (optional)</Label>
                        <Input
                            placeholder="e.g., Weekly delivery from supplier"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Saving...' : 'Restock'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// === Adjust sub-dialog ===
const AdjustDialog = ({ inventoryItems, onClose, onAdjust }) => {
    const [formData, setFormData] = useState({
        inventory: '',
        newQuantity: '',
        reason: '',
    });
    const [saving, setSaving] = useState(false);

    const selectedItem = inventoryItems.find(i => i._id === formData.inventory);
    const change = selectedItem && formData.newQuantity
        ? parseFloat(formData.newQuantity) - selectedItem.quantity
        : 0;

    const handleSubmit = async () => {
        if (!formData.inventory) { toast.error("Select an inventory item"); return; }
        if (formData.newQuantity === '' || parseFloat(formData.newQuantity) < 0) {
            toast.error("New quantity must be >= 0"); return;
        }
        if (!formData.reason || formData.reason.trim().length < 3) {
            toast.error("Reason is required (min 3 chars)"); return;
        }
        setSaving(true);
        await onAdjust({
            inventory: formData.inventory,
            newQuantity: parseFloat(formData.newQuantity),
            reason: formData.reason,
        });
        setSaving(false);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="size-5" /> Adjust Stock
                    </DialogTitle>
                    <DialogDescription>Manual correction (inventory count, spoilage, etc.).</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Inventory Item *</Label>
                        <Select value={formData.inventory} onValueChange={(v) => setFormData({ ...formData, inventory: v })}>
                            <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                            <SelectContent>
                                {inventoryItems.map(inv => (
                                    <SelectItem key={inv._id} value={inv._id}>
                                        {inv.name} ({inv.quantity} {inv.unit})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem && (
                        <div className="text-sm bg-muted/30 p-3 rounded-lg space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current stock:</span>
                                <strong>{selectedItem.quantity} {selectedItem.unit}</strong>
                            </div>
                            {formData.newQuantity !== '' && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Change:</span>
                                    <span className={cn('font-bold', change < 0 ? 'text-red-600' : 'text-emerald-600')}>
                                        {change > 0 ? '+' : ''}{change.toFixed(2)} {selectedItem.unit}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>New Quantity *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={formData.newQuantity}
                            onChange={(e) => setFormData({ ...formData, newQuantity: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Reason * (min 3 chars)</Label>
                        <Textarea
                            placeholder="e.g., Inventory count correction, spoilage, damage"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Saving...' : 'Adjust'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// === Stock Card History sub-dialog ===
const HistoryDialog = ({ inventoryId, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const { getInventoryHistory } = useStockMovementStore();

    useEffect(() => {
        getInventoryHistory(inventoryId).then(h => {
            setHistory(h);
            setLoading(false);
        });
    }, [inventoryId, getInventoryHistory]);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="size-5" /> Stock Card — Full History
                    </DialogTitle>
                    <DialogDescription>
                        Complete movement history for this inventory item (newest first).
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading...</div>
                ) : history.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No movements found.</div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {history.map((m) => {
                            const typeInfo = MOVEMENT_TYPES[m.type] || MOVEMENT_TYPES.adjustment;
                            const TypeIcon = typeInfo.icon;
                            return (
                                <div key={m._id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                                    <Badge className={cn('border shrink-0', typeInfo.color)}>
                                        <TypeIcon className="size-3 mr-1" />
                                        {typeInfo.label}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn(
                                                'font-mono font-bold',
                                                m.quantityChange < 0 ? 'text-red-600' : 'text-emerald-600'
                                            )}>
                                                {m.quantityChange > 0 ? '+' : ''}{m.quantityChange.toFixed(2)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(m.createdAt).toLocaleString('sl-SI')}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {m.quantityBefore.toFixed(2)} → {m.quantityAfter.toFixed(2)} {m.unit}
                                        </div>
                                        {m.reason && (
                                            <p className="text-sm mt-1">{m.reason}</p>
                                        )}
                                        {m.menuItemName && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                From: {m.menuItemName}
                                            </p>
                                        )}
                                        {m.userName && (
                                            <p className="text-xs text-muted-foreground">
                                                By: {m.userName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StockMovementManagement;
