"use client";

import { useLanguageStore } from "@/store/language";

export default function PrivacyPage() {
  const { locale } = useLanguageStore();

  if (locale === "en") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted">Last updated: February 19, 2026</p>
        </div>

        <div className="space-y-6 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p>We collect the following information when you use our services:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-foreground">Account Data:</strong> Name, email address, and password (encrypted).</li>
              <li><strong className="text-foreground">Transaction Data:</strong> Number purchase history, deposits, and service usage.</li>
              <li><strong className="text-foreground">Technical Data:</strong> IP address, browser type, and device information for security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Use of Information</h2>
            <p>The collected information is used to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide and improve our services.</li>
              <li>Process transactions and manage user accounts.</li>
              <li>Send service-related notifications (OTP received, order status).</li>
              <li>Prevent fraud and service abuse.</li>
              <li>Comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Data Storage</h2>
            <p>
              User data is stored securely using industry-standard encryption. Passwords are stored in hashed form (bcrypt) and are never stored in plain text. We retain data as long as the account is active and will delete it upon user request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Virtual Numbers & OTP</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Purchased virtual numbers are temporary (active for a maximum of 20 minutes).</li>
              <li>Received OTP codes are stored in the user account for reference.</li>
              <li>We do not store SMS content other than the relevant OTP codes.</li>
              <li>Expired numbers cannot be accessed again.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Sharing</h2>
            <p>
              We <strong className="text-foreground">do not sell</strong> user data to third parties. Data is only shared under the following conditions:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>To process payments through trusted payment gateways.</li>
              <li>If required by law or court order.</li>
              <li>To prevent fraud or protect service security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect user data, including SSL/TLS encryption, JWT authentication, and role-based access control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. User Rights</h2>
            <p>Users have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access and download their personal data.</li>
              <li>Update or correct account information.</li>
              <li>Request deletion of their account and related data.</li>
              <li>Withdraw consent for data usage at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Cookies</h2>
            <p>
              We use cookies to store user preferences (such as display theme) and login sessions. These cookies are necessary for basic service functionality and are not used for third-party tracking.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>
              For questions about this privacy policy, contact us at{" "}
              <a href="mailto:privacy@kirimkode.com" className="text-primary hover:underline">privacy@kirimkode.com</a>.
            </p>
          </section>
        </div>
      </div>
    );
  }

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
