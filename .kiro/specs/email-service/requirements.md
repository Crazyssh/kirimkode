# Requirements Document

> Referensi teknis: Proyek **KirimKode** (Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Prisma + PostgreSQL, NextAuth v5).
> Model `User` sudah memiliki field `email` (unique), `emailVerified` (DateTime?), `password` (hashed, nullable untuk OAuth), `apiKey` (unique?). Pola verifikasi HP via OTP (WhatsApp/FONNTE) sudah ada; verifikasi EMAIL adalah kemampuan baru.
> Pengiriman email menggunakan SMTP standar (lihat `scripts/test-smtp.mjs`) agar bersifat provider-agnostic.

## Introduction

Fitur Email Service menambahkan tiga kemampuan email untuk KirimKode: (1) verifikasi alamat email pengguna, (2) alur reset password melalui email, dan (3) email marketing/broadcast massal dari admin. Verifikasi email bersifat OPSIONAL dan TIDAK memblokir alur inti (beli nomor, deposit, transaksi umum). Verifikasi email HANYA diwajibkan untuk aksi sensitif tertentu, yaitu generate/regenerate API key. Alur reset password bergantung pada kepemilikan email yang valid dan hanya relevan untuk pengguna yang memiliki password (credentials), bukan pengguna OAuth-only.

Semua email transaksional (verifikasi, reset password) dan email bulk (marketing) dikirim via SMTP standar yang dikonfigurasi melalui environment variable, sehingga penyedia SMTP dapat diganti tanpa mengubah kode. Token verifikasi dan reset dibuat aman, sekali pakai, kedaluwarsa, dan rate-limited terhadap penyalahgunaan. Isi email mendukung dua bahasa (Indonesia dan Inggris).

## Glossary

- **Email_Service**: Sistem yang bertanggung jawab menyusun, mengirim, dan melacak email transaksional dan bulk melalui SMTP.
- **Verification_Service**: Komponen yang menerbitkan dan memvalidasi token verifikasi email.
- **Password_Reset_Service**: Komponen yang menerbitkan dan memvalidasi token reset password serta menetapkan password baru.
- **Marketing_Service**: Komponen yang membuat, menargetkan, dan mengirim email broadcast dari admin ke pengguna.
- **SMTP_Sender**: Komponen adapter yang melakukan koneksi SMTP dan pengiriman pesan email.
- **Verification_Token**: String acak sekali pakai yang mengaitkan permintaan verifikasi email dengan seorang pengguna, memiliki waktu kedaluwarsa.
- **Reset_Token**: String acak sekali pakai yang mengaitkan permintaan reset password dengan seorang pengguna, memiliki waktu kedaluwarsa.
- **User**: Pengguna terdaftar KirimKode yang memiliki record pada model `User`.
- **Credentials_User**: User yang memiliki `password` non-null (mendaftar via email/password).
- **OAuth_Only_User**: User yang memiliki `password` bernilai null (mendaftar hanya via penyedia OAuth seperti Google).
- **Verified_User**: User yang field `emailVerified` bernilai non-null (waktu verifikasi tercatat).
- **Admin**: User dengan `role` bernilai `admin`.
- **Broadcast**: Satu kampanye email marketing yang ditujukan ke satu segmen penerima.
- **Recipient_Segment**: Kumpulan penerima yang ditentukan untuk sebuah Broadcast (semua pengguna atau subset tertentu).
- **Opt_Out**: Status pengguna yang menolak menerima email marketing.
- **Sensitive_Action**: Aksi yang memerlukan email terverifikasi; dalam scope ini adalah generate/regenerate API key.
- **Rate_Limit_Window**: Rentang waktu yang digunakan untuk membatasi jumlah permintaan email dari satu pengguna atau alamat.
- **Locale**: Preferensi bahasa isi email, bernilai `id` atau `en`.

## Requirements

### Requirement 1: Mengirim Email Verifikasi

**User Story:** Sebagai User, saya ingin meminta pengiriman email verifikasi ke alamat email saya, agar saya dapat membuktikan kepemilikan email tersebut.

#### Acceptance Criteria

