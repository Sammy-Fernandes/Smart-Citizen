'use client';

import { Database, LogOut, Shield } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-zinc-400 text-sm">System configuration.</p>
            </header>

            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="font-bold flex items-center gap-2"><Shield size={18} /> Admin Profile</h3>
                </div>
                <div className="p-6 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#00ff88] flex items-center justify-center text-black text-2xl font-bold">A</div>
                    <div>
                        <p className="font-bold">Administrator</p>
                        <p className="text-zinc-500 text-sm">admin@civic.app</p>
                    </div>
                    <button className="ml-auto px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 text-sm">
                        Edit
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="font-bold flex items-center gap-2"><Database size={18} /> System Status</h3>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Maintenance Mode</p>
                            <p className="text-xs text-zinc-500">Disable app access for users.</p>
                        </div>
                        <div className="w-12 h-6 bg-zinc-800 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-500 rounded-full transition-all"></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">AI Verification</p>
                            <p className="text-xs text-zinc-500">Auto-verify incoming reports.</p>
                        </div>
                        <div className="w-12 h-6 bg-[#00ff88]/20 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-[#00ff88] rounded-full transition-all"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center pt-8">
                <button className="text-red-500 hover:bg-red-500/10 px-6 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto">
                    <LogOut size={20} /> Sign Out
                </button>
                <p className="text-xs text-zinc-600 mt-4">Version 1.0.0 • Build 2026.01.10</p>
            </div>
        </div>
    );
}
