import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * TableTimer — prikazuje kako dolgo je miza zasedena.
 *
 * Props:
 *   occupiedAt — ISO date string kdaj je miza postala Occupied
 *   compact — ali naj bo kompakten prikaz (samo ikona + čas)
 *
 * Barvno kodiranje:
 *   - Zelena: < 45 minut (normalno)
 *   - Rumena: 45-90 minut (pozornost)
 *   - Rdeča: > 90 minut (akcija potrebna)
 */
const TableTimer = ({ occupiedAt, compact = false }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!occupiedAt) return;

        const calculate = () => {
            const start = new Date(occupiedAt).getTime();
            const now = Date.now();
            const diff = Math.max(0, now - start);
            setElapsed(diff);
        };

        calculate();
        const interval = setInterval(calculate, 1000);
        return () => clearInterval(interval);
    }, [occupiedAt]);

    if (!occupiedAt) return null;

    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const hours = Math.floor(minutes / 60);

    // Barva glede na trajanje
    const getColor = () => {
        if (minutes < 45) return { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
        if (minutes < 90) return { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" };
        return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" };
    };

    const colors = getColor();

    // Format: "45:30" ali "1:23:45"
    const formatTime = () => {
        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    if (compact) {
        return (
            <span className={cn("inline-flex items-center gap-1 text-xs font-mono font-bold", colors.text)}>
                <Clock className="size-3" />
                {formatTime()}
            </span>
        );
    }

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono font-bold",
            colors.bg, colors.text, colors.border
        )}>
            <Clock className="size-3" />
            <span>{formatTime()}</span>
            {minutes >= 90 && (
                <span className="animate-pulse ml-1">⚠</span>
            )}
        </div>
    );
};

export default TableTimer;