1. WHEN seorang User yang belum terverifikasi meminta verifikasi email, THE Verification_Service SHALL membuat Verification_Token yang unik dan acak untuk User tersebut.
2. WHEN Verification_Service membuat Verification_Token, THE Verification_Service SHALL menetapkan waktu kedaluwarsa token sebesar 24 jam sejak waktu pembuatan.
3. WHEN sebuah Verification_Token dibuat, THE Email_Service SHALL mengirim email berisi tautan verifikasi ke alamat email User tersebut.
4. WHEN Verification_Service membuat Verification_Token baru untuk seorang User, THE Verification_Service SHALL membatalkan seluruh Verification_Token sebelumnya yang masih aktif milik User tersebut.
5. WHERE User telah berstatus Verified_User, THE Verification_Service SHALL menolak permintaan verifikasi baru dan mengembalikan pesan bahwa email sudah terverifikasi.

### Requirement 2: Memverifikasi Email via Token

**User Story:** Sebagai User, saya ingin menyelesaikan verifikasi dengan mengeklik tautan pada email, agar status email saya menjadi terverifikasi.

#### Acceptance Criteria

1. WHEN seorang User mengakses tautan verifikasi dengan Verification_Token yang valid dan belum kedaluwarsa, THE Verification_Service SHALL menetapkan field `emailVerified` User tersebut ke waktu saat ini.
2. WHEN Verification_Service berhasil memverifikasi seorang User, THE Verification_Service SHALL menandai Verification_Token yang digunakan sebagai terpakai sehingga tidak dapat digunakan kembali.
3. IF Verification_Token yang diberikan sudah kedaluwarsa, THEN THE Verification_Service SHALL menolak verifikasi dan mengembalikan pesan bahwa token telah kedaluwarsa.
4. IF Verification_Token yang diberikan tidak ditemukan atau sudah pernah dipakai, THEN THE Verification_Service SHALL menolak verifikasi dan mengembalikan pesan bahwa token tidak valid.

### Requirement 3: Kirim Ulang Email Verifikasi dengan Rate Limit

**User Story:** Sebagai User, saya ingin dapat meminta pengiriman ulang email verifikasi, agar saya tetap bisa verifikasi jika email pertama tidak sampai.

#### Acceptance Criteria

1. WHEN seorang User yang belum terverifikasi meminta kirim ulang email verifikasi, THE Verification_Service SHALL membuat Verification_Token baru dan THE Email_Service SHALL mengirim ulang email verifikasi.
2. IF seorang User telah meminta email verifikasi sebanyak 3 kali dalam Rate_Limit_Window selama 60 menit, THEN THE Verification_Service SHALL menolak permintaan tambahan dan mengembalikan pesan untuk mencoba lagi setelah jeda waktu.
3. WHEN Verification_Service menolak permintaan karena rate limit, THE Verification_Service SHALL menyertakan durasi tunggu tersisa dalam responsnya.

### Requirement 4: Verifikasi Email Bersifat Non-Blocking

**User Story:** Sebagai User yang belum memverifikasi email, saya ingin tetap dapat membeli nomor dan melakukan deposit, agar verifikasi email tidak menghambat transaksi saya.

#### Acceptance Criteria

1. WHERE seorang User belum berstatus Verified_User, THE Email_Service SHALL mengizinkan User tersebut melakukan pembelian nomor tanpa verifikasi email.
2. WHERE seorang User belum berstatus Verified_User, THE Email_Service SHALL mengizinkan User tersebut melakukan deposit tanpa verifikasi email.
3. WHERE seorang User belum berstatus Verified_User, THE Email_Service SHALL mengizinkan User tersebut mengakses aksi umum non-sensitif tanpa verifikasi email.

### Requirement 5: Gating Aksi Sensitif — Generate/Regenerate API Key

**User Story:** Sebagai operator platform, saya ingin membatasi generate/regenerate API key hanya untuk pengguna yang emailnya terverifikasi, agar akses developer terikat pada email yang valid.

#### Acceptance Criteria

1. WHEN seorang Verified_User meminta generate atau regenerate API key, THE Email_Service SHALL mengizinkan aksi tersebut dilanjutkan.
2. IF seorang User yang belum terverifikasi meminta generate atau regenerate API key, THEN THE Email_Service SHALL menolak aksi tersebut dan mengembalikan pesan yang menyatakan verifikasi email diperlukan.
3. WHEN Email_Service menolak aksi generate atau regenerate API key karena email belum terverifikasi, THE Email_Service SHALL menyertakan petunjuk cara memulai verifikasi email dalam responsnya.

### Requirement 6: Permintaan Reset Password via Email

**User Story:** Sebagai Credentials_User yang lupa password, saya ingin meminta reset password melalui email, agar saya dapat memulihkan akses ke akun saya.

