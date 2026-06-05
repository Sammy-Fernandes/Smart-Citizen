'use client';

import { auth, db } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { Activity, ArrowRight, CheckCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [stats, setStats] = useState({
    total: '...',
    resolved: '...',
    verified: '...'
  });

  useEffect(() => {
    // 1. Ensure we are signed in (anonymously) to read public stats
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Anon auth failed", e);
      }
    };
    initAuth();

    // 2. Listen to data
    const unsub = onSnapshot(collection(db, 'complaints'), (snapshot) => {
      const total = snapshot.size;
      const resolved = snapshot.docs.filter(d => d.data().status === 'resolved').length;

      setStats({
        total: total.toLocaleString(),
        resolved: resolved.toLocaleString(),
        verified: Math.floor(total * 0.8).toLocaleString()
      });
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#00ff88]/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-200px] right-[-200px] w-[800px] h-[800px] bg-[#00ff88] rounded-full blur-[200px] opacity-[0.05]" />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#00cc6f] flex items-center justify-center text-black font-bold">
            C
          </div>
          <span className="text-xl font-bold tracking-tight">Smart Citizen</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/about" className="text-sm text-zinc-400 hover:text-white transition-colors">Initiatives</Link>
          <Link href="/impact" className="text-sm text-zinc-400 hover:text-white transition-colors">Impact</Link>
          <Link href="/login" className="px-5 py-2 rounded-full glass border border-white/10 hover:border-[#00ff88]/50 text-sm font-medium transition-all hover:glow-primary">
            Admin Access
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff88]"></span>
            </span>
            Live City Monitoring System
          </div>

          <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-8">
            Building a <span className="bg-gradient-to-r from-[#00ff88] via-white to-white bg-clip-text text-transparent">Better City</span>, Together.
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed mb-10 max-w-2xl">
            Empowering citizens and authorities to collaborate on infrastructure, sanitation, and safety. Real-time reporting, AI-verified resolution, and transparent governance.
          </p>

          <div className="flex items-center gap-4">
            <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00cc6f] text-black font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
              Explore Initiatives <ArrowRight size={20} />
            </button>
            <button className="px-8 py-4 rounded-xl glass border border-white/10 hover:bg-white/5 transition-colors font-medium">
              View Public Reports
            </button>
          </div>
        </div>

        {/* Floating Stats Cards */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Issues Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-[#00ff88]' },
            { label: 'Total Reports', value: stats.total, icon: Users, color: 'text-blue-400' },
            { label: 'Avg. Response Time', value: '4.2 hrs', icon: Activity, color: 'text-orange-400' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="glass-card p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-500">
                <Icon className={`mb-4 w-8 h-8 ${stat.color}`} />
                <h3 className="text-4xl font-bold mb-2">{stat.value}</h3>
                <p className="text-zinc-500">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Showcase Grid */}
        <div className="mt-32">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Recent Government Works</h2>
              <p className="text-zinc-400">Transparent updates on infrastructure projects.</p>
            </div>
            <button className="text-[#00ff88] hover:underline flex items-center gap-2">
              View All Projects <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
                <div className="absolute inset-0 bg-zinc-800 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute bottom-0 left-0 w-full p-6 z-20">
                  <div className="inline-block px-2 py-1 rounded bg-[#00ff88]/20 text-[#00ff88] text-xs font-bold mb-2">
                    COMPLETED
                  </div>
                  <h4 className="text-lg font-bold mb-1">Infrastructure Upgrade #{i + 102}</h4>
                  <p className="text-xs text-zinc-400">City-wide maintenance and safety improvements.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-zinc-600 text-sm">
        <p>&copy; 2026 Smart Citizen. Powered by AI & Community.</p>
      </footer>
    </div>
  );
}
