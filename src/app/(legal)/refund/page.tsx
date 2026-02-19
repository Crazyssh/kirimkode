export default function RefundPage() {
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
