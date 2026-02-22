"use client";

import { useLanguageStore } from "@/store/language";

export default function RefundPage() {
  const { locale } = useLanguageStore();

  if (locale === "en") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
            Refund Policy
          </h1>
          <p className="text-sm text-muted">Last updated: February 19, 2026</p>
        </div>

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
          <strong className="text-foreground">Key Point:</strong>{" "}
          <span className="text-muted">
            Balance is automatically refunded if OTP is not received within 20 minutes. No need to submit a manual refund request for this case.
          </span>
        </div>

        <div className="space-y-6 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Automatic Refund (Balance)</h2>
            <p>Balance will be automatically refunded under the following conditions:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">OTP not received:</strong> If the OTP code is not received within 20 minutes after purchase, the balance will be automatically returned to your account.</li>
              <li><strong className="text-foreground">Manual cancellation:</strong> You can cancel an order at any time before OTP is received, and the balance will be immediately returned.</li>
              <li><strong className="text-foreground">Invalid number:</strong> If the system detects that the provided number cannot receive SMS, the balance will be refunded.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Deposit Refund</h2>
            <p>For balance topped up through deposits:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Deposited balance is generally <strong className="text-foreground">non-refundable</strong>.</li>
              <li>Exception: If a system error causes the balance not to arrive or to be deducted without an order, please contact the support team.</li>
              <li>Deposit refunds are only processed via bank transfer to the same name as the KirimKode account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Conditions Not Eligible for Refund</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>OTP was successfully received but the user did not use it.</li>
              <li>User selected the wrong service or country.</li>
              <li>The platform being verified rejected the virtual number (not our responsibility).</li>
              <li>Accounts blocked for violating the Terms & Conditions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Refund Process</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Automatic refund:</strong> Credited to account balance within 1-5 seconds.</li>
              <li><strong className="text-foreground">Manual refund:</strong> Submit via support email, processed within 1-3 business days.</li>
              <li><strong className="text-foreground">Deposit refund:</strong> Processed within 3-7 business days after verification.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. How to Request a Refund</h2>
            <p>If you need to submit a manual refund request, send an email to:</p>
            <div className="mt-2 p-3 rounded-lg bg-surface border border-border">
              <p className="text-foreground font-medium">support@kirimkode.com</p>
              <p className="text-xs mt-1">Include: Account ID, transaction details, and reason for refund.</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
          Kebijakan Refund
        </h1>
        <p className="text-sm text-muted">Terakhir diperbarui: 19 Februari 2026</p>
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
        <strong className="text-foreground">Poin Penting:</strong>{" "}
        <span className="text-muted">
          Saldo otomatis dikembalikan jika OTP tidak masuk dalam 20 menit. Tidak perlu mengajukan refund manual untuk kasus ini.
        </span>
      </div>

      <div className="space-y-6 text-sm text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Refund Otomatis (Saldo)</h2>
          <p>Saldo akan dikembalikan secara otomatis dalam kondisi berikut:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-foreground">OTP tidak masuk:</strong> Jika kode OTP tidak diterima dalam waktu 20 menit setelah pembelian, saldo akan otomatis dikembalikan ke akun Anda.</li>
            <li><strong className="text-foreground">Pembatalan manual:</strong> Anda bisa membatalkan order kapan saja sebelum OTP masuk, dan saldo akan langsung dikembalikan.</li>
            <li><strong className="text-foreground">Nomor tidak valid:</strong> Jika sistem mendeteksi nomor yang diberikan tidak dapat menerima SMS, saldo akan dikembalikan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Refund Deposit</h2>
          <p>Untuk saldo yang diisi melalui deposit:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Saldo deposit bersifat <strong className="text-foreground">non-refundable</strong> secara umum.</li>
            <li>Pengecualian: Jika terjadi kesalahan sistem yang menyebabkan saldo tidak masuk atau terpotong tanpa order, silakan hubungi tim support.</li>
            <li>Refund deposit hanya diproses dalam bentuk transfer ke rekening bank atas nama yang sama dengan akun KirimKode.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Kondisi yang Tidak Mendapat Refund</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>OTP berhasil diterima tetapi pengguna tidak menggunakannya.</li>
            <li>Pengguna salah memilih layanan atau negara.</li>
            <li>Platform yang diverifikasi menolak nomor virtual (bukan tanggung jawab kami).</li>
            <li>Akun yang diblokir karena melanggar Syarat & Ketentuan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Proses Refund</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Refund otomatis:</strong> Langsung masuk ke saldo akun dalam 1-5 detik.</li>
            <li><strong className="text-foreground">Refund manual:</strong> Ajukan melalui email support, diproses dalam 1-3 hari kerja.</li>
            <li><strong className="text-foreground">Refund deposit:</strong> Diproses dalam 3-7 hari kerja setelah verifikasi.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Cara Mengajukan Refund</h2>
          <p>Jika Anda perlu mengajukan refund manual, kirim email ke:</p>
          <div className="mt-2 p-3 rounded-lg bg-surface border border-border">
            <p className="text-foreground font-medium">support@kirimkode.com</p>
            <p className="text-xs mt-1">Sertakan: ID akun, detail transaksi, dan alasan refund.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
