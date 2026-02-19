export interface OTPServer {
  id: "api1" | "api2";
  name: string;
  icon: string;
  color: string;
  description: string;
  status: "online" | "maintenance";
}

export interface OTPService {
  id: string;
  name: string;
  icon: string;
  category: string;
  price: number;
  available: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  priceMultiplier: number;
}

export const servers: OTPServer[] = [
  {
    id: "api1",
    name: "Mars",
    icon: "\uD83D\uDD34",
    color: "from-red-500 to-orange-500",
    description: "Server utama, stok terbanyak",
    status: "online",
  },
  {
    id: "api2",
    name: "Jupiter",
    icon: "\uD83D\uDFE0",
    color: "from-amber-500 to-yellow-500",
    description: "Server cadangan, lebih stabil",
    status: "online",
  },
];

export const countries: Country[] = [
  { code: "ID", name: "Indonesia", flag: "\ud83c\uddee\ud83c\udde9", priceMultiplier: 1 },
  { code: "US", name: "Amerika Serikat", flag: "\ud83c\uddfa\ud83c\uddf8", priceMultiplier: 3.5 },
  { code: "UK", name: "Inggris", flag: "\ud83c\uddec\ud83c\udde7", priceMultiplier: 3 },
  { code: "IN", name: "India", flag: "\ud83c\uddee\ud83c\uddf3", priceMultiplier: 0.8 },
  { code: "RU", name: "Rusia", flag: "\ud83c\uddf7\ud83c\uddfa", priceMultiplier: 1.5 },
  { code: "BR", name: "Brazil", flag: "\ud83c\udde7\ud83c\uddf7", priceMultiplier: 1.2 },
  { code: "PH", name: "Filipina", flag: "\ud83c\uddf5\ud83c\udded", priceMultiplier: 0.9 },
  { code: "VN", name: "Vietnam", flag: "\ud83c\uddfb\ud83c\uddf3", priceMultiplier: 0.7 },
  { code: "MY", name: "Malaysia", flag: "\ud83c\uddf2\ud83c\uddfe", priceMultiplier: 1.3 },
  { code: "TH", name: "Thailand", flag: "\ud83c\uddf9\ud83c\udded", priceMultiplier: 1.1 },
  { code: "DE", name: "Jerman", flag: "\ud83c\udde9\ud83c\uddea", priceMultiplier: 3.2 },
  { code: "FR", name: "Prancis", flag: "\ud83c\uddeb\ud83c\uddf7", priceMultiplier: 3.0 },
  { code: "NG", name: "Nigeria", flag: "\ud83c\uddf3\ud83c\uddec", priceMultiplier: 0.6 },
  { code: "KR", name: "Korea Selatan", flag: "\ud83c\uddf0\ud83c\uddf7", priceMultiplier: 2.5 },
  { code: "JP", name: "Jepang", flag: "\ud83c\uddef\ud83c\uddf5", priceMultiplier: 3.5 },
];

export const services: OTPService[] = [
  { id: "whatsapp", name: "WhatsApp", icon: "/icons/whatsapp.svg", category: "Messenger", price: 1500, available: 342 },
  { id: "telegram", name: "Telegram", icon: "/icons/telegram.svg", category: "Messenger", price: 1200, available: 521 },
  { id: "facebook", name: "Facebook", icon: "/icons/facebook.svg", category: "Sosial Media", price: 2000, available: 189 },
  { id: "instagram", name: "Instagram", icon: "/icons/instagram.svg", category: "Sosial Media", price: 2500, available: 156 },
  { id: "tiktok", name: "TikTok", icon: "/icons/tiktok.svg", category: "Sosial Media", price: 1800, available: 278 },
  { id: "twitter", name: "Twitter / X", icon: "/icons/twitter.svg", category: "Sosial Media", price: 2200, available: 94 },
  { id: "google", name: "Google / Gmail", icon: "/icons/google.svg", category: "Email", price: 3000, available: 67 },
  { id: "discord", name: "Discord", icon: "/icons/discord.svg", category: "Messenger", price: 1500, available: 445 },
  { id: "line", name: "LINE", icon: "/icons/line.svg", category: "Messenger", price: 2000, available: 123 },
  { id: "shopee", name: "Shopee", icon: "/icons/shopee.svg", category: "E-Commerce", price: 1200, available: 389 },
  { id: "tokopedia", name: "Tokopedia", icon: "/icons/tokopedia.svg", category: "E-Commerce", price: 1200, available: 256 },
  { id: "grab", name: "Grab", icon: "/icons/grab.svg", category: "Transport", price: 2500, available: 78 },
  { id: "gojek", name: "Gojek", icon: "/icons/gojek.svg", category: "Transport", price: 2500, available: 65 },
  { id: "dana", name: "DANA", icon: "/icons/dana.svg", category: "Fintech", price: 3000, available: 45 },
  { id: "ovo", name: "OVO", icon: "/icons/ovo.svg", category: "Fintech", price: 3000, available: 52 },
  { id: "spotify", name: "Spotify", icon: "/icons/spotify.svg", category: "Hiburan", price: 1800, available: 312 },
  { id: "netflix", name: "Netflix", icon: "/icons/netflix.svg", category: "Hiburan", price: 2800, available: 89 },
  { id: "lazada", name: "Lazada", icon: "/icons/lazada.svg", category: "E-Commerce", price: 1200, available: 201 },
];

export const categories = [
  "Semua",
  "Messenger",
  "Sosial Media",
  "E-Commerce",
  "Fintech",
  "Transport",
  "Email",
  "Hiburan",
];
