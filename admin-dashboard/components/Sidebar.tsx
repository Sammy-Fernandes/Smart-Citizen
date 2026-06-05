'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertCircle, Bell, LayoutDashboard, LogOut, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
    { icon: AlertCircle, label: 'Complaints', href: '/dashboard/complaints' },
    { icon: MessageSquare, label: 'Suggestions', href: '/dashboard/suggestions' },
    { icon: Bell, label: 'Broadcasts', href: '/dashboard/broadcasts' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="h-screen w-64 glass-card border-r border-r-[rgba(0,255,136,0.1)] fixed left-0 top-0 flex flex-col z-50">
            <div className="p-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-[#00ff88] bg-clip-text text-transparent">
                    Smart Citizen
                </h1>
                <p className="text-xs text-zinc-500 tracking-wider mt-1 uppercase">Admin Portal</p>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link href={item.href} key={item.href}>
                            <div
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                    isActive
                                        ? "text-black font-semibold"
                                        : "text-zinc-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-gradient-to-r from-[#00ff88] to-[#00cc6f] z-0"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                <Icon size={20} className="relative z-10" />
                                <span className="relative z-10">{item.label}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4">
                <button className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-[rgba(255,68,68,0.1)] rounded-xl transition-colors">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
}
