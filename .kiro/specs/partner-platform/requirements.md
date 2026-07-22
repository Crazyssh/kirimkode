# Requirements Document

> Referensi utama: `.agents/PARTNER-PROJECT-INFO.md`, `.agents/RESEARCH-MODEM-SMS.md`, `.agents/RESEARCH-WA-OTP.md`, dan arsitektur KirimKode pada `.agents/PROJECT-INFO.md`.
> Partner Platform adalah aplikasi terpisah dari web buyer: repository, build, domain, port, dan proses PM2 mandiri. Aplikasi dapat menggunakan server PostgreSQL yang sama pada tahap awal, tetapi data, ledger, kredensial, dan lifecycle partner harus terisolasi secara logis.

## Introduction

Partner Platform memungkinkan supplier menyediakan nomor OTP kepada KirimKode melalui simulator, APK Android, modem/GoIP, atau direct API. Partner mengelola perangkat, nomor, offer, order, pendapatan, dan payout melalui `partner.kirimkode.com`; perangkat mengirim heartbeat dan SMS melalui `partner-api.kirimkode.com`. Web buyer KirimKode mengakses supply partner melalui internal API yang aman dan idempotent.

MVP berfokus pada satu partner yang disetujui, satu perangkat simulator, satu nomor Indonesia, satu layanan, satu harga dasar, satu order buyer tester, satu SMS simulasi, satu OTP sukses, satu earning pending, dan satu payout manual. APK, modem, direct API eksternal, routing kualitas kompleks, KYC otomatis, dan payout otomatis dibangun setelah alur simulator stabil.

## Glossary

- **Partner_Platform**: Aplikasi mandiri untuk mengelola supplier nomor OTP.
- **Main_Platform**: Web buyer KirimKode yang berjalan terpisah dari Partner Platform.
- **Partner**: Organisasi atau individu yang menyediakan nomor OTP.
- **Partner_Member**: Akun manusia yang menjadi owner atau anggota sebuah Partner.
- **Partner_Admin**: Operator KirimKode yang mengelola partner dari aplikasi Partner Platform.
- **Device**: APK Android, modem, GoIP, simulator, atau koneksi API milik Partner.
- **Partner_Number**: Nomor telepon yang didaftarkan Partner dan terikat pada Device.
- **Offer**: Penawaran supply berdasarkan layanan, negara, operator, dan Base_Price.
- **Base_Price**: Harga dasar yang diminta Partner untuk satu order berhasil.
- **Retail_Price**: Harga yang ditampilkan dan dibebankan kepada buyer.
- **Price_Guardrail**: Batas minimum dan maksimum harga yang ditentukan platform.
- **Partner_Order**: Assignment order buyer kepada satu Partner_Number.
- **Order_Snapshot**: Salinan harga dan atribut penting yang tidak berubah selama order.
- **Earning**: Catatan ledger pendapatan Partner dari order berhasil.
- **Payout**: Permintaan pencairan Earning yang sudah tersedia.
- **Heartbeat**: Sinyal berkala bahwa Device aktif dan dapat menerima order.
- **Agent_API**: API untuk simulator, APK, modem, GoIP, dan direct integration.
- **Internal_API**: API service-to-service antara Main_Platform dan Partner_Platform.
- **Idempotency_Key**: Identifier unik agar retry request tidak menghasilkan operasi ganda.
- **OTP**: Kode sekali pakai yang diekstrak dari SMS atau notifikasi.
- **Private_Beta**: Tahap uji yang hanya dapat digunakan akun buyer tertentu.

## Requirements

### Requirement 1: Isolasi Aplikasi dan Deployment

**User Story:** Sebagai operator KirimKode, saya ingin Partner Platform berjalan terpisah dari web buyer, agar deployment dan kegagalan partner tidak mengganggu transaksi buyer.

#### Acceptance Criteria

