"use client";

import { useState, useEffect } from "react";

const WA_NUMBER = "19053297645";
const WA_MESSAGE = "Halo KirimKode, saya butuh bantuan";

export function WhatsAppButton() {
    const [show, setShow] = useState(false);
    const [pulse, setPulse] = useState(true);

    useEffect(() => {
        // Show button after 2 seconds
        const timer = setTimeout(() => setShow(true), 2000);
        // Stop pulse after 10 seconds
        const pulseTimer = setTimeout(() => setPulse(false), 10000);
        return () => {
            clearTimeout(timer);
            clearTimeout(pulseTimer);
        };
    }, []);

    if (!show) return null;

    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

    return (
        <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat via WhatsApp"
            className="wa-float-btn"
        >
            {/* Pulse ring */}
            {pulse && <span className="wa-float-pulse" />}

            {/* WhatsApp Icon */}
            <svg viewBox="0 0 32 32" width="28" height="28" fill="white">
                <path d="M16.004 3.2C9.064 3.2 3.404 8.856 3.4 15.8c0 2.22.58 4.392 1.684 6.304L3.2 28.8l6.892-1.808A12.56 12.56 0 0016.008 28.6c6.94 0 12.596-5.656 12.6-12.6.004-3.368-1.308-6.532-3.692-8.916A12.52 12.52 0 0016.004 3.2zm0 23.08a10.24 10.24 0 01-5.224-1.428l-.376-.224-3.892 1.02 1.04-3.796-.244-.388A10.2 10.2 0 015.72 15.8c0-5.676 4.62-10.292 10.3-10.292a10.24 10.24 0 017.284 3.016 10.24 10.24 0 013.012 7.284c-.004 5.676-4.624 10.292-10.312 10.292v-.02zm5.648-7.708c-.308-.156-1.832-.904-2.116-1.008-.284-.104-.492-.156-.7.156s-.804 1.008-.988 1.216c-.18.208-.364.232-.672.076-.308-.156-1.304-.48-2.484-1.532-.92-.82-1.54-1.832-1.72-2.14-.18-.308-.02-.476.136-.628.14-.14.308-.364.464-.544.156-.18.208-.308.312-.516.104-.208.052-.388-.028-.544-.076-.156-.7-1.688-.96-2.312-.252-.608-.508-.524-.7-.536h-.596c-.208 0-.544.08-.828.388-.284.308-1.084 1.06-1.084 2.584s1.108 3 1.264 3.208c.156.208 2.184 3.332 5.292 4.672.74.32 1.316.512 1.768.656.744.236 1.42.204 1.952.124.596-.088 1.832-.748 2.092-1.472.256-.724.256-1.344.18-1.472-.08-.132-.284-.208-.596-.364z" />
            </svg>
        </a>
    );
}
