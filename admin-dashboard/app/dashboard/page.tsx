'use client';

import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    AlertTriangle,
    ArrowUp,
    CheckCircle2,
    Clock,
    Map as MapIcon,
    Filter,
    Users,
    TrendingUp,
    ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { INDIAN_STATES, DISTRICTS_BY_STATE, extractState } from '@/lib/locationData';

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-zinc-900 animate-pulse rounded-2xl flex items-center justify-center font-bold text-zinc-700">Loading Map Infrastructure...</div>
});

export default function DashboardOverview() {
    const router = useRouter();
    const [selectedState, setSelectedState] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [allComplaints, setAllComplaints] = useState<any[]>([]);
    const [recentComplaints, setRecentComplaints] = useState<any[]>([]);
    const [stats, setStats] = useState([
        { label: 'Total Complaints', value: '...', change: '0%', icon: AlertTriangle, color: 'text-orange-400' },
        { label: 'Resolved', value: '...', change: '0%', icon: CheckCircle2, color: 'text-[#00ff88]' },
        { label: 'Pending Verification', value: '...', change: '0%', icon: Clock, color: 'text-blue-400' },
        { label: 'AI Verified', value: '...', change: '0%', icon: ArrowUp, color: 'text-purple-400' },
    ]);
    const [mapView, setMapView] = useState<{ center: [number, number], zoom: number }>({
        center: [20.5937, 78.9629],
        zoom: 5
    });

    const states = useMemo(() => {
        return ['all', ...INDIAN_STATES.map(s => s.name)];
    }, []);

    const districts = useMemo(() => {
        if (selectedState === 'all') return ['all'];
        return ['all', ...(DISTRICTS_BY_STATE[selectedState] || [])];
    }, [selectedState]);

    const filteredComplaints = useMemo(() => {
        let res = allComplaints;
        if (selectedState !== 'all') res = res.filter((c: any) => extractState(c) === selectedState);
        if (selectedDistrict !== 'all') res = res.filter((c: any) => c.district === selectedDistrict);
        return res;
    }, [allComplaints, selectedState, selectedDistrict]);

    // Update map view when filters change
    useEffect(() => {
        if (filteredComplaints.length > 0) {
            const first = filteredComplaints.find(c => c.location?.latitude);
            if (first) {
                setMapView({
                    center: [first.location.latitude, first.location.longitude],
                    zoom: selectedDistrict !== 'all' ? 12 : selectedState !== 'all' ? 8 : 5
                });
            }
        }
    }, [selectedState, selectedDistrict]);

    const handleRecenter = () => {
        if (filteredComplaints.length > 0) {
            const first = filteredComplaints.find(c => c.location?.latitude);
            if (first) {
                setMapView({
                    center: [first.location.latitude, first.location.longitude],
                    zoom: selectedDistrict !== 'all' ? 12 : 8
                });
            }
        } else {
            setMapView({ center: [20.5937, 78.9629], zoom: 5 });
        }
    };

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'complaints'), (snapshot) => {
            const total = snapshot.size;
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllComplaints(docs);

            const resolved = docs.filter((d: any) => d.status === 'resolved').length;
            const verified = docs.filter((d: any) => d.verificationStatus === 'verified').length;
            const pending = docs.filter((d: any) => !d.verificationStatus || d.verificationStatus === 'unverified').length;

            setStats([
                { label: 'Total Complaints', value: total.toString(), change: '+Active', icon: AlertTriangle, color: 'text-orange-400' },
                { label: 'Resolved', value: resolved.toString(), change: `${Math.round((resolved / total) * 100 || 0)}%`, icon: CheckCircle2, color: 'text-[#00ff88]' },
                { label: 'Pending Verification', value: pending.toString(), change: 'Needs Action', icon: Clock, color: 'text-blue-400' },
                { label: 'AI Verified', value: verified.toString(), change: 'Auto-Checked', icon: ArrowUp, color: 'text-purple-400' },
            ]);

            const sorted = docs.sort((a: any, b: any) => {
                const tA = a.createdAt?.seconds || 0;
                const tB = b.createdAt?.seconds || 0;
                return tB - tA;
            });
            setRecentComplaints(sorted.slice(0, 5));
        }, (error) => {
            console.error("Dashboard snapshot error:", error);
        });

        return () => {
            unsub();
        };
    }, []);

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard Overview</h1>
                    <p className="text-zinc-400 mt-2">Welcome back, Admin. Real-time data from Smart Citizen App.</p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-zinc-400 px-3 border-r border-white/10">
                        <Filter size={18} className="text-[#00ff88]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Filters</span>
                    </div>

                    {/* State Filter */}
                    <div className="relative group w-full md:w-48">
                        <select
                            value={selectedState}
                            onChange={(e) => {
                                setSelectedState(e.target.value);
                                setSelectedDistrict('all');
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#00ff88]/50 transition-all appearance-none cursor-pointer hover:bg-black/60 pr-8"
                        >
                            <option value="all" className="bg-zinc-900 font-sans">All States</option>
                            {states.filter(s => s !== 'all').map(s => (
                                <option key={s} value={s} className="bg-zinc-900 font-sans">{s}</option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-[#00ff88] transition-colors">
                            <ChevronDown size={14} />
                        </div>
                    </div>

                    {/* District Filter */}
                    <div className="relative group w-full md:w-48">
                        <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-[#00ff88]/50 transition-all appearance-none cursor-pointer hover:bg-black/60 pr-8"
                        >
                            <option value="all" className="bg-zinc-900 font-sans">All Districts</option>
                            {districts.filter(d => d !== 'all').map(d => (
                                <option key={d} value={d} className="bg-zinc-900 font-sans">{d}</option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-[#00ff88] transition-colors">
                            <ChevronDown size={14} />
                        </div>
                    </div>

                    <button
                        onClick={handleRecenter}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] rounded-xl border border-[#00ff88]/20 transition-all text-xs font-bold"
                    >
                        <MapIcon size={14} />
                        Center Map
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg bg-white/5 ${stat.color}`}>
                                    <Icon size={24} />
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.change.includes('%') ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-white/10 text-zinc-400'}`}>
                                    {stat.change}
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold mb-1">{stat.value}</h3>
                            <p className="text-zinc-500 text-sm">{stat.label}</p>

                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </div>
                    );
                })}
            </div>

            {/* Map Section */}
            <div className="glass-card rounded-3xl overflow-hidden p-1 relative group">
                {/* Decorative background glow for the map card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#00ff88]/10 to-blue-500/10 rounded-[2rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.1)]">
                            <MapIcon className="text-[#00ff88]" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Issue Heatmap</h2>
                            <p className="text-xs text-zinc-500 font-medium tracking-wide">
                                Real-time incident density for <span className="text-[#00ff88]">{selectedDistrict === 'all' ? 'All Districts' : selectedDistrict}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-5 bg-black/40 px-5 py-3 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#ff4444] animate-pulse shadow-[0_0_10px_rgba(255,68,68,0.5)]" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Critical Hotspot</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Normal Density</span>
                        </div>
                    </div>
                </div>
                <div className="h-[450px] w-full relative z-10 p-2">
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                        <Map
                            issues={filteredComplaints}
                            center={mapView.center}
                            zoom={mapView.zoom}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Reports List */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Recent Reports</h2>
                        <button className="text-xs text-[#00ff88] hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {recentComplaints.map((complaint, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                                    {/* Display Image if available */}
                                    {complaint.imageUrls && complaint.imageUrls[0] ? (
                                        <img src={complaint.imageUrls[0]} alt="Report" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">IMG</div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold truncate">{complaint.title || 'Untitled Report'}</h4>
                                    <p className="text-xs text-zinc-400">{complaint.category} • {new Date((complaint.createdAt?.seconds || 0) * 1000).toLocaleDateString()}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${complaint.priority === 4 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        complaint.priority === 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                            complaint.priority === 2 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                                                'bg-zinc-500/20 text-zinc-400 border border-zinc-500/10'
                                        }`}>
                                        Priority {complaint.priority || 1}
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${complaint.status === 'resolved' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-orange-500/20 text-orange-400'
                                        }`}>
                                        {complaint.status || 'Pending'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recentComplaints.length === 0 && (
                            <p className="text-zinc-500 text-sm text-center py-4">No reports found.</p>
                        )}
                    </div>
                </div>

                {/* AI Activity */}
                <div className="glass-card rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-6">AI Activity</h2>
                    <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-0 before:w-[2px] before:bg-white/10">
                        {recentComplaints.filter((c: any) => c.verificationStatus === 'verified').slice(0, 5).map((c, i) => (
                            <div key={i} className="flex gap-4 relative">
                                <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center shrink-0 z-10 bg-black">
                                    <ArrowUp size={16} className="text-[#00ff88]" />
                                </div>
                                <div>
                                    <p className="text-sm">Verified <span className="text-[#00ff88]">{c.category}</span></p>
                                    <p className="text-xs text-zinc-500 mt-1">{(c.verificationConfidence * 100).toFixed(0)}% Confidence • {c.detectedIssues?.join(', ') || 'Issue'}</p>
                                </div>
                            </div>
                        ))}
                        {recentComplaints.filter((c: any) => c.verificationStatus === 'verified').length === 0 && (
                            <p className="text-zinc-500 text-sm pl-8">No recent AI verifications.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
