export default function TermsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
          Syarat & Ketentuan
        </h1>
        <p className="text-sm text-muted">Terakhir diperbarui: 19 Februari 2026</p>
      </div>

      <div className="space-y-6 text-sm text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Penerimaan Ketentuan</h2>
          <p>
            Dengan mengakses dan menggunakan layanan KirimKode, Anda menyetujui untuk terikat oleh Syarat & Ketentuan ini. Jika Anda tidak setuju dengan ketentuan ini, harap tidak menggunakan layanan kami.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Deskripsi Layanan</h2>
          <p>
            KirimKode menyediakan layanan nomor virtual sementara untuk menerima kode verifikasi OTP (One-Time Password). Nomor yang disediakan bersifat sementara dan digunakan untuk keperluan verifikasi akun di berbagai platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Akun Pengguna</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Pengguna harus mendaftar dengan informasi yang benar dan akurat.</li>
            <li>Setiap pengguna hanya boleh memiliki satu akun.</li>
            <li>Pengguna bertanggung jawab menjaga keamanan akun dan password.</li>
            <li>KirimKode berhak menangguhkan akun yang melanggar ketentuan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Penggunaan yang Dilarang</h2>
          <p>Pengguna dilarang menggunakan layanan untuk:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Aktivitas ilegal atau melanggar hukum.</li>
            <li>Penipuan, spam, atau phishing.</li>
            <li>Mengganggu atau merusak layanan kami.</li>
            <li>Menjual kembali nomor atau OTP kepada pihak ketiga tanpa izin.</li>
            <li>Penyalahgunaan API melebihi batas wajar.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Pembayaran & Saldo</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Saldo yang diisi bersifat non-refundable kecuali dalam kondisi tertentu.</li>
            <li>Harga layanan dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya.</li>
            <li>Saldo akan otomatis dikembalikan jika OTP tidak diterima dalam waktu 20 menit.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Ketersediaan Layanan</h2>
          <p>
            Kami berupaya menjaga layanan tetap aktif 24/7, namun tidak menjamin ketersediaan 100%. Gangguan dapat terjadi karena pemeliharaan, masalah teknis, atau faktor di luar kendali kami. Kami tidak bertanggung jawab atas kerugian akibat ketidaktersediaan layanan.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Batasan Tanggung Jawab</h2>
          <p>
            KirimKode tidak bertanggung jawab atas kegagalan verifikasi yang disebabkan oleh pihak ketiga (platform yang diverifikasi), keterlambatan pengiriman SMS dari operator, atau penyalahgunaan layanan oleh pengguna.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Perubahan Ketentuan</h2>
          <p>
            KirimKode berhak mengubah Syarat & Ketentuan ini kapan saja. Perubahan akan berlaku sejak dipublikasikan di halaman ini. Pengguna disarankan untuk memeriksa halaman ini secara berkala.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Kontak</h2>
          <p>
            Jika ada pertanyaan mengenai Syarat & Ketentuan ini, silakan hubungi kami di{" "}
            <a href="mailto:support@kirimkode.com" className="text-primary hover:underline">support@kirimkode.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