1. THE Partner_Platform SHALL dapat dibuild, dijalankan, dan direstart tanpa membuild atau merestart Main_Platform.
2. THE Partner_Platform SHALL menggunakan konfigurasi runtime, secret, log, dan build output yang terpisah dari Main_Platform.
3. WHEN Partner_Platform mengalami kegagalan proses, THE Main_Platform SHALL tetap dapat melayani fitur non-partner yang sudah ada.
4. THE Partner_Platform SHALL menyediakan health endpoint yang dapat diperiksa tanpa autentikasi sensitif.
5. THE Partner_Platform SHALL mendukung deployment pada port dan proses PM2 tersendiri.

### Requirement 2: Registrasi dan Autentikasi Partner

**User Story:** Sebagai calon Partner, saya ingin membuat dan mengamankan akun partner, agar saya dapat mengakses portal supplier.

#### Acceptance Criteria

1. WHEN calon Partner mengirim data registrasi yang valid, THE Partner_Platform SHALL membuat Partner dan Partner_Member owner dengan status `pending`.
2. THE Partner_Platform SHALL mewajibkan alamat email unik dan password yang memenuhi kebijakan keamanan.
3. THE Partner_Platform SHALL menyimpan password hanya dalam bentuk hash yang aman.
4. WHEN Partner_Member berhasil login, THE Partner_Platform SHALL membuat sesi yang hanya berlaku untuk Partner tersebut.
5. IF kredensial login tidak valid, THEN THE Partner_Platform SHALL menolak login tanpa mengungkap apakah email terdaftar.
6. THE Partner_Platform SHALL menyediakan verifikasi email dan reset password dengan token sekali pakai serta kedaluwarsa.
7. THE Partner_Platform SHALL membatasi percobaan login, verifikasi email, dan reset password untuk mencegah abuse.

### Requirement 3: Persetujuan dan Status Partner

**User Story:** Sebagai Partner_Admin, saya ingin meninjau dan mengatur status Partner, agar hanya supplier yang disetujui dapat menyediakan inventory.

#### Acceptance Criteria

1. THE Partner_Platform SHALL mendukung status Partner `pending`, `approved`, `suspended`, dan `rejected`.
2. WHEN Partner_Admin menyetujui Partner, THE Partner_Platform SHALL mengizinkan Partner mengaktifkan Device, Partner_Number, dan Offer.
3. WHILE Partner berstatus selain `approved`, THE Partner_Platform SHALL mencegah inventory Partner tersedia untuk order buyer.
4. WHEN Partner_Admin menangguhkan Partner, THE Partner_Platform SHALL menghentikan reservasi baru tanpa mengubah hasil order yang telah selesai.
5. WHEN status Partner diubah, THE Partner_Platform SHALL mencatat actor, status lama, status baru, alasan, dan waktu pada audit log.

### Requirement 4: Role dan Isolasi Data Partner

**User Story:** Sebagai owner Partner, saya ingin mengelola anggota tim dengan akses terbatas, agar data organisasi tidak dapat diakses Partner lain.

#### Acceptance Criteria

1. THE Partner_Platform SHALL mendukung minimal role `owner` dan `member` untuk Partner_Member serta role terpisah untuk Partner_Admin.
2. THE Partner_Platform SHALL mengikat setiap query dan mutation Partner_Member kepada Partner yang berasal dari sesi terautentikasi.
3. IF Partner_Member mencoba mengakses resource milik Partner lain, THEN THE Partner_Platform SHALL menolak permintaan tanpa membocorkan detail resource.
4. THE Partner_Platform SHALL membatasi operasi sensitif seperti pengelolaan anggota, API key, dan payout kepada role yang berwenang.
5. WHEN owner menambah, mengubah, atau mencabut akses anggota, THE Partner_Platform SHALL mencatat tindakan tersebut pada audit log.

### Requirement 5: Pengelolaan Device dan Kredensial Agent

**User Story:** Sebagai Partner, saya ingin mendaftarkan perangkat dan memperoleh kredensial khusus, agar perangkat dapat berkomunikasi dengan Agent_API secara aman.

#### Acceptance Criteria

