// Quick test for DashScope (Qwen) OpenAI-compatible API
const API_KEY = process.env.DASHSCOPE_API_KEY || "sk-6acae630332142298f7015c168fa9c13";
const MODEL = process.env.DASHSCOPE_MODEL || "qwen-plus";

const ENDPOINTS = [
  { name: "China (Beijing)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { name: "International (Singapore)", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
];

async function testEndpoint(base) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Balas singkat: sebutkan 3 warna." },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  for (const ep of ENDPOINTS) {
    console.log(`\n=== ${ep.name} — ${ep.url} (model=${MODEL}) ===`);
    try {
      const { status, ok, data } = await testEndpoint(ep.url);
      console.log("HTTP status:", status);
      if (ok) {
        console.log("✅ SUCCESS");
        console.log("Reply:", data.choices?.[0]?.message?.content);
        console.log("Usage:", JSON.stringify(data.usage));
      } else {
        console.log("❌ ERROR:", JSON.stringify(data.error ?? data));
      }
    } catch (e) {
      console.error("Request failed:", e.message);
    }
  }
}

main();
