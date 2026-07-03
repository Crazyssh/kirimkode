// FAQ auto-reply untuk CS Telegram Business KirimKode.
// Edit bebas: tambah/ubah keyword & jawaban. Urutan penting — yang lebih spesifik taruh atas.
//
// Format: { keywords: [...], reply: "..." }
// Bot akan balas dengan reply pertama yang salah satu keyword-nya cocok (substring, case-insensitive).

export const FAQ = [
  {
    keywords: ["deposit", "topup", "top up", "isi saldo", "isi ulang", "cara bayar"],
    reply:
      "💰 *Cara Deposit:*\n" +
      "1. Login di kirimkode.com\n" +
      "2. Buka menu *Deposit*\n" +
      "3. Masukkan nominal & pilih *QRIS*\n" +
      "4. Scan & bayar — saldo masuk otomatis dalam beberapa detik.\n\n" +
      "Kalau saldo belum masuk setelah 5 menit, kirim bukti bayarnya ya.",
  },
  {
    keywords: ["cara order", "cara beli", "cara pesan", "gimana order", "beli nomor", "beli otp"],
    reply:
      "🛒 *Cara Order Nomor OTP:*\n" +
      "1. Pastikan saldo cukup\n" +
      "2. Buka menu *Beli*\n" +
      "3. Pilih server → negara → layanan (mis. WhatsApp)\n" +
      "4. Klik *Beli*, nomor langsung muncul\n" +
      "5. Pakai nomornya, OTP masuk otomatis di riwayat.",
  },
  {
    keywords: ["otp gak masuk", "otp tidak masuk", "otp belum masuk", "kode gak masuk", "kode belum masuk", "otp lama", "gak dapat kode"],
    reply:
      "⏳ *OTP belum masuk?*\n" +
      "- Tunggu beberapa menit, kadang provider agak lambat.\n" +
      "- Kalau sampai timeout OTP tetap gak masuk, order otomatis *dibatalkan & saldo dikembalikan*.\n" +
      "- Kamu juga bisa klik *Batalkan* setelah 4,5 menit untuk refund langsung.",
  },
  {
    keywords: ["refund", "saldo balik", "saldo kembali", "uang balik", "batal"],
    reply:
      "↩️ *Refund:*\n" +
      "Kalau OTP gak masuk sampai batas waktu, saldo otomatis dikembalikan penuh. " +
      "Kamu juga bisa batalin manual setelah 4,5 menit. Gak ada saldo yang hangus kalau order gagal.",
  },
  {
    keywords: ["saldo", "cek saldo", "sisa saldo"],
    reply: "💳 Cek saldo kamu di kirimkode.com pada pojok kanan atas / menu dashboard.",
  },
  {
    keywords: ["stok", "stock", "kosong", "habis"],
    reply:
      "📦 Stok nomor berubah-ubah tergantung provider. Kalau satu server kosong, coba server lain " +
      "(Earth, Saturn, Neptune, dll) atau negara lain.",
  },
  {
    keywords: ["api", "developer", "reseller", "webhook"],
    reply:
      "🔌 Kami punya *API untuk developer/reseller*. Generate API key di menu pengaturan akun, " +
      "dokumentasinya ada di website. Cocok buat integrasi otomatis.",
  },
  {
    keywords: ["harga", "berapa", "price"],
    reply:
      "🏷️ Harga tiap layanan & negara beda-beda, dan tampil real-time di halaman *Beli*. " +
      "Pilih server/negara buat lihat harga terbaru.",
  },
  {
    keywords: ["halo", "hai", "hi", "assalam", "min", "admin", "permisi", "kak", "bang"],
    reply:
      "👋 Halo! Selamat datang di *KirimKode* — jual beli nomor virtual untuk OTP.\n\n" +
      "Ada yang bisa dibantu? Ketik salah satu:\n" +
      "• *deposit* — cara isi saldo\n" +
      "• *order* — cara beli nomor\n" +
      "• *otp* — OTP gak masuk?\n" +
      "• *refund* — soal pengembalian saldo\n" +
      "• *api* — untuk developer",
  },
];

// Jawaban default kalau tidak ada keyword yang cocok.
export const DEFAULT_REPLY =
  "🙏 Terima kasih sudah menghubungi *KirimKode*.\n" +
  "Pesan kamu sudah kami terima. Untuk bantuan cepat, ketik: *deposit*, *order*, *otp*, *refund*, atau *api*.\n" +
  "Admin akan balas secepatnya bila butuh bantuan lebih lanjut.";

/** Cari jawaban FAQ dari teks pesan. Return string reply atau null. */
export function findReply(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const item of FAQ) {
    if (item.keywords.some((k) => lower.includes(k))) {
      return item.reply;
    }
  }
  return DEFAULT_REPLY;
}