1. WHEN Partner approved mendaftarkan Device, THE Partner_Platform SHALL membuat identifier Device unik dan kredensial agent dengan entropi yang memadai.
2. THE Partner_Platform SHALL menampilkan secret agent hanya ketika dibuat atau dirotasi dan SHALL tidak menyimpan secret mentah apabila autentikasi dapat dilakukan dengan hash.
3. THE Partner_Platform SHALL mendukung tipe Device minimal `simulator`, `android`, `modem`, `goip`, dan `api`.
4. THE Partner_Platform SHALL mendukung status Device `offline`, `online`, dan `disabled`.
5. WHEN kredensial Device dirotasi atau dicabut, THE Agent_API SHALL menolak kredensial lama.
6. IF Device berstatus `disabled`, THEN THE Agent_API SHALL menolak perubahan inventory dan pengiriman SMS dari Device tersebut.

### Requirement 6: Heartbeat dan Status Ketersediaan Device

**User Story:** Sebagai Partner dan Partner_Admin, saya ingin melihat status hidup perangkat, agar nomor offline tidak ditawarkan kepada buyer.

#### Acceptance Criteria

1. WHEN Device terautentikasi mengirim heartbeat valid, THE Partner_Platform SHALL memperbarui `lastSeenAt` dan status Device menjadi `online`.
2. IF Device tidak mengirim heartbeat melewati batas waktu yang dikonfigurasi, THEN THE Partner_Platform SHALL memperlakukannya sebagai `offline` untuk reservasi baru.
3. WHILE Device berstatus `offline` atau `disabled`, THE Partner_Platform SHALL mengecualikan seluruh Partner_Number miliknya dari inventory tersedia.
4. WHEN heartbeat menyertakan metadata yang diizinkan, THE Partner_Platform SHALL dapat mencatat versi agent, sinyal, operator, dan health tanpa mempercayai metadata sebagai otorisasi.
5. THE Partner_Platform SHALL menampilkan waktu heartbeat terakhir dan status Device pada portal Partner dan Partner_Admin.

### Requirement 7: Pengelolaan Nomor Partner

**User Story:** Sebagai Partner, saya ingin mendaftarkan dan mengatur nomor pada perangkat, agar nomor yang siap dapat dijual melalui KirimKode.

#### Acceptance Criteria

1. WHEN Partner mendaftarkan nomor valid pada Device miliknya, THE Partner_Platform SHALL membuat Partner_Number yang terikat pada Partner dan Device tersebut.
2. THE Partner_Platform SHALL menormalisasi nomor ke format kanonik dan mencegah duplikasi aktif yang dapat menyebabkan assignment ambigu.
3. THE Partner_Platform SHALL mendukung status nomor `offline`, `available`, `reserved`, `busy`, dan `disabled`.
4. IF Partner_Number sedang `reserved` atau `busy`, THEN THE Partner_Platform SHALL mencegah pemindahan Device atau penghapusan nomor hingga order selesai atau dilepas secara sah.
5. WHEN Partner atau Partner_Admin menonaktifkan nomor idle, THE Partner_Platform SHALL mengecualikannya dari inventory baru.
6. THE Partner_Platform SHALL menyimpan riwayat perubahan status nomor untuk audit dan troubleshooting.

### Requirement 8: Offer dan Harga Dasar

**User Story:** Sebagai Partner, saya ingin menawarkan nomor berdasarkan layanan, negara, operator, dan harga dasar, agar supply saya dapat dipasarkan dengan harga yang sesuai.

#### Acceptance Criteria

1. WHEN Partner approved membuat Offer valid, THE Partner_Platform SHALL mengaitkannya dengan service, country, operator, Base_Price, dan status aktif.
2. THE Partner_Platform SHALL memvalidasi Base_Price terhadap Price_Guardrail yang berlaku.
3. IF Base_Price berada di luar Price_Guardrail, THEN THE Partner_Platform SHALL menolak atau menahan Offer untuk review dan menjelaskan alasan kepada Partner.
4. THE Partner_Platform SHALL menghitung Retail_Price menggunakan Base_Price dan aturan platform yang dikonfigurasi server-side.
5. WHEN aturan harga atau Base_Price berubah, THE Partner_Platform SHALL menerapkannya hanya pada reservasi baru.
6. THE Partner_Platform SHALL mencegah client Partner menentukan Retail_Price atau payout final secara langsung.

