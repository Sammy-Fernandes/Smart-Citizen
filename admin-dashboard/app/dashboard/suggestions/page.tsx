'use client';

import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Calendar, MapPin, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SuggestionsPage() {
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        // Fetch suggestions, assume ordered by upvotes/popularity is desired 
        // but upvotes field logic might need sorting client side if indexes missing
        const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));

        const unsub = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Client-side sort by upvotes for now to ensure "Popularity" view
            docs.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0));
            setSuggestions(docs);
        });

        return () => unsub();
    }, []);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Community Suggestions</h1>
                <p className="text-zinc-400 text-sm">Top requested improvements from citizens.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suggestions.map((s, i) => (
                    <div key={s.id} className="glass-card p-6 rounded-2xl flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-50 text-[100px] font-bold text-white/5 leading-none select-none -translate-y-8 translate-x-4">
                            {i + 1}
                        </div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-xs text-zinc-300">
                                {s.category}
                            </span>
                            <div className="flex items-center gap-1.5 text-[#00ff88] font-bold">
                                <ThumbsUp size={16} /> {s.upvotes || 0}
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-2 relative z-10">{s.title}</h3>
                        <p className="text-zinc-400 text-sm line-clamp-3 mb-6 flex-1 relative z-10">{s.description}</p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <Calendar size={12} /> {new Date((s.createdAt?.seconds || 0) * 1000).toLocaleDateString()}
                            </div>
                            {s.location?.address && (
                                <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/5 px-2 py-1 rounded">
                                    <MapPin size={10} /> {s.location.address.split(',')[0]}
                                </div>
                            )}
                        </div>

                        {/* Rank Badge for Top 3 */}
                        {i < 3 && (
                            <div className="absolute top-0 left-0 w-16 h-16 overflow-hidden">
                                <div className="absolute top-0 left-0 bg-[#00ff88] text-black font-bold text-[10px] py-1 w-[150%] -rotate-45 -translate-x-[30%] translate-y-[15%] text-center shadow-lg">
                                    TOP #{i + 1}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {suggestions.length === 0 && (
                    <div className="col-span-full p-12 text-center border dashed border-white/10 rounded-2xl text-zinc-500">
                        No suggestions received yet.
                    </div>
                )}
            </div>
        </div>
    );
}
