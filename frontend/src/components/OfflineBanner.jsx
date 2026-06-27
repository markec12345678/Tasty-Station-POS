import React from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/utils/onlineStatus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * OfflineBanner — prikazuje status povezave na vrhu strani.
 *
 * Stanja:
 *   - Online, 0 pending: nič ne prikaže
 *   - Online, >0 pending: rumen banner "Syncing X operations..."
 *   - Offline: rdeč banner "Offline — orders will be queued"
 */
const OfflineBanner = () => {
    const { isOnline, pendingCount, isSyncing, retrySync } = useOnlineStatus();

    // Ne prikazuj če je vse OK
    if (isOnline && pendingCount === 0 && !isSyncing) return null;

    let config;

    if (!isOnline) {
        config = {
            bg: "bg-red-500",
            icon: WifiOff,
            text: `Offline — naročila se shranjujejo lokalno${pendingCount > 0 ? ` (${pendingCount} čaka)` : ""}`,
        };
    } else if (isSyncing) {
        config = {
            bg: "bg-blue-500",
            icon: RefreshCw,
            text: `Sinhroniziram ${pendingCount} operacij...`,
            spin: true,
        };
    } else if (pendingCount > 0) {
        config = {
            bg: "bg-amber-500",
            icon: AlertTriangle,
            text: `${pendingCount} operacij čaka na sinhronizacijo`,
            action: retrySync,
            actionLabel: "Poskusi znova",
        };
    } else {
        return null;
    }

    const Icon = config.icon;

    return (
        <div className={cn(
            "fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-white text-sm flex items-center justify-center gap-2 shadow-lg",
            config.bg
        )}>
            <Icon className={cn("size-4", config.spin && "animate-spin")} />
            <span>{config.text}</span>
            {config.action && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 h-7 px-2 text-xs ml-2"
                    onClick={config.action}
                >
                    {config.actionLabel}
                </Button>
            )}
        </div>
    );
};

export default OfflineBanner;
