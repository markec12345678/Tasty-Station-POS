import React, { useEffect, useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    QrCode, Download, Printer, Search, Filter, Utensils, Smartphone, Globe
} from 'lucide-react';
import { useTableStore } from '@/store/useTableStore';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import QRCode from 'qrcode';

const QRCodeGenerator = () => {
    const { tables, getTables } = useTableStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeZone, setActiveZone] = useState("All");
    const [qrDataUrls, setQrDataUrls] = useState({});  // { [tableId]: dataUrl }

    useEffect(() => {
        getTables();
    }, [getTables]);

    // Generiraj QR kodo za vsako mizo
    useEffect(() => {
        if (!tables.length) return;

        const baseUrl = window.location.origin;
        tables.forEach(table => {
            const url = `${baseUrl}/qr/${table._id}`;
            QRCode.toDataURL(url, {
                width: 512,
                margin: 2,
                color: { dark: '#0d9488', light: '#ffffff' },
                errorCorrectionLevel: 'H',
            }).then(dataUrl => {
                setQrDataUrls(prev => ({ ...prev, [table._id]: dataUrl }));
            }).catch(err => console.error(`QR error for ${table.name}:`, err));
        });
    }, [tables]);

    const zones = ["All", ...new Set(tables.map(t => t.zone))];
    const filteredTables = tables.filter(table => {
        const matchesZone = activeZone === "All" || table.zone === activeZone;
        const matchesSearch = table.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesZone && matchesSearch;
    });

    const handleDownload = (table) => {
        const dataUrl = qrDataUrls[table._id];
        if (!dataUrl) return;
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `QR-${table.name}-${table.zone}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`QR koda za ${table.name} prenesena`);
    };

    const handleDownloadAll = async () => {
        for (const table of filteredTables) {
            const dataUrl = qrDataUrls[table._id];
            if (dataUrl) {
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = `QR-${table.name}-${table.zone}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                await new Promise(r => setTimeout(r, 200));  // 200ms delay
            }
        }
        toast.success(`Preneseno ${filteredTables.length} QR kod`);
    };

    const handlePrint = (table) => {
        const dataUrl = qrDataUrls[table._id];
        if (!dataUrl) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>QR Koda — ${table.name}</title>
                    <style>
                        body { font-family: sans-serif; text-align: center; padding: 40px; }
                        img { width: 350px; height: 350px; }
                        h1 { margin: 20px 0 5px; color: #0d9488; }
                        p { color: #666; margin: 5px 0; }
                        .footer { margin-top: 30px; font-size: 12px; color: #999; }
                    </style>
                </head>
                <body>
                    <img src="${dataUrl}" alt="QR Code" />
                    <h1>Tasty Station</h1>
                    <p><b>Miza ${table.name}</b> • ${table.zone}</p>
                    <p>Skeniraj QR kodo za naročilo</p>
                    <div class="footer">Scan to order from your phone</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <QrCode className="size-7 text-primary" />
                            QR Code Generator
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Generiraj in natisni QR kode za mize — gostje skenirajo za naročilo
                        </p>
                    </div>
                    <Button onClick={handleDownloadAll} disabled={filteredTables.length === 0}>
                        <Download className="size-4 mr-2" />
                        Prenesi vse ({filteredTables.length})
                    </Button>
                </div>

                {/* Info card */}
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-4 flex items-center gap-4">
                        <Smartphone className="size-8 text-primary shrink-0" />
                        <div className="text-sm">
                            <div className="font-semibold">Kako deluje?</div>
                            <div className="text-muted-foreground text-xs mt-0.5">
                                1. Natisni QR kodo za vsako mizo • 2. Gost skenira s telefonom • 3. Brska meni in odda naročilo • 4. Naročilo se prikaže v KDS in POS
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                            placeholder="Iskanje miz..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background"
                        />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {zones.map(zone => (
                            <button
                                key={zone}
                                onClick={() => setActiveZone(zone)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap border transition-all",
                                    activeZone === zone
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30"
                                )}
                            >
                                {zone}
                            </button>
                        ))}
                    </div>
                </div>

                {/* QR cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredTables.map(table => (
                        <Card key={table._id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <div className="aspect-square bg-white flex items-center justify-center p-4 relative">
                                {qrDataUrls[table._id] ? (
                                    <img
                                        src={qrDataUrls[table._id]}
                                        alt={`QR ${table.name}`}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center">
                                        <QrCode className="size-16 text-muted-foreground/30 animate-pulse" />
                                    </div>
                                )}
                                {/* Status badge */}
                                <div className="absolute top-2 right-2">
                                    <Badge variant="outline" className={cn(
                                        "text-[10px]",
                                        table.status === "Available" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                                        table.status === "Occupied" && "bg-red-500/10 text-red-700 border-red-500/30",
                                        table.status === "Reserved" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                                    )}>
                                        {table.status}
                                    </Badge>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <div className="font-bold text-sm">{table.name}</div>
                                        <div className="text-xs text-muted-foreground">{table.zone} • {table.capacity} sedežev</div>
                                    </div>
                                    <Utensils className="size-4 text-muted-foreground" />
                                </div>
                                <div className="flex gap-1.5 mt-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs"
                                        onClick={() => handleDownload(table)}
                                        disabled={!qrDataUrls[table._id]}
                                    >
                                        <Download className="size-3 mr-1" />
                                        PNG
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs"
                                        onClick={() => handlePrint(table)}
                                        disabled={!qrDataUrls[table._id]}
                                    >
                                        <Printer className="size-3 mr-1" />
                                        Natisni
                                    </Button>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-2 truncate">
                                    <Globe className="size-2.5 inline mr-1" />
                                    {window.location.origin}/qr/{table._id.slice(-6)}...
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredTables.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <QrCode className="size-12 mx-auto mb-3 opacity-20" />
                        <p>Ni miz za prikaz</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRCodeGenerator;
