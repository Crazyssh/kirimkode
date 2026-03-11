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

// Order nomor virtual (Indonesia)
const order = await fetch(\`\${BASE}/order\`, {
  method: "POST",
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    server: "api1",
    country: 6,
    service: "wa",
    operator: "any",
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

# Order nomor virtual (Indonesia)
order = requests.post(f"{BASE}/order", headers={
    **headers, "Content-Type": "application/json"
}, json={
    "server": "api1",
    "country": 6,
    "service": "wa",
    "operator": "any"
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

// Order nomor virtual (Indonesia)
$ch = curl_init("$base/order");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $apiKey",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "server" => "api1",
    "country" => 6,
    "service" => "wa",
    "operator" => "any"
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

# Order nomor virtual (Indonesia)
curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"server":"api1","country":6,"service":"wa","operator":"any"}' \\
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
    { method: "GET", path: "/balance", description: t("apiDocs.descBalance"), example: `{\n  "success": true,\n  "data": {\n    "balance": 125000,\n    "currency": "IDR"\n  },\n  "timestamp": "2026-03-11T16:31:48.817Z"\n}` },
    { method: "GET", path: "/services", description: t("apiDocs.descServices"), example: `// Query: ?server=api1&country=6\n\n{\n  "success": true,\n  "data": [\n    {\n      "code": "wa",\n      "name": "WhatsApp",\n      "price": 1500,\n      "stock": 342\n    }\n  ],\n  "timestamp": "2026-03-11T16:32:03.746Z"\n}` },
    { method: "POST", path: "/order", description: t("apiDocs.descOrder"), example: `// Request\n{\n  "server": "api1",\n  "country": 6,\n  "service": "wa",\n  "operator": "any"\n}\n\n// Response\n{\n  "success": true,\n  "data": {\n    "order_id": 12003637,\n    "number": "+62881025274888",\n    "service": "wa",\n    "price": 1500,\n    "expires_at": "2026-03-11T16:54:58.177Z"\n  },\n  "timestamp": "2026-03-11T16:34:58.177Z"\n}` },
    { method: "GET", path: "/order/{id}/status", description: t("apiDocs.descStatus"), example: `{\n  "success": true,\n  "data": {\n    "order_id": "cmmm9f3ei000r3xkpvjnwtkfy",\n    "number": "+62881025274888",\n    "code": "482916",\n    "status": "success",\n    "received_at": "2026-03-11T14:42:15Z"\n  },\n  "timestamp": "2026-03-11T14:42:15.123Z"\n}` },
    { method: "POST", path: "/order/{id}/cancel", description: t("apiDocs.descCancel"), example: `// Success\n{\n  "success": true,\n  "message": "Order cancelled and balance refunded",\n  "timestamp": "2026-03-11T14:45:00.123Z"\n}\n\n// Error (cancel terlalu cepat)\n{\n  "success": false,\n  "error": {\n    "message": "Cannot cancel within 3 minutes of order",\n    "code": "CANCEL_TOO_EARLY"\n  },\n  "timestamp": "2026-03-11T14:42:30.456Z"\n}` },
    { method: "GET", path: "/orders", description: t("apiDocs.descHistory"), example: `{\n  "success": true,\n  "data": [\n    {\n      "id": "cmmm9f3ei000r3xkpvjnwtkfy",\n      "order_id": 12003637,\n      "service": "wa",\n      "number": "+62881025274888",\n      "code": "482916",\n      "status": "success",\n      "price": 1500\n    }\n  ],\n  "pagination": {\n    "page": 1,\n    "limit": 20,\n    "total": 47,\n    "total_pages": 3\n  },\n  "timestamp": "2026-03-11T16:35:30.077Z"\n}` },
  ];

  const errorCodes = [
    { code: 200, status: "OK", desc: t("apiDocs.err200") },
    { code: 400, status: "Bad Request", desc: t("apiDocs.err400") },
    { code: 401, status: "Unauthorized", desc: t("apiDocs.err401") },
    { code: 402, status: "Payment Required", desc: t("apiDocs.err402") },
    { code: 404, status: "Not Found", desc: t("apiDocs.err404") },
    { code: 409, status: "Conflict", desc: "Stok habis / Order sudah diproses" },
    { code: 429, status: "Too Many Requests", desc: t("apiDocs.err429") },
    { code: 500, status: "Server Error", desc: "Kesalahan internal server" },
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 rounded-xl bg-background/50 text-center">
                  <div className="text-lg sm:text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                    60
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted">{t("apiDocs.requestPerMin")}</div>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-background/50 text-center">
                  <div className="text-lg sm:text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                    10
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted">Auth & Deposit /menit</div>
                </div>
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
