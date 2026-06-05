'use client';

import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { AlertCircle, ChevronRight, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function PinLoginPage() {
    const [pin, setPin] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) value = value[0]; // Only allow 1 char
        if (!/^\d*$/.test(value)) return; // Only allow numbers

        const newPin = [...pin];
        newPin[index] = value;
        setPin(newPin);

        // Auto-advance
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit if full
        if (index === 5 && value) {
            verifyPin(newPin.join('') + value); // Use current value immediately to avoid state lag
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const verifyPin = async (completedPin: string) => {
        // Check if the passed argument is a string 6 chars long, if not use state
        if (typeof completedPin !== 'string' || completedPin.length !== 6) {
            completedPin = pin.join('');
        }

        if (completedPin.length !== 6) return;

        setLoading(true);
        setError('');

        // --- REAL AUTH LOGIC ---
        // Mapping the PIN to a specific Admin Account for Firebase Auth
        const ADMIN_EMAIL = "admin@civic.app";
        const ADMIN_PASS = "admin123"; // This password corresponds to the PIN '123456'
        const CORRECT_PIN = "123456";

        if (completedPin === CORRECT_PIN) {
            try {
                console.log("Attempting to sign in...");
                await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
                console.log("Sign in successful!");
                router.push('/dashboard');
            } catch (err: any) {
                console.error("Auth error:", err);

                // Auto-create admin user if it doesn't exist (Dev Helper)
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                    try {
                        console.log("Admin account not found. Creating it...");
                        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
                        // Auto sign-in after creation
                        router.push('/dashboard');
                    } catch (createErr: any) {
                        console.error("Failed to create admin:", createErr);
                        setError(createErr.message);
                        setLoading(false);
                        setPin(['', '', '', '', '', '']);
                        inputRefs.current[0]?.focus();
                    }
                } else {
                    setError(err.message);
                    setLoading(false);
                    setPin(['', '', '', '', '', '']);
                    inputRefs.current[0]?.focus();
                }
            }
        } else {
            setError('Invalid Security PIN');
            setLoading(false);
            setPin(['', '', '', '', '', '']); // Reset
            inputRefs.current[0]?.focus();
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00ff88]/5 via-black to-black" />

            <div className="z-10 w-full max-w-md">
                <div className="text-center mb-12">
                    <div className="w-16 h-16 mx-auto bg-[#00ff88]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#00ff88]/20 animate-pulse">
                        <Lock className="w-8 h-8 text-[#00ff88]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Restricted Access</h1>
                    <p className="text-zinc-500 text-sm uppercase tracking-widest">Enter 6-Digit Security PIN</p>
                </div>

                <div className="glass-card p-10 rounded-3xl border border-white/5 relative bg-black/50 backdrop-blur-xl">
                    {error && (
                        <div className="absolute -top-16 left-0 w-full flex justify-center">
                            <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 justify-center mb-8">
                        {pin.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                disabled={loading}
                                className={`w-12 h-16 text-center text-2xl font-bold rounded-xl bg-white/5 border focus:outline-none transition-all duration-300
                  ${digit ? 'border-[#00ff88] text-white shadow-[0_0_15px_rgba(0,255,136,0.3)]' : 'border-white/10 text-transparent focus:border-[#00ff88]/50'} 
                  ${error ? 'border-red-500/50' : ''}
                `}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => verifyPin(pin.join(''))}
                        disabled={loading || pin.join('').length < 6}
                        className="w-full py-4 rounded-xl bg-[#00ff88] text-black font-bold text-lg hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] disabled:opacity-30 disabled:hover:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>Access Portal <ChevronRight size={20} /></>
                        )}
                    </button>
                </div>

                <div className="text-center mt-8">
                    <p className="text-zinc-600 text-xs">
                        Authorized Personnel Only • ID: 192.168.x.x
                    </p>
                </div>
            </div>
        </div>
    );
}