#### Acceptance Criteria

1. WHEN seorang Credentials_User meminta reset password dengan alamat email terdaftar, THE Password_Reset_Service SHALL membuat Reset_Token yang unik dan acak untuk User tersebut.
2. WHEN Password_Reset_Service membuat Reset_Token, THE Password_Reset_Service SHALL menetapkan waktu kedaluwarsa token sebesar 60 menit sejak waktu pembuatan.
3. WHEN Reset_Token dibuat, THE Email_Service SHALL mengirim email berisi tautan reset password ke alamat email User tersebut.
4. IF alamat email yang diberikan tidak terdaftar, THEN THE Password_Reset_Service SHALL mengembalikan respons sukses generik yang identik dengan kasus email terdaftar, tanpa mengungkap keberadaan akun.
5. IF alamat email yang diberikan milik OAuth_Only_User, THEN THE Password_Reset_Service SHALL mengembalikan respons sukses generik dan THE Email_Service SHALL mengirim email yang mengarahkan User untuk masuk melalui penyedia OAuth.
6. IF seorang pengguna telah meminta reset password sebanyak 3 kali dalam Rate_Limit_Window selama 60 menit, THEN THE Password_Reset_Service SHALL menolak permintaan tambahan.

### Requirement 7: Menetapkan Password Baru via Token Reset

**User Story:** Sebagai Credentials_User, saya ingin menetapkan password baru menggunakan tautan reset, agar saya dapat masuk kembali dengan password baru.

#### Acceptance Criteria

1. WHEN seorang User mengirimkan password baru bersama Reset_Token yang valid dan belum kedaluwarsa, THE Password_Reset_Service SHALL menyimpan password baru dalam bentuk ter-hash pada record User tersebut.
2. WHEN Password_Reset_Service berhasil menetapkan password baru, THE Password_Reset_Service SHALL menandai Reset_Token yang digunakan sebagai terpakai sehingga tidak dapat digunakan kembali.
3. IF Reset_Token yang diberikan sudah kedaluwarsa, THEN THE Password_Reset_Service SHALL menolak penetapan password dan mengembalikan pesan bahwa token telah kedaluwarsa.
4. IF Reset_Token yang diberikan tidak ditemukan atau sudah pernah dipakai, THEN THE Password_Reset_Service SHALL menolak penetapan password dan mengembalikan pesan bahwa token tidak valid.
5. IF password baru yang dikirim tidak memenuhi panjang minimal 8 karakter, THEN THE Password_Reset_Service SHALL menolak penetapan password dan mengembalikan pesan syarat password.

### Requirement 8: Membuat dan Menargetkan Broadcast Email Marketing

**User Story:** Sebagai Admin, saya ingin membuat broadcast email dan menentukan segmen penerima, agar saya dapat mengirim newsletter atau promo kepada pengguna.

#### Acceptance Criteria

1. WHEN seorang Admin membuat Broadcast dengan subjek dan isi, THE Marketing_Service SHALL menyimpan Broadcast tersebut beserta Recipient_Segment yang dipilih.
2. THE Marketing_Service SHALL mendukung Recipient_Segment bernilai seluruh pengguna maupun subset pengguna berdasarkan kriteria yang ditentukan Admin.
3. IF seorang User yang bukan Admin mencoba membuat atau mengirim Broadcast, THEN THE Marketing_Service SHALL menolak aksi tersebut dan mengembalikan pesan penolakan akses.
4. IF sebuah Broadcast dibuat tanpa subjek atau tanpa isi, THEN THE Marketing_Service SHALL menolak penyimpanan dan mengembalikan pesan bahwa subjek dan isi wajib diisi.

### Requirement 9: Mengirim Broadcast dengan Kepatuhan Opt-Out

**User Story:** Sebagai Admin, saya ingin mengirim broadcast hanya kepada pengguna yang belum opt-out, agar pengiriman mematuhi preferensi pengguna.

#### Acceptance Criteria