### Requirement 9: Inventory dan Reservasi Atomic

**User Story:** Sebagai buyer, saya ingin memperoleh tepat satu nomor yang benar-benar tersedia, agar tidak terjadi satu nomor diberikan kepada beberapa order.

#### Acceptance Criteria

1. WHEN Internal_API meminta reservasi, THE Partner_Platform SHALL memilih Partner_Number yang `available`, Device-nya `online`, Partner-nya `approved`, dan Offer-nya aktif.
2. THE Partner_Platform SHALL mengubah nomor dari `available` menjadi `reserved` dalam transaksi atomic yang sama dengan pembuatan Partner_Order.
3. IF dua atau lebih permintaan mencoba mengambil Partner_Number yang sama, THEN THE Partner_Platform SHALL mengizinkan paling banyak satu reservasi berhasil.
4. WHEN tidak ada inventory yang memenuhi kriteria, THE Partner_Platform SHALL mengembalikan hasil stok habis tanpa membuat Partner_Order parsial.
5. THE Partner_Platform SHALL menyimpan Order_Snapshot yang mencakup service, country, operator, Base_Price, Retail_Price, dan nilai payout.
6. WHEN reservasi gagal setelah Main_Platform membuat order sementara, THE Internal_API SHALL memberikan hasil deterministik agar Main_Platform dapat melakukan kompensasi atau refund.

### Requirement 10: Internal API dengan Main Platform

**User Story:** Sebagai operator KirimKode, saya ingin web buyer menggunakan supply partner melalui API internal yang stabil, agar kedua aplikasi dapat dideploy secara independen.

#### Acceptance Criteria

1. THE Internal_API SHALL mengautentikasi setiap request menggunakan kredensial service-to-service yang berbeda dari kredensial Device dan sesi manusia.
2. THE Internal_API SHALL menyediakan operasi minimal untuk cek inventory/harga, reserve number, cek status/OTP, cancel, dan timeout/release.
3. THE Internal_API SHALL mewajibkan Idempotency_Key pada operasi yang dapat menghasilkan perubahan state atau uang.
4. WHEN request dengan Idempotency_Key yang sama diulang dengan payload yang sama, THE Internal_API SHALL mengembalikan hasil operasi pertama tanpa menggandakan order, refund, atau earning.
5. IF Idempotency_Key digunakan ulang dengan payload berbeda, THEN THE Internal_API SHALL menolak request sebagai konflik.
6. THE Internal_API SHALL menggunakan contract versioning agar perubahan kompatibel tidak memaksa deployment serentak.
7. THE Internal_API SHALL memiliki timeout dan respons error terstruktur tanpa mengekspos secret atau detail internal.

### Requirement 11: Penerimaan SMS dan Ekstraksi OTP

**User Story:** Sebagai buyer, saya ingin SMS yang diterima nomor partner dipasangkan ke order saya, agar saya memperoleh OTP yang benar.

#### Acceptance Criteria

1. WHEN Agent_API menerima SMS dari Device terautentikasi, THE Partner_Platform SHALL memvalidasi bahwa nomor dan Device dimiliki Partner yang sama.
2. THE Partner_Platform SHALL mencatat SMS masuk dengan identifier unik, sender, waktu penerimaan, nomor, Device, dan isi yang dilindungi sesuai kebijakan retention.
3. THE Partner_Platform SHALL menggunakan Idempotency_Key atau message identifier untuk mencegah SMS retry diproses lebih dari sekali.
4. WHEN nomor memiliki tepat satu Partner_Order aktif yang sesuai, THE Partner_Platform SHALL mencoba mengekstrak OTP dan mengaitkan SMS kepada order tersebut.
5. IF tidak ada order aktif atau terdapat kondisi ambigu, THEN THE Partner_Platform SHALL menyimpan SMS untuk audit tanpa mengirim OTP kepada buyer yang salah.
6. WHEN OTP berhasil diekstrak, THE Partner_Platform SHALL menyimpan OTP pada order dan membuat statusnya tersedia melalui Internal_API.
7. THE Partner_Platform SHALL mendukung aturan parser per layanan serta fallback yang dibatasi agar angka yang bukan OTP tidak mudah diteruskan.
8. THE Partner_Platform SHALL mengecualikan OTP dan isi SMS mentah dari log aplikasi umum.

