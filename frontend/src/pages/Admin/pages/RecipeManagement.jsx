import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    BookOpen, Plus, Trash2, Save, X, ChefHat, DollarSign, TrendingUp,
    Package, Search, Calculator, AlertCircle
} from 'lucide-react';
import { useRecipeStore } from '@/store/useRecipeStore';
import { useMenuStore } from '@/store/useMenuStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { can } from '@/utils/rbac';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const EMPTY_FORM = {
    menuItem: '',
    ingredients: [{ inventory: '', quantity: '', unit: '', optional: false, note: '' }],
    instructions: '',
    prepTime: '',
};

const RecipeManagement = () => {
    const { recipes, isLoading, getRecipes, saveRecipe, deleteRecipe } = useRecipeStore();
    const { menu, getAllMenuItems } = useMenuStore();
    const { items: inventoryItems, fetchInventory } = useInventoryStore();
    const { authUser } = useAuthStore();
    // Popravek: prej hardcoded € — sedaj uporabljamo useCurrencyStore.format()
    const format = useCurrencyStore((s) => s.format);
    // RBAC: only menu:create/update/delete roles can manage recipes
    const canCreate = can(authUser?.role, 'menu:create');
    const canUpdate = can(authUser?.role, 'menu:update');
    const canDelete = can(authUser?.role, 'menu:delete');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [search, setSearch] = useState('');
    const [costingDialog, setCostingDialog] = useState(null); // recipe za costing popup

    useEffect(() => {
        getRecipes();
        getAllMenuItems(1, 100); // pridobi vse menu item-e za dropdown
        fetchInventory(1, 100);  // pridobi vse inventory item-e za dropdown
    }, [getRecipes, getAllMenuItems, fetchInventory]);

    const filteredRecipes = recipes.filter(r =>
        r.menuItem?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleAdd = () => {
        setEditingRecipe(null);
        setFormData(EMPTY_FORM);
        setDialogOpen(true);
    };

    const handleEdit = (recipe) => {
        setEditingRecipe(recipe);
        setFormData({
            menuItem: recipe.menuItem?._id || '',
            ingredients: recipe.ingredients?.map(ing => ({
                inventory: ing.inventory?._id || ing.inventory,
                quantity: String(ing.quantity || ''),
                unit: ing.unit || '',
                optional: ing.optional || false,
                note: ing.note || '',
            })) || [{ inventory: '', quantity: '', unit: '', optional: false, note: '' }],
            instructions: recipe.instructions || '',
            prepTime: recipe.prepTime ? String(recipe.prepTime) : '',
        });
        setDialogOpen(true);
    };

    const handleDelete = async (recipe) => {
        if (!confirm(`Delete recipe for "${recipe.menuItem?.name}"? This cannot be undone.`)) return;
        await deleteRecipe(recipe._id);
    };

    const handleAddIngredient = () => {
        setFormData(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { inventory: '', quantity: '', unit: '', optional: false, note: '' }],
        }));
    };

    const handleRemoveIngredient = (index) => {
        setFormData(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index),
        }));
    };

    const handleIngredientChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            ingredients: prev.ingredients.map((ing, i) =>
                i === index ? { ...ing, [field]: value } : ing
            ),
        }));
    };

    const handleSubmit = async () => {
        if (!formData.menuItem) {
            toast.error("Please select a menu item");
            return;
        }
        const validIngredients = formData.ingredients.filter(ing => ing.inventory && parseFloat(ing.quantity) > 0);
        if (validIngredients.length === 0) {
            toast.error("Add at least one ingredient with quantity > 0");
            return;
        }

        const payload = {
            menuItem: formData.menuItem,
            ingredients: validIngredients.map(ing => ({
                inventory: ing.inventory,
                quantity: parseFloat(ing.quantity),
                unit: ing.unit || null,
                optional: ing.optional,
                note: ing.note || '',
            })),
            instructions: formData.instructions,
            prepTime: formData.prepTime ? parseInt(formData.prepTime) : 0,
        };

        const result = await saveRecipe(payload);
        if (result.success) {
            setDialogOpen(false);
            setFormData(EMPTY_FORM);
            setEditingRecipe(null);
        }
    };

    // === Stats ===
    const totalRecipes = recipes.length;
    const avgCost = totalRecipes > 0
        ? (recipes.reduce((s, r) => s + (r.computedCost || 0), 0) / totalRecipes).toFixed(2)
        : '0.00';
    const avgMargin = totalRecipes > 0
        ? recipes.reduce((s, r) => {
            const price = r.menuItem?.price || 0;
            const cost = r.computedCost || 0;
            return s + (price > 0 ? ((price - cost) / price * 100) : 0);
        }, 0) / totalRecipes
        : 0;
    const totalIngredients = recipes.reduce((s, r) => s + (r.ingredients?.length || 0), 0);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <BookOpen className="size-7 text-primary" />
                            Recipe Management
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upravljaj recepte (Bill of Materials) za recipe costing in AI inventory forecasting.
                        </p>
                    </div>
                    {canCreate && (
                    <Button onClick={handleAdd}>
                        <Plus className="size-4 mr-2" /> New Recipe
                    </Button>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="size-5 text-primary" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Recipes</p><p className="text-2xl font-bold">{totalRecipes}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign className="size-5 text-emerald-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Avg Cost</p><p className="text-2xl font-bold">{format(parseFloat(avgCost))}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <TrendingUp className="size-5 text-amber-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Avg Margin</p><p className="text-2xl font-bold">{avgMargin.toFixed(1)}%</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Package className="size-5 text-purple-500" />
                        </div>
                        <div><p className="text-xs text-muted-foreground uppercase">Ingredients</p><p className="text-2xl font-bold">{totalIngredients}</p></div>
                    </CardContent></Card>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by menu item name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Recipe List */}
                {isLoading ? (
                    <Card><CardContent className="p-12 text-center text-muted-foreground">
                        <ChefHat className="size-12 mx-auto mb-3 opacity-30" />
                        Loading recipes...
                    </CardContent></Card>
                ) : filteredRecipes.length === 0 ? (
                    <Card><CardContent className="p-12 text-center">
                        <BookOpen className="size-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground mb-4">
                            {search ? 'No recipes match your search.' : 'No recipes yet. Create your first recipe to enable AI inventory forecasting.'}
                        </p>
                        {!search && canCreate && (
                            <Button onClick={handleAdd}><Plus className="size-4 mr-2" /> Create Recipe</Button>
                        )}
                    </CardContent></Card>
                ) : (
                    <div className="grid gap-3">
                        {filteredRecipes.map((recipe) => {
                            const price = recipe.menuItem?.price || 0;
                            const cost = recipe.computedCost || 0;
                            const margin = price > 0 ? ((price - cost) / price * 100) : 0;

                            return (
                                <Card key={recipe._id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            {/* Left: Menu item info */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {recipe.menuItem?.image ? (
                                                    <img src={recipe.menuItem.image} alt="" className="size-12 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="size-12 rounded-lg bg-muted flex items-center justify-center">
                                                        <ChefHat className="size-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate">{recipe.menuItem?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {recipe.ingredients?.length || 0} ingredients · {recipe.prepTime || 0} min prep
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {recipe.ingredients?.slice(0, 4).map((ing, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {ing.inventory?.name || '?'} ×{ing.quantity}
                                                            </Badge>
                                                        ))}
                                                        {recipe.ingredients?.length > 4 && (
                                                            <Badge variant="outline" className="text-xs">+{recipe.ingredients.length - 4}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Cost + margin + actions */}
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Cost</p>
                                                    <p className="font-bold text-lg">{format(cost)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Price</p>
                                                    <p className="font-bold text-lg">{format(price)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Margin</p>
                                                    <p className={cn(
                                                        "font-bold text-lg",
                                                        margin >= 70 ? "text-emerald-600" : margin >= 50 ? "text-amber-600" : "text-red-600"
                                                    )}>
                                                        {margin.toFixed(1)}%
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setCostingDialog(recipe)}
                                                    >
                                                        <Calculator className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEdit(recipe)}
                                                        disabled={!canUpdate}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => handleDelete(recipe)}
                                                        disabled={!canDelete}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Info banner */}
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertCircle className="size-5 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                                Why recipes matter
                            </p>
                            <p className="text-muted-foreground">
                                Recipes (Bill of Materials) enable <strong>accurate inventory forecasting</strong> and
                                <strong> recipe costing</strong>. Without recipes, the AI forecast falls back to naive
                                text matching (unreliable). With recipes, the system calculates real consumption:
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">portions_sold × ingredient_quantity</code>.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* === Create/Edit Dialog === */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
                        <DialogDescription>
                            Define ingredients and quantities for a menu item. This enables recipe costing and AI forecasting.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Menu item selector */}
                        <div className="space-y-1.5">
                            <Label>Menu Item *</Label>
                            <Select
                                value={formData.menuItem}
                                onValueChange={(v) => setFormData({ ...formData, menuItem: v })}
                                disabled={!!editingRecipe}
                            >
                                <SelectTrigger><SelectValue placeholder="Select menu item..." /></SelectTrigger>
                                <SelectContent>
                                    {menu.map(mi => (
                                        <SelectItem key={mi._id} value={mi._id}>
                                            {mi.name} — {format(mi.price || 0)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Ingredients */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Ingredients *</Label>
                                <Button size="sm" variant="outline" onClick={handleAddIngredient}>
                                    <Plus className="size-4 mr-1" /> Add
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {formData.ingredients.map((ing, index) => (
                                    <div key={index} className="flex items-start gap-2 p-2 rounded-lg border bg-muted/30">
                                        <div className="flex-1 grid grid-cols-12 gap-2">
                                            <div className="col-span-5">
                                                <Select
                                                    value={ing.inventory}
                                                    onValueChange={(v) => handleIngredientChange(index, 'inventory', v)}
                                                >
                                                    <SelectTrigger className="h-9"><SelectValue placeholder="Inventory..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {inventoryItems.map(inv => (
                                                            <SelectItem key={inv._id} value={inv._id}>
                                                                {inv.name} ({format(inv.costPerUnit || 0)}/{inv.unit})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-3">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Qty"
                                                    value={ing.quantity}
                                                    onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    placeholder="Unit"
                                                    value={ing.unit}
                                                    onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="col-span-2 flex items-center gap-1 pt-1">
                                                <Checkbox
                                                    checked={ing.optional}
                                                    onCheckedChange={(v) => handleIngredientChange(index, 'optional', v)}
                                                    id={`opt-${index}`}
                                                />
                                                <Label htmlFor={`opt-${index}`} className="text-xs">Opt.</Label>
                                            </div>
                                        </div>
                                        {formData.ingredients.length > 1 && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 h-9"
                                                onClick={() => handleRemoveIngredient(index)}
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-1.5">
                            <Label>Instructions (optional)</Label>
                            <Textarea
                                placeholder="Cooking instructions..."
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                rows={2}
                            />
                        </div>

                        {/* Prep time */}
                        <div className="space-y-1.5 max-w-xs">
                            <Label>Prep Time (minutes)</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formData.prepTime}
                                onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>
                            <Save className="size-4 mr-2" />
                            {editingRecipe ? 'Update Recipe' : 'Create Recipe'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* === Costing Dialog === */}
            {costingDialog && (
                <CostingDialog
                    recipe={costingDialog}
                    onClose={() => setCostingDialog(null)}
                />
            )}
        </div>
    );
};

// === Costing sub-dialog ===
const CostingDialog = ({ recipe, onClose }) => {
    const [costing, setCosting] = useState(null);
    const { getCosting } = useRecipeStore();
    const format = useCurrencyStore((s) => s.format);

    useEffect(() => {
        if (recipe.menuItem?._id) {
            getCosting(recipe.menuItem._id).then(setCosting);
        }
    }, [recipe, getCosting]);

    return (
        <Dialog open={!!recipe} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="size-5" />
                        Recipe Costing — {recipe.menuItem?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Detailed cost breakdown based on current inventory prices.
                    </DialogDescription>
                </DialogHeader>

                {!costing ? (
                    <div className="py-8 text-center text-muted-foreground">
                        <Calculator className="size-10 mx-auto mb-2 opacity-30" />
                        Loading costing...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted">
                                <p className="text-xs text-muted-foreground">Computed Cost</p>
                                <p className="text-xl font-bold">{format(costing.computedCost || 0)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted">
                                <p className="text-xs text-muted-foreground">Sale Price</p>
                                <p className="text-xl font-bold">{format(costing.salePrice || 0)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-emerald-500/10">
                                <p className="text-xs text-muted-foreground">Gross Profit</p>
                                <p className="text-xl font-bold text-emerald-600">{format(costing.grossProfit || 0)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-amber-500/10">
                                <p className="text-xs text-muted-foreground">Margin</p>
                                <p className="text-xl font-bold text-amber-600">{(costing.marginPercent || 0).toFixed(1)}%</p>
                            </div>
                        </div>

                        {/* Ingredient breakdown */}
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Ingredient Breakdown</p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {costing.ingredients?.map((ing, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                                        <span>{ing.name} × {ing.quantity} {ing.unit}</span>
                                        <span className="text-muted-foreground">{format(ing.lineCost || 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RecipeManagement;