1. WHEN seorang Admin mengirim sebuah Broadcast, THE Marketing_Service SHALL mengirim email hanya kepada penerima dalam Recipient_Segment yang tidak berstatus Opt_Out.
2. WHERE seorang penerima berstatus Opt_Out, THE Marketing_Service SHALL mengecualikan penerima tersebut dari pengiriman Broadcast.
3. WHEN Email_Service mengirim email Broadcast, THE Email_Service SHALL menyertakan tautan opt-out pada isi email.
4. WHEN seorang penerima mengakses tautan opt-out, THE Marketing_Service SHALL menetapkan status penerima tersebut menjadi Opt_Out.
5. WHEN seorang penerima yang berstatus Opt_Out mengakses tautan berlangganan kembali, THE Marketing_Service SHALL menghapus status Opt_Out penerima tersebut.

### Requirement 10: Pelacakan Dasar Pengiriman Broadcast

**User Story:** Sebagai Admin, saya ingin melihat status pengiriman broadcast, agar saya mengetahui berapa email yang terkirim dan gagal.

#### Acceptance Criteria

1. WHEN Marketing_Service mengirim sebuah Broadcast, THE Marketing_Service SHALL mencatat status setiap penerima sebagai terkirim atau gagal.
2. IF SMTP_Sender mengembalikan kegagalan untuk seorang penerima, THEN THE Marketing_Service SHALL mencatat penerima tersebut sebagai gagal beserta alasan kegagalan.
3. WHEN pengiriman Broadcast selesai, THE Marketing_Service SHALL menyediakan ringkasan jumlah penerima terkirim dan jumlah penerima gagal untuk Broadcast tersebut.

### Requirement 11: Keamanan Token dan SMTP

**User Story:** Sebagai operator platform, saya ingin token dan kredensial email dikelola secara aman, agar tidak terjadi kebocoran atau penyalahgunaan.

#### Acceptance Criteria

1. THE Verification_Service SHALL membuat Verification_Token dengan entropi minimal 128 bit.
2. THE Password_Reset_Service SHALL membuat Reset_Token dengan entropi minimal 128 bit.
3. WHEN Email_Service mencatat aktivitas pengiriman ke log, THE Email_Service SHALL mengecualikan nilai Verification_Token dan Reset_Token dari log.
4. THE SMTP_Sender SHALL membaca host, port, username, password, dan alamat pengirim SMTP dari environment variable.
5. WHEN SMTP_Sender terhubung ke server SMTP, THE SMTP_Sender SHALL menggunakan koneksi terenkripsi TLS.

### Requirement 12: Penanganan Kegagalan Pengiriman Email

**User Story:** Sebagai User, saya ingin sistem menangani kegagalan pengiriman email dengan jelas, agar saya tahu langkah selanjutnya bila email gagal terkirim.

#### Acceptance Criteria

1. IF SMTP_Sender gagal mengirim email transaksional, THEN THE Email_Service SHALL mencatat kegagalan tersebut beserta alasannya.
2. IF SMTP_Sender gagal mengirim email verifikasi atau reset password, THEN THE Email_Service SHALL mengembalikan pesan kepada User untuk mencoba lagi beberapa saat kemudian.
3. WHILE SMTP_Sender tidak dapat dijangkau, THE Email_Service SHALL tetap mengizinkan alur inti pembelian dan deposit berjalan tanpa terganggu.

### Requirement 13: Internasionalisasi Isi Email

**User Story:** Sebagai User, saya ingin menerima email dalam bahasa yang saya pahami, agar isi email jelas bagi saya.

#### Acceptance Criteria

1. WHERE Locale seorang User bernilai `id`, THE Email_Service SHALL menyusun isi email dalam Bahasa Indonesia.
2. WHERE Locale seorang User bernilai `en`, THE Email_Service SHALL menyusun isi email dalam Bahasa Inggris.
3. IF Locale seorang User tidak tersedia, THEN THE Email_Service SHALL menyusun isi email dalam Bahasa Indonesia sebagai bahasa bawaan.

### Requirement 14: Non-Fungsional — Tidak Mengubah Alur Bisnis Inti

**User Story:** Sebagai operator platform, saya ingin fitur email tidak mengubah alur bisnis inti yang sudah ada, agar integrasi tidak menimbulkan regresi.

#### Acceptance Criteria

1. THE Email_Service SHALL menggunakan konfigurasi SMTP yang bersumber dari environment variable tanpa nilai kredensial yang ditulis langsung dalam kode.
2. THE Email_Service SHALL beroperasi tanpa mengubah perilaku alur pembelian nomor, deposit, dan otentikasi yang sudah ada.
3. WHERE fitur email dinonaktifkan melalui konfigurasi, THE Email_Service SHALL menonaktifkan pengiriman email tanpa memengaruhi alur bisnis inti.