### Requirement 12: Lifecycle Order, Cancel, dan Timeout

**User Story:** Sebagai buyer dan operator, saya ingin order mempunyai lifecycle yang konsisten, agar nomor, refund, dan earning tidak salah diproses.

#### Acceptance Criteria

1. THE Partner_Platform SHALL mendukung status order minimal `created`, `reserved`, `waiting_sms`, `success`, `cancelled`, `timeout`, dan `failed`.
2. WHEN reservasi siap digunakan, THE Partner_Platform SHALL mengubah nomor menjadi `busy` dan order menjadi `waiting_sms`.
3. WHEN OTP valid diterima, THE Partner_Platform SHALL mengubah order menjadi `success` secara idempotent.
4. WHEN cancel valid diterima sebelum sukses dan memenuhi aturan pembatalan, THE Partner_Platform SHALL mengubah order menjadi `cancelled` serta melepaskan atau menonaktifkan nomor sesuai kebijakan.
5. WHEN batas waktu order terlampaui tanpa OTP, THE Partner_Platform SHALL mengubah order menjadi `timeout` dan menjalankan pelepasan secara idempotent.
6. IF order sudah terminal, THEN THE Partner_Platform SHALL menolak transisi terminal berbeda yang dapat menggandakan refund atau earning.
7. THE Partner_Platform SHALL mencatat alasan dan actor untuk setiap transisi manual.

### Requirement 13: Ledger Pendapatan Partner

**User Story:** Sebagai Partner, saya ingin pendapatan dari order sukses tercatat secara transparan, agar saya dapat mengetahui saldo yang akan dibayarkan.

#### Acceptance Criteria

1. WHEN Partner_Order pertama kali berubah menjadi `success`, THE Partner_Platform SHALL membuat tepat satu Earning berdasarkan nilai payout pada Order_Snapshot.
2. THE Partner_Platform SHALL mendukung status Earning minimal `pending`, `available`, `requested`, `paid`, dan `reversed`.
3. THE Partner_Platform SHALL memisahkan Earning Partner dari saldo buyer Main_Platform.
4. WHEN hold period berakhir tanpa dispute, THE Partner_Platform SHALL mengubah Earning `pending` menjadi `available`.
5. IF refund atau dispute yang sah membutuhkan pembalikan, THEN THE Partner_Platform SHALL membuat jejak reversal yang dapat diaudit dan SHALL tidak menghapus catatan keuangan asli.
6. THE Partner_Platform SHALL menghitung saldo Partner dari ledger yang konsisten, bukan hanya satu nilai saldo yang dapat diubah tanpa jejak.
7. THE Partner_Platform SHALL mencegah retry order sukses membuat Earning ganda.

### Requirement 14: Payout Manual MVP

**User Story:** Sebagai Partner, saya ingin meminta pencairan pendapatan tersedia, agar saya dapat menerima pembayaran dari KirimKode.

#### Acceptance Criteria

1. WHEN Partner mengajukan Payout, THE Partner_Platform SHALL memvalidasi bahwa jumlah memenuhi minimum dan tidak melebihi Earning `available` yang belum terkunci.
2. THE Partner_Platform SHALL mengunci Earning terkait secara atomic saat permintaan Payout dibuat.
3. THE Partner_Platform SHALL mendukung status Payout minimal `requested`, `approved`, `processing`, `paid`, `rejected`, dan `failed`.
4. WHEN Partner_Admin menandai Payout sebagai `paid`, THE Partner_Platform SHALL mencatat waktu, actor, metode, dan referensi pembayaran.
5. IF Payout ditolak atau gagal, THEN THE Partner_Platform SHALL mengembalikan Earning terkunci ke status yang dapat digunakan sesuai kebijakan secara idempotent.
6. THE Partner_Platform SHALL mencegah satu Earning dibayarkan melalui lebih dari satu Payout.
7. THE Partner_Platform SHALL mewajibkan audit trail untuk perubahan status dan data tujuan payout.

