// Script seed blog articles untuk KirimKode
// Jalankan: npx tsx scripts/seed-blog.ts

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const articles = [
  {
    slug: "cara-verifikasi-whatsapp-tanpa-nomor-hp-pribadi",
    titleId: "Cara Verifikasi WhatsApp Tanpa Nomor HP Pribadi",
    titleEn: "How to Verify WhatsApp Without Your Personal Phone Number",
    excerptId: "Pelajari cara mudah verifikasi akun WhatsApp menggunakan nomor virtual. Jaga privasi nomor HP pribadi Anda dengan solusi yang aman dan terjangkau.",
    excerptEn: "Learn how to easily verify your WhatsApp account using a virtual number. Keep your personal phone number private with a safe and affordable solution.",
    contentId: `## Mengapa Perlu Verifikasi WhatsApp Tanpa Nomor Pribadi?

WhatsApp mengharuskan setiap akun diverifikasi dengan nomor telepon aktif. Namun, ada banyak alasan mengapa Anda mungkin tidak ingin menggunakan nomor HP pribadi:

- **Privasi**: Tidak ingin membagikan nomor pribadi ke grup atau orang asing
- **Multi-akun**: Membutuhkan lebih dari satu akun WhatsApp untuk bisnis
- **Testing**: Developer yang perlu menguji fitur OTP di aplikasi
- **Keamanan**: Menghindari spam dan telemarketing

## Solusi: Gunakan Nomor Virtual

Nomor virtual adalah nomor telepon sementara yang bisa menerima SMS dan kode OTP tanpa perlu SIM card fisik. KirimKode menyediakan nomor virtual dari Indonesia dan 200+ negara lainnya.

## Langkah-Langkah Verifikasi WhatsApp

### 1. Daftar di KirimKode
Kunjungi [kirimkode.com](https://kirimkode.com) dan buat akun gratis. Proses pendaftaran hanya membutuhkan email.

### 2. Deposit Saldo
Isi saldo melalui QRIS dengan minimum deposit Rp 5.000. Semua e-wallet dan bank di Indonesia didukung.

### 3. Beli Nomor Virtual WhatsApp
Di dashboard, pilih layanan "WhatsApp" dan negara yang diinginkan. Harga nomor virtual WhatsApp Indonesia mulai dari Rp 1.500.

### 4. Masukkan Nomor ke WhatsApp
Buka WhatsApp, pilih "Verifikasi dengan SMS", dan masukkan nomor virtual yang Anda dapatkan dari KirimKode.

### 5. Terima Kode OTP
Kode OTP akan otomatis muncul di dashboard KirimKode dalam hitungan detik. Masukkan kode tersebut ke WhatsApp.

### 6. Selesai!
Akun WhatsApp Anda sekarang aktif tanpa menggunakan nomor HP pribadi.

## Tips Penting

- **Jangan tutup halaman** sebelum menerima kode OTP
- Jika OTP tidak masuk dalam 20 menit, saldo akan **otomatis dikembalikan**
- Nomor virtual bersifat sementara — gunakan untuk verifikasi saja
- Untuk keamanan ekstra, aktifkan verifikasi 2 langkah di WhatsApp

## Kesimpulan

Verifikasi WhatsApp tanpa nomor HP pribadi kini mudah dan terjangkau berkat layanan nomor virtual. Dengan KirimKode, Anda bisa mendapatkan nomor virtual dalam hitungan detik dengan harga mulai dari Rp 1.200. Daftar sekarang di [kirimkode.com](https://kirimkode.com) dan jaga privasi Anda.`,
    contentEn: `## Why Verify WhatsApp Without a Personal Number?

WhatsApp requires every account to be verified with an active phone number. However, there are many reasons why you might not want to use your personal number:

- **Privacy**: Avoid sharing your personal number with strangers
- **Multi-account**: Need more than one WhatsApp account for business
- **Testing**: Developers testing OTP features in applications
- **Security**: Avoid spam and telemarketing calls

## The Solution: Use a Virtual Number

A virtual number is a temporary phone number that can receive SMS and OTP codes without a physical SIM card. KirimKode provides virtual numbers from Indonesia and 200+ other countries.

## Step-by-Step WhatsApp Verification

### 1. Register at KirimKode
Visit [kirimkode.com](https://kirimkode.com) and create a free account. Registration only requires an email.

### 2. Add Balance
Top up your balance via QRIS with a minimum deposit of IDR 5,000. All Indonesian e-wallets and banks are supported.

### 3. Buy a WhatsApp Virtual Number
In the dashboard, select "WhatsApp" service and your desired country. Indonesian WhatsApp virtual numbers start from IDR 1,500.

### 4. Enter the Number in WhatsApp
Open WhatsApp, choose "Verify with SMS", and enter the virtual number you received from KirimKode.

### 5. Receive the OTP Code
The OTP code will automatically appear on your KirimKode dashboard within seconds. Enter the code in WhatsApp.

### 6. Done!
Your WhatsApp account is now active without using your personal phone number.

## Important Tips

- **Don't close the page** before receiving the OTP code
- If OTP doesn't arrive within 20 minutes, your balance will be **automatically refunded**
- Virtual numbers are temporary — use them for verification only
- For extra security, enable two-step verification in WhatsApp

## Conclusion

Verifying WhatsApp without a personal phone number is now easy and affordable with virtual number services. With KirimKode, you can get a virtual number in seconds starting from IDR 1,200. Register now at [kirimkode.com](https://kirimkode.com) and protect your privacy.`,
    category: "tutorial",
    tags: "whatsapp,verifikasi,otp,nomor virtual,privasi",
  },
  {
    slug: "apa-itu-nomor-virtual-dan-cara-kerjanya",
    titleId: "Apa Itu Nomor Virtual dan Bagaimana Cara Kerjanya?",
    titleEn: "What Is a Virtual Number and How Does It Work?",
    excerptId: "Panduan lengkap tentang nomor virtual: definisi, cara kerja, kegunaan, dan mengapa semakin banyak orang menggunakannya untuk verifikasi OTP.",
    excerptEn: "Complete guide to virtual numbers: definition, how they work, uses, and why more people are using them for OTP verification.",
    contentId: `## Definisi Nomor Virtual

Nomor virtual (atau virtual phone number) adalah nomor telepon yang tidak terikat pada SIM card atau perangkat fisik tertentu. Nomor ini berfungsi melalui internet dan bisa digunakan untuk menerima SMS, termasuk kode verifikasi OTP (One-Time Password).

## Bagaimana Cara Kerja Nomor Virtual?

Proses kerja nomor virtual cukup sederhana:

1. **Provider menyediakan pool nomor** dari berbagai negara dan operator
2. **User memilih nomor** sesuai layanan dan negara yang dibutuhkan
3. **SMS masuk** ke nomor tersebut diteruskan ke platform provider
4. **User membaca SMS** melalui dashboard atau API tanpa perlu SIM card

Berbeda dengan nomor telepon biasa, nomor virtual bersifat **sementara** — biasanya aktif selama 20 menit untuk menerima satu kode OTP.

## Kegunaan Nomor Virtual

### 1. Verifikasi Akun Online
Gunakan untuk mendaftar di layanan seperti WhatsApp, Telegram, Instagram, TikTok, dan ratusan aplikasi lainnya tanpa mengekspos nomor pribadi.

### 2. Digital Marketing
Marketer yang mengelola banyak akun sosial media membutuhkan nomor unik untuk setiap akun. Nomor virtual menyediakan solusi yang efisien dan terjangkau.

### 3. Quality Assurance (QA) Testing
Tim QA dan developer membutuhkan banyak nomor telepon untuk menguji fitur registrasi, login OTP, dan verifikasi di aplikasi yang sedang dikembangkan.

### 4. Privasi dan Keamanan
Saat mendaftar di platform yang kurang terpercaya, nomor virtual melindungi identitas Anda dari potensi spam atau penyalahgunaan data.

## Nomor Virtual vs Nomor Biasa

| Aspek | Nomor Virtual | Nomor Biasa |
|-------|-------------|-------------|
| SIM Card | Tidak perlu | Perlu |
| Biaya | Mulai Rp 1.200/nomor | Rp 10.000+ untuk kartu SIM |
| Durasi | Sementara (20 menit) | Permanen |
| Privasi | Tinggi | Rendah |
| Jumlah | Tidak terbatas | Terbatas (maks 3 SIM) |

## Cara Mendapatkan Nomor Virtual di KirimKode

1. Daftar gratis di [kirimkode.com](https://kirimkode.com)
2. Deposit saldo mulai dari Rp 5.000 via QRIS
3. Pilih layanan dan negara
4. Terima kode OTP secara instan

## Kesimpulan

Nomor virtual adalah solusi modern untuk kebutuhan verifikasi OTP yang fleksibel, aman, dan terjangkau. Dengan 500+ layanan dan 200+ negara yang didukung, KirimKode menjadi pilihan terpercaya untuk nomor virtual di Indonesia.`,
    contentEn: `## What Is a Virtual Number?

A virtual number (or virtual phone number) is a phone number that is not tied to any physical SIM card or device. It operates via the internet and can receive SMS, including OTP (One-Time Password) verification codes.

## How Do Virtual Numbers Work?

The process is straightforward:

1. **Provider maintains a pool of numbers** from various countries and operators
2. **User selects a number** based on the required service and country
3. **Incoming SMS** to that number is forwarded to the provider's platform
4. **User reads the SMS** through the dashboard or API without needing a SIM card

Unlike regular phone numbers, virtual numbers are **temporary** — typically active for 20 minutes to receive a single OTP code.

## Uses of Virtual Numbers

### 1. Online Account Verification
Use them to register on services like WhatsApp, Telegram, Instagram, TikTok, and hundreds of other apps without exposing your personal number.

### 2. Digital Marketing
Marketers managing multiple social media accounts need unique numbers for each account. Virtual numbers provide an efficient and affordable solution.

### 3. Quality Assurance (QA) Testing
QA teams and developers need many phone numbers to test registration, OTP login, and verification features in applications under development.

### 4. Privacy and Security
When signing up on less trustworthy platforms, virtual numbers protect your identity from potential spam or data misuse.

## Virtual Numbers vs Regular Numbers

| Aspect | Virtual Number | Regular Number |
|--------|---------------|----------------|
| SIM Card | Not needed | Required |
| Cost | From IDR 1,200/number | IDR 10,000+ for SIM |
| Duration | Temporary (20 min) | Permanent |
| Privacy | High | Low |
| Quantity | Unlimited | Limited (max 3 SIMs) |

## How to Get a Virtual Number on KirimKode

1. Register for free at [kirimkode.com](https://kirimkode.com)
2. Deposit starting from IDR 5,000 via QRIS
3. Select your service and country
4. Receive OTP codes instantly

## Conclusion

Virtual numbers are a modern solution for flexible, secure, and affordable OTP verification needs. With 500+ services and 200+ countries supported, KirimKode is Indonesia's trusted choice for virtual numbers.`,
    category: "guide",
    tags: "nomor virtual,panduan,otp,cara kerja,verifikasi",
  },
  {
    slug: "tips-aman-menggunakan-nomor-virtual-untuk-otp",
    titleId: "5 Tips Aman Menggunakan Nomor Virtual untuk Verifikasi OTP",
    titleEn: "5 Safety Tips for Using Virtual Numbers for OTP Verification",
    excerptId: "Tips penting agar penggunaan nomor virtual tetap aman untuk verifikasi OTP. Lindungi akun dan data pribadi Anda dengan praktik terbaik ini.",
    excerptEn: "Essential tips to keep your virtual number usage safe for OTP verification. Protect your accounts and personal data with these best practices.",
    contentId: `## Pentingnya Keamanan saat Menggunakan Nomor Virtual

Nomor virtual sangat membantu untuk verifikasi OTP, namun penggunaannya perlu dilakukan dengan bijak. Berikut 5 tips penting yang harus Anda perhatikan.

## 1. Gunakan Platform Terpercaya

Tidak semua penyedia nomor virtual bisa dipercaya. Pilih platform yang:

- **Memiliki reputasi baik** dan review positif dari pengguna
- **Menyediakan refund otomatis** jika OTP tidak masuk
- **Menggunakan enkripsi** untuk melindungi data pengguna
- **Memiliki customer support** yang responsif

KirimKode memenuhi semua kriteria di atas dengan sistem refund otomatis 20 menit dan enkripsi data end-to-end.

## 2. Jangan Gunakan untuk Akun Utama

Nomor virtual bersifat sementara dan tidak bisa digunakan kembali. Oleh karena itu:

- **Jangan gunakan** untuk akun banking atau fintech utama
- **Ideal untuk** akun sosial media sekunder, testing, atau registrasi layanan baru
- **Selalu aktifkan** verifikasi 2 langkah (2FA) setelah registrasi
- **Ganti ke nomor pribadi** jika akun tersebut menjadi penting

## 3. Segera Catat Kode OTP

Nomor virtual memiliki masa aktif terbatas. Untuk menghindari kehilangan kode:

- **Jangan tinggalkan halaman** saat menunggu OTP
- **Catat kode segera** setelah muncul di dashboard
- **Aktifkan notifikasi** di browser untuk pemberitahuan real-time
- **Gunakan fitur SSE** (Server-Sent Events) di KirimKode yang menampilkan OTP secara otomatis

## 4. Perhatikan Harga dan Stok

Tips menghemat saldo saat menggunakan nomor virtual:

- **Bandingkan harga** antar server dan negara
- **Cek stok** sebelum membeli — nomor dengan stok tinggi biasanya lebih reliable
- **Gunakan voucher** untuk mendapatkan bonus saldo
- **Deposit secukupnya** — mulai dari Rp 5.000 via QRIS

## 5. Manfaatkan API untuk Automasi

Jika Anda developer atau membutuhkan banyak nomor secara rutin:

- **Gunakan REST API** KirimKode untuk otomatisasi
- **Integrasikan ke workflow** CI/CD atau tools testing Anda
- **Monitor penggunaan** lewat endpoint /orders
- **Set webhook** untuk notifikasi OTP real-time

## Hal yang Harus Dihindari

- ❌ Menggunakan nomor virtual untuk aktivitas ilegal
- ❌ Membagikan kode OTP ke pihak lain
- ❌ Menggunakan platform tidak jelas tanpa review
- ❌ Menyimpan data sensitif di akun yang diverifikasi dengan nomor virtual

## Kesimpulan

Nomor virtual adalah tools yang powerful jika digunakan dengan benar. Dengan mengikuti tips di atas, Anda bisa memanfaatkan layanan nomor virtual dengan aman dan efektif. Mulai gunakan KirimKode sekarang di [kirimkode.com](https://kirimkode.com).`,
    contentEn: `## Why Security Matters When Using Virtual Numbers

Virtual numbers are incredibly helpful for OTP verification, but they need to be used wisely. Here are 5 essential tips you should follow.

## 1. Use a Trusted Platform

Not all virtual number providers can be trusted. Choose a platform that:

- **Has a good reputation** and positive user reviews
- **Provides automatic refunds** if OTP doesn't arrive
- **Uses encryption** to protect user data
- **Has responsive customer support**

KirimKode meets all these criteria with a 20-minute automatic refund system and end-to-end data encryption.

## 2. Don't Use for Primary Accounts

Virtual numbers are temporary and cannot be reused. Therefore:

- **Don't use them** for primary banking or fintech accounts
- **Ideal for** secondary social media accounts, testing, or new service registrations
- **Always enable** two-factor authentication (2FA) after registration
- **Switch to your personal number** if the account becomes important

## 3. Note Down OTP Codes Immediately

Virtual numbers have a limited active period. To avoid losing codes:

- **Don't leave the page** while waiting for OTP
- **Record the code immediately** after it appears on the dashboard
- **Enable notifications** in your browser for real-time alerts
- **Use the SSE feature** (Server-Sent Events) on KirimKode for automatic OTP display

## 4. Watch Prices and Availability

Tips for saving when using virtual numbers:

- **Compare prices** across different servers and countries
- **Check stock** before buying — numbers with high stock are usually more reliable
- **Use vouchers** to get bonus balance
- **Deposit just enough** — starting from IDR 5,000 via QRIS

## 5. Leverage the API for Automation

If you're a developer or need many numbers regularly:

- **Use KirimKode's REST API** for automation
- **Integrate into your workflow** CI/CD or testing tools
- **Monitor usage** via the /orders endpoint
- **Set webhooks** for real-time OTP notifications

## Things to Avoid

- ❌ Using virtual numbers for illegal activities
- ❌ Sharing OTP codes with others
- ❌ Using unreviewed, unknown platforms
- ❌ Storing sensitive data in accounts verified with virtual numbers

## Conclusion

Virtual numbers are powerful tools when used correctly. By following the tips above, you can use virtual number services safely and effectively. Start using KirimKode now at [kirimkode.com](https://kirimkode.com).`,
    category: "tips",
    tags: "keamanan,tips,nomor virtual,otp,privasi",
  },
  {
    slug: "cara-integrasi-api-kirimkode-untuk-developer",
    titleId: "Cara Integrasi API KirimKode untuk Developer",
    titleEn: "How to Integrate KirimKode API for Developers",
    excerptId: "Panduan teknis lengkap mengintegrasikan REST API KirimKode ke aplikasi Anda. Contoh kode Node.js, Python, dan PHP untuk automasi OTP.",
    excerptEn: "Complete technical guide to integrating KirimKode's REST API into your application. Code examples in Node.js, Python, and PHP for OTP automation.",
    contentId: `## Kenapa Menggunakan API KirimKode?

Jika Anda developer yang membutuhkan nomor virtual secara programatik — baik untuk QA testing, automasi registrasi, atau integrasi ke platform Anda — API KirimKode menyediakan akses lengkap ke semua fitur melalui REST API.

## Persiapan

### Dapatkan API Key
1. Daftar di [kirimkode.com](https://kirimkode.com)
2. Buka halaman **API Docs** di dashboard
3. Generate atau salin API Key Anda

### Base URL
\`\`\`
https://api.kirimkode.com/v1
\`\`\`

Semua request memerlukan header:
\`\`\`
X-API-Key: YOUR_API_KEY
\`\`\`

## Endpoint Utama

### 1. Cek Saldo

\`\`\`bash
curl -H "X-API-Key: YOUR_KEY" https://api.kirimkode.com/v1/balance
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "data": { "balance": 125000, "currency": "IDR" },
  "timestamp": "2026-03-11T..."
}
\`\`\`

### 2. Lihat Layanan Tersedia

\`\`\`bash
curl "https://api.kirimkode.com/v1/services?server=api1&country=6" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

### 3. Buat Order

\`\`\`bash
curl -X POST https://api.kirimkode.com/v1/order \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"server":"api1","country":6,"service":"wa","operator":"any"}'
\`\`\`

### 4. Cek Status OTP

\`\`\`bash
curl "https://api.kirimkode.com/v1/order/ORDER_ID/status" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

### 5. Cancel Order

\`\`\`bash
curl -X POST "https://api.kirimkode.com/v1/order/ORDER_ID/cancel" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

## Contoh Integrasi Node.js

\`\`\`javascript
const API_KEY = "YOUR_API_KEY";
const BASE = "https://api.kirimkode.com/v1";

async function getOTP(service, country) {
  // 1. Buat order
  const order = await fetch(\`\${BASE}/order\`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ server: "api1", country, service, operator: "any" }),
  }).then(r => r.json());

  console.log("Nomor:", order.data.number);

  // 2. Poll OTP
  while (true) {
    const status = await fetch(\`\${BASE}/order/\${order.data.order_id}/status\`, {
      headers: { "X-API-Key": API_KEY },
    }).then(r => r.json());

    if (status.data.code) {
      console.log("OTP:", status.data.code);
      return status.data.code;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}
\`\`\`

## Error Handling

Semua error menggunakan format konsisten:

\`\`\`json
{
  "success": false,
  "error": { "message": "Insufficient balance", "code": "INSUFFICIENT_BALANCE" },
  "timestamp": "2026-03-11T..."
}
\`\`\`

Error code yang umum: \`MISSING_FIELDS\`, \`INSUFFICIENT_BALANCE\`, \`OUT_OF_STOCK\`, \`CANCEL_TOO_EARLY\`.

## Rate Limiting

API dibatasi 60 request per menit untuk endpoint umum dan 10 request per menit untuk auth/deposit. Jika melebihi limit, Anda akan mendapat response 429.

## Kesimpulan

API KirimKode dirancang untuk developer yang membutuhkan integrasi cepat dan reliable. Dengan format response yang konsisten dan dokumentasi lengkap, Anda bisa mulai mengintegrasikan nomor virtual ke aplikasi Anda dalam hitungan menit. Kunjungi [kirimkode.com/api-docs](https://kirimkode.com/api-docs) untuk dokumentasi lengkap.`,
    contentEn: `## Why Use KirimKode API?

If you're a developer who needs virtual numbers programmatically — whether for QA testing, registration automation, or platform integration — KirimKode's API provides full access to all features through a REST API.

## Getting Started

### Get Your API Key
1. Register at [kirimkode.com](https://kirimkode.com)
2. Open the **API Docs** page in your dashboard
3. Generate or copy your API Key

### Base URL
\`\`\`
https://api.kirimkode.com/v1
\`\`\`

All requests require the header:
\`\`\`
X-API-Key: YOUR_API_KEY
\`\`\`

## Main Endpoints

### 1. Check Balance

\`\`\`bash
curl -H "X-API-Key: YOUR_KEY" https://api.kirimkode.com/v1/balance
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "data": { "balance": 125000, "currency": "IDR" },
  "timestamp": "2026-03-11T..."
}
\`\`\`

### 2. List Available Services

\`\`\`bash
curl "https://api.kirimkode.com/v1/services?server=api1&country=6" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

### 3. Create Order

\`\`\`bash
curl -X POST https://api.kirimkode.com/v1/order \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"server":"api1","country":6,"service":"wa","operator":"any"}'
\`\`\`

### 4. Check OTP Status

\`\`\`bash
curl "https://api.kirimkode.com/v1/order/ORDER_ID/status" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

### 5. Cancel Order

\`\`\`bash
curl -X POST "https://api.kirimkode.com/v1/order/ORDER_ID/cancel" \\
  -H "X-API-Key: YOUR_KEY"
\`\`\`

## Node.js Integration Example

\`\`\`javascript
const API_KEY = "YOUR_API_KEY";
const BASE = "https://api.kirimkode.com/v1";

async function getOTP(service, country) {
  const order = await fetch(\`\${BASE}/order\`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ server: "api1", country, service, operator: "any" }),
  }).then(r => r.json());

  console.log("Number:", order.data.number);

  while (true) {
    const status = await fetch(\`\${BASE}/order/\${order.data.order_id}/status\`, {
      headers: { "X-API-Key": API_KEY },
    }).then(r => r.json());

    if (status.data.code) {
      console.log("OTP:", status.data.code);
      return status.data.code;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}
\`\`\`

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": { "message": "Insufficient balance", "code": "INSUFFICIENT_BALANCE" },
  "timestamp": "2026-03-11T..."
}
\`\`\`

Common error codes: \`MISSING_FIELDS\`, \`INSUFFICIENT_BALANCE\`, \`OUT_OF_STOCK\`, \`CANCEL_TOO_EARLY\`.

## Rate Limiting

The API is limited to 60 requests per minute for general endpoints and 10 requests per minute for auth/deposit. Exceeding the limit returns a 429 response.

## Conclusion

KirimKode's API is designed for developers who need fast and reliable integration. With consistent response formats and comprehensive documentation, you can start integrating virtual numbers into your application within minutes. Visit [kirimkode.com/api-docs](https://kirimkode.com/api-docs) for full documentation.`,
    category: "tutorial",
    tags: "api,developer,integrasi,node.js,python,php,rest api",
  },
  {
    slug: "nomor-virtual-untuk-qa-testing-aplikasi-mobile",
    titleId: "Nomor Virtual untuk QA Testing Aplikasi Mobile: Panduan Lengkap",
    titleEn: "Virtual Numbers for Mobile App QA Testing: Complete Guide",
    excerptId: "Pelajari mengapa tim QA membutuhkan nomor virtual untuk testing OTP dan bagaimana mengintegrasikannya ke pipeline CI/CD Anda.",
    excerptEn: "Learn why QA teams need virtual numbers for OTP testing and how to integrate them into your CI/CD pipeline.",
    contentId: `## Tantangan Testing OTP di Aplikasi Mobile

Setiap aplikasi mobile yang menggunakan verifikasi OTP pasti menghadapi tantangan saat testing:

- **Butuh banyak nomor telepon** untuk test registrasi berulang
- **SIM card fisik terbatas** dan mahal jika beli banyak
- **Test otomatis sulit** karena harus baca SMS manual
- **Nomor bekas** sering sudah terdaftar di layanan

## Solusi: Nomor Virtual + API

KirimKode menyediakan REST API yang memungkinkan tim QA mengotomatisasi seluruh proses testing OTP.

## Setup untuk Tim QA

### 1. Buat Akun Testing
Buat satu akun KirimKode khusus untuk tim QA. Deposit saldo yang cukup untuk testing (misal Rp 100.000 untuk ~80 nomor virtual).

### 2. Generate API Key
Di halaman API Docs, generate API Key yang akan digunakan di script testing.

### 3. Integrasikan ke Test Suite

Contoh integrasi dengan test framework:

\`\`\`javascript
// test/helpers/otp-helper.js
const BASE = "https://api.kirimkode.com/v1";
const API_KEY = process.env.KIRIMKODE_API_KEY;

async function getTestNumber(service = "wa") {
  const res = await fetch(\`\${BASE}/order\`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ server: "api1", country: 6, service, operator: "any" }),
  });
  return res.json();
}

async function waitForOTP(orderId, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(\`\${BASE}/order/\${orderId}/status\`, {
      headers: { "X-API-Key": API_KEY },
    });
    const data = await res.json();
    if (data.data.code) return data.data.code;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("OTP timeout");
}

module.exports = { getTestNumber, waitForOTP };
\`\`\`

### 4. Gunakan di Test Case

\`\`\`javascript
describe("User Registration", () => {
  it("should register with OTP verification", async () => {
    // 1. Dapatkan nomor virtual
    const { data } = await getTestNumber("wa");

    // 2. Register di app dengan nomor tersebut
    await app.register({ phone: data.number });

    // 3. Tunggu dan verifikasi OTP
    const otp = await waitForOTP(data.order_id);
    await app.verifyOTP(otp);

    // 4. Assert registrasi berhasil
    expect(app.isLoggedIn()).toBe(true);
  });
});
\`\`\`

## Best Practices untuk QA Testing

### Budget Management
- Track penggunaan lewat endpoint \`/orders\`
- Set alert jika saldo di bawah threshold tertentu
- Gunakan negara dengan harga termurah untuk testing

### CI/CD Integration
- Simpan API Key di environment variables (jangan hardcode!)
- Buat helper functions yang reusable
- Tambahkan retry logic untuk handle network errors
- Cancel order jika test gagal sebelum OTP masuk (refund saldo)

### Test Data Cleanup
- Catat semua nomor yang dipakai di test log
- Cancel order yang tidak terpakai untuk refund otomatis
- Buat cleanup script yang jalan setelah test suite selesai

## Keuntungan vs Alternatif Lain

| Metode | Biaya | Automasi | Skalabilitas |
|--------|-------|----------|-----|
| SIM Card Fisik | Mahal | Sulit | Terbatas |
| Bypass OTP (mock) | Gratis | Mudah | Tidak realistis |
| **KirimKode API** | **Terjangkau** | **Mudah** | **Unlimited** |

## Kesimpulan

Nomor virtual dari KirimKode adalah solusi ideal untuk QA testing yang membutuhkan verifikasi OTP nyata. Dengan REST API yang mudah diintegrasikan dan harga mulai dari Rp 1.200 per nomor, tim QA bisa menjalankan test otomatis tanpa hambatan. Mulai sekarang di [kirimkode.com](https://kirimkode.com).`,
    contentEn: `## The Challenge of OTP Testing in Mobile Apps

Every mobile app using OTP verification faces testing challenges:

- **Need many phone numbers** for repeated registration tests
- **Physical SIM cards are limited** and expensive to buy in bulk
- **Automated testing is difficult** because SMS must be read manually
- **Used numbers** are often already registered on services

## The Solution: Virtual Numbers + API

KirimKode provides a REST API that enables QA teams to automate the entire OTP testing process.

## Setup for QA Teams

### 1. Create a Testing Account
Create a dedicated KirimKode account for the QA team. Deposit sufficient balance for testing (e.g., IDR 100,000 for ~80 virtual numbers).

### 2. Generate API Key
On the API Docs page, generate an API Key for use in testing scripts.

### 3. Integrate with Your Test Suite

Example integration with a test framework:

\`\`\`javascript
// test/helpers/otp-helper.js
const BASE = "https://api.kirimkode.com/v1";
const API_KEY = process.env.KIRIMKODE_API_KEY;

async function getTestNumber(service = "wa") {
  const res = await fetch(\`\${BASE}/order\`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ server: "api1", country: 6, service, operator: "any" }),
  });
  return res.json();
}

async function waitForOTP(orderId, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(\`\${BASE}/order/\${orderId}/status\`, {
      headers: { "X-API-Key": API_KEY },
    });
    const data = await res.json();
    if (data.data.code) return data.data.code;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("OTP timeout");
}

module.exports = { getTestNumber, waitForOTP };
\`\`\`

### 4. Use in Test Cases

\`\`\`javascript
describe("User Registration", () => {
  it("should register with OTP verification", async () => {
    const { data } = await getTestNumber("wa");
    await app.register({ phone: data.number });
    const otp = await waitForOTP(data.order_id);
    await app.verifyOTP(otp);
    expect(app.isLoggedIn()).toBe(true);
  });
});
\`\`\`

## Best Practices for QA Testing

### Budget Management
- Track usage via the \`/orders\` endpoint
- Set alerts when balance falls below a threshold
- Use the cheapest country for testing

### CI/CD Integration
- Store API Keys in environment variables (never hardcode!)
- Create reusable helper functions
- Add retry logic for network errors
- Cancel orders if tests fail before OTP arrives (auto-refund)

### Test Data Cleanup
- Log all numbers used in tests
- Cancel unused orders for automatic refunds
- Create cleanup scripts that run after the test suite completes

## Advantages vs Alternatives

| Method | Cost | Automation | Scalability |
|--------|------|------------|-------------|
| Physical SIM Cards | Expensive | Difficult | Limited |
| OTP Bypass (mock) | Free | Easy | Not realistic |
| **KirimKode API** | **Affordable** | **Easy** | **Unlimited** |

## Conclusion

Virtual numbers from KirimKode are the ideal solution for QA testing that requires real OTP verification. With an easy-to-integrate REST API and prices starting from IDR 1,200 per number, QA teams can run automated tests without obstacles. Start now at [kirimkode.com](https://kirimkode.com).`,
    category: "guide",
    tags: "qa testing,developer,ci/cd,automasi,testing,api",
  },
];

async function main() {
  console.log("Seeding 5 blog articles...");

  for (const article of articles) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: article.slug },
    });

    if (existing) {
      console.log(`⏭️  Skip: "${article.titleId}" (sudah ada)`);
      continue;
    }

    await prisma.blogPost.create({
      data: {
        ...article,
        status: "published",
        publishedAt: new Date(),
        views: Math.floor(Math.random() * 500) + 50,
        authorName: "KirimKode Team",
      },
    });
    console.log(`✅ Created: "${article.titleId}"`);
  }

  console.log("\n🎉 Done! 5 articles seeded.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
