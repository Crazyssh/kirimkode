"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/store/user";
import {
  Key,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  CheckCircle,
  Book,
  Zap,
  AlertTriangle,
  Gauge,
} from "lucide-react";

const sections = [
  { id: "api-key", label: "API Key", icon: Key },
  { id: "quick-start", label: "Quick Start", icon: Zap },
  { id: "endpoints", label: "Endpoints", icon: Book },
  { id: "rate-limit", label: "Rate Limit", icon: Gauge },
  { id: "errors", label: "Kode Error", icon: AlertTriangle },
];

const apiEndpoints = [
  {
    method: "GET",
    path: "/api/v1/balance",
    description: "Cek saldo akun",
    example: `{
  "status": "success",
  "data": {
    "balance": 125000,
    "currency": "IDR"
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/services",
    description: "Daftar semua layanan tersedia",
    example: `{
  "status": "success",
  "data": [
    {
      "id": "whatsapp",
      "name": "WhatsApp",
      "category": "Messenger",
      "price": 1500,
      "available": 342
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/countries",
    description: "Daftar negara tersedia",
    example: `{
  "status": "success",
  "data": [
    {
      "code": "ID",
      "name": "Indonesia",
      "flag": "\ud83c\uddee\ud83c\udde9",
      "price_multiplier": 1.0
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/order",
    description: "Beli nomor virtual baru",
    example: `// Request
{
  "service": "whatsapp",
  "country": "ID"
}

// Response
{
  "status": "success",
  "data": {
    "order_id": "ORD-048",
    "number": "+6281234567890",
    "service": "whatsapp",
    "expires_at": "2026-02-19T15:00:00Z"
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/order/{id}/status",
    description: "Cek status order & kode OTP",
    example: `{
  "status": "success",
  "data": {
    "order_id": "ORD-048",
    "number": "+6281234567890",
    "code": "482916",
    "status": "completed",
    "received_at": "2026-02-19T14:42:15Z"
  }
}`,
  },
  {
    method: "POST",
    path: "/api/v1/order/{id}/cancel",
    description: "Batalkan order (sebelum OTP masuk)",
    example: `{
  "status": "success",
  "message": "Order dibatalkan, saldo dikembalikan"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/history",
    description: "Riwayat semua order",
    example: `{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 47
  }
}`,
  },
];

const errorCodes = [
  { code: 200, status: "OK", desc: "Request berhasil" },
  { code: 400, status: "Bad Request", desc: "Parameter tidak valid" },
  { code: 401, status: "Unauthorized", desc: "API key tidak valid" },
  { code: 402, status: "Payment Required", desc: "Saldo tidak cukup" },
  { code: 404, status: "Not Found", desc: "Resource tidak ditemukan" },
  { code: 429, status: "Too Many Requests", desc: "Rate limit exceeded" },
  { code: 503, status: "Service Unavailable", desc: "Nomor tidak tersedia" },
];

export default function ApiDocsPage() {
  const { user, fetchUser } = useUserStore();
  const [showKey, setShowKey] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const apiKey = user?.apiKey || "";

  const handleRegenerate = async () => {
    if (!confirm("Regenerate API key? Key lama akan tidak berlaku.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/user/api-key", { method: "POST" });
      if (res.ok) {
        await fetchUser();
        setShowKey(true);
      }
    } catch { /* silent */ }
    finally { setRegenerating(false); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-[860px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            API Documentation
          </h1>
          <p className="text-sm text-muted">
            Integrasikan layanan KirimKode ke aplikasi Anda
          </p>
        </div>

        {/* API Key */}
        <section id="api-key">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="w-4 h-4 text-primary" />
                API Key
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!apiKey ? (
                <div className="space-y-3 w-full">
                  <p className="text-sm text-muted">Belum punya API key. Generate sekarang untuk mulai integrasi.</p>
                  <Button onClick={handleRegenerate} disabled={regenerating}>
                    {regenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Generate API Key
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-background rounded-xl border border-border font-[family-name:var(--font-jetbrains-mono)] text-sm w-full">
                    <span className="flex-1 truncate">
                      {showKey ? apiKey : "\u2022".repeat(40)}
                    </span>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="text-muted hover:text-foreground shrink-0"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(apiKey, "apikey")}
                      className="text-muted hover:text-foreground shrink-0"
                    >
                      {copied === "apikey" ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button variant="secondary" size="sm" className="shrink-0" onClick={handleRegenerate} disabled={regenerating}>
                    {regenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted mt-2">
                Gunakan header <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">X-API-Key</code> untuk autentikasi.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Base URL Info */}
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted mb-1">Base URL</div>
                <code className="text-xs sm:text-sm font-[family-name:var(--font-jetbrains-mono)] text-primary break-all">
                  https://api.kirimkode.com/v1
                </code>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Autentikasi</div>
                <code className="text-xs sm:text-sm font-[family-name:var(--font-jetbrains-mono)] text-muted">
                  Header: X-API-Key
                </code>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Format</div>
                <Badge variant="primary">JSON</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <section id="quick-start">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-4 h-4 text-primary" />
                  Quick Start
                </CardTitle>
                <button
                  onClick={() => handleCopy(`curl -H "X-API-Key: YOUR_API_KEY" https://api.kirimkode.com/v1/balance`, "quickstart")}
                  className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                >
                  {copied === "quickstart" ? <CheckCircle className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  {copied === "quickstart" ? "Copied!" : "Copy"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-xl p-2 sm:p-4 overflow-x-auto">
                <pre className="text-[10px] sm:text-sm font-[family-name:var(--font-jetbrains-mono)] leading-relaxed">
                  <code>
                    <span className="text-muted"># Cek saldo</span>
                    {"\n"}<span className="text-accent">curl</span> -H <span className="text-primary">{'"X-API-Key: YOUR_API_KEY"'}</span>
                    {"\n  "}https://api.kirimkode.com/v1/balance
                    {"\n\n"}<span className="text-muted"># Beli nomor WhatsApp Indonesia</span>
                    {"\n"}<span className="text-accent">curl</span> -X POST{"\n  "}-H <span className="text-primary">{'"X-API-Key: YOUR_API_KEY"'}</span>
                    {"\n  "}-H <span className="text-primary">{'"Content-Type: application/json"'}</span>
                    {"\n  "}-d <span className="text-primary">{"'{\"service\":\"whatsapp\",\"country\":\"ID\"}"}</span><span className="text-primary">{"'"}</span>
                    {"\n  "}https://api.kirimkode.com/v1/order
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="space-y-3">
          <h2 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
            Endpoints
          </h2>

          {apiEndpoints.map((endpoint, index) => (
            <Card key={index}>
              <button
                onClick={() => setExpandedEndpoint(expandedEndpoint === index ? null : index)}
                className="w-full text-left"
              >
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={endpoint.method === "GET" ? "success" : "warning"}
                        className="font-[family-name:var(--font-jetbrains-mono)] text-xs w-14 justify-center"
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs sm:text-sm font-[family-name:var(--font-jetbrains-mono)] break-all">
                        {endpoint.path}
                      </code>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted hidden sm:inline">
                        {endpoint.description}
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 text-muted transition-transform ${expandedEndpoint === index ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </button>

              {expandedEndpoint === index && (
                <div className="px-6 pb-6 animate-fade-in">
                  <p className="text-sm text-muted mb-3">{endpoint.description}</p>
                  <div className="relative">
                    <button
                      onClick={() => handleCopy(endpoint.example, `ep-${index}`)}
                      className="absolute top-3 right-3 text-muted hover:text-foreground z-10"
                    >
                      {copied === `ep-${index}` ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <div className="bg-background rounded-xl p-4 overflow-x-auto">
                      <pre className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-foreground/80 leading-relaxed">
                        {endpoint.example}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </section>

        {/* Rate Limit */}
        <section id="rate-limit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="w-4 h-4 text-primary" />
                Rate Limiting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { limit: "100", plan: "Starter" },
                  { limit: "500", plan: "Pro" },
                  { limit: "Unlimited", plan: "Enterprise" },
                ].map((r) => (
                  <div key={r.plan} className="p-3 sm:p-4 rounded-xl bg-background/50 text-center">
                    <div className="text-lg sm:text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                      {r.limit}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted">Request/menit ({r.plan})</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Error Codes */}
        <section id="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Kode Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium w-20">Code</th>
                      <th className="pb-3 font-medium w-40">Status</th>
                      <th className="pb-3 font-medium">Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorCodes.map((err) => (
                      <tr key={err.code} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2.5">
                          <Badge
                            variant={err.code === 200 ? "success" : err.code < 500 ? "warning" : "error"}
                            className="font-[family-name:var(--font-jetbrains-mono)]"
                          >
                            {err.code}
                          </Badge>
                        </td>
                        <td className="py-2.5 font-medium">{err.status}</td>
                        <td className="py-2.5 text-muted">{err.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
    </div>
  );
}