### Requirement 15: Portal Partner MVP

**User Story:** Sebagai Partner, saya ingin mengelola operasional melalui portal, agar saya tidak perlu mengakses database atau meminta bantuan admin untuk aktivitas rutin.

#### Acceptance Criteria

1. THE Partner_Platform SHALL menyediakan dashboard berisi status Partner, jumlah Device online, nomor tersedia, order, Earning pending, saldo available, dan Payout.
2. THE Partner_Platform SHALL menyediakan halaman untuk Device, Partner_Number, Offer, order aktif, riwayat order, Earning, Payout, anggota, dan API key.
3. WHEN data portal kosong, THE Partner_Platform SHALL menampilkan empty state dan langkah berikutnya yang relevan.
4. THE Partner_Platform SHALL menampilkan waktu dan nominal keuangan secara konsisten menggunakan timezone serta mata uang yang dikonfigurasi.
5. THE Partner_Platform SHALL membatasi tombol dan operasi berdasarkan status Partner dan role Partner_Member.
6. THE Partner_Platform SHALL memberikan status keberhasilan atau kegagalan yang jelas untuk setiap mutation.

### Requirement 16: Operasi Partner Admin

**User Story:** Sebagai Partner_Admin, saya ingin mengelola seluruh lifecycle supplier dari aplikasi partner, agar perubahan fitur admin tidak memerlukan deployment web buyer.

#### Acceptance Criteria

1. THE Partner_Platform SHALL menyediakan area Partner_Admin yang terpisah dari portal Partner biasa.
2. THE Partner_Admin SHALL dapat meninjau, menyetujui, menolak, dan menangguhkan Partner dengan alasan.
3. THE Partner_Admin SHALL dapat melihat Device, Partner_Number, Offer, Partner_Order, SMS audit, Earning, dan Payout sesuai izin.
4. THE Partner_Admin SHALL dapat menonaktifkan Device, Partner_Number, atau Offer yang berisiko tanpa menghapus riwayat.
5. THE Partner_Admin SHALL dapat mengatur Price_Guardrail, markup, hold period, minimum payout, dan timeout melalui konfigurasi tervalidasi.
6. THE Partner_Admin SHALL dapat menjalankan tindakan recovery terbatas dengan audit log dan proteksi terhadap double processing.
7. THE Partner_Platform SHALL mencegah Partner_Admin melihat secret mentah yang tidak diperlukan.

### Requirement 17: Simulator dan Private Beta

**User Story:** Sebagai tim pengembang, saya ingin menguji alur partner tanpa hardware, agar portal, order, OTP, dan earning dapat divalidasi sebelum membuat APK atau agent modem.

#### Acceptance Criteria

1. THE Partner_Platform SHALL mendukung Device bertipe `simulator` hanya pada environment atau akun yang diizinkan.
2. WHEN simulator mengirim heartbeat, mendaftarkan nomor, dan mengirim SMS melalui Agent_API, THE Partner_Platform SHALL memprosesnya dengan aturan domain yang sama seperti Device nyata.
3. THE Partner_Platform SHALL mencegah endpoint simulator dapat digunakan secara anonim atau oleh Partner produksi yang tidak diizinkan.
4. THE Main_Platform SHALL membatasi supply partner MVP kepada akun buyer private beta yang dikonfigurasi.
5. THE MVP SHALL dapat mendemonstrasikan satu alur lengkap dari inventory hingga Earning pending.
6. WHEN private beta dinonaktifkan, THE Main_Platform SHALL menyembunyikan supply partner tanpa menghapus data pengujian yang diperlukan untuk audit.

### Requirement 18: Keamanan Agent API

**User Story:** Sebagai operator, saya ingin Agent_API tahan terhadap pemalsuan perangkat dan replay, agar OTP, inventory, dan earning tidak dapat dimanipulasi.

#### Acceptance Criteria

