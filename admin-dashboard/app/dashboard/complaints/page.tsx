'use client';

import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, Timestamp, updateDoc, where, deleteDoc } from 'firebase/firestore';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Filter,
    ImageIcon,
    MessageSquare,
    Search,
    Send,
    Shield,
    ThumbsUp,
    User,
    XCircle,
    TrendingUp,
    ChevronDown,
    Trash2,
    Layers,
    Activity,
    MapPin,
    Car
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { INDIAN_STATES, DISTRICTS_BY_STATE, extractState } from '@/lib/locationData';

export default function ComplaintsPage() {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [filter, setFilter] = useState('all'); // all, pending, verified, resolved
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedState, setSelectedState] = useState('all');
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [selectedComplaint, setSelectedComplaint] = useState<any>(null); // For detail view/modal

    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [resolutionImage, setResolutionImage] = useState<File | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    // Comment State for Admin
    const [reportComments, setReportComments] = useState<any[]>([]);
    const [adminComment, setAdminComment] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);

    useEffect(() => {
        if (selectedComplaint) {
            fetchComments(selectedComplaint.id);
        } else {
            setReportComments([]);
            setAdminComment("");
        }
    }, [selectedComplaint]);

    const fetchComments = async (itemId: string) => {
        setIsLoadingComments(true);
        try {
            // Avoid composite index requirement by removing orderBy; sort client-side
            const q = query(
                collection(db, 'comments'),
                where('itemId', '==', itemId)
            );
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort: Admin first, then date descending
            const sorted = items.sort((a: any, b: any) => {
                if (a.isAdmin && !b.isAdmin) return -1;
                if (!a.isAdmin && b.isAdmin) return 1;
                const aTime = a.createdAt?.seconds ?? 0;
                const bTime = b.createdAt?.seconds ?? 0;
                return bTime - aTime;
            });
            setReportComments(sorted);
        } catch (e) {
            console.error("Fetch comments error", e);
        } finally {
            setIsLoadingComments(false);
        }
    };

    const handlePostAdminComment = async () => {
        if (!selectedComplaint || !adminComment.trim()) return;

        setIsPostingComment(true);
        try {
            await addDoc(collection(db, 'comments'), {
                userId: 'admin', // Or actual admin ID if available
                userName: 'Official Admin',
                itemId: selectedComplaint.id,
                itemType: 'complaint',
                content: adminComment.trim(),
                isAdmin: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            setAdminComment("");
            fetchComments(selectedComplaint.id);
        } catch (e) {
            console.error("Post comment error", e);
            alert("Failed to post comment");
        } finally {
            setIsPostingComment(false);
        }
    };

    useEffect(() => {
        // Real-time listener
        const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setComplaints(docs);
        });
        return () => unsub();
    }, []);

    const uploadImage = async (file: File): Promise<string | null> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'vedcivil');
        formData.append('api_key', '152634273923857');
        formData.append('timestamp', (Math.floor(Date.now() / 1000)).toString());

        try {
            const res = await fetch('https://api.cloudinary.com/v1_1/dx8gqgdtc/image/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            return data.secure_url;
        } catch (e) {
            console.error("Upload failed", e);
            return null;
        }
    };

    const handleAction = async (id: string, action: 'verify' | 'resolve' | 'reject' | 'delete') => {
        if (action === 'resolve') {
            setResolvingId(id);
            return;
        }

        if (action === 'delete') {
            if (confirm("Are you sure you want to permanently delete this complaint? This cannot be undone.")) {
                try {
                    await deleteDoc(doc(db, 'complaints', id));
                    // Optional: also delete associated comments/broadcasts
                    alert("Complaint deleted successfully");
                } catch (e) {
                    console.error("Delete failed", e);
                    alert("Delete failed: " + e);
                }
            }
            return;
        }

        try {
            const ref = doc(db, 'complaints', id);
            if (action === 'verify') {
                await updateDoc(ref, {
                    verificationStatus: 'verified',
                    verificationConfidence: 1.0, // Manual verification = 100%
                    aiProcessed: true,
                    updatedAt: Timestamp.now()
                });
            } else if (action === 'reject') {
                await updateDoc(ref, {
                    verificationStatus: 'rejected',
                    status: 'rejected', // Optional if you have this status
                    aiProcessed: true,
                    updatedAt: Timestamp.now()
                });
            }
        } catch (e) {
            console.error("Action failed", e);
            alert("Action failed: " + e);
        }
    };

    const handleConfirmResolution = async () => {
        if (!resolvingId || !resolutionNote) {
            alert("Please provide a resolution note.");
            return;
        }

        setIsResolving(true);
        try {
            // 1. Upload Proof Image (Optional)
            let imageUrl = '';
            if (resolutionImage) {
                const uploaded = await uploadImage(resolutionImage);
                if (uploaded) imageUrl = uploaded;
            }

            // 2. Update Complaint
            const complaintRef = doc(db, 'complaints', resolvingId);
            const complaint = complaints.find(c => c.id === resolvingId);

            await updateDoc(complaintRef, {
                status: 'resolved',
                resolution: {
                    note: resolutionNote,
                    imageUrl: imageUrl, // Can be empty string
                    resolvedAt: Timestamp.now()
                },
                resolvedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            // 3. Create Broadcast
            await addDoc(collection(db, 'broadcasts'), {
                title: `Issue Resolved: ${complaint?.title || 'Complaint'}`,
                content: resolutionNote,
                imageUrl: imageUrl,
                type: 'success',
                linkedComplaintId: resolvingId,
                createdAt: Timestamp.now(),
                active: true
            });

            setResolvingId(null);
            setResolutionNote('');
            setResolutionImage(null);
            alert("Complaint resolved and broadcasted!");

        } catch (e) {
            console.error("Resolution failed", e);
            alert("Failed to resolve: " + e);
        } finally {
            setIsResolving(false);
        }
    };

    const statesList = useMemo(() => ['all', ...INDIAN_STATES.map(s => s.name)], []);
    const districtsList = useMemo(() => {
        if (selectedState === 'all') return ['all'];
        return ['all', ...(DISTRICTS_BY_STATE[selectedState] || [])];
    }, [selectedState]);

    const filtered = complaints.filter(c => {
        const matchesSearch = c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesState = selectedState === 'all' || extractState(c) === selectedState;
        const matchesDistrict = selectedDistrict === 'all' || c.district === selectedDistrict;

        const baseMatch = matchesSearch && matchesState && matchesDistrict;

        if (filter === 'all') return baseMatch;
        if (filter === 'pending') return baseMatch && (!c.verificationStatus || c.verificationStatus === 'unverified') && c.status !== 'resolved';
        if (filter === 'verified') return baseMatch && c.verificationStatus === 'verified' && c.status !== 'resolved';
        if (filter === 'resolved') return baseMatch && c.status === 'resolved';
        return baseMatch;
    });

    return (
        <div className="space-y-6 relative">
            {/* Resolution Modal Overlay */}
            {resolvingId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                        <button
                            onClick={() => setResolvingId(null)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white"
                        >
                            <XCircle size={24} />
                        </button>

                        <h2 className="text-xl font-bold mb-1">Resolve Complaint</h2>
                        <p className="text-zinc-400 text-sm mb-6">Provide proof of resolution to close this ticket.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Resolution Details</label>
                                <textarea
                                    value={resolutionNote}
                                    onChange={e => setResolutionNote(e.target.value)}
                                    placeholder="Describe how the issue was resolved..."
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-[#00ff88]/50 min-h-[100px]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Proof Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setResolutionImage(e.target.files?.[0] || null)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-xs text-zinc-400 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#00ff88]/10 file:text-[#00ff88] hover:file:bg-[#00ff88]/20"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    onClick={() => setResolvingId(null)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmResolution}
                                    disabled={isResolving}
                                    className="flex-1 py-3 rounded-xl bg-[#00ff88] text-black font-bold hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all disabled:opacity-50"
                                >
                                    {isResolving ? 'Processing...' : 'Confirm Resolution'}
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-500 text-center mt-2">
                                This will automatically create a public broadcast with the details.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Issues Management</h1>
                    <p className="text-zinc-400 text-sm">Monitor and resolve citizen reports.</p>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    {['all', 'pending', 'verified', 'resolved'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === f ? 'bg-[#00ff88] text-black shadow-lg shadow-[#00ff88]/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                <div className="p-4 border-b border-white/5 flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#00ff88]/50"
                        />
                    </div>

                    {/* State Filter */}
                    <div className="relative w-full md:w-48">
                        <select
                            value={selectedState}
                            onChange={(e) => {
                                setSelectedState(e.target.value);
                                setSelectedDistrict('all');
                            }}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#00ff88]/50 text-zinc-300 appearance-none cursor-pointer pr-10"
                        >
                            <option value="all">All States</option>
                            {statesList.filter(s => s !== 'all').map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <ChevronDown size={14} />
                        </div>
                    </div>

                    {/* District Filter */}
                    <div className="relative w-full md:w-48">
                        <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#00ff88]/50 text-zinc-300 appearance-none cursor-pointer pr-10 disabled:opacity-50"
                            disabled={selectedState === 'all'}
                        >
                            <option value="all">All Districts</option>
                            {districtsList.filter(d => d !== 'all').map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-zinc-400 font-medium whitespace-nowrap">
                            <tr>
                                <th className="p-4 pl-6 min-w-[300px]">Issue</th>
                                <th className="p-4 min-w-[120px]">Priority</th>
                                <th className="p-4 min-w-[100px]">Severity</th>
                                <th className="p-4 min-w-[120px]">Status</th>
                                <th className="p-4 min-w-[150px]">Engagement</th>
                                <th className="p-4 min-w-[150px]">AI Scan</th>
                                <th className="p-4 text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="">
                            {(() => {
                                // Dynamic Color Engine
                                const getClusterStyle = (id: string) => {
                                    const palettes = [
                                        { border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/5', badge: 'bg-blue-500', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]' },
                                        { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/5', badge: 'bg-purple-500', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]' },
                                        { border: 'border-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/5', badge: 'bg-emerald-500', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' },
                                        { border: 'border-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/5', badge: 'bg-amber-500', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]' },
                                        { border: 'border-pink-500', text: 'text-pink-400', bg: 'bg-pink-500/5', badge: 'bg-pink-500', glow: 'shadow-[0_0_15_rgba(236,72,153,0.2)]' },
                                    ];
                                    let hash = 0;
                                    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
                                    return palettes[hash % palettes.length];
                                };

                                // Loop-safe, filter-safe root ID resolver
                                const getRootId = (c: any) => {
                                    const path: string[] = [];
                                    const visited = new Set<string>();
                                    let current = c;
                                    while (current.parentId) {
                                        if (visited.has(current.parentId)) {
                                            path.push(current.id);
                                            const loopNodes = complaints.filter(x => path.includes(x.id));
                                            loopNodes.sort((a, b) => {
                                                const timeA = a.createdAt?.seconds || 0;
                                                const timeB = b.createdAt?.seconds || 0;
                                                if (timeA !== timeB) return timeA - timeB;
                                                return a.id.localeCompare(b.id);
                                            });
                                            return loopNodes[0].id;
                                        }
                                        visited.add(current.id);
                                        path.push(current.id);
                                        const parent = complaints.find(x => x.id === current.parentId);
                                        if (!parent) break;
                                        current = parent;
                                    }
                                    return current.id;
                                };

                                // Group filtered complaints by their root ID
                                const groups: { [rootId: string]: any[] } = {};
                                filtered.forEach(c => {
                                    const rootId = getRootId(c);
                                    if (!groups[rootId]) {
                                        groups[rootId] = [];
                                    }
                                    groups[rootId].push(c);
                                });

                                const finalRows: React.ReactNode[] = [];

                                Object.entries(groups).forEach(([rootId, groupComplaints]) => {
                                    // 1. If only 1 complaint is in the group, we render it as standalone
                                    if (groupComplaints.length === 1) {
                                        const c = groupComplaints[0];
                                        finalRows.push(renderComplaintRow(c, false, false, { border: 'border-white/10', text: 'text-zinc-400', bg: '', badge: 'bg-zinc-700', glow: '' }, true));
                                        return;
                                    }

                                    // 2. Otherwise, we have a cluster of 2 or more related reports
                                    const style = getClusterStyle(rootId);
                                    const rootComplaint = complaints.find(x => x.id === rootId);
                                    const clusterTitle = rootComplaint?.title || groupComplaints[0].title || "Incident Cluster";
                                    const combinedSeverity = rootComplaint?.combinedSeverity || groupComplaints.find(x => x.combinedSeverity)?.combinedSeverity || null;

                                    // Cluster Header
                                    finalRows.push(
                                        <tr key={`header-${rootId}`} className={`${style.bg} border-t border-white/5`}>
                                            <td colSpan={7} className={`p-2 pl-6 border-l-4 ${style.border}`}>
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        <Layers size={14} className={style.text} />
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}>
                                                            Incident Cluster: {clusterTitle} ({groupComplaints.length} Reports)
                                                        </span>
                                                    </div>
                                                    {combinedSeverity && (
                                                        <div className="flex items-center gap-1 bg-[#00ff88]/15 px-2 py-0.5 rounded border border-[#00ff88]/20 mr-2">
                                                            <span className="text-[9px] font-black tracking-wider text-[#00ff88] uppercase">Combined Severity:</span>
                                                            <span className="text-[10px] font-black text-[#00ff88]">{combinedSeverity}</span>
                                                        </div>
                                                     )}
                                                </div>
                                            </td>
                                        </tr>
                                    );

                                    // Identify if the actual root/master is present in groupComplaints
                                    const master = groupComplaints.find(c => c.id === rootId);
                                    const duplicates = groupComplaints.filter(c => c.id !== rootId);

                                    // Render Master if present (without border-t)
                                    if (master) {
                                        finalRows.push(renderComplaintRow(master, false, true, style, false));
                                    }

                                    // Render Duplicates (without border-t)
                                    duplicates.forEach(child => {
                                        finalRows.push(renderComplaintRow(child, true, false, style, false));
                                    });

                                    // Valid HTML Spacer row with proper td
                                    finalRows.push(
                                        <tr key={`spacer-${rootId}`} className="h-4 bg-transparent pointer-events-none">
                                            <td colSpan={7} className="h-4 p-0 border-0 bg-transparent" />
                                        </tr>
                                    );
                                });

                                return finalRows;

                                function renderComplaintRow(c: any, isChild: boolean, isMaster: boolean, style: any, showTopBorder: boolean) {
                                    const inCluster = isMaster || isChild;
                                    return (
                                        <tr 
                                            key={c.id} 
                                            className={`group hover:bg-white/5 transition-colors ${isChild ? 'bg-white/[0.01]' : ''} ${inCluster ? style.bg : ''} ${showTopBorder ? 'border-t border-white/5' : ''}`}
                                        >
                                            <td className={`p-4 pl-6 ${inCluster ? `border-l-4 ${style.border}` : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    {isChild && (
                                                        <div className="flex items-center -ml-2 mr-1">
                                                            <div className={`w-4 h-8 border-l-2 border-b-2 ${style.border}/20 rounded-bl-lg`} />
                                                        </div>
                                                    )}
                                                    
                                                    <div className="relative">
                                                        <div className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border ${isMaster ? style.border : 'border-white/10'} ${isMaster ? style.glow : ''}`}>
                                                            {c.imageUrls?.[0] ? (
                                                                <img src={c.imageUrls[0]} className="w-full h-full object-cover" />
                                                            ) : <ImageIcon size={16} className="text-zinc-600" />}
                                                        </div>
                                                        {isMaster && (
                                                            <div className={`absolute -top-1 -right-1 ${style.badge} rounded-full p-1 border border-[#09090b] shadow-lg`}>
                                                                <Shield size={10} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white line-clamp-1 flex items-center gap-2">
                                                            {c.title}
                                                            {isMaster && (
                                                                <span className={`text-[9px] ${style.badge} text-black px-1.5 py-0.5 rounded-sm font-black uppercase`}>
                                                                    Master
                                                                </span>
                                                            )}
                                                            {isChild && (
                                                                <span className={`text-[9px] bg-zinc-800 ${style.text} px-1.5 py-0.5 rounded-sm border ${style.border}/20 font-bold uppercase`}>
                                                                    Duplicate
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 flex items-center gap-2">
                                                            <Clock size={12} /> {new Date((c.createdAt?.seconds || 0) * 1000).toLocaleDateString()}
                                                            {c.district && <span className="truncate max-w-[150px]"> • {c.district}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {(() => {
                                                    const p = (typeof c.priority === 'number' && c.priority >= 1 && c.priority <= 4) ? c.priority : 1;
                                                    const colors = ['text-zinc-500', 'text-blue-400', 'text-orange-400', 'text-red-500'];
                                                    const labels = ['Low', 'Medium', 'High', 'Critical'];
                                                    const colorClass = colors[p-1] || colors[0];
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${colorClass.replace('text-', 'bg-')}`} />
                                                            <span className={`text-xs font-bold ${colorClass}`}>{labels[p-1] || labels[0]}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Activity size={12} className={(c.severityScore || 0) > 70 ? 'text-red-400' : 'text-zinc-400'} />
                                                        <span className="text-sm font-medium">{c.severityScore || 0}</span>
                                                    </div>
                                                    <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${(c.severityScore || 0) > 75 ? 'bg-red-500' : (c.severityScore || 0) > 40 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                                                            style={{ width: `${c.severityScore || 0}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {c.status === 'resolved' ? (
                                                    <span className="flex items-center gap-1.5 text-[#00ff88] text-xs font-bold">
                                                        <CheckCircle size={14} /> Resolved
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-orange-400 text-xs font-bold">
                                                        <AlertTriangle size={14} /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                                                        <ThumbsUp size={12} className="text-[#00ff88]" /> {c.upvotes || 0}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                                                        <MessageSquare size={12} className="text-blue-400" /> {c.commentCount || 0}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {c.verificationStatus === 'verified' ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-[#00ff88] text-xs font-bold flex items-center gap-1">
                                                            <Shield size={12} /> Verified
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500">
                                                            {(c.verificationConfidence * 100).toFixed(0)}% • {c.detectedIssues?.[0] || 'Clean'}
                                                        </span>
                                                    </div>
                                                ) : c.verificationStatus === 'rejected' ? (
                                                    <span className="text-red-500 text-xs font-bold">Rejected</span>
                                                ) : (
                                                    <span className="text-zinc-500 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 pr-6">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    <button
                                                        onClick={() => setSelectedComplaint(c)}
                                                        className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20" title="View Details"
                                                    >
                                                        <ImageIcon size={16} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleAction(c.id, 'delete')}
                                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20" title="Delete Complaint"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>

                                                    {c.status !== 'resolved' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAction(c.id, 'resolve')}
                                                                className="p-1.5 rounded-lg bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20" title="Mark Resolved"
                                                            >
                                                                <CheckCircle size={16} />
                                                            </button>
                                                            {c.verificationStatus !== 'verified' && (
                                                                <button
                                                                    onClick={() => handleAction(c.id, 'verify')}
                                                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Manually Verify"
                                                                >
                                                                    <Shield size={16} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleAction(c.id, 'reject')}
                                                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Reject Report"
                                                            >
                                                                <XCircle size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }
                            })()}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                                        No reports found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Report Detail Modal */}
            {selectedComplaint && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
                        <button
                            onClick={() => setSelectedComplaint(null)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white z-10"
                        >
                            <XCircle size={24} />
                        </button>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Side: Report Details */}
                            <div className="flex-1 p-6 overflow-y-auto border-r border-white/5">
                                <h2 className="text-2xl font-bold mb-4">{selectedComplaint.title}</h2>

                                {selectedComplaint.imageUrls?.length > 0 && (
                                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                                        {selectedComplaint.imageUrls.map((url: string, i: number) => (
                                            <img key={i} src={url} className="h-48 rounded-xl object-cover border border-white/10" />
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <section>
                                        <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Description</label>
                                        <p className="text-zinc-300 mt-1 whitespace-pre-wrap">{selectedComplaint.description}</p>
                                    </section>

                                    <div className="grid grid-cols-2 gap-6">
                                        <section>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Category</label>
                                            <div className="mt-1 text-[#00ff88] font-medium">{selectedComplaint.category}</div>
                                        </section>
                                        <section>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Status</label>
                                            <div className="mt-1 flex items-center gap-2 font-medium">
                                                {selectedComplaint.status === 'resolved' ? (
                                                    <span className="text-[#00ff88] flex items-center gap-1"><CheckCircle size={14} /> Resolved</span>
                                                ) : (
                                                    <span className="text-orange-400 flex items-center gap-1"><AlertTriangle size={14} /> Pending</span>
                                                )}
                                            </div>
                                        </section>
                                        <section>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Location</label>
                                            <div className="mt-1 text-zinc-300 text-sm">{selectedComplaint.location?.address || 'No address'}</div>
                                        </section>
                                        <section>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Reporter</label>
                                            <div className="mt-1 text-zinc-300 flex items-center gap-2 text-sm">
                                                <User size={14} className="text-[#00ff88]" /> {selectedComplaint.userName}
                                            </div>
                                        </section>
                                    </div>

                                    {selectedComplaint.verificationStatus === 'verified' && (
                                        <div className="space-y-4">
                                            <section className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-[#00ff88] font-bold mb-2">
                                                    <Shield size={16} /> AI Verification Result
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div>
                                                        <span className="text-zinc-500">Status:</span>
                                                        <div className="text-white font-medium capitalize">{selectedComplaint.verificationStatus} ({(selectedComplaint.verificationConfidence * 100).toFixed(0)}%)</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-zinc-500">Priority:</span>
                                                        <div className={`font-bold ${selectedComplaint.priority === 4 ? 'text-red-500' : 'text-orange-400'}`}>
                                                            Level {selectedComplaint.priority} ({['Low', 'Medium', 'High', 'Critical'][selectedComplaint.priority-1]})
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-zinc-500">Detected Issues:</span>
                                                        <div className="text-white">{selectedComplaint.detectedIssues?.join(', ')}</div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-blue-400 font-bold mb-2">
                                                    <TrendingUp size={16} /> AI Environmental Context
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div>
                                                        <span className="text-zinc-500">Traffic Density:</span>
                                                        <div className="text-white flex items-center gap-1">
                                                            <Car size={12} /> {selectedComplaint.aiContext?.traffic_density || 'Low'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-zinc-500">Area Type:</span>
                                                        <div className="text-white flex items-center gap-1">
                                                            <MapPin size={12} /> {selectedComplaint.aiContext?.area_type || 'General'}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-zinc-500">Severity Reasoning:</span>
                                                        <div className="text-white italic">"{selectedComplaint.verificationReason}"</div>
                                                    </div>
                                                </div>
                                            </section>

                                            {complaints.filter(sub => sub.parentId === selectedComplaint.id).length > 0 && (
                                                <section className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                    <div className="flex items-center gap-2 text-white font-bold mb-2">
                                                        <Layers size={16} /> Linked Reports (Grouped)
                                                    </div>
                                                    <div className="space-y-2">
                                                        {complaints.filter(sub => sub.parentId === selectedComplaint.id).map(sub => (
                                                            <div key={sub.id} className="text-xs text-zinc-400 flex justify-between bg-black/20 p-2 rounded-lg">
                                                                <span className="truncate max-w-[200px]">{sub.title}</span>
                                                                <span>{new Date(sub.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Comments/Discussion */}
                            <div className="w-[400px] bg-black/40 flex flex-col">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <MessageSquare size={18} className="text-[#00ff88]" /> Discussion
                                    </h3>
                                    <span className="text-xs text-zinc-500">{reportComments.length} comments</span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {isLoadingComments ? (
                                        <div className="flex justify-center p-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff88]"></div>
                                        </div>
                                    ) : reportComments.length === 0 ? (
                                        <div className="text-center py-12 text-zinc-500 text-sm">
                                            No comments yet.
                                        </div>
                                    ) : (
                                        reportComments.map((comment) => (
                                            <div key={comment.id} className={`p-3 rounded-xl border ${comment.isAdmin ? 'bg-[#00ff88]/5 border-[#00ff88]/30 shadow-[0_0_15px_rgba(0,255,136,0.05)]' : 'bg-white/5 border-white/5'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-xs font-bold ${comment.isAdmin ? 'text-[#00ff88]' : 'text-zinc-400'}`}>
                                                        {comment.userName} {comment.isAdmin && '🛡️'}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-600">
                                                        {new Date(comment.createdAt?.seconds * 1000).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 border-t border-white/5 bg-black/60">
                                    <div className="relative">
                                        <textarea
                                            value={adminComment}
                                            onChange={(e) => setAdminComment(e.target.value)}
                                            placeholder="Write official response..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pr-12 text-sm focus:outline-none focus:border-[#00ff88]/50 min-h-[80px]"
                                        />
                                        <button
                                            onClick={handlePostAdminComment}
                                            disabled={isPostingComment || !adminComment.trim()}
                                            className="absolute bottom-3 right-3 p-2 bg-[#00ff88] text-black rounded-lg hover:shadow-[0_0_10px_rgba(0,255,136,0.3)] transition-all disabled:opacity-50"
                                        >
                                            {isPostingComment ? (
                                                <div className="h-4 w-4 animate-spin border-b-2 border-black rounded-full"></div>
                                            ) : (
                                                <Send size={16} />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-2 italic text-center">
                                        Admins post as "Official Admin" and are pinned to top.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
