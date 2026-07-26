'use client';

import { auth, db } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, ShieldCheck, AlertCircle, Lightbulb, Lock, Activity } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [stats, setStats] = useState({
    totalComplaints: 0,
    resolvedComplaints: 0,
    verifiedComplaints: 0,
    totalSuggestions: 0,
    loading: true
  });

  const [recentComplaints, setRecentComplaints] = useState<any[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<any[]>([]);

  useEffect(() => {
    let unsubComplaints: () => void = () => {};
    let unsubSuggestions: () => void = () => {};

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
          return; // onAuthStateChanged will re-trigger with user present
        } catch (e) {
          console.error("Anonymous auth failed:", e);
        }
      }

      // Cleanup existing listeners if any
      unsubComplaints();
      unsubSuggestions();

      // Real-time Complaints subscription
      unsubComplaints = onSnapshot(collection(db, 'complaints'), (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const total = docs.length;
        const resolved = docs.filter((d: any) => d.status === 'resolved').length;
        const verified = docs.filter((d: any) => d.verificationStatus === 'verified').length;

        const sorted = [...docs].sort((a: any, b: any) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });

        setRecentComplaints(sorted.slice(0, 4));
        setStats(prev => ({
          ...prev,
          totalComplaints: total,
          resolvedComplaints: resolved,
          verifiedComplaints: verified,
          loading: false
        }));
      }, (err) => {
        console.error("Complaints listener error:", err);
        setStats(prev => ({ ...prev, loading: false }));
      });

      // Real-time Suggestions subscription
      unsubSuggestions = onSnapshot(collection(db, 'suggestions'), (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = [...docs].sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0));
        setRecentSuggestions(sorted.slice(0, 3));
        setStats(prev => ({
          ...prev,
          totalSuggestions: docs.length
        }));
      }, (err) => {
        console.error("Suggestions listener error:", err);
      });
    });

    return () => {
      unsubAuth();
      unsubComplaints();
      unsubSuggestions();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden selection:bg-[#00ff88] selection:text-black">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#00ff88]/10 via-[#00ff88]/5 to-transparent pointer-events-none" />
      <div className="absolute top-[-250px] right-[-200px] w-[700px] h-[700px] bg-[#00ff88] rounded-full blur-[220px] opacity-[0.07] pointer-events-none" />
      <div className="absolute bottom-[-200px] left-[-200px] w-[600px] h-[600px] bg-blue-500 rounded-full blur-[220px] opacity-[0.05] pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 py-6 max-w-7xl mx-auto border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#00cc6f] flex items-center justify-center text-black font-extrabold text-lg shadow-[0_0_20px_rgba(0,255,136,0.3)]">
            SC
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight block">Smart Citizen</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-medium">Public Governance Network</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 hover:bg-[#00ff88] hover:text-black text-sm font-semibold transition-all duration-300 flex items-center gap-2"
          >
            <Lock size={16} /> Admin Portal
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-28">
        
        {/* Hero Section */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 mb-6 backdrop-blur-md">
            <Activity size={14} className="text-[#00ff88]" />
            Live Civic Operations & Community Transparency
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight">
            Transparent City <br />
            <span className="bg-gradient-to-r from-[#00ff88] via-white to-zinc-400 bg-clip-text text-transparent">
              Governance & Action
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 leading-relaxed mb-8 max-w-2xl font-normal">
            Real-time citizen report resolution, AI image verification, and community-driven suggestions powered by the Smart Citizen infrastructure.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00cc6f] text-black font-bold flex items-center gap-2 hover:shadow-[0_0_25px_rgba(0,255,136,0.4)] transition-all"
            >
              Access Admin Dashboard <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Dynamic Real-Time Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="p-3 w-fit rounded-xl bg-orange-500/10 text-orange-400 mb-3 border border-orange-500/20">
              <AlertCircle size={22} />
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold mb-1">{stats.loading ? '...' : stats.totalComplaints}</h3>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Reports</p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="p-3 w-fit rounded-xl bg-[#00ff88]/10 text-[#00ff88] mb-3 border border-[#00ff88]/20">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold mb-1">{stats.loading ? '...' : stats.resolvedComplaints}</h3>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Issues Resolved</p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold mb-1">{stats.loading ? '...' : stats.verifiedComplaints}</h3>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">AI Verified</p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-400 mb-3 border border-blue-500/20">
              <Lightbulb size={22} />
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold mb-1">{stats.loading ? '...' : stats.totalSuggestions}</h3>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Community Ideas</p>
          </div>
        </div>

        {/* Live Reports Showcase (Dynamic Data from Firestore) */}
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Live Public Activity</h2>
              <p className="text-zinc-400 text-sm mt-1">Real-time reports directly submitted by citizens across the city.</p>
            </div>
            <Link href="/login" className="text-xs text-[#00ff88] hover:underline font-semibold flex items-center gap-1">
              Manage in Admin Portal <ArrowRight size={14} />
            </Link>
          </div>

          {recentComplaints.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recentComplaints.map((item, i) => (
                <div key={i} className="glass-card rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/60 flex flex-col justify-between p-5 hover:border-[#00ff88]/30 transition-all duration-300">
                  <div>
                    {item.imageUrls && item.imageUrls[0] ? (
                      <div className="aspect-video w-full rounded-xl overflow-hidden mb-4 bg-zinc-800">
                        <img src={item.imageUrls[0]} alt={item.title || 'Report Image'} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-xl mb-4 bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-600 text-xs font-mono">
                        NO IMAGE
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-zinc-300 border border-white/10">
                        {item.category || 'General'}
                      </span>
                      {item.verificationStatus === 'verified' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                          <ShieldCheck size={12} /> Verified
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base line-clamp-1 mb-1">{item.title || 'Civic Issue'}</h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4">{item.description || 'No description provided.'}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.status === 'resolved' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-orange-500/10 text-orange-400'
                    }`}>
                      {item.status || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center border border-white/5 bg-zinc-900/30">
              <AlertCircle size={36} className="mx-auto text-zinc-600 mb-3" />
              <h3 className="text-lg font-bold text-zinc-300">No Reports Published Yet</h3>
              <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
                Reports submitted via the mobile app will automatically reflect here in real-time.
              </p>
            </div>
          )}
        </div>

        {/* Popular Community Ideas Section */}
        {recentSuggestions.length > 0 && (
          <div className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Top Community Ideas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {recentSuggestions.map((s, i) => (
                <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-400 font-medium">{s.category || 'Idea'}</span>
                    <span className="px-2.5 py-1 rounded-full bg-[#00ff88]/10 text-[#00ff88] text-xs font-bold border border-[#00ff88]/20">
                      ▲ {s.upvotes || 0} Upvotes
                    </span>
                  </div>
                  <h3 className="font-bold text-base mb-2">{s.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-zinc-500 text-xs">
        <p>&copy; {new Date().getFullYear()} Smart Citizen Portal • Built for Transparent Public Governance.</p>
      </footer>
    </div>
  );
}
