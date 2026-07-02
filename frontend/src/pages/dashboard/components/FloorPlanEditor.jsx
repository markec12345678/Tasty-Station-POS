import React, { useState, useRef } from 'react';
import { useTableStore } from '@/store/useTableStore';
import { Button } from "@/components/ui/button";
import { Maximize2, Save, RotateCcw, Grid3x3, Lock, Unlock, Armchair } from 'lucide-react';
import { cn } from "@/lib/utils";
import axiosInstance from "@/axios/axiosInstace";
import { toast } from 'sonner';

const statusColors = {
    Available: "bg-emerald-500 text-white border-emerald-600",
    Occupied: "bg-red-500 text-white border-red-600",
    Reserved: "bg-amber-500 text-white border-amber-600",
};

const FloorPlanEditor = ({ tables = [], onTableClick }) => {
    const { getTables } = useTableStore();
    const [editMode, setEditMode] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [positions, setPositions] = useState({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const dragId = useRef(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    React.useEffect(() => {
        const newPositions = {};
        let idx = 0;
        const cols = Math.ceil(Math.sqrt(tables.length || 1));
        const spacing = 130;
        tables.forEach((t) => {
            if (t.position?.x != null && t.position?.y != null) {
                newPositions[t._id] = { x: t.position.x, y: t.position.y };
            } else {
                newPositions[t._id] = { x: 24 + (idx % cols) * spacing, y: 24 + Math.floor(idx / cols) * spacing };
                idx++;
            }
        });
        setPositions(newPositions);
        setDirty(false);
    }, [tables]);

    const onDragStart = (e, id) => {
        if (!editMode) return;
        dragId.current = id;
        const rect = e.currentTarget.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDrag = (e) => {
        if (!dragId.current) return;
        e.preventDefault();
        const canvas = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, e.clientX - canvas.left - dragOffset.current.x);
        const y = Math.max(0, e.clientY - canvas.top - dragOffset.current.y);
        setPositions(prev => ({ ...prev, [dragId.current]: { x, y } }));
        setDirty(true);
    };

    const onDragEnd = () => { dragId.current = null; };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = Object.entries(positions).map(([id, pos]) => ({ id, x: Math.round(pos.x), y: Math.round(pos.y) }));
            await axiosInstance.patch('/table/positions', { positions: payload });
            toast.success(`${payload.length} positions saved`);
            setDirty(false);
            getTables();
        } catch (_e) { toast.error("Failed to save"); }
        setSaving(false);
    };

    const handleReset = () => {
        const newPositions = {};
        const cols = Math.ceil(Math.sqrt(tables.length || 1));
        tables.forEach((t, i) => {
            newPositions[t._id] = { x: 24 + (i % cols) * 130, y: 24 + Math.floor(i / cols) * 130 };
        });
        setPositions(newPositions);
        setDirty(true);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50 shrink-0">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Maximize2 className="size-4 text-primary" /> Floor Plan Editor
                </h2>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className={cn("h-8", showGrid && "bg-accent")} onClick={() => setShowGrid(!showGrid)}>
                        <Grid3x3 className="size-4" />
                    </Button>
                    <Button variant={editMode ? "default" : "outline"} size="sm" className="h-8" onClick={() => setEditMode(!editMode)}>
                        {editMode ? <><Unlock className="size-3.5 mr-1.5" />Editing</> : <><Lock className="size-3.5 mr-1.5" />Locked</>}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8" onClick={handleReset} disabled={!editMode}>
                        <RotateCcw className="size-3.5 mr-1.5" />Reset
                    </Button>
                    <Button size="sm" className="h-8" onClick={handleSave} disabled={!dirty || saving}>
                        <Save className="size-3.5 mr-1.5" />{saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
            <div
                className="flex-1 relative overflow-auto bg-muted/20"
                style={{
                    backgroundImage: showGrid ? "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)" : undefined,
                    backgroundSize: showGrid ? "30px 30px" : undefined,
                    minWidth: "1200px", minHeight: "700px",
                }}
                onDragOver={(e) => editMode && e.preventDefault()}
                onDrop={onDragEnd}
            >
                {tables.map(table => {
                    const pos = positions[table._id] || { x: 0, y: 0 };
                    return (
                        <div
                            key={table._id}
                            draggable={editMode}
                            onDragStart={(e) => onDragStart(e, table._id)}
                            onDrag={onDrag}
                            onDragEnd={onDragEnd}
                            onClick={() => !editMode && onTableClick?.(table)}
                            className={cn("absolute select-none transition-shadow", editMode ? "cursor-grab" : "cursor-pointer")}
                            style={{ left: pos.x, top: pos.y, width: 100, height: 100 }}
                        >
                            <div className={cn("w-full h-full flex flex-col items-center justify-center border-2 shadow-md rounded-full",
                                statusColors[table.status] || statusColors.Available)}>
                                <Armchair className="size-5 opacity-80" />
                                <div className="text-xs font-bold mt-0.5">{table.name}</div>
                                <div className="text-[10px] opacity-75">{table.capacity} seats</div>
                            </div>
                        </div>
                    );
                })}
                {tables.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <div className="text-center"><Armchair className="size-12 mx-auto mb-2 opacity-20" /><p className="text-sm">No tables</p></div>
                    </div>
                )}
            </div>
            {dirty && <div className="px-4 py-2 border-t bg-amber-500/5 text-xs text-amber-600 font-medium">⚠ Unsaved changes</div>}
        </div>
    );
};

export default FloorPlanEditor;
