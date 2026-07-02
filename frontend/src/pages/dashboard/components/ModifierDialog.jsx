import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Check, X } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * ModifierDialog — popup za izbiro modifikatorjev artikla.
 *
 * Props:
 *   open — ali je dialog odprt
 *   onOpenChange — setOpen callback
 *   menuItem — artikel z modifierGroups (iz API-ja)
 *   onAddToCart — callback(item, quantity, modifiers) ko uporabnik potrdi
 *
 * Prikazuje:
 *   - Sliko in ime artikla
 *   - Modifier groups (radio za single, checkbox za multiple)
 *   - Price adjustments za vsak modifier
 *   - Quantity selector
 *   - Live total price calculation
 */
const ModifierDialog = ({ open, onOpenChange, menuItem, onAddToCart }) => {
    const [quantity, setQuantity] = useState(1);
    const [selections, setSelections] = useState({}); // { [groupId]: modifierName | [modifierNames] }

    // Reset ko se odpre z novim artiklom
    useEffect(() => {
        if (open && menuItem) {
            setQuantity(1);
            const initial = {};
            (menuItem.modifierGroups || []).forEach(group => {
                if (group.selectionType === 'single') {
                    // Najdi default modifier
                    const defaultMod = group.modifiers?.find(m => m.isDefault && m.isAvailable !== false);
                    initial[group._id] = defaultMod ? defaultMod.name : null;
                } else {
                    // Multiple — default izbrane
                    const defaults = group.modifiers?.filter(m => m.isDefault && m.isAvailable !== false).map(m => m.name) || [];
                    initial[group._id] = defaults;
                }
            });
            setSelections(initial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens with new item (menuItem._id)
    }, [open, menuItem?._id]);

    // Izračunaj ceno z modifikatorji
    const { unitPrice, totalPrice, selectedModifiers } = useMemo(() => {
        if (!menuItem) return { unitPrice: 0, totalPrice: 0, selectedModifiers: [] };

        let price = menuItem.price;
        const mods = [];

        (menuItem.modifierGroups || []).forEach(group => {
            const sel = selections[group._id];
            if (!sel) return;

            const selectedNames = Array.isArray(sel) ? sel : [sel];
            selectedNames.forEach(name => {
                const modifier = group.modifiers?.find(m => m.name === name && m.isAvailable !== false);
                if (modifier) {
                    if (modifier.priceOverride !== null && modifier.priceOverride !== undefined) {
                        price = modifier.priceOverride;
                    } else {
                        price += modifier.priceAdjustment || 0;
                    }
                    mods.push({
                        groupName: group.name,
                        modifierName: modifier.name,
                        priceAdjustment: modifier.priceAdjustment || 0,
                        priceOverride: modifier.priceOverride,
                    });
                }
            });
        });

        return {
            unitPrice: price,
            totalPrice: price * quantity,
            selectedModifiers: mods,
        };
    }, [menuItem, selections, quantity]);

    if (!menuItem) return null;

    const handleSelectSingle = (groupId, modifierName) => {
        setSelections(prev => ({ ...prev, [groupId]: modifierName }));
    };

    const handleToggleMultiple = (groupId, modifierName, maxSelections) => {
        setSelections(prev => {
            const current = prev[groupId] || [];
            if (current.includes(modifierName)) {
                return { ...prev, [groupId]: current.filter(n => n !== modifierName) };
            } else {
                if (maxSelections > 0 && current.length >= maxSelections) {
                    return prev; // ne dovoli več
                }
                return { ...prev, [groupId]: [...current, modifierName] };
            }
        });
    };

    const handleConfirm = () => {
        // Validiraj required groups
        for (const group of menuItem.modifierGroups || []) {
            if (group.required) {
                const sel = selections[group._id];
                if (!sel || (Array.isArray(sel) && sel.length === 0)) {
                    alert(`Prosimo izberite: ${group.name}`);
                    return;
                }
            }
        }
        onAddToCart?.(menuItem, quantity, selectedModifiers, unitPrice);
        onOpenChange?.(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{menuItem.name}</span>
                        <span className="text-primary">€{unitPrice.toFixed(2)}</span>
                    </DialogTitle>
                    {menuItem.description && (
                        <DialogDescription>{menuItem.description}</DialogDescription>
                    )}
                </DialogHeader>

                {/* Modifier groups */}
                <div className="space-y-4">
                    {(menuItem.modifierGroups || []).filter(g => g.isActive !== false).map(group => (
                        <div key={group._id} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold">
                                    {group.name}
                                    {group.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <span className="text-[10px] text-muted-foreground">
                                    {group.selectionType === 'single' ? 'Izberi eno' : `Izberi${group.maxSelections > 0 ? ` do ${group.maxSelections}` : ' več'}`}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                {group.modifiers?.filter(m => m.isAvailable !== false).sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)).map(modifier => {
                                    const sel = selections[group._id];
                                    const isSelected = group.selectionType === 'single'
                                        ? sel === modifier.name
                                        : Array.isArray(sel) && sel.includes(modifier.name);

                                    const priceLabel = modifier.priceOverride !== null && modifier.priceOverride !== undefined
                                        ? `€${modifier.priceOverride.toFixed(2)}`
                                        : modifier.priceAdjustment > 0
                                            ? `+€${modifier.priceAdjustment.toFixed(2)}`
                                            : modifier.priceAdjustment < 0
                                                ? `-€${Math.abs(modifier.priceAdjustment).toFixed(2)}`
                                                : '';

                                    return (
                                        <button
                                            key={modifier.name}
                                            onClick={() => {
                                                if (group.selectionType === 'single') {
                                                    handleSelectSingle(group._id, modifier.name);
                                                } else {
                                                    handleToggleMultiple(group._id, modifier.name, group.maxSelections);
                                                }
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all",
                                                isSelected
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                    : "border-border hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn(
                                                    "size-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                                    group.selectionType === 'single' ? "rounded-full" : "rounded",
                                                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                                                )}>
                                                    {isSelected && <Check className="size-2.5 text-primary-foreground" />}
                                                </div>
                                                <span className="text-sm">{modifier.name}</span>
                                            </div>
                                            {priceLabel && (
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    modifier.priceAdjustment > 0 || (modifier.priceOverride && modifier.priceOverride > menuItem.price)
                                                        ? "text-emerald-600"
                                                        : modifier.priceAdjustment < 0
                                                            ? "text-red-500"
                                                            : "text-muted-foreground"
                                                )}>
                                                    {priceLabel}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm font-medium">Količina</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="size-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70"
                        >
                            <Minus className="size-4" />
                        </button>
                        <span className="font-bold text-lg w-8 text-center">{quantity}</span>
                        <button
                            onClick={() => setQuantity(Math.min(99, quantity + 1))}
                            className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange?.(false)}>
                        Prekliči
                    </Button>
                    <Button onClick={handleConfirm} className="flex-1">
                        Dodaj — €{totalPrice.toFixed(2)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ModifierDialog;
