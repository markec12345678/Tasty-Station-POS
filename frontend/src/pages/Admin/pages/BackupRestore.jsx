import React, { useEffect, useState, useRef } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Download, Upload, Database, Shield, AlertTriangle, CheckCircle2,
    Users, UtensilsCrossed, Grid2x2Check, ShoppingBag, Package,
    Receipt, Percent, Tag, FileArchive, Clock, Loader2
} from 'lucide-react';
import axiosInstance from '@/axios/axiosInstace';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from 'date-fns';
import { toast } from 'sonner';

const BackupRestore = () => {
    const [counts, setCounts] = useState(null);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [lastBackupAt, setLastBackupAt] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [dropExisting, setDropExisting] = useState(false);
    const [restoreDialog, setRestoreDialog] = useState(false);
    const [restoreResult, setRestoreResult] = useState(null);
    const [resultDialog, setResultDialog] = useState(false);
    const fileInputRef = useRef(null);

    const getStats = async () => {
        try {
            const res = await axiosInstance.get("/backup/stats");
            setCounts(res.data.counts);
        } catch (error) {
            console.error("Backup stats error:", error);
        }
    };

    useEffect(() => { getStats(); }, []);

    const handleDownload = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch(`${axiosInstance.defaults.baseURL}/backup`, { credentials: "include" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const disposition = response.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            a.download = match ? match[1] : `tasty-station-backup-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            setLastBackupAt(new Date().toISOString());
            toast.success("Backup downloaded successfully");
        } catch (error) {
            toast.error(error.message || "Backup failed");
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.zip')) return toast.error("Please select a .zip file");
        if (file.size > 100 * 1024 * 1024) return toast.error("File too large (max 100 MB)");
        setSelectedFile(file);
        setRestoreDialog(true);
    };

    const handleRestoreConfirm = async () => {
        if (!selectedFile) return;
        setRestoreDialog(false);
        setIsRestoring(true);
        try {
            const formData = new FormData();
            formData.append("backup", selectedFile);
            formData.append("dropExisting", String(dropExisting));
            const res = await axiosInstance.post("/backup/restore", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 120000,
            });
            if (res.data.success) {
                toast.success(`Restore complete — ${res.data.inserted.users} users, ${res.data.inserted.menuItems} menu items`);
                setRestoreResult(res.data);
                setResultDialog(true);
                getStats();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Restore failed");
        } finally {
            setIsRestoring(false);
            setSelectedFile(null);
            setDropExisting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const collectionCards = [
        { key: 'users', label: 'Users', icon: Users, color: 'text-blue-500' },
        { key: 'menuItems', label: 'Menu Items', icon: UtensilsCrossed, color: 'text-emerald-500' },
        { key: 'tables', label: 'Tables', icon: Grid2x2Check, color: 'text-cyan-500' },
        { key: 'orders', label: 'Orders', icon: Receipt, color: 'text-orange-500' },
        { key: 'clients', label: 'Clients', icon: ShoppingBag, color: 'text-pink-500' },
        { key: 'inventory', label: 'Inventory', icon: Package, color: 'text-amber-500' },
        { key: 'rewards', label: 'Rewards', icon: Tag, color: 'text-purple-500' },
    ];

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Database className="size-7 text-primary" />
                            Backup & Restore
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Export baze v ZIP ali restore iz backup-a</p>
                    </div>
                    {lastBackupAt && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700">
                            <Clock className="size-3 mr-1" />
                            Last backup: {format(new Date(lastBackupAt), 'MMM d, HH:mm')}
                        </Badge>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Database Status</CardTitle>
                        <CardDescription>Skupno {counts?.total?.toLocaleString() || 0} zapisov</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                            {collectionCards.map(({ key, label, icon: Icon, color }) => (
                                <div key={key} className="flex flex-col items-center justify-center p-3 rounded-lg border bg-muted/30">
                                    <Icon className={`size-5 mb-1.5 ${color}`} />
                                    <span className="text-xl font-bold">{counts?.[key]?.toLocaleString() || 0}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-primary/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Download className="size-4 text-primary" /> Backup baze
                            </CardTitle>
                            <CardDescription>Prenesi ZIP z JSON dump-om vseh kolekcij</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-500 mt-0.5" /> Vsebuje manifest.json z metapodatki</div>
                            <div className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-500 mt-0.5" /> Gesla izključena (varnost)</div>
                            <div className="flex items-start gap-2"><Shield className="size-4 text-amber-500 mt-0.5" /> Hranite na varnem mestu — vsebuje PIU</div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleDownload} disabled={isBackingUp} className="w-full" size="lg">
                                {isBackingUp ? <><Loader2 className="size-4 mr-2 animate-spin" /> Generating ZIP...</> : <><Download className="size-4 mr-2" /> Download ZIP backup</>}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="border-amber-500/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Upload className="size-4 text-amber-600" /> Restore iz backup-a
                            </CardTitle>
                            <CardDescription>Naloži ZIP in obnovi podatke</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2"><CheckCircle2 className="size-4 text-emerald-500 mt-0.5" /> Opcijsko: izprazni kolekcije pred restore</div>
                            <div className="flex items-start gap-2"><AlertTriangle className="size-4 text-amber-500 mt-0.5" /> Restore brez dropExisting lahko ustvari duplikate</div>
                            <div className="flex items-start gap-2"><AlertTriangle className="size-4 text-red-500 mt-0.5" /> dropExisting trajno izbriše obstoječe podatke</div>
                        </CardContent>
                        <CardFooter>
                            <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />
                            <Button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} variant="outline" className="w-full" size="lg">
                                {isRestoring ? <><Loader2 className="size-4 mr-2 animate-spin" /> Restoring...</> : <><Upload className="size-4 mr-2" /> Select ZIP to restore</>}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="p-4 flex items-start gap-3">
                        <FileArchive className="size-5 text-muted-foreground mt-0.5" />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p><b>Vsebina:</b> database.json + manifest.json</p>
                            <p><b>Format:</b> ZIP z maksimalno kompresijo</p>
                            <p><b>Varnost:</b> vsebuje PIU — hranite šifrirano</p>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={restoreDialog} onOpenChange={(open) => !open && (setRestoreDialog(false), setSelectedFile(null), setDropExisting(false))}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-500" /> Confirm restore</DialogTitle>
                            <DialogDescription>Izbrano: <b>{selectedFile?.name}</b> ({(selectedFile?.size / 1024).toFixed(1)} KB)</DialogDescription>
                        </DialogHeader>
                        <label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent">
                            <Checkbox checked={dropExisting} onCheckedChange={(c) => setDropExisting(c === true)} className="data-[state=checked]:bg-red-500 mt-0.5" />
                            <div>
                                <div className="font-medium text-sm">Drop existing collections</div>
                                <div className="text-xs text-muted-foreground"><b className="text-red-600">Trajno izbriše</b> vse obstoječe podatke. Priporočeno.</div>
                            </div>
                        </label>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => (setRestoreDialog(false), setSelectedFile(null), setDropExisting(false))}>Cancel</Button>
                            <Button variant={dropExisting ? "destructive" : "default"} onClick={handleRestoreConfirm}>
                                <Upload className="size-4 mr-2" /> {dropExisting ? "Drop & Restore" : "Restore (merge)"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={resultDialog} onOpenChange={setResultDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="size-5" /> Restore complete</DialogTitle>
                            <DialogDescription>Backup obnovljen iz {restoreResult?.source?.exportedAt ? format(new Date(restoreResult.source.exportedAt), 'MMM d, yyyy HH:mm') : 'neznega datuma'}</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {restoreResult?.inserted && Object.entries(restoreResult.inserted).map(([k, c]) => (
                                <div key={k} className="flex justify-between p-2 rounded border bg-muted/30">
                                    <span className="capitalize">{k}</span><span className="font-bold">{c}</span>
                                </div>
                            ))}
                        </div>
                        <DialogFooter><Button onClick={() => setResultDialog(false)}>Done</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default BackupRestore;