1. THE Agent_API SHALL hanya menerima HTTPS pada environment produksi.
2. THE Agent_API SHALL mengautentikasi setiap request Device menggunakan kredensial yang dapat dicabut dan dirotasi.
3. THE Agent_API SHALL menerapkan rate limit berdasarkan Device, Partner, endpoint, dan sumber jaringan sesuai kebutuhan.
4. THE Agent_API SHALL memvalidasi timestamp, nonce atau Idempotency_Key untuk operasi yang rentan replay.
5. IF autentikasi, ownership, signature, atau replay validation gagal, THEN THE Agent_API SHALL menolak request sebelum mengubah state.
6. THE Agent_API SHALL membatasi ukuran payload dan memvalidasi seluruh input secara server-side.
7. THE Partner_Platform SHALL mencatat kejadian autentikasi gagal dan pola abuse tanpa mencatat secret atau OTP.

### Requirement 19: Audit, Privasi, dan Retensi Data

**User Story:** Sebagai operator dan Partner, saya ingin tindakan sensitif serta data SMS dikelola secara bertanggung jawab, agar masalah dapat ditelusuri tanpa menyimpan data sensitif tanpa batas.

#### Acceptance Criteria

1. THE Partner_Platform SHALL mencatat audit untuk perubahan status Partner, role, Device, nomor, Offer, order manual, Earning, Payout, dan kredensial.
2. THE audit log SHALL menyimpan actor, action, target, waktu, hasil, dan metadata aman yang relevan.
3. THE Partner_Platform SHALL membatasi akses SMS mentah dan OTP kepada role yang benar-benar membutuhkan.
4. THE Partner_Platform SHALL menyediakan kebijakan retention yang dapat dikonfigurasi untuk SMS mentah, OTP, log keamanan, dan metadata operasional.
5. WHEN masa retention data sensitif berakhir, THE Partner_Platform SHALL menghapus atau meredaksi data sensitif tanpa merusak catatan finansial dan audit yang wajib dipertahankan.
6. THE Partner_Platform SHALL mengecualikan password, token, API key, OTP, dan isi SMS mentah dari log umum serta respons error.

### Requirement 20: Reliability, Recovery, dan Observability

**User Story:** Sebagai operator, saya ingin mengetahui kesehatan Partner Platform dan memulihkan kegagalan dengan aman, agar order dan payout tidak rusak saat terjadi retry atau restart.

#### Acceptance Criteria

1. THE Partner_Platform SHALL menyimpan heartbeat, inventory, order, SMS, Earning, dan Payout pada storage persisten, bukan memory proses sebagai sumber kebenaran.
2. WHEN proses Partner_Platform restart, THE Partner_Platform SHALL dapat melanjutkan order aktif tanpa membuat assignment atau Earning ganda.
3. THE Partner_Platform SHALL menyediakan structured logging, health status, dan metrik dasar untuk error rate, latency, inventory, order success, heartbeat, dan payout.
4. THE Partner_Platform SHALL membedakan error client, autentikasi, conflict, stok habis, dependency failure, dan internal failure melalui kode error stabil.
5. IF Main_Platform atau Partner_Platform sementara tidak tersedia, THEN retry SHALL mengikuti idempotency dan tidak menghasilkan double charge, double refund, atau double payout.
6. THE Partner_Platform SHALL menyediakan mekanisme rekonsiliasi untuk menemukan order, Earning, atau Payout yang tertinggal pada state tidak konsisten.

### Requirement 21: Ekstensibilitas APK, Modem, dan Direct API

**User Story:** Sebagai operator, saya ingin core platform tidak bergantung pada satu jenis perangkat, agar supply dapat diperluas setelah MVP stabil.

#### Acceptance Criteria

1. THE Agent_API SHALL menggunakan kontrak domain yang dapat dipakai simulator, APK Android, modem/GoIP, dan direct API tanpa mengubah lifecycle order inti.
2. THE Partner_Platform SHALL menyimpan tipe dan versi agent untuk compatibility serta troubleshooting.
3. WHEN tipe Device memiliki metadata khusus, THE Partner_Platform SHALL menyimpannya sebagai data tervalidasi tanpa menjadikannya sumber otorisasi.
4. THE Partner_Platform SHALL memungkinkan capability Device dinyatakan secara eksplisit, termasuk SMS, notification, resend, operator, dan jumlah slot.
5. IF capability tidak didukung Device, THEN THE Partner_Platform SHALL tidak menawarkan atau menjalankan operasi terkait.
6. Penambahan APK, modem, atau direct API SHALL tidak menjadi syarat penerimaan MVP simulator.

