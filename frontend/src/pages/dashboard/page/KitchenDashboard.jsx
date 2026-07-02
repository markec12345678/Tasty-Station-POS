import React, { useEffect, useMemo, useCallback, useState } from 'react';
import useKitchenStore from '@/store/useKitchenStore';
import { Flame, Timer, CheckCircle2, ChevronRight, Bell, BellOff } from 'lucide-react';
import KitchenColumn from '../components/kitchen/KitchenColumn';
import { notifyNewOrder, requestPermission, isSupported } from '@/utils/notifications';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const KitchenDashboard = () => {
    const { kitchenOrders, fetchKitchenOrders, updateStatus } = useKitchenStore();
    const [notifEnabled, setNotifEnabled] = useState(() => {
        return isSupported() && Notification.permission === 'granted';
    });
    const [soundEnabled] = useState(() => {
        const saved = localStorage.getItem('kds-sound');
        return saved === null ? true : saved === 'true';
    });
    const [, setNewOrderIds] = useState(new Set());

    const handleRefresh = useCallback(async () => {
        await fetchKitchenOrders();
    }, [fetchKitchenOrders]);

    // Request notification permission on mount
    useEffect(() => {
        if (isSupported() && Notification.permission === 'default') {
            requestPermission().then(granted => {
                setNotifEnabled(granted);
                if (granted) toast.success('Desktop notifications enabled');
            });
        }
    }, []);

    // Toggle notifications
    const _handleToggleNotif = async () => {
        if (notifEnabled) {
            setNotifEnabled(false);
            toast.info('Desktop notifications disabled');
        } else {
            const granted = await requestPermission();
            setNotifEnabled(granted);
            if (granted) toast.success('Desktop notifications enabled');
            else toast.error('Notification permission denied');
        }
    };

    // Zapomni si preference
    useEffect(() => {
        localStorage.setItem('kds-sound', String(soundEnabled));
    }, [soundEnabled]);

    useEffect(() => {
        handleRefresh();
        const interval = setInterval(fetchKitchenOrders, 10000);
        return () => clearInterval(interval);
    }, [fetchKitchenOrders, handleRefresh]);

    // Socket.io listener for new orders + notifications
    useEffect(() => {
        const handleNewOrder = (newOrder) => {
            if (newOrder.status === 'Pending') {
                fetchKitchenOrders();
                // Sound
                if (soundEnabled) {
                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.value = 880;
                        gain.gain.setValueAtTime(0.3, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.2);
                    } catch (_e) { /* AudioContext failed */ }
                }
                // Browser notification
                if (notifEnabled) {
                    notifyNewOrder(newOrder);
                }
                // Visual NEW badge
                setNewOrderIds(prev => { const next = new Set(prev); next.add(newOrder._id); return next; });
                setTimeout(() => {
                    setNewOrderIds(prev => { const next = new Set(prev); next.delete(newOrder._id); return next; });
                }, 5000);
            }
        };

        import('@/config/socket.config').then(({ getSocket }) => {
            const socket = getSocket();
            socket.on('newOrder', handleNewOrder);
            socket.on('qrOrderPlaced', handleNewOrder);
        });

        return () => {
            import('@/config/socket.config').then(({ getSocket }) => {
                const socket = getSocket();
                socket.off('newOrder', handleNewOrder);
                socket.off('qrOrderPlaced', handleNewOrder);
            });
        };
    }, [soundEnabled, notifEnabled, fetchKitchenOrders]);

    const ordersByStatus = useMemo(() => ({
        Pending: kitchenOrders.filter(o => o.status === 'Pending'),
        Preparing: kitchenOrders.filter(o => o.status === 'Preparing'),
        Ready: kitchenOrders.filter(o => o.status === 'Ready'),
    }), [kitchenOrders]);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-6">

                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-[18px] font-semibold text-foreground tracking-tight">
                            Kitchen
                        </h1>
                        <span className="text-[11px] text-muted-foreground/50 font-medium">
                            {kitchenOrders.length} active ticket{kitchenOrders.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-[0.04em]">
                            Live
                        </span>
                    </div>
                </div>

                {/* Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <KitchenColumn
                        title="Incoming"
                        icon={Flame}
                        orders={ordersByStatus.Pending}
                        onUpdate={updateStatus}
                        nextStatus="Preparing"
                        actionLabel="Accept"
                        actionIcon={ChevronRight}
                    />
                    <KitchenColumn
                        title="In Preparation"
                        icon={Timer}
                        orders={ordersByStatus.Preparing}
                        onUpdate={updateStatus}
                        nextStatus="Ready"
                        actionLabel="Mark Ready"
                        actionIcon={CheckCircle2}
                    />
                    <KitchenColumn
                        title="Ready for Pickup"
                        icon={CheckCircle2}
                        orders={ordersByStatus.Ready}
                        onUpdate={updateStatus}
                        nextStatus="Completed"
                        actionLabel="Distribute"
                        actionIcon={CheckCircle2}
                    />
                </div>

            </div>
        </div>
    );
};

export default KitchenDashboard;