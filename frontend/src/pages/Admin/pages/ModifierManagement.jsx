import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    SlidersHorizontal, Plus, Edit, Trash2, Save, X, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { useModifierStore } from '@/store/useModifierStore';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const ModifierManagement = () => {
    const { groups, isLoading, getGroups, createGroup, updateGroup, deleteGroup } = useModifierStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    useEffect(() => { getGroups(); }, [getGroups]);

    const handleAdd = () => { setEditingGroup(null); setDialogOpen(true); };
    const handleEdit = (group) => { setEditingGroup(group); setDialogOpen(true); };
    const handleDelete = async (group) => {
        if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
        await deleteGroup(group._id);
    };

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <SlidersHorizontal className="size-7 text-primary" />
                            Modifier Groups
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upravljaj skupine modifikatorjev za artikle (extra cheese, cook temperature, size...)
                        </p>
                    </div>
                    <Button onClick={handleAdd}>
                        <Plus className="size-4 mr-2" /> New Modifier Group
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <SlidersHorizontal className="size-5 text-primary" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Groups</p><p className="text-2xl font-bold">{groups.length}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Check className="size-5 text-emerald-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold">{groups.filter(g => g.isActive).length}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Plus className="size-5 text-amber-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Required</p><p className="text-2xl font-bold">{groups.filter(g => g.required).length}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <SlidersHorizontal className="size-5 text-purple-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Total Options</p><p className="text-2xl font-bold">{groups.reduce((s, g) => s + (g.modifiers?.length || 0), 0)}</p></div>
                    </CardContent></Card>
                </div>

                {/* Groups list */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <SlidersHorizontal className="size-12 mx-auto mb-3 opacity-20 animate-pulse" />
                            Loading...
                        </div>
                    ) : groups.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <SlidersHorizontal className="size-12 mx-auto mb-3 opacity-20" />
                                <p>No modifier groups yet — add your first one</p>
                                <p className="text-xs mt-2">Examples: "Cook Temperature", "Extras", "Sauce", "Size"</p>
                            </CardContent>
                        </Card>
                    ) : (
                        groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(group => (
                            <Card key={group._id} className={cn(!group.isActive && "opacity-60")}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("size-9 rounded-lg flex items-center justify-center", group.isActive ? "bg-primary/10" : "bg-muted")}>
                                                <SlidersHorizontal className={cn("size-4", group.isActive ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm">{group.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {group.required && <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-700 border-red-500/30">Required</Badge>}
                                                    <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                                                        {group.selectionType === 'single' ? 'Single choice' : 'Multiple'}
                                                    </Badge>
                                                    {group.maxSelections > 0 && (
                                                        <Badge variant="outline" className="text-[9px] bg-muted">Max {group.maxSelections}</Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-[9px]">{group.modifiers?.length || 0} options</Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => handleEdit(group)}>
                                                <Edit className="size-3.5 mr-1" /> Edit
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500" onClick={() => handleDelete(group)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {group.modifiers?.sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)).map((mod, i) => (
                                            <div key={i} className={cn(
                                                "p-2 rounded-md border text-xs",
                                                mod.isAvailable === false ? "opacity-40 bg-muted" : "bg-card"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{mod.name}</span>
                                                    {mod.isDefault && <Check className="size-3 text-primary" />}
                                                </div>
                                                <div className="text-muted-foreground mt-0.5">
                                                    {mod.priceOverride !== null && mod.priceOverride !== undefined
                                                        ? `€${mod.priceOverride.toFixed(2)}`
                                                        : mod.priceAdjustment > 0
                                                            ? `+€${mod.priceAdjustment.toFixed(2)}`
                                                            : mod.priceAdjustment < 0
                                                                ? `-€${Math.abs(mod.priceAdjustment).toFixed(2)}`
                                                                : 'No price change'
                                                    }
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

            </div>

            {/* Dialog */}
            <GroupDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                group={editingGroup}
                onSave={async (data) => {
                    if (editingGroup?._id) {
                        await updateGroup(editingGroup._id, data);
                    } else {
                        await createGroup(data);
                    }
                    setDialogOpen(false);
                }}
            />
        </div>
    );
};

// === Group Dialog ===
const GroupDialog = ({ open, onOpenChange, group, onSave }) => {
    const [formData, setFormData] = useState({
        name: "", description: "", required: false,
        selectionType: "single", maxSelections: 0, isActive: true, sortOrder: 0,
        modifiers: [],
    });

    useEffect(() => {
        if (group) {
            setFormData({
                name: group.name || "",
                description: group.description || "",
                required: group.required || false,
                selectionType: group.selectionType || "single",
                maxSelections: group.maxSelections || 0,
                isActive: group.isActive !== false,
                sortOrder: group.sortOrder || 0,
                modifiers: group.modifiers?.map(m => ({ ...m })) || [],
            });
        } else {
            setFormData({
                name: "", description: "", required: false,
                selectionType: "single", maxSelections: 0, isActive: true, sortOrder: 0,
                modifiers: [],
            });
        }
    }, [group, open]);

    const addModifier = () => {
        setFormData(prev => ({
            ...prev,
            modifiers: [...prev.modifiers, {
                name: "", priceAdjustment: 0, priceOverride: null,
                isDefault: false, isAvailable: true, prepTimeAdjustment: 0, sortOrder: prev.modifiers.length,
            }],
        }));
    };

    const updateModifier = (idx, field, value) => {
        setFormData(prev => ({
            ...prev,
            modifiers: prev.modifiers.map((m, i) => i === idx ? { ...m, [field]: value } : m),
        }));
    };

    const removeModifier = (idx) => {
        setFormData(prev => ({ ...prev, modifiers: prev.modifiers.filter((_, i) => i !== idx) }));
    };

    const moveModifier = (idx, dir) => {
        setFormData(prev => {
            const mods = [...prev.modifiers];
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= mods.length) return prev;
            [mods[idx], mods[newIdx]] = [mods[newIdx], mods[idx]];
            mods.forEach((m, i) => m.sortOrder = i);
            return { ...prev, modifiers: mods };
        });
    };

    const handleSave = () => {
        if (!formData.name.trim()) return toast.error("Name is required");
        // Clean modifiers
        const cleanModifiers = formData.modifiers.filter(m => m.name.trim());
        onSave({ ...formData, modifiers: cleanModifiers });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{group ? "Edit Modifier Group" : "New Modifier Group"}</DialogTitle>
                    <DialogDescription>
                        {group ? `Editing ${group.name}` : "Create a group of options (e.g. Cook Temperature, Extras)"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Basic */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Name *</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Cook Temperature" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="How would you like it cooked?" />
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Selection Type</Label>
                            <select
                                value={formData.selectionType}
                                onChange={(e) => setFormData({ ...formData, selectionType: e.target.value })}
                                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                            >
                                <option value="single">Single (radio)</option>
                                <option value="multiple">Multiple (checkbox)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max Selections (0=unlimited)</Label>
                            <Input type="number" min="0" value={formData.maxSelections}
                                onChange={(e) => setFormData({ ...formData, maxSelections: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Sort Order</Label>
                            <Input type="number" min="0" value={formData.sortOrder}
                                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={formData.required} onChange={(e) => setFormData({ ...formData, required: e.target.checked })} className="size-4" />
                            Required (guest must select)
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="size-4" />
                            Active
                        </label>
                    </div>

                    {/* Modifiers */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Options / Modifiers</Label>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addModifier}>
                                <Plus className="size-3 mr-1" /> Add Option
                            </Button>
                        </div>

                        {formData.modifiers.length === 0 ? (
                            <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
                                No options yet — add "Rare", "Medium", "Well Done" etc.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {formData.modifiers.map((mod, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                                        <div className="flex flex-col">
                                            <button onClick={() => moveModifier(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                                <ChevronUp className="size-3" />
                                            </button>
                                            <button onClick={() => moveModifier(idx, 1)} disabled={idx === formData.modifiers.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                                <ChevronDown className="size-3" />
                                            </button>
                                        </div>
                                        <Input
                                            value={mod.name}
                                            onChange={(e) => updateModifier(idx, 'name', e.target.value)}
                                            placeholder="Option name (e.g. Medium)"
                                            className="h-8 text-xs flex-1"
                                        />
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-muted-foreground">€</span>
                                            <Input
                                                type="number"
                                                step="0.50"
                                                value={mod.priceAdjustment}
                                                onChange={(e) => updateModifier(idx, 'priceAdjustment', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                className="h-8 w-16 text-xs"
                                                title="Price adjustment (+2.00, -0.50)"
                                            />
                                        </div>
                                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Default selected">
                                            <input type="checkbox" checked={mod.isDefault} onChange={(e) => updateModifier(idx, 'isDefault', e.target.checked)} className="size-3" />
                                            Def
                                        </label>
                                        <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Available">
                                            <input type="checkbox" checked={mod.isAvailable} onChange={(e) => updateModifier(idx, 'isAvailable', e.target.checked)} className="size-3" />
                                            Avail
                                        </label>
                                        <button onClick={() => removeModifier(idx)} className="text-red-500 hover:text-red-600">
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>
                        <Save className="size-4 mr-2" />
                        {group ? "Save changes" : "Create group"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ModifierManagement;
