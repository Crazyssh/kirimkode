"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, ChevronRight } from "lucide-react";

const WA_NUMBER = "19053297645";

const FAQ_OPTIONS = [
    {
        label: "💰 Deposit tidak masuk",
        message: "Halo KirimKode, deposit saya belum masuk ke saldo. Mohon bantuannya.",
    },
    {
        label: "🔑 Lupa password",
        message: "Halo KirimKode, saya lupa password akun saya. Mohon bantuannya untuk reset.",
    },
    {
        label: "📱 OTP tidak masuk",
        message: "Halo KirimKode, saya sudah beli nomor tapi OTP tidak masuk. Mohon bantuannya.",
    },
    {
        label: "💸 Refund / Pembatalan",
        message: "Halo KirimKode, saya ingin bertanya tentang refund/pembatalan order. Mohon bantuannya.",
    },
    {
        label: "❓ Pertanyaan lainnya",
        message: "",
    },
];

export function WhatsAppButton() {
    const [showButton, setShowButton] = useState(false);
    const [open, setOpen] = useState(false);
    const [customMsg, setCustomMsg] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const [pulse, setPulse] = useState(true);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setShowButton(true), 2000);
        const pulseTimer = setTimeout(() => setPulse(false), 10000);
        return () => {
            clearTimeout(timer);
            clearTimeout(pulseTimer);
        };
    }, []);

    // Close popup on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setOpen(false);
                setShowCustom(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    if (!showButton) return null;

    function goToWA(message: string) {
        const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        setOpen(false);
        setShowCustom(false);
        setCustomMsg("");
    }

    function handleFaqClick(faq: (typeof FAQ_OPTIONS)[0]) {
        if (faq.message) {
            goToWA(faq.message);
        } else {
            setShowCustom(true);
        }
    }

    function handleCustomSend() {
        if (customMsg.trim()) {
            goToWA(customMsg.trim());
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50" ref={popupRef}>
            {/* Popup */}
            {open && (
                <div className="absolute bottom-16 right-0 w-80 rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="bg-[#25D366] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <MessageCircle className="w-5 h-5" />
                            <div>
                                <div className="text-sm font-semibold">KirimKode Support</div>
                                <div className="text-[10px] opacity-80">Biasanya membalas dalam menit</div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setOpen(false); setShowCustom(false); }}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-3">
                        {!showCustom ? (
                            <>
                                <p className="text-xs text-muted mb-3 px-1">
                                    Pilih topik atau tulis pesan Anda:
                                </p>
                                <div className="space-y-1.5">
                                    {FAQ_OPTIONS.map((faq) => (
                                        <button
                                            key={faq.label}
                                            onClick={() => handleFaqClick(faq)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm hover:bg-surface-hover transition-colors group"
                                        >
                                            <span>{faq.label}</span>
                                            <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-muted mb-2 px-1">
                                    Tulis pesan Anda:
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customMsg}
                                        onChange={(e) => setCustomMsg(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCustomSend()}
                                        placeholder="Ketik pesan..."
                                        className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCustomSend}
                                        disabled={!customMsg.trim()}
                                        className="px-3 py-2 rounded-xl bg-[#25D366] text-white disabled:opacity-50 hover:bg-[#20bd5a] transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowCustom(false)}
                                    className="text-xs text-muted hover:text-foreground mt-2 px-1 transition-colors"
                                >
                                    ← Kembali ke pilihan
                                </button>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-border">
                        <p className="text-[10px] text-muted text-center">
                            Powered by WhatsApp · Tersedia 24/7
                        </p>
                    </div>
                </div>
            )}

            {/* Float Button */}
            <button
                onClick={() => { setOpen(!open); setPulse(false); }}
                className="wa-float-btn"
                aria-label="Chat via WhatsApp"
            >
                {pulse && !open && <span className="wa-float-pulse" />}
                {open ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <svg viewBox="0 0 32 32" width="28" height="28" fill="white">
                        <path d="M16.004 3.2C9.064 3.2 3.404 8.856 3.4 15.8c0 2.22.58 4.392 1.684 6.304L3.2 28.8l6.892-1.808A12.56 12.56 0 0016.008 28.6c6.94 0 12.596-5.656 12.6-12.6.004-3.368-1.308-6.532-3.692-8.916A12.52 12.52 0 0016.004 3.2zm0 23.08a10.24 10.24 0 01-5.224-1.428l-.376-.224-3.892 1.02 1.04-3.796-.244-.388A10.2 10.2 0 015.72 15.8c0-5.676 4.62-10.292 10.3-10.292a10.24 10.24 0 017.284 3.016 10.24 10.24 0 013.012 7.284c-.004 5.676-4.624 10.292-10.312 10.292v-.02zm5.648-7.708c-.308-.156-1.832-.904-2.116-1.008-.284-.104-.492-.156-.7.156s-.804 1.008-.988 1.216c-.18.208-.364.232-.672.076-.308-.156-1.304-.48-2.484-1.532-.92-.82-1.54-1.832-1.72-2.14-.18-.308-.02-.476.136-.628.14-.14.308-.364.464-.544.156-.18.208-.308.312-.516.104-.208.052-.388-.028-.544-.076-.156-.7-1.688-.96-2.312-.252-.608-.508-.524-.7-.536h-.596c-.208 0-.544.08-.828.388-.284.308-1.084 1.06-1.084 2.584s1.108 3 1.264 3.208c.156.208 2.184 3.332 5.292 4.672.74.32 1.316.512 1.768.656.744.236 1.42.204 1.952.124.596-.088 1.832-.748 2.092-1.472.256-.724.256-1.344.18-1.472-.08-.132-.284-.208-.596-.364z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
