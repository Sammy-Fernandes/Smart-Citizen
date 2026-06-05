'use client';

import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { AlertOctagon, Bell, Info, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function BroadcastsPage() {
    const [news, setNews] = useState<any[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('info'); // info, alert
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        // Fetch broadcasts (requires creating 'broadcasts' collection in Firestore first time a doc is added)
        const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setNews(docs);
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
            console.log("Starting Cloudinary upload...", { fileName: file.name, fileSize: file.size });
            const res = await fetch('https://api.cloudinary.com/v1_1/dx8gqgdtc/image/upload', {
                method: 'POST',
                body: formData
            });

            console.log("Cloudinary response status:", res.status);
            const text = await res.text();
            console.log("Cloudinary raw response:", text);

            let data: any = {};
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse Cloudinary response as JSON:", text);
            }

            if (!res.ok) {
                console.error("Cloudinary upload failed:", data);
                throw new Error(text || `Error ${res.status}`);
            }

            if (data.secure_url) {
                return data.secure_url;
            }

            console.error("No secure_url in Cloudinary response:", data);
            return null;
        } catch (e: any) {
            console.error("Upload process error:", e);
            throw e;
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("handlePost triggered. current imageFile:", imageFile);
        if (!title || !content) {
            console.log("Title or content missing, returning.");
            return;
        }

        setLoading(true);
        try {
            let imageUrl = '';
            let uploadStatus = 'No image selected';

            console.log("Submission starting. imageFile:", imageFile);
            if (imageFile) {
                try {
                    const uploaded = await uploadImage(imageFile);
                    if (uploaded) {
                        imageUrl = uploaded;
                        uploadStatus = 'Image uploaded successfully';
                        console.log('Image uploaded successfully:', imageUrl);
                    }
                } catch (err: any) {
                    uploadStatus = `FAILED: ${err.message}`;
                    console.error("Upload error in handlePost:", err);
                }
            }

            await addDoc(collection(db, 'broadcasts'), {
                title,
                content,
                type,
                imageUrl,
                createdAt: Timestamp.now(),
                active: true
            });
            alert(`Broadcast Published Successfully!\nStatus: ${uploadStatus}\nImage URL: ${imageUrl || 'None'}`);
            console.log('Broadcast created with imageUrl:', imageUrl);
            setTitle('');
            setContent('');
            setImageFile(null);
            // Simulating push notification trigger would happen via Cloud Function here
        } catch (err) {
            console.error("Error posting news", err);
            alert("Failed to post");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this broadcast?')) {
            await deleteDoc(doc(db, 'broadcasts', id));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Compose Section */}
            <div className="lg:col-span-1">
                <div className="glass-card p-6 rounded-2xl sticky top-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Send size={20} className="text-[#00ff88]" /> Compose Update
                    </h2>
                    <form onSubmit={handlePost} className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Type</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setType('info')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2
                                ${type === 'info' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-white/10 hover:bg-white/5'}`}
                                >
                                    <Info size={16} /> News
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('alert')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2
                                ${type === 'alert' ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'border-white/10 hover:bg-white/5'}`}
                                >
                                    <AlertOctagon size={16} /> Alert
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Title</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-[#00ff88]/50"
                                placeholder={type === 'alert' ? "EMERGENCY: Flood Warning" : "New Park Opening"}
                            />
                        </div>

                        {/* Image Upload Input */}
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Pass Image (Optional)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    console.log("File input changed. Selected file:", file);
                                    setImageFile(file);
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-2 text-xs text-zinc-400 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#00ff88]/10 file:text-[#00ff88] hover:file:bg-[#00ff88]/20"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Message</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-[#00ff88]/50 min-h-[120px]"
                                placeholder="Enter details..."
                            />
                        </div>

                        <button
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-[#00ff88] text-black font-bold hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all disabled:opacity-50"
                        >
                            {loading ? 'Broadcasting...' : 'Post Update'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Feed Section */}
            <div className="lg:col-span-2 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Bell size={20} /> Active Broadcasts
                </h2>

                <div className="space-y-4">
                    {news.map(item => (
                        <div key={item.id} className={`rounded-2xl border overflow-hidden ${item.type === 'alert' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                            {/* Broadcast Image */}
                            {item.imageUrl && (
                                <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    className="w-full h-48 object-cover"
                                />
                            )}
                            <div className="p-6 flex gap-4">
                                <div className={`p-3 rounded-full h-fit shrink-0 ${item.type === 'alert' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {item.type === 'alert' ? <AlertOctagon size={24} /> : <Info size={24} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold mb-1">{item.title}</h3>
                                            <p className="text-zinc-500 text-xs mb-3">{new Date((item.createdAt?.seconds || 0) * 1000).toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete(item.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed">{item.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {news.length === 0 && (
                        <div className="text-center py-12 text-zinc-500 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                            No active broadcasts.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
