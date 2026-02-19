const API_URLS = {
  api1: process.env.JASAOTP_API1_URL || "https://api.jasaotp.id/v1",
  api2: process.env.JASAOTP_API2_URL || "https://api.jasaotp.id/v2",
};

const API_KEY = process.env.JASAOTP_API_KEY || "";

type ServerId = "api1" | "api2";

function getBaseUrl(server: ServerId): string {
  return API_URLS[server];
}

async function fetchApi(server: ServerId, endpoint: string, params?: Record<string, string>) {
  const base = getBaseUrl(server);
  const url = new URL(`${base}/${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || `API error: ${res.status}`);
  }

  return data;
}

export async function getBalance(server: ServerId) {
  return fetchApi(server, "balance.php", { api_key: API_KEY });
}

export async function getNegara(server: ServerId) {
  return fetchApi(server, "negara.php");
}

export async function getOperator(server: ServerId, negara: number) {
  return fetchApi(server, "operator.php", { negara: String(negara) });
}

export async function getLayanan(server: ServerId, negara: number) {
  return fetchApi(server, "layanan.php", { negara: String(negara) });
}

export async function createOrder(
  server: ServerId,
  negara: number,
  layanan: string,
  operator: string
) {
  return fetchApi(server, "order.php", {
    api_key: API_KEY,
    negara: String(negara),
    layanan,
    operator,
  });
}

export async function checkSms(server: ServerId, orderId: number) {
  return fetchApi(server, "sms.php", {
    api_key: API_KEY,
    id: String(orderId),
  });
}

export async function cancelOrder(server: ServerId, orderId: number) {
  return fetchApi(server, "cancel.php", {
    api_key: API_KEY,
    id: String(orderId),
  });
}
