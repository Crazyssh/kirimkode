"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
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
  Code,
} from "lucide-react";

export default function ApiDocsPage() {
  const { user, fetchUser } = useUserStore();
  const { t } = useLanguageStore();
  const [showKey, setShowKey] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [sdkTab, setSdkTab] = useState<"node" | "python" | "php" | "curl">("node");

  const apiKey = user?.apiKey || "";

  const sections = [
    { id: "api-key", label: "API Key", icon: Key },
    { id: "quick-start", label: t("apiDocs.quickStart"), icon: Zap },
    { id: "sdk-examples", label: "SDK Examples", icon: Code },
    { id: "endpoints", label: t("apiDocs.endpoints"), icon: Book },
    { id: "rate-limit", label: t("apiDocs.rateLimit"), icon: Gauge },
    { id: "errors", label: t("apiDocs.errorCodes"), icon: AlertTriangle },
  ];

  const sdkExamples: Record<string, { label: string; code: string }> = {
    node: {
      label: "Node.js",
      code: `const API_KEY = "YOUR_API_KEY";
const BASE = "https://api.kirimkode.com/v1";

// Cek saldo
const balance = await fetch(\`\${BASE}/balance\`, {
  headers: { "X-API-Key": API_KEY },
}).then(r => r.json());
console.log("Saldo:", balance.data.balance);

// Order nomor virtual WhatsApp
const order = await fetch(\`\${BASE}/order\`, {
  method: "POST",
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    service: "whatsapp",
    country: "ID",
  }),
}).then(r => r.json());
console.log("Nomor:", order.data.number);

// Poll OTP (cek setiap 5 detik)
const checkOtp = async (orderId) => {
  const res = await fetch(
    \`\${BASE}/order/\${orderId}/status\`,
    { headers: { "X-API-Key": API_KEY } }
  ).then(r => r.json());

  if (res.data.code) {
    console.log("OTP:", res.data.code);
    return res.data.code;
  }
  // Coba lagi dalam 5 detik
  await new Promise(r => setTimeout(r, 5000));
  return checkOtp(orderId);
};

const otp = await checkOtp(order.data.order_id);`,
    },
    python: {
      label: "Python",
      code: `import requests
import time

API_KEY = "YOUR_API_KEY"
BASE = "https://api.kirimkode.com/v1"
headers = {"X-API-Key": API_KEY}

# Cek saldo
balance = requests.get(f"{BASE}/balance", headers=headers).json()
print(f"Saldo: {balance['data']['balance']}")

# Order nomor virtual WhatsApp
order = requests.post(f"{BASE}/order", headers={
    **headers, "Content-Type": "application/json"
}, json={
    "service": "whatsapp",
    "country": "ID"
}).json()
print(f"Nomor: {order['data']['number']}")

# Poll OTP (cek setiap 5 detik)
order_id = order["data"]["order_id"]
while True:
    status = requests.get(
        f"{BASE}/order/{order_id}/status",
        headers=headers
    ).json()
    if status["data"].get("code"):
        print(f"OTP: {status['data']['code']}")
        break
    time.sleep(5)`,
    },
    php: {
      label: "PHP",
      code: `<?php
$apiKey = "YOUR_API_KEY";
$base = "https://api.kirimkode.com/v1";

// Cek saldo
$ch = curl_init("$base/balance");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: $apiKey"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$balance = json_decode(curl_exec($ch), true);
echo "Saldo: " . $balance["data"]["balance"] . "\\n";

// Order nomor virtual WhatsApp
$ch = curl_init("$base/order");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $apiKey",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "service" => "whatsapp",
    "country" => "ID"
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$order = json_decode(curl_exec($ch), true);
echo "Nomor: " . $order["data"]["number"] . "\\n";

// Poll OTP
$orderId = $order["data"]["order_id"];
while (true) {
    $ch = curl_init("$base/order/$orderId/status");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: $apiKey"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $status = json_decode(curl_exec($ch), true);
    if (!empty($status["data"]["code"])) {
        echo "OTP: " . $status["data"]["code"] . "\\n";
        break;
    }
    sleep(5);
}`,
    },
    curl: {
      label: "cURL",
      code: `# Cek saldo
curl -H "X-API-Key: YOUR_API_KEY" \\
  https://api.kirimkode.com/v1/balance

# Order nomor virtual WhatsApp
curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"whatsapp","country":"ID"}' \\
  https://api.kirimkode.com/v1/order

# Cek status OTP
curl -H "X-API-Key: YOUR_API_KEY" \\
  https://api.kirimkode.com/v1/order/ORDER_ID/status

# Cancel order
curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  https://api.kirimkode.com/v1/order/ORDER_ID/cancel`,
    },
  };

  const apiEndpoints = [
    { method: "GET", path: "/api/v1/balance", description: t("apiDocs.descBalance"), example: `{\n  "status": "success",\n  "data": {\n    "balance": 125000,\n    "currency": "IDR"\n  }\n}` },
    { method: "GET", path: "/api/v1/services", description: t("apiDocs.descServices"), example: `{\n  "status": "success",\n  "data": [\n    {\n      "id": "whatsapp",\n      "name": "WhatsApp",\n      "category": "Messenger",\n      "price": 1500,\n      "available": 342\n    }\n  ]\n}` },
    { method: "GET", path: "/api/v1/countries", description: t("apiDocs.descCountries"), example: `{\n  "status": "success",\n  "data": [\n    {\n      "code": "ID",\n      "name": "Indonesia",\n      "flag": "\ud83c\uddee\ud83c\udde9",\n      "price_multiplier": 1.0\n    }\n  ]\n}` },
    { method: "POST", path: "/api/v1/order", description: t("apiDocs.descOrder"), example: `// Request\n{\n  "service": "whatsapp",\n  "country": "ID"\n}\n\n// Response\n{\n  "status": "success",\n  "data": {\n    "order_id": "ORD-048",\n    "number": "+6281234567890",\n    "service": "whatsapp",\n    "expires_at": "2026-02-19T15:00:00Z"\n  }\n}` },
    { method: "GET", path: "/api/v1/order/{id}/status", description: t("apiDocs.descStatus"), example: `{\n  "status": "success",\n  "data": {\n    "order_id": "ORD-048",\n    "number": "+6281234567890",\n    "code": "482916",\n    "status": "completed",\n    "received_at": "2026-02-19T14:42:15Z"\n  }\n}` },
    { method: "POST", path: "/api/v1/order/{id}/cancel", description: t("apiDocs.descCancel"), example: `{\n  "status": "success",\n  "message": "Order cancelled, balance refunded"\n}` },
    { method: "GET", path: "/api/v1/history", description: t("apiDocs.descHistory"), example: `{\n  "status": "success",\n  "data": [...],\n  "pagination": {\n    "page": 1,\n    "per_page": 20,\n    "total": 47\n  }\n}` },
  ];

  const errorCodes = [
    { code: 200, status: "OK", desc: t("apiDocs.err200") },
    { code: 400, status: "Bad Request", desc: t("apiDocs.err400") },
    { code: 401, status: "Unauthorized", desc: t("apiDocs.err401") },
    { code: 402, status: "Payment Required", desc: t("apiDocs.err402") },
    { code: 404, status: "Not Found", desc: t("apiDocs.err404") },
    { code: 429, status: "Too Many Requests", desc: t("apiDocs.err429") },
    { code: 503, status: "Service Unavailable", desc: t("apiDocs.err503") },
  ];

  const handleRegenerate = async () => {
    if (!confirm(t("apiDocs.regenerateConfirm"))) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/user/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: prompt("Password:") }),
      });
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
            {t("apiDocs.title")}
          </h1>
          <p className="text-sm text-muted">
            {t("apiDocs.desc")}
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
                  <p className="text-sm text-muted">{t("apiDocs.noApiKey")}</p>
                  <Button onClick={handleRegenerate} disabled={regenerating}>
                    {regenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {t("apiDocs.generateKey")}
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
                    {t("apiDocs.regenerate")}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted mt-2">
                {t("apiDocs.authHeader")} <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">X-API-Key</code> {t("apiDocs.forAuth")}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Base URL Info */}
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted mb-1">{t("apiDocs.baseUrl")}</div>
                <code className="text-xs sm:text-sm font-[family-name:var(--font-jetbrains-mono)] text-primary break-all">
                  https://api.kirimkode.com/v1
                </code>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">{t("apiDocs.authentication")}</div>
                <code className="text-xs sm:text-sm font-[family-name:var(--font-jetbrains-mono)] text-muted">
                  Header: X-API-Key
                </code>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">{t("apiDocs.format")}</div>
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
                  {t("apiDocs.quickStart")}
                </CardTitle>
                <button
                  onClick={() => handleCopy(`curl -H "X-API-Key: YOUR_API_KEY" https://api.kirimkode.com/v1/balance`, "quickstart")}
                  className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                >
                  {copied === "quickstart" ? <CheckCircle className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  {copied === "quickstart" ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-xl p-2 sm:p-4 overflow-x-auto">
                <pre className="text-[10px] sm:text-sm font-[family-name:var(--font-jetbrains-mono)] leading-relaxed">
                  <code>
                    <span className="text-muted"># {t("apiDocs.checkBalance")}</span>
                    {"\n"}<span className="text-accent">curl</span> -H <span className="text-primary">{'"X-API-Key: YOUR_API_KEY"'}</span>
                    {"\n  "}https://api.kirimkode.com/v1/balance
                    {"\n\n"}<span className="text-muted"># {t("apiDocs.buyWhatsapp")}</span>
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

        {/* SDK Examples */}
        <section id="sdk-examples">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code className="w-4 h-4 text-primary" />
                  SDK Examples
                </CardTitle>
                <button
                  onClick={() => handleCopy(sdkExamples[sdkTab].code, "sdk")}
                  className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                >
                  {copied === "sdk" ? <CheckCircle className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  {copied === "sdk" ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mb-4">
                {(Object.keys(sdkExamples) as Array<keyof typeof sdkExamples>).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSdkTab(key as typeof sdkTab)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      sdkTab === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    {sdkExamples[key].label}
                  </button>
                ))}
              </div>
              <div className="bg-background rounded-xl p-2 sm:p-4 overflow-x-auto">
                <pre className="text-[10px] sm:text-xs font-[family-name:var(--font-jetbrains-mono)] leading-relaxed text-foreground/80">
                  {sdkExamples[sdkTab].code}
                </pre>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="space-y-3">
          <h2 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
            {t("apiDocs.endpoints")}
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
                {t("apiDocs.rateLimit")}
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
                    <div className="text-[10px] sm:text-xs text-muted">{t("apiDocs.requestPerMin")} ({r.plan})</div>
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
                {t("apiDocs.errorCodes")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium w-20">{t("apiDocs.code")}</th>
                      <th className="pb-3 font-medium w-40">{t("apiDocs.status")}</th>
                      <th className="pb-3 font-medium">{t("apiDocs.description")}</th>
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
