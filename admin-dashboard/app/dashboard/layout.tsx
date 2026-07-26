'use client';

import Sidebar from '@/components/Sidebar';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (user) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
                router.push('/');
            }
        });
        return () => unsub();
    }, [router]);

    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold text-zinc-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-t-transparent border-[#00ff88] rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                </div>
            </div>
        );
    }

    if (isAuthenticated === false) {
        return null;
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#00ff88] selection:text-black">
            {/* Dynamic Background Glows */}
            <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#00ff88] opacity-[0.05] blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0a3d2e] opacity-[0.1] blur-[150px] pointer-events-none" />

            <Sidebar />

            <main className="ml-64 p-8 min-h-screen relative z-10">
                {children}
            </main>
        </div>
    );
}
