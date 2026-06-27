import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    ShoppingCart, Plus, Minus, X, Search, Utensils,
    CheckCircle2, Loader2, Phone, User, AlertCircle, Flame, Leaf, Clock
} from 'lucide-react';
import { useQROrderStore } from '@/store/useQROrderStore';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import ModifierDialog from '@/pages/dashboard/components/ModifierDialog';
import { toast } from 'sonner';

const spiceLevelLabels = { mild: "Mild", medium: "Medium", hot: "Hot", extra_hot: "Extra Hot" };
const spiceLevelColors = {
    mild: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    hot: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    extra_hot: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const QROrderPage = () => {
    const { tableId } = useParams();
    const {
        menuByCategory, table, cart, customerName, customerPhone,
        isLoading, isSubmitting, lastOrder, error,
        loadData, addToCart, removeFromCart, setCustomer, placeOrder, reset,
        getCartTotal, getCartCount,
    } = useQROrderStore();

    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [modifierDialogItem, setModifierDialogItem] = useState(null);

    useEffect(() => { if (tableId) loadData(tableId); }, [tableId, loadData]);
    useEffect(() => () => reset(), [reset]);

    const filteredCategories = menuByCategory.filter(cat => {
        if (activeCategory !== "all" && cat._id !== activeCategory) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return cat.items.some(item => item.name.toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q));
        }
        return true;
    }).map(cat => ({
        ...cat,
        items: searchQuery.trim()
            ? cat.items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
            : cat.items,
    })).filter(cat => cat.items.length > 0);

    const handleCheckout = async () => {
        if (!customerName.trim()) { alert("Prosimo vnesite ime"); return; }
        const result = await placeOrder(tableId);
        setCheckoutOpen(false);
        if (result.success) setSuccessOpen(true);
    };

    const cartTotal = getCartTotal();
    const cartCount = getCartCount();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="size-12 mx-auto mb-4 text-primary animate-spin" />
                    <p className="text-muted-foreground">Nalagamo meni...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <AlertCircle className="size-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-bold mb-2">Napaka</h1>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={() => loadData(tableId)}>Poskusi znova</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 pb-32">
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
                <div className="max-w-3xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="size-9 bg-primary rounded-lg flex items-center justify-center">
                                <Utensils className="size-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="font-bold text-base leading-tight">Tasty Station</h1>
                                <p className="text-[10px] text-muted-foreground">
                                    {table ? `Miza ${table.name} • ${table.zone}` : "Meni"}
                                </p>
                            </div>
                        </div>
                        {cartCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground">
                                <ShoppingCart className="size-4" />
                                <span className="text-sm font-bold">{cartCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Iskanje jedi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-11 rounded-full"
                    />
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-4">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    <button
                        onClick={() => setActiveCategory("all")}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                            activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        )}
                    >
                        Vse
                    </button>
                    {menuByCategory.map(cat => (
                        <button
                            key={cat._id}
                            onClick={() => setActiveCategory(cat._id)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                activeCategory === cat._id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pt-4 space-y-6">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Utensils className="size-12 mx-auto mb-3 opacity-20" />
                        <p>Ni najdenih jedi</p>
                    </div>
                ) : (
                    filteredCategories.map(category => (
                        <div key={category._id}>
                            <h2 className="font-bold text-lg mb-3 sticky top-[88px] bg-background/95 backdrop-blur-sm py-1 z-30">
                                {category.name}
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                    {category.items.length} artiklov
                                </span>
                            </h2>
                            <div className="space-y-3">
                                {category.items.map(item => {
                                    const inCart = cart.find(c => c.menuItemId === item._id);
                                    return (
                                        <div key={item._id} className="flex gap-3 p-3 rounded-xl bg-card border hover:shadow-sm transition-shadow">
                                            <div className="size-20 rounded-lg overflow-hidden bg-muted shrink-0">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Utensils className="size-6 text-muted-foreground/40" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                                                    </div>
                                                    <span className="font-bold text-sm whitespace-nowrap">€{item.price.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                    {item.isVeg ? (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                                            <Leaf className="size-2.5" /> Veg
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400">
                                                            <Flame className="size-2.5" /> Non-Veg
                                                        </span>
                                                    )}
                                                    {item.spiceLevel && item.spiceLevel !== "mild" && (
                                                        <span className={cn("flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded", spiceLevelColors[item.spiceLevel])}>
                                                            <Flame className="size-2.5" /> {spiceLevelLabels[item.spiceLevel]}
                                                        </span>
                                                    )}
                                                    {item.preparationTime && (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                            <Clock className="size-2.5" /> {item.preparationTime}min
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex justify-end">
                                                    {inCart ? (
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => removeFromCart(inCart.cartKey || item._id)} className="size-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70">
                                                                <Minus className="size-3.5" />
                                                            </button>
                                                            <span className="font-bold text-sm w-6 text-center">{inCart.quantity}</span>
                                                            <button onClick={() => {
                                                                if (item.modifierGroups?.length > 0) {
                                                                    setModifierDialogItem(item);
                                                                } else {
                                                                    addToCart(item);
                                                                }
                                                            }} className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90">
                                                                <Plus className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => {
                                                            if (item.modifierGroups?.length > 0) {
                                                                setModifierDialogItem(item);
                                                            } else {
                                                                addToCart(item);
                                                            }
                                                        }}>
                                                            <Plus className="size-3 mr-1" /> Dodaj
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {cartCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg">
                    <div className="max-w-3xl mx-auto px-4 py-3">
                        <Button onClick={() => setCheckoutOpen(true)} className="w-full h-12 text-base" size="lg">
                            <ShoppingCart className="size-5 mr-2" />
                            Naroči ({cartCount}) — €{cartTotal.toFixed(2)}
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Zaključi naročilo</DialogTitle>
                        <DialogDescription>{table && `Miza ${table.name} • ${table.zone}`}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.cartKey || item.menuItemId} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                                            <span className="font-bold text-xs">{item.quantity}×</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate">{item.name}</div>
                                            {item.modifiers && item.modifiers.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {item.modifiers.map((mod, mi) => (
                                                        <span key={mi} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                                                            {mod.modifierName}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-muted-foreground">€{((item.unitPrice || item.price) * item.quantity).toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.cartKey || item.menuItemId)} className="text-red-500 hover:text-red-600">
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between font-bold">
                                <span>Skupaj</span><span>€{cartTotal.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Plačilo izvedete po obroku pri natakarju.</p>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium flex items-center gap-1"><User className="size-3" /> Ime *</label>
                                <Input placeholder="Vaše ime" value={customerName} onChange={(e) => setCustomer(e.target.value, customerPhone)} required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium flex items-center gap-1"><Phone className="size-3" /> Telefon (opcija)</label>
                                <Input placeholder="+386 ..." value={customerPhone} onChange={(e) => setCustomer(customerName, e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Prekliči</Button>
                        <Button onClick={handleCheckout} disabled={isSubmitting || !customerName.trim()}>
                            {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Pošiljanje...</> : <>Oddaj naročilo • €{cartTotal.toFixed(2)}</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="size-6" /> Naročilo sprejeto!
                        </DialogTitle>
                        <DialogDescription>Hvala za vaše naročilo. Kuhinja ga že pripravlja.</DialogDescription>
                    </DialogHeader>
                    {lastOrder && (
                        <div className="space-y-3">
                            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Številka naročila</span>
                                    <span className="font-mono font-bold">{lastOrder.orderId}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Miza</span>
                                    <span className="font-medium">{lastOrder.table}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Artikli</span>
                                    <span className="font-medium">{lastOrder.itemCount}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-1 border-t">
                                    <span>Skupaj</span><span>€{lastOrder.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {lastOrder.items?.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs">
                                        <span>{item.quantity}× {item.name}</span>
                                        <span className="text-muted-foreground">€{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => { setSuccessOpen(false); reset(); }} className="w-full">Zapri</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modifier Selection Dialog */}
            <ModifierDialog
                open={!!modifierDialogItem}
                onOpenChange={(open) => !open && setModifierDialogItem(null)}
                menuItem={modifierDialogItem}
                onAddToCart={(item, qty, mods, price) => {
                    addToCart(item, qty, mods, price);
                    toast.success(`${item.name} dodan v košarico`);
                }}
            />
        </div>
    );
};

export default QROrderPage;