### Requirement 22: Perlindungan Main Platform dan Data Existing

**User Story:** Sebagai operator KirimKode, saya ingin pengembangan Partner Platform tidak merusak data maupun alur provider existing, agar layanan utama tetap aman.

#### Acceptance Criteria

1. THE Partner_Platform SHALL menggunakan secret service, session, dan Device yang berbeda dari secret Main_Platform.
2. THE Partner_Platform SHALL berintegrasi melalui Internal_API dan SHALL tidak bergantung pada memory atau private implementation Main_Platform.
3. Perubahan database untuk Partner Platform SHALL bersifat additive dan SHALL tidak menghapus tabel, kolom, user, saldo, order, deposit, atau migration history existing.
4. BEFORE migration partner pertama diterapkan, THE design SHALL menetapkan satu sumber kebenaran migration dan batas kepemilikan schema.
5. WHEN supply partner disembunyikan atau gagal, THE Main_Platform SHALL tetap menyediakan provider existing sesuai perilaku sebelumnya.
6. Deployment Partner_Platform SHALL tidak menjalankan restart terhadap proses PM2 Main_Platform.
7. Integrasi buyer SHALL menyediakan feature flag atau allowlist untuk menonaktifkan supply partner tanpa rollback database.

### Requirement 23: Batas Scope MVP

**User Story:** Sebagai pemilik produk, saya ingin MVP dibatasi pada alur terkecil yang dapat divalidasi, agar risiko sistem finansial dan perangkat dapat diuji bertahap.

#### Acceptance Criteria

1. THE MVP SHALL mendukung minimal satu Partner approved, satu Device simulator, satu Partner_Number Indonesia, satu layanan, dan satu Base_Price.
2. THE MVP SHALL mendukung satu order buyer tester dari reservasi hingga OTP sukses.
3. THE MVP SHALL membuat satu Earning `pending` dari order sukses dan mendukung satu Payout manual setelah memenuhi aturan availability.
4. KYC otomatis, payout otomatis, dynamic routing kompleks, banyak negara, banyak operator, APK produksi, modem produksi, dan deployment multi-server SHALL berada di luar acceptance MVP awal.
5. WHEN seluruh alur MVP berhasil dan hasil finansial dapat direkonsiliasi, THEN pengembangan MAY dilanjutkan ke APK Android dan agent modem sesuai roadmap.

## Out of Scope untuk MVP Awal

- Pembuatan APK Android produksi.
- Agent modem/GoIP produksi.
- Direct API publik untuk supplier eksternal.
- Payout otomatis melalui payment gateway.
- KYC otomatis dan verifikasi dokumen.
- Dynamic routing berbobot lintas banyak Partner.
- Multi-currency dan perhitungan pajak.
- Banyak negara, banyak operator, dan banyak layanan sekaligus.
- Pemisahan Partner API menjadi service ketiga sebelum beban membutuhkannya.

## Keputusan yang Harus Difinalkan pada Design

1. Satu database dengan schema terpisah atau database partner terpisah pada server PostgreSQL yang sama.
2. Repository/schema mana yang menjadi sumber kebenaran Prisma migration.
3. Bentuk contract Internal_API, autentikasi service-to-service, dan strategi kompensasi order.
4. Nama provider internal/planet pada Main_Platform.
5. Layanan, negara, operator, dan timeout MVP.
6. Rumus platform fee/markup, Price_Guardrail, hold period, dan minimum payout.
7. Metode payout manual serta data tujuan pembayaran yang dibutuhkan.
8. Retention SMS mentah, OTP, audit log, dan data operasional.
9. Detail heartbeat timeout serta strategi offline/recovery.
10. Boundary antara portal/API dalam aplikasi Partner Platform dan worker yang mungkin ditambahkan nanti.
