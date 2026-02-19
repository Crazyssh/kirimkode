export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
          Kebijakan Privasi
        </h1>
        <p className="text-sm text-muted">Terakhir diperbarui: 19 Februari 2026</p>
      </div>

      <div className="space-y-6 text-sm text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Informasi yang Kami Kumpulkan</h2>
          <p>Kami mengumpulkan informasi berikut saat Anda menggunakan layanan kami:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-foreground">Data Akun:</strong> Nama, alamat email, dan password (terenkripsi).</li>
            <li><strong className="text-foreground">Data Transaksi:</strong> Riwayat pembelian nomor, deposit, dan penggunaan layanan.</li>
            <li><strong className="text-foreground">Data Teknis:</strong> Alamat IP, jenis browser, dan informasi perangkat untuk keamanan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Penggunaan Informasi</h2>
          <p>Informasi yang dikumpulkan digunakan untuk:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Menyediakan dan meningkatkan layanan kami.</li>
            <li>Memproses transaksi dan mengelola akun pengguna.</li>
            <li>Mengirim notifikasi terkait layanan (OTP masuk, status order).</li>
            <li>Mencegah penipuan dan penyalahgunaan layanan.</li>
            <li>Memenuhi kewajiban hukum yang berlaku.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Penyimpanan Data</h2>
          <p>
            Data pengguna disimpan dengan aman menggunakan enkripsi standar industri. Password disimpan dalam bentuk hash (bcrypt) dan tidak pernah disimpan dalam teks biasa. Kami menyimpan data selama akun aktif dan akan menghapusnya sesuai permintaan pengguna.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Nomor Virtual & OTP</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Nomor virtual yang dibeli bersifat sementara (aktif maksimal 20 menit).</li>
            <li>Kode OTP yang diterima disimpan di akun pengguna untuk referensi.</li>
            <li>Kami tidak menyimpan konten SMS selain kode OTP yang relevan.</li>
            <li>Nomor yang sudah expired tidak dapat diakses kembali.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Berbagi Data</h2>
          <p>
            Kami <strong className="text-foreground">tidak menjual</strong> data pengguna kepada pihak ketiga. Data hanya dibagikan dalam kondisi berikut:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Untuk memproses pembayaran melalui payment gateway yang terpercaya.</li>
            <li>Jika diwajibkan oleh hukum atau perintah pengadilan.</li>
            <li>Untuk mencegah penipuan atau melindungi keamanan layanan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Keamanan</h2>
          <p>
            Kami menerapkan langkah-langkah keamanan teknis dan organisasi yang sesuai untuk melindungi data pengguna, termasuk enkripsi SSL/TLS, autentikasi JWT, dan pembatasan akses berbasis role.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Hak Pengguna</h2>
          <p>Pengguna memiliki hak untuk:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Mengakses dan mengunduh data pribadi mereka.</li>
            <li>Memperbarui atau mengoreksi informasi akun.</li>
            <li>Meminta penghapusan akun dan data terkait.</li>
            <li>Menarik persetujuan penggunaan data kapan saja.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Cookie</h2>
          <p>
            Kami menggunakan cookie untuk menyimpan preferensi pengguna (seperti tema tampilan) dan sesi login. Cookie ini diperlukan untuk fungsi dasar layanan dan tidak digunakan untuk pelacakan pihak ketiga.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Kontak</h2>
          <p>
            Untuk pertanyaan tentang kebijakan privasi ini, hubungi kami di{" "}
            <a href="mailto:privacy@kirimkode.com" className="text-primary hover:underline">privacy@kirimkode.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
