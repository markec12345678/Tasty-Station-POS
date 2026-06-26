import React, { useState, useEffect } from 'react'
import {
    BadgeQuestionMark,
    BringToFront,
    Grid2x2Check,
    Hamburger,
    LayoutDashboard,
    LogOut,
    Settings,
    UserRoundCog,
    Users,
    ChevronLeft,
    ChevronRight,
    Package,
    ChefHat,
    UserCog,
    HelpCircle,
    Bell,
    ShoppingCart,
    Utensils,
    Coffee,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useOrderStore } from '@/store/useOrderStore'
import useKitchenStore from '@/store/useKitchenStore'
import { useTranslation } from 'react-i18next'

const Sidebar = () => {

    const { authUser, logout } = useAuthStore()
    const { stats, getStats } = useOrderStore()
    const { kitchenOrders, fetchKitchenOrders } = useKitchenStore()
    const { t } = useTranslation()

    const [collapsed, setCollapsed] = useState(false)
    const location = useLocation()

    // Naloži statistiko in kuhinjska naročila za real-time badge številke
    useEffect(() => {
        getStats();
        fetchKitchenOrders();
        // Osveži na vsakih 30 sekund
        const interval = setInterval(() => {
            getStats();
            fetchKitchenOrders();
        }, 30000);
        return () => clearInterval(interval);
    }, [getStats, fetchKitchenOrders]);

    // Izračunaj aktivne badge številke iz realnih podatkov
    const pendingCount = stats?.pendingOrders ?? 0;
    const kitchenActiveCount = kitchenOrders?.length ?? 0;

    // Aktivni item iz URL path
    const getActiveFromPath = () => {
        const path = location.pathname;
        if (path === '/' || path === '/dashboard') return 'dashboard';
        if (path.startsWith('/orders')) return 'orders';
        if (path.startsWith('/waiter')) return 'waiter';
        if (path.startsWith('/tables')) return 'tables';
        if (path.startsWith('/dishes')) return 'dishes';
        if (path.startsWith('/inventory')) return 'inventory';
        if (path.startsWith('/kitchen')) return 'kitchen';
        if (path.startsWith('/admin')) return 'admin-panel';
        return 'dashboard';
    };
    const activeItem = getActiveFromPath();

    const menuItems = [
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: 0, link: '/dashboard' },

        { id: 'orders', label: t('nav.orders'), icon: ShoppingCart, badge: pendingCount, link: '/orders' },
        // Waiter Terminal — samo za waiter/manager/admin vloge
        ...(authUser?.role === 'waiter' || authUser?.role === 'manager' || authUser?.role === 'admin'
            ? [{ id: 'waiter', label: t('nav.waiter'), icon: Coffee, badge: 0, link: '/waiter' }]
            : []),
        { id: 'tables', label: t('nav.tables'), icon: Grid2x2Check, badge: 0, link: '/tables' },
        { id: 'dishes', label: t('nav.dishes'), icon: Hamburger, badge: kitchenActiveCount, link: '/dishes' },
        { id: 'inventory', label: t('nav.inventory'), icon: Package, badge: 0, link: '/inventory' },
        // { id: 'staff', label: 'Staff Management', icon: ChefHat, badge: 0, link: '/staff' },
        // { id: 'users', label: 'Manage Users', icon: UserRoundCog, badge: 0, link: '/users' },
        // { id: 'customers', label: 'Customers', icon: Users, badge: 0, link: '/customers' },
        { id: 'kitchen', label: t('nav.kitchen'), icon: Utensils, badge: kitchenActiveCount, link: '/kitchen' },
        ...(authUser?.role === 'admin' ? [
            { id: 'admin-panel', label: t('nav.admin'), icon: UserRoundCog, badge: 0, link: '/admin' }
        ] : [])
    ]

    const bottomItems = [
        { id: 'settings', label: t('nav.settings'), icon: Settings, link: '/settings' },
        { id: 'help', label: t('nav.help'), icon: HelpCircle, link: '/help' },
    ]

    return (
        <aside className={cn(
            "flex flex-col h-full bg-background border-r transition-all duration-300",
            collapsed ? "w-20" : "w-64"
        )}>
            {/* Header */}
            <div className="p-6 border-b">
                <div className={cn(
                    "flex items-center justify-between",
                    collapsed && "justify-center"
                )}>
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="size-9 bg-primary rounded-lg flex items-center justify-center shadow-md">
                                <Hamburger className="size-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="font-bold text-lg leading-tight tracking-tight">Tasty <span className="font-normal text-muted-foreground">Station</span></h1>
                                <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest">Admin Panel</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div className="size-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
                            <Hamburger className="size-5 text-primary-foreground" />
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? (
                            <ChevronRight className="size-4" />
                        ) : (
                            <ChevronLeft className="size-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 p-4  overflow-y-auto">
                <div className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeItem === item.id
                        const showBadge = item.badge > 0

                        return (
                            <Link key={item.id} to={item.link} className=''>
                                <div
                                    className={cn(
                                        "w-full flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all duration-300 group cursor-pointer relative",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        isActive
                                            ? "text-primary bg-primary/5 border border-primary/20 shadow-sm"
                                            : "text-muted-foreground",

                                    )}
                                >
                                    <div className="relative">
                                        <Icon className={cn(
                                            "size-5 transition-all duration-300",
                                            isActive && "text-primary scale-110",
                                            collapsed && "mx-auto"
                                        )} />
                                        {showBadge && !collapsed && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 animate-pulse">
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                        {showBadge && collapsed && (
                                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                                                {item.badge > 9 ? '9+' : item.badge}
                                            </span>
                                        )}
                                    </div>
                                    {!collapsed && (
                                        <>
                                            <span className={cn(
                                                "font-medium flex-1 text-left transition-colors",
                                                isActive ? "text-primary" : "group-hover:text-foreground"
                                            )}>{item.label}</span>
                                            {isActive && (
                                                <div className="size-1.5 rounded-full bg-primary animate-pulse-subtle shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                            )}
                                        </>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Bottom Section */}
            <div className="p-4 space-y-1">
                {bottomItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeItem === item.id

                    return (
                        <Link key={item.id} to={item.link}>
                            <div
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 cursor-pointer",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    isActive
                                        ? "bg-accent text-accent-foreground shadow-sm"
                                        : "text-muted-foreground"
                                )}
                            >
                                <Icon className={cn(
                                    "size-5",
                                    collapsed && "mx-auto"
                                )} />
                                {!collapsed && (
                                    <span className="font-medium">{item.label}</span>
                                )}
                            </div>
                        </Link>
                    )
                })}



                {/* Logout Button */}
                <button
                    onClick={logout}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-all duration-300 active:scale-95 font-medium",
                        collapsed && "justify-center"
                    )}
                >
                    <LogOut className="size-5" />
                    {!collapsed && (
                        <span className="font-medium">Logout</span>
                    )}
                </button>
            </div>
        </aside>
    )
}

export default Sidebar