import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Building2, Plus, Edit, Trash2, Star, MapPin, Phone, Clock,
    Users, Grid2x2Check, DollarSign, ShoppingBag, Save, X
} from 'lucide-react';
import { useOutletStore } from '@/store/useOutletStore';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const WEEKDAYS = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
];

const OutletManagement = () => {
    const { outlets, isLoading, getOutlets, createOutlet, updateOutlet, deleteOutlet, setPrimary } = useOutletStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingOutlet, setEditingOutlet] = useState(null);

    useEffect(() => { getOutlets(); }, [getOutlets]);

    const handleAdd = () => {
        setEditingOutlet(null);
        setDialogOpen(true);
    };

    const handleEdit = (outlet) => {
        setEditingOutlet(outlet);
        setDialogOpen(true);
    };

    const handleDelete = async (outlet) => {
        if (!confirm(`Deactivate outlet "${outlet.name}"? This will make it inactive but preserve data.`)) return;
        await deleteOutlet(outlet._id);
    };

    const handleSetPrimary = async (outlet) => {
        if (!confirm(`Set "${outlet.name}" as primary outlet?`)) return;
        await setPrimary(outlet._id);
    };

    // Aggregate stats
    const totalOutlets = outlets.length;
    const activeOutlets = outlets.filter(o => o.isActive).length;
    const totalRevenue = outlets.reduce((sum, o) => sum + (o.stats?.totalRevenue || 0), 0);
    const totalOrders = outlets.reduce((sum, o) => sum + (o.stats?.totalOrders || 0), 0);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Building2 className="size-7 text-primary" />
                            Outlets Management
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upravljaj verigo restavrac — {activeOutlets} aktivnih od {totalOutlets}
                        </p>
                    </div>
                    <Button onClick={handleAdd}>
                        <Plus className="size-4 mr-2" />
                        New Outlet
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="size-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Outlets</p>
                                <p className="text-2xl font-bold">{totalOutlets}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <DollarSign className="size-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                                <p className="text-xl font-bold">€{totalRevenue.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <ShoppingBag className="size-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Orders</p>
                                <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Users className="size-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Staff</p>
                                <p className="text-2xl font-bold">
                                    {outlets.reduce((sum, o) => sum + (o.stats?.totalStaff || 0), 0)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Outlets grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <Building2 className="size-12 mx-auto mb-3 opacity-20 animate-pulse" />
                            Loading outlets...
                        </div>
                    ) : outlets.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <Building2 className="size-12 mx-auto mb-3 opacity-20" />
                            <p>No outlets — add your first location</p>
                        </div>
                    ) : (
                        outlets.map(outlet => (
                            <Card key={outlet._id} className={cn(
                                "relative overflow-hidden hover:shadow-md transition-shadow",
                                !outlet.isActive && "opacity-60"
                            )}>
                                {/* Primary badge */}
                                {outlet.isPrimary && (
                                    <div className="absolute top-3 right-3">
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                                            <Star className="size-3 mr-1 fill-current" />
                                            PRIMARY
                                        </Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-3">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "size-10 rounded-lg flex items-center justify-center shrink-0",
                                            outlet.isActive ? "bg-primary/10" : "bg-muted"
                                        )}>
                                            <Building2 className={cn("size-5", outlet.isActive ? "text-primary" : "text-muted-foreground")} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm truncate">{outlet.name}</h3>
                                            <p className="text-xs text-muted-foreground font-mono">{outlet.code}</p>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    {/* Address */}
                                    {outlet.address?.city && (
                                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <MapPin className="size-3.5 mt-0.5 shrink-0" />
                                            <span>
                                                {outlet.address.street && `${outlet.address.street}, `}
                                                {outlet.address.city}
                                                {outlet.address.zip && ` ${outlet.address.zip}`}
                                                {outlet.address.country && `, ${outlet.address.country}`}
                                            </span>
                                        </div>
                                    )}

                                    {/* Phone */}
                                    {outlet.phone && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Phone className="size-3.5" />
                                            <span>{outlet.phone}</span>
                                        </div>
                                    )}

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                                        <div className="text-center">
                                            <Grid2x2Check className="size-3.5 mx-auto text-muted-foreground mb-0.5" />
                                            <div className="text-sm font-bold">{outlet.stats?.totalTables || 0}</div>
                                            <div className="text-[10px] text-muted-foreground">Tables</div>
                                        </div>
                                        <div className="text-center">
                                            <Users className="size-3.5 mx-auto text-muted-foreground mb-0.5" />
                                            <div className="text-sm font-bold">{outlet.stats?.totalStaff || 0}</div>
                                            <div className="text-[10px] text-muted-foreground">Staff</div>
                                        </div>
                                        <div className="text-center">
                                            <DollarSign className="size-3.5 mx-auto text-muted-foreground mb-0.5" />
                                            <div className="text-sm font-bold">€{((outlet.stats?.totalRevenue || 0) / 1000).toFixed(1)}k</div>
                                            <div className="text-[10px] text-muted-foreground">Revenue</div>
                                        </div>
                                    </div>

                                    {/* Manager */}
                                    {outlet.manager && (
                                        <div className="flex items-center gap-2 text-xs pt-2 border-t">
                                            <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                                {outlet.manager.name?.slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-muted-foreground">Manager: {outlet.manager.name}</span>
                                        </div>
                                    )}
                                </CardContent>

                                {/* Actions */}
                                <div className="px-4 pb-4 flex gap-1.5">
                                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleEdit(outlet)}>
                                        <Edit className="size-3 mr-1" /> Edit
                                    </Button>
                                    {!outlet.isPrimary && outlet.isActive && (
                                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => handleSetPrimary(outlet)} title="Set as primary">
                                            <Star className="size-3" />
                                        </Button>
                                    )}
                                    {outlet.isActive && (
                                        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500" onClick={() => handleDelete(outlet)} title="Deactivate">
                                            <Trash2 className="size-3" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </div>

            </div>

            {/* Outlet Dialog */}
            <OutletDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                outlet={editingOutlet}
                onSave={async (data) => {
                    if (editingOutlet?._id) {
                        await updateOutlet(editingOutlet._id, data);
                    } else {
                        await createOutlet(data);
                    }
                    setDialogOpen(false);
                }}
            />
        </div>
    );
};

// === Outlet Dialog ===
const OutletDialog = ({ open, onOpenChange, outlet, onSave }) => {
    const [formData, setFormData] = useState({
        name: "", code: "", description: "",
        address: { street: "", city: "", zip: "", country: "Slovenia" },
        phone: "", email: "",
        taxNumber: "", currencyCode: "",
        openingHours: WEEKDAYS.reduce((acc, d) => {
            acc[d.key] = { open: "08:00", close: "22:00", closed: d.key === 'sunday' };
            return acc;
        }, {}),
        isPrimary: false,
        isActive: true,
    });

    useEffect(() => {
        if (outlet) {
            setFormData({
                name: outlet.name || "",
                code: outlet.code || "",
                description: outlet.description || "",
                address: outlet.address || { street: "", city: "", zip: "", country: "Slovenia" },
                phone: outlet.phone || "",
                email: outlet.email || "",
                taxNumber: outlet.taxNumber || "",
                currencyCode: outlet.currencyCode || "",
                openingHours: outlet.openingHours || formData.openingHours,
                isPrimary: outlet.isPrimary || false,
                isActive: outlet.isActive !== false,
            });
        } else {
            setFormData({
                name: "", code: "", description: "",
                address: { street: "", city: "", zip: "", country: "Slovenia" },
                phone: "", email: "",
                taxNumber: "", currencyCode: "",
                openingHours: WEEKDAYS.reduce((acc, d) => {
                    acc[d.key] = { open: "08:00", close: "22:00", closed: d.key === 'sunday' };
                    return acc;
                }, {}),
                isPrimary: false,
                isActive: true,
            });
        }
    }, [outlet, open]);

    const handleSubmit = () => {
        if (!formData.name.trim() || !formData.code.trim()) return;
        onSave(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{outlet ? "Edit Outlet" : "New Outlet"}</DialogTitle>
                    <DialogDescription>
                        {outlet ? `Editing ${outlet.name}` : "Add a new restaurant location"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Basic info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Name *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Tasty Station Ljubljana"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Code * (unique, uppercase)</Label>
                            <Input
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="TS-LJU"
                                maxLength={10}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Center Ljubljana, glavna restavracija"
                        />
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Address</Label>
                        <Input
                            value={formData.address.street}
                            onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                            placeholder="Slovenska cesta 1"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <Input
                                value={formData.address.city}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                placeholder="Ljubljana"
                            />
                            <Input
                                value={formData.address.zip}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, zip: e.target.value } })}
                                placeholder="1000"
                            />
                            <Input
                                value={formData.address.country}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })}
                                placeholder="Slovenia"
                            />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Phone</Label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+386 1 234 5678"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Email</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ljubljana@tastystation.si"
                            />
                        </div>
                    </div>

                    {/* Tax + currency */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tax Number ( davčna št.)</Label>
                            <Input
                                value={formData.taxNumber}
                                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                                placeholder="SI12345678"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Currency Override (optional)</Label>
                            <Input
                                value={formData.currencyCode}
                                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                                placeholder="EUR (empty = global)"
                                maxLength={3}
                            />
                        </div>
                    </div>

                    {/* Opening hours */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                            <Clock className="size-3" /> Opening Hours
                        </Label>
                        <div className="space-y-1.5">
                            {WEEKDAYS.map(day => (
                                <div key={day.key} className="flex items-center gap-2">
                                    <div className="w-12 text-xs font-medium">{day.label}</div>
                                    <input
                                        type="checkbox"
                                        checked={!formData.openingHours?.[day.key]?.closed}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            openingHours: {
                                                ...formData.openingHours,
                                                [day.key]: { ...formData.openingHours[day.key], closed: !e.target.checked }
                                            }
                                        })}
                                        className="size-3.5"
                                    />
                                    <Input
                                        type="time"
                                        value={formData.openingHours?.[day.key]?.open || "08:00"}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            openingHours: {
                                                ...formData.openingHours,
                                                [day.key]: { ...formData.openingHours[day.key], open: e.target.value }
                                            }
                                        })}
                                        className="h-8 w-28 text-xs"
                                        disabled={formData.openingHours?.[day.key]?.closed}
                                    />
                                    <span className="text-xs text-muted-foreground">to</span>
                                    <Input
                                        type="time"
                                        value={formData.openingHours?.[day.key]?.close || "22:00"}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            openingHours: {
                                                ...formData.openingHours,
                                                [day.key]: { ...formData.openingHours[day.key], close: e.target.value }
                                            }
                                        })}
                                        className="h-8 w-28 text-xs"
                                        disabled={formData.openingHours?.[day.key]?.closed}
                                    />
                                    {formData.openingHours?.[day.key]?.closed && (
                                        <span className="text-xs text-red-500">Closed</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isPrimary}
                                onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                                className="size-4"
                            />
                            <Star className="size-3" /> Primary outlet (HQ)
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="size-4"
                            />
                            Active
                        </label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="size-4 mr-2" /> Cancel
                    </Button>
                    <Button onClick={handleSubmit}>
                        <Save className="size-4 mr-2" />
                        {outlet ? "Save changes" : "Create outlet"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OutletManagement;
