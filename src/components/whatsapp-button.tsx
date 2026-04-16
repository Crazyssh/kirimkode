"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, ChevronRight } from "lucide-react";

const TELEGRAM_URL = "https://t.me/Kirimkode";

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

    function goToTelegram(message: string) {
        const url = message
            ? `${TELEGRAM_URL}?text=${encodeURIComponent(message)}`
            : TELEGRAM_URL;
        window.open(url, "_blank", "noopener,noreferrer");
        setOpen(false);
        setShowCustom(false);
        setCustomMsg("");
    }

    function handleFaqClick(faq: (typeof FAQ_OPTIONS)[0]) {
        if (faq.message) {
            goToTelegram(faq.message);
        } else {
            setShowCustom(true);
        }
    }

    function handleCustomSend() {
        if (customMsg.trim()) {
            goToTelegram(customMsg.trim());
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50" ref={popupRef}>
            {/* Popup */}
            {open && (
                <div className="absolute bottom-16 right-0 w-80 rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="bg-[#0088cc] px-4 py-3 flex items-center justify-between">
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
                                        className="px-3 py-2 rounded-xl bg-[#0088cc] text-white disabled:opacity-50 hover:bg-[#006daa] transition-colors"
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
                            Powered by Telegram · Tersedia 24/7
                        </p>
                    </div>
                </div>
            )}

            {/* Float Button */}
            <button
                onClick={() => { setOpen(!open); setPulse(false); }}
                className="tg-float-btn"
                aria-label="Chat via Telegram"
            >
                {pulse && !open && <span className="tg-float-pulse" />}
                {open ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                )}
            </button>
        </div>
    );
}
