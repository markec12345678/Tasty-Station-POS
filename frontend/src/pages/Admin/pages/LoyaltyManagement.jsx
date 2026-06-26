import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Award, Gift, Plus, Edit, Trash2, Star, Crown, Save } from 'lucide-react';
import axiosInstance from '@/axios/axiosInstace';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const tierColors = {
    Bronze: "bg-amber-700/10 text-amber-700 dark:text-amber-500 border-amber-700/30",
    Silver: "bg-slate-400/10 text-slate-600 dark:text-slate-300 border-slate-400/30",
    Gold: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    Platinum: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
};

const LoyaltyManagement = () => {
    const [rewards, setRewards] = useState([]);
    const [settings, setSettings] = useState(null);
    const [clients, setClients] = useState([]);
    const [rewardDialog, setRewardDialog] = useState({ open: false, reward: null });

    const fetchAll = async () => {
        try {
            const [r, s, c] = await Promise.all([
                axiosInstance.get("/loyalty/rewards"),
                axiosInstance.get("/loyalty/settings"),
                axiosInstance.get("/clients"),
            ]);
            setRewards(r.data.rewards || []);
            setSettings(s.data.settings);
            setClients(c.data.clients || c.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchAll(); }, []);

    const topClients = [...clients]
        .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 5);

    const handleDelete = async (id) => {
        if (!confirm("Delete this reward?")) return;
        try {
            await axiosInstance.delete(`/loyalty/rewards/${id}`);
            toast.success("Reward deleted");
            fetchAll();
        } catch (e) { toast.error("Failed to delete"); }
    };

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Award className="size-7 text-primary" /> Loyalty Program
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Upravljaj točke, tier-je in nagrade</p>
                    </div>
                    <Button onClick={() => setRewardDialog({ open: true, reward: null })}>
                        <Plus className="size-4 mr-2" /> New Reward
                    </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center"><Gift className="size-5 text-primary" /></div>
                        <div><p className="text-xs text-muted-foreground uppercase">Rewards</p><p className="text-2xl font-bold">{rewards.length}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Star className="size-5 text-amber-500" /></div>
                        <div><p className="text-xs text-muted-foreground uppercase">Pts/Rs</p><p className="text-2xl font-bold">{settings?.pointsPerRupee || 100}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Star className="size-5 text-emerald-500" /></div>
                        <div><p className="text-xs text-muted-foreground uppercase">Pts Value</p><p className="text-2xl font-bold">€{settings?.pointValue || 1}</p></div>
                    </CardContent></Card>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Crown className="size-5 text-purple-500" /></div>
                        <div><p className="text-xs text-muted-foreground uppercase">Status</p><p className="text-sm font-bold">{settings?.enabled ? "✓ Active" : "✗ Disabled"}</p></div>
                    </CardContent></Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rewards Catalog</CardTitle>
                        <CardDescription>Nagrade, ki jih stranke izkoristijo s točkami</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {rewards.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground"><Gift className="size-12 mx-auto mb-3 opacity-20" /><p>Ni nagrad — dodaj prvo</p></div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rewards.map(reward => (
                                    <div key={reward._id} className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow group">
                                        <div className="p-4 flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">{reward.icon || "🎁"}</div>
                                                <div><h3 className="font-semibold">{reward.name}</h3><p className="text-xs text-muted-foreground">{reward.description}</p></div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="size-7" onClick={() => setRewardDialog({ open: true, reward })}><Edit className="size-3.5" /></Button>
                                                <Button size="icon" variant="ghost" className="size-7 text-red-500" onClick={() => handleDelete(reward._id)}><Trash2 className="size-3.5" /></Button>
                                            </div>
                                        </div>
                                        <div className="px-4 pb-4 flex items-center justify-between">
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30"><Star className="size-3 mr-1" />{reward.pointsCost} pts</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {reward.type === "fixed_discount" && `€${reward.value} off`}
                                                {reward.type === "percentage_discount" && `${reward.value}% off`}
                                                {reward.type === "free_item" && `Free item`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top Customers</CardTitle>
                        <CardDescription>Najbolj zveste stranke</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topClients.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">Ni strank</div>
                        ) : (
                            <div className="space-y-2">
                                {topClients.map((client, idx) => (
                                    <div key={client._id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("size-8 rounded-full flex items-center justify-center font-bold text-sm",
                                                idx === 0 ? "bg-yellow-500/20 text-yellow-700" : idx === 1 ? "bg-slate-400/20 text-slate-600" : idx === 2 ? "bg-amber-700/20 text-amber-700" : "bg-muted text-muted-foreground")}>
                                                {idx + 1}
                                            </div>
                                            <div><div className="font-medium">{client.name}</div><div className="text-xs text-muted-foreground">{client.phone}</div></div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={cn(tierColors[client.tier || "Bronze"])}><Crown className="size-3 mr-1" />{client.tier || "Bronze"}</Badge>
                                            <div className="text-right"><div className="text-sm font-bold">{client.loyaltyPoints || 0} pts</div><div className="text-xs text-muted-foreground">€{(client.totalSpent || 0).toLocaleString()}</div></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LoyaltyManagement;
