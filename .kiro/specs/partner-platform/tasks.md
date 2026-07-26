# Implementation Plan — Partner Platform

## Overview

Rencana ini membangun MVP Partner Platform berbasis TypeScript secara inkremental dalam repository mandiri `Crazyssh/kirimkode-partner`, lalu menambahkan integrasi additive Pluto (Private Beta) pada repository Main Platform. Urutan kerja menjaga isolasi deployment dan migration, membangun invariant domain sebelum transport, dan menutup implementasi dengan contract, concurrency, smoke, serta E2E otomatis. APK produksi, modem/GoIP produksi, direct supplier API publik, routing berbobot, KYC, payout otomatis, multi-currency, multi-country, worker terpisah, dan integrasi Bimasakti tidak termasuk task MVP ini.

## Tasks

- [x] 1. Bootstrap codebase Partner Platform yang mandiri
  - [x] 1.1 [Repo Partner] Inisialisasi aplikasi Next.js TypeScript dan struktur layer
    - Buat package manifest, lockfile, konfigurasi TypeScript/Next.js/Tailwind/ESLint, App Router, serta struktur `src/app`, `src/domain`, `src/application`, `src/infrastructure`, dan `src/test`.
    - Pisahkan entry portal, admin, Internal API v1, Agent API v1, dan cron tanpa mengimpor source atau Prisma Client dari Main Platform.
    - Gunakan output build, cache, dan namespace package yang hanya dimiliki Partner Platform.
    - _Requirements: 1.1, 1.2, 22.2_
  - [x] 1.2 [Repo Partner] Siapkan toolchain validasi dan testing yang reproducible
    - Tambahkan script non-watch untuk lint, typecheck, build, unit, property, integration, dan test gabungan.
    - Pin versi dependency secara exact, termasuk Vitest `4.1.10` dan fast-check `4.9.0`, serta siapkan fake clock, generator, dan disposable test database harness.
    - _Requirements: 1.1, 20.2_
  - [x] 1.3 [Repo Partner] Buat boundary import dan bootstrap aplikasi fail-fast
    - Tambahkan alias/lint rule agar route hanya memanggil application service, raw Prisma tidak dapat diimpor route/UI, dan pure domain tidak bergantung DB/network.
    - Validasi konfigurasi saat startup tanpa mencetak nilai secret.
    - _Requirements: 1.2, 19.6, 20.1_

- [x] 2. Menyiapkan konfigurasi, CI, dan skeleton deployment terisolasi
  - [x] 2.1 [Repo Partner] Implementasikan schema environment dan pemisahan secret
    - Definisikan konfigurasi tervalidasi untuk database `kirimkode_partner`, session, HMAC Internal API, Device credential pepper, enkripsi SMS/OTP, cron, SMTP, domain, trusted proxy, port `3001`, dan timezone.
    - Sediakan template environment dengan placeholder saja dan guard yang menolak penggunaan secret Main/session/device yang sama.
    - _Requirements: 1.2, 18.1, 22.1_
  - [x] 2.2 [Repo Partner] Implementasikan health, request identity, dan process entry
    - Buat `/api/health/live` publik dengan `{status, version, time}` dan `/api/health/ready` dengan pemeriksaan DB dangkal serta error dependency generik.
    - Tambahkan request ID dan process entry yang membaca port `3001` tanpa ketergantungan runtime Main.
    - _Requirements: 1.3, 1.4, 20.3, 20.4_
  - [x] 2.3 [Repo Partner] Tambahkan konfigurasi CI dan pemeriksaan migration aman
    - Buat pipeline lint, typecheck, build, unit/property/integration, migration-from-empty, serta scanner yang menolak `DROP`, `TRUNCATE`, dan penghapusan kolom pada migration MVP.
    - Pastikan pipeline Partner tidak menjalankan migration, build, test, atau restart milik Main.
    - _Requirements: 1.1, 22.3, 22.4, 22.6_
  - [x] 2.4 [Repo Partner] Buat skeleton PM2, Nginx, backup, dan release script
    - Tambahkan konfigurasi PM2 bernama `kirimkode-partner`, port `3001`, path/log/env mandiri; template Nginx untuk dua domain partner; serta script build/migrate/reload yang hanya menargetkan process Partner.
    - Tambahkan script backup/restore database partner sebagai artefak terpisah dan guard agar tidak pernah menargetkan database/process Main.
    - _Requirements: 1.2, 1.5, 20.1, 22.3, 22.6_

- [x] 3. Menetapkan ownership database dan migration Partner
  - [x] 3.1 [Repo Partner] Definisikan model tenant, identity, credential, dan audit di Prisma
    - Buat model Partner, PartnerMember, PartnerSession, OneTimeToken, PartnerAdmin, DeviceCredential, ServiceCredential, AuditEvent, SecurityEvent, PlatformConfig, dan constraint/index terkait.
    - Terapkan UUID, timestamp UTC, email normalized unik, hash-only credential, realm admin terpisah, dan relasi tenant eksplisit.
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 4.1, 5.1, 19.1, 19.2_
  - [x] 3.2 [Repo Partner] Definisikan model inventory, order, SMS, dan idempotency di Prisma
    - Buat PartnerDevice, DeviceHeartbeat, PartnerNumber, NumberStateHistory, PartnerOffer, PartnerOrder, OrderSnapshot, OrderTransition, PartnerSms, IdempotencyRecord, dan ReplayNonce.
    - Tambahkan enum, index eligibility, unique nomor aktif/message/nonce, check nominal, immutable snapshot boundary, serta constraint satu order aktif per nomor.
    - _Requirements: 5.3, 6.1, 7.1, 7.2, 7.3, 7.6, 8.1, 9.2, 9.5, 11.2, 12.1_
  - [x] 3.3 [Repo Partner] Definisikan model ledger, payout, job, dan rekonsiliasi di Prisma
    - Buat PartnerEarning, LedgerTransaction, LedgerEntry, PayoutDestination, PartnerPayout, PayoutAllocation, PayoutTransition, JobLease, dan ReconciliationIssue.
    - Tambahkan unique earning/order, event key, allocation/earning, payment reference, serta index batch job dan status finansial.
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 14.2, 14.3, 14.6, 20.6_
  - [x] 3.4 [Repo Partner] Buat baseline migration dan seed konfigurasi MVP
    - Hasilkan migration pertama hanya di `kirimkode-partner/prisma/migrations` untuk database `kirimkode_partner`; tambahkan role/grant template yang tidak memiliki akses ke database `kirimkode`.
    - Seed config immutable untuk `wa/ID/any`, IDR, guardrail Rp500–Rp5.000, fee Rp250, markup 1500 bps, round Rp50, heartbeat 30/90 detik, timeout 20 menit, cancel 3 menit, hold 24 jam, minimum payout Rp1.000, dan retention desain.
    - _Requirements: 8.2, 16.5, 19.4, 22.3, 22.4, 23.1_
  - [x] 3.5 [Repo Partner] Tulis integration test ownership schema dan migration
    - Uji migration dari database kosong, constraint/index/check, rollback transaksi, privilege role tanpa akses silang, scanner SQL destructive, dan migrate ulang secara idempotent.
    - _Requirements: 20.1, 22.3, 22.4_

- [x] 4. Checkpoint database — Ensure all tests pass, ask the user if questions arise.

- [x] 5. Mengimplementasikan pure domain dan correctness properties
  - [x] 5.1 [Repo Partner] Implementasikan domain identity, tenant policy, dan status Partner
    - Buat normalisasi email, kebijakan password, registrasi atomik berbasis unit-of-work port, token sekali pakai, role matrix, tenant guard, state machine Partner, dan audit descriptor tanpa dependency transport/DB.
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 4.4_
  - [x] 5.2 [Repo Partner] Implementasikan domain Device, heartbeat, nomor, eligibility, dan pricing
    - Buat state/capability Device, liveness berbasis waktu server, normalisasi E.164 `+62`, guard perpindahan nomor, selector inventory deterministik, validasi offer/config, serta kalkulasi authoritative retail/payout.
    - _Requirements: 5.4, 5.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.6, 9.1, 9.4, 21.3, 21.5_
  - [x] 5.3 [Repo Partner] Implementasikan domain idempotency, replay, error, redaction, dan private-beta policy
    - Buat request hash payload-bound, hasil replay deterministik, nonce/timestamp validator, stable error mapper, safe metadata/redaction, serta gating Pluto flag+allowlist yang tidak memengaruhi order existing.
    - _Requirements: 9.6, 10.3, 10.4, 10.5, 10.7, 17.4, 17.6, 18.4, 18.5, 19.6, 20.4, 20.5, 22.7_
  - [x] 5.4 [Repo Partner] Implementasikan domain SMS matching dan parser OTP WhatsApp
    - Buat ownership/dedupe policy, matcher tepat-satu order aktif, parser keyword service-specific dengan satu kandidat enam digit utuh, dan penolakan decoy/ambiguity/fallback generik.
    - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.7_
  - [x] 5.5 [Repo Partner] Implementasikan state machine order dan pasangan state nomor
    - Buat transition function CAS untuk created/reserved/waiting_sms/terminal, cancel minimum, timeout, terminal absorbing, release disposition berdasarkan liveness, dan operation key deterministik.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [x] 5.6 [Repo Partner] Implementasikan domain earning, ledger, dan payout manual
    - Buat earning-on-success, hold/reversal, transaksi ledger zero-sum append-only, saldo bucket, payout whole-earning, lock/unlock, state machine payout, dan payment reference policy.
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 14.1, 14.2, 14.3, 14.5, 14.6_
  - [x] 5.7 [Repo Partner] Implementasikan domain config, audit, retention, reconciliation, simulator, dan formatter
    - Buat invariant config, event audit lengkap, retention decision, detektor mismatch tanpa silent money repair, policy simulator/capability netral tipe, serta formatter IDR dan Asia/Jakarta.
    - _Requirements: 15.4, 16.5, 17.1, 17.2, 19.1, 19.2, 19.3, 19.4, 19.5, 20.6, 21.1, 21.4_

  - [x] 5.8 [Repo Partner] Tulis property test registrasi tenant atomik
    - **Property 1: Registrasi tenant atomik**
    - Gunakan fake unit-of-work dengan failure injection; simpan test pada file property tersendiri dengan komentar dan `numRuns` sesuai design.
    - **Validates: Requirements 2.1**
  - [x] 5.9 [Repo Partner] Tulis property test normalisasi identitas dan kebijakan kredensial
    - **Property 2: Normalisasi identitas dan kebijakan kredensial**
    - Generasikan email Unicode/whitespace/case dan password di sekitar seluruh batas kebijakan.
    - **Validates: Requirements 2.2**
  - [x] 5.10 [Repo Partner] Tulis property test token sekali pakai berbatas waktu
    - **Property 3: Token sekali pakai berbatas waktu**
    - Variasikan hash, used state, expiry, fake clock, dan retry untuk membuktikan maksimal satu perubahan state.
    - **Validates: Requirements 2.6**
  - [x] 5.11 [Repo Partner] Tulis property test isolasi tenant dan matriks izin
    - **Property 4: Isolasi tenant dan matriks izin**
    - Generasikan tenant, role, operasi, dan resource lintas tenant; pastikan respons generik serta state tetap saat ditolak.
    - **Validates: Requirements 2.4, 4.2, 4.3, 4.4**
  - [x] 5.12 [Repo Partner] Tulis property test status Partner dan inventory
    - **Property 5: Status Partner mengendalikan inventory tanpa merusak history**
    - Generasikan urutan status valid dan inventory/history untuk memastikan hanya approved yang eligible.
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 16.4**
  - [x] 5.13 [Repo Partner] Tulis property test Device fail-closed
    - **Property 6: Credential dan status Device bersifat fail-closed**
    - Variasikan principal, credential, status, heartbeat, dan mutation; disabled harus selalu mendominasi tanpa efek domain.
    - **Validates: Requirements 5.4, 5.6, 18.5**
  - [x] 5.14 [Repo Partner] Tulis property test liveness heartbeat
    - **Property 7: Liveness heartbeat deterministik dan metadata non-otoritatif**
    - Generasikan waktu server/history/metadata untuk membuktikan `lastSeenAt` monoton dan threshold 90 detik.
    - **Validates: Requirements 6.1, 6.2, 6.4, 21.3**
  - [x] 5.15 [Repo Partner] Tulis property test eligibility saat Device offline
    - **Property 8: Device offline meniadakan eligibility**
    - Generasikan graph Device-number-offer-order dan kondisi recovery heartbeat.
    - **Validates: Requirements 6.3**
  - [x] 5.16 [Repo Partner] Tulis property test nomor kanonik dan state guard
    - **Property 9: Nomor kanonik unik dan state-guarded**
    - Generasikan representasi nomor Indonesia ekuivalen, duplicate aktif, serta operasi move/delete pada setiap state.
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  - [x] 5.17 [Repo Partner] Tulis property test pricing authoritative
    - **Property 10: Pricing, guardrail, dan server authority**
    - Uji seluruh rentang integer aman termasuk batas guardrail; jalankan 500 case pada profil CI malam.
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6**
  - [x] 5.18 [Repo Partner] Tulis property test snapshot order immutable
    - **Property 11: Snapshot order immutable**
    - Generasikan perubahan offer/config setelah reserve dan pastikan hanya reservasi baru yang berubah.
    - **Validates: Requirements 8.5, 9.5**
  - [x] 5.19 [Repo Partner] Tulis property test selector eligible inventory
    - **Property 12: Pemilihan inventory hanya dari eligible set**
    - Generasikan inventory graph dan filter katalog; stockout tidak boleh mengubah input/state.
    - **Validates: Requirements 9.1, 9.4, 21.5**
  - [x] 5.20 [Repo Partner] Tulis property test idempotency payload-bound
    - **Property 13: Idempotency mutation payload-bound**
    - Gunakan fake repository dan retry positif dengan key/payload/principal/scope sama maupun konflik.
    - **Validates: Requirements 9.6, 10.3, 10.4, 10.5, 20.5**
  - [x] 5.21 [Repo Partner] Tulis property test error mapping aman
    - **Property 14: Error mapping stabil dan aman**
    - Generasikan seluruh domain error dan marker sensitif untuk memverifikasi status/code/retryable deterministik tanpa leak.
    - **Validates: Requirements 10.7, 20.4**
  - [x] 5.22 [Repo Partner] Tulis property test ownership dan deduplikasi SMS
    - **Property 15: Ownership dan deduplikasi SMS**
    - Variasikan relasi Device-number, message ID, idempotency key, dan retry untuk membuktikan maksimal satu efek.
    - **Validates: Requirements 11.1, 11.3**

  - [x] 5.23 [Repo Partner] Tulis property test matching SMS tak ambigu
    - **Property 16: Matching SMS tidak pernah ambigu**
    - Generasikan cardinality order aktif nol, satu, dan banyak beserta window waktu dan status audit.
    - **Validates: Requirements 11.4, 11.5**
  - [x] 5.24 [Repo Partner] Tulis property test parser OTP menolak decoy
    - **Property 17: Parser OTP service-specific menolak decoy**
    - Generasikan keyword, Unicode, kandidat enam digit, angka telepon/tanggal, serta kandidat ganda; jalankan 500 case pada CI malam.
    - **Validates: Requirements 11.7**
  - [x] 5.25 [Repo Partner] Tulis property test state machine order
    - **Property 18: State machine order menolak transisi ilegal**
    - Generasikan status dan sequence command termasuk terminal berbeda dan retry; jalankan 500 case pada CI malam.
    - **Validates: Requirements 12.1, 12.3, 12.6**
  - [x] 5.26 [Repo Partner] Tulis property test pasangan state order-number
    - **Property 19: State order dan number selalu berpasangan**
    - Variasikan aktivasi/cancel/timeout, liveness Device, enable flag, dan retry.
    - **Validates: Requirements 12.2, 12.4, 12.5**
  - [x] 5.27 [Repo Partner] Tulis property test success menghasilkan satu Earning
    - **Property 20: Success menghasilkan tepat satu Earning**
    - Generasikan jumlah pengulangan OTP valid dan failure boundary pada fake unit-of-work.
    - **Validates: Requirements 13.1, 13.7**
  - [x] 5.28 [Repo Partner] Tulis property test hold Earning
    - **Property 21: Hold Earning berbatas waktu**
    - Variasikan `availableAt`, fake clock, dispute, reversal, dan retry release.
    - **Validates: Requirements 13.2, 13.4**
  - [x] 5.29 [Repo Partner] Tulis property test ledger konservatif
    - **Property 22: Ledger konservatif dan append-only**
    - Generasikan urutan event balanced/reversal dan verifikasi zero-sum, SUM bucket, serta immutability; jalankan 500 case pada CI malam.
    - **Validates: Requirements 13.5, 13.6**
  - [x] 5.30 [Repo Partner] Tulis property test payout whole Earning
    - **Property 23: Payout mengunci whole Earning tepat sekali**
    - Generasikan pilihan earning/status/amount dan simulasi request paralel pada fake repository.
    - **Validates: Requirements 14.1, 14.3, 14.6**
  - [x] 5.31 [Repo Partner] Tulis property test unlock payout gagal
    - **Property 24: Kegagalan payout membuka lock secara idempotent**
    - Generasikan status payout belum paid dan retry rejected/failed untuk memastikan satu unlock event.
    - **Validates: Requirements 14.5**
  - [x] 5.32 [Repo Partner] Tulis property test invariant PlatformConfig
    - **Property 25: Policy konfigurasi selalu menjaga invariant**
    - Generasikan guardrail, timeout, heartbeat, retention, dan minimum payout valid/invalid.
    - **Validates: Requirements 16.5, 19.4**
  - [x] 5.33 [Repo Partner] Tulis property test ekuivalensi tipe Device
    - **Property 26: Simulator dan tipe Device ekuivalen pada domain inti**
    - Generasikan tipe/capability/command yang sama serta policy environment/allowlist simulator.
    - **Validates: Requirements 17.1, 17.2, 21.1, 21.4**
  - [x] 5.34 [Lintas repo] Tulis property test private beta gating
    - **Property 27: Private beta gating reversibel**
    - Generasikan buyer, flag, allowlist, dan order existing untuk membuktikan hanya eligibility baru yang terpengaruh.
    - **Validates: Requirements 17.4, 17.6, 22.7**
  - [x] 5.35 [Repo Partner] Tulis property test replay validation
    - **Property 28: Replay validation menerima hanya request fresh dan unik**
    - Generasikan timestamp, skew, nonce, principal, dan auth validity; penolakan harus terjadi sebelum mutation.
    - **Validates: Requirements 18.4, 18.5**
  - [x] 5.36 [Repo Partner] Tulis property test audit dan least privilege
    - **Property 29: Audit event lengkap dan least privilege**
    - Generasikan sensitive command serta akses raw SMS dengan kombinasi permission, re-auth, dan reason.
    - **Validates: Requirements 19.1, 19.2, 19.3**
  - [x] 5.37 [Repo Partner] Tulis property test retention data sensitif
    - **Property 30: Retention meredaksi data sensitif tanpa merusak bukti finansial**
    - Generasikan umur dataset di sekitar seluruh boundary retention dan verifikasi invariant audit/finansial.
    - **Validates: Requirements 19.4, 19.5**
  - [x] 5.38 [Repo Partner] Tulis property test deteksi rekonsiliasi
    - **Property 31: Reconciliation mendeteksi pelanggaran invariant**
    - Injeksi tepat satu mismatch per dataset dan pastikan issue tepat tanpa perbaikan uang diam-diam.
    - **Validates: Requirements 20.2, 20.6**
  - [x] 5.39 [Repo Partner] Tulis property test formatter portal
    - **Property 32: Format portal deterministik**
    - Generasikan integer IDR dan timestamp valid untuk memastikan format tanpa pecahan, Asia/Jakarta, dan sumber UTC immutable.
    - **Validates: Requirements 15.4**

- [x] 6. Checkpoint pure domain — Ensure all tests pass, ask the user if questions arise.

- [x] 7. Membangun autentikasi, onboarding, dan isolasi tenant
  - [x] 7.1 [Repo Partner] Implementasikan repository tenant-scoped dan unit of work
    - Buat repository Prisma yang selalu menerima `TenantContext`, filter `partnerId` defense-in-depth, CAS/versioning, transaksi, dan mapping cross-tenant menjadi `RESOURCE_NOT_FOUND`.
    - Jangan ekspor raw Prisma client ke route, component, atau handler.
    - _Requirements: 4.2, 4.3, 20.1_
  - [x] 7.2 [Repo Partner] Implementasikan registrasi, login, session, dan logout
    - Buat registrasi Partner+owner pending dalam satu transaksi, Argon2id, generic login error, opaque session hash, cookie `__Host-partner_session`, idle/absolute expiry, security version, dan revocation.
    - Terapkan rate limit login/register per email+IP sesuai design.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_
  - [x] 7.3 [Repo Partner] Implementasikan verifikasi email dan reset password
    - Buat issuance/consumption token SHA-256 sekali pakai untuk TTL 24 jam/60 menit, invalidasi aman, generic response, SMTP adapter, dan rate limit.
    - _Requirements: 2.6, 2.7, 19.6_
  - [x] 7.4 [Repo Partner] Implementasikan authorization owner/member dan pengelolaan anggota
    - Buat middleware/session context server-side dan command invite/update/revoke member yang membatasi operasi sensitif serta menulis audit.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 7.5 [Repo Partner] Implementasikan realm Partner Admin dan lifecycle approval
    - Buat auth/route `/admin` terpisah, command approve/reject/suspend/reapprove dengan reason, dan audit actor/status lama-baru/waktu.
    - Pastikan non-approved tidak dapat mengaktifkan inventory dan suspend tidak mengubah order terminal.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 16.1, 16.2_
  - [x] 7.6 [Repo Partner] Tulis integration test auth dan isolasi tenant
    - Uji hash/verify, expiry session/token, generic errors, rate limit, role matrix, cross-tenant enumeration, admin realm, serta rollback registrasi.
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4_

- [x] 8. Membangun inventory, Device credential, nomor, offer, dan pricing
  - [x] 8.1 [Repo Partner] Implementasikan command Device dan credential lifecycle
    - Buat create/disable/re-enable Device, secret agent 256-bit tampil-sekali, hash+salt storage, rotasi/revoke tanpa grace period, capability tervalidasi, dan audit.
    - Dukung enum `simulator|android|modem|goip|api` pada kontrak, tetapi hanya simulator yang diaktifkan untuk alur MVP.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 21.2, 21.4, 23.4_
  - [x] 8.2 [Repo Partner] Implementasikan command heartbeat dan effective availability
    - Persist heartbeat dengan waktu server, metadata tervalidasi, `lastSeenAt` monoton, online/offline recovery, serta propagasi status hanya ke nomor idle.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 8.3 [Repo Partner] Implementasikan command PartnerNumber
    - Buat register/update/disable nomor E.164 milik Device tenant, unique aktif global MVP, state history, dan guard move/delete saat reserved/busy.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 8.4 [Repo Partner] Implementasikan command Offer, config pricing, dan inventory query
    - Buat CRUD offer `wa/ID/any`, guardrail server-side, immutable config version, kalkulasi retail/payout authoritative, eligibility query, dan quote version/expiry.
    - Gunakan urutan candidate `number.id ASC`; jangan menambahkan weighted routing atau katalog non-MVP.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.4, 23.1, 23.4_
  - [x] 8.5 [Repo Partner] Tulis integration test inventory dan pricing persistence
    - Uji credential rotate/revoke, heartbeat recovery, duplicate nomor aktif, state guard, config snapshot, batas pricing, dan stockout tanpa partial order.
    - _Requirements: 5.5, 6.1, 6.3, 7.2, 7.4, 8.2, 8.5, 9.4_

- [x] 9. Membangun Internal API Partner dan saga Pluto pada Main Platform
  - [x] 9.1 [Repo Partner] Implementasikan autentikasi HMAC Internal API v1
    - Verifikasi canonical method/path/timestamp/nonce/body hash/idempotency key secara constant-time, current+previous key, skew 300 detik, nonce 10 menit, HTTPS production, request size, dan rate limit.
    - Pisahkan ServiceCredential dari session manusia dan Device credential; tolak sebelum mutation bila validasi gagal.
    - _Requirements: 10.1, 10.6, 10.7, 18.5, 22.1_
  - [x] 9.2 [Repo Partner] Implementasikan engine idempotency dan envelope API
    - Persist `(scope, principal, key, requestHash, status, response)` dalam transaksi efek, replay response pertama, conflict payload berbeda, TTL retention, stable error envelope, dan request ID.
    - _Requirements: 9.6, 10.3, 10.4, 10.5, 10.7, 20.4, 20.5_
  - [x] 9.3 [Repo Partner] Implementasikan operasi inventory dan reserve atomic
    - Buat `GET /inventory` serta `POST /orders/reserve` dengan quote validation, `FOR UPDATE SKIP LOCKED`, order+snapshot+idempotency+number reserved dalam transaksi, activation CAS ke waiting_sms/busy, dan response deterministik.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.2_
  - [x] 9.4 [Repo Partner] Implementasikan operasi status, cancel, timeout, dan reconciliation
    - Buat `GET /orders/{id}`, mutation cancel/timeout, dan batch reconciliation maksimal 100 item; hanya tampilkan OTP order terkait dan tidak pernah mengembalikan SMS mentah.
    - _Requirements: 10.2, 10.3, 11.6, 12.4, 12.5, 20.6_
  - [x] 9.5 [Repo Main] Tambahkan migration additive untuk referensi dan dispatch Pluto
    - Tambahkan `providerOrderRef String?`, `providerRequestRef String?`, serta tabel operasi/kompensasi dengan unique purchase key dan status saga tanpa mengubah/menghapus schema atau migration existing.
    - Pastikan database Main tetap pemilik buyer, saldo, order, debit, dan refund; jangan membuat foreign key atau query ke database Partner.
    - _Requirements: 9.6, 22.2, 22.3, 22.4_
  - [x] 9.6 [Repo Main] Implementasikan client Internal API dan adapter provider Pluto
    - Buat client HMAC dengan timeout 3/8 detik, stable error mapping, retry key sama, serta `provider-partner.ts` untuk inventory/reserve/status/cancel/timeout/reconciliation.
    - Daftarkan ID `partner` dengan display **Pluto (Private Beta)** tanpa mengubah perilaku `api1`–`api10` atau `unified`, dan jangan memasukkannya ke Bimasakti.
    - _Requirements: 10.1, 10.2, 10.6, 10.7, 17.4, 22.2, 22.5, 23.4_
  - [x] 9.7 [Repo Main] Implementasikan saga debit-reserve-confirm-compensate
    - Persist dispatch sebelum call Partner, gunakan conditional debit/refund exactly-once, state `pending|confirmed|compensating|compensated|unknown`, dan rekonsiliasi outcome unknown berdasarkan key/ref yang sama.
    - Pertahankan provider existing bila Partner gagal/stockout dan jangan membuat refund di Partner Platform.
    - _Requirements: 9.6, 17.5, 20.5, 22.5_
  - [x] 9.8 [Repo Main] Implementasikan feature flag dan allowlist private beta
    - Tambahkan `partner_supply_enabled` default false dan allowlist buyer UUID; gate discovery/purchase baru, tetapi izinkan status/cancel order Pluto existing ketika flag mati.
    - _Requirements: 17.4, 17.6, 22.7, 23.2_

- [x] 10. Checkpoint integrasi internal — Ensure all tests pass, ask the user if questions arise.

- [x] 11. Membangun Agent API v1 dan simulator
  - [x] 11.1 [Repo Partner] Implementasikan middleware autentikasi dan replay Agent API
    - Parse `Authorization: Device <publicId>.<secret>`, verifikasi hash constant-time, status Partner/Device, timestamp/nonce, idempotency, HTTPS production, payload maksimal 16 KiB, dan redaction.
    - Terapkan rate limit heartbeat 6/device/menit, SMS 30/device/menit, number mutation 10/device/menit, 120/partner/menit, dan 300/IP/menit.
    - _Requirements: 5.5, 5.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_
  - [x] 11.2 [Repo Partner] Implementasikan endpoint heartbeat Agent
    - Buat `POST /api/agent/v1/heartbeat` yang memanggil command heartbeat bersama, menyimpan version/signal/operator/health/capabilities tervalidasi, dan tidak mempercayai metadata sebagai otorisasi.
    - _Requirements: 6.1, 6.4, 21.2, 21.3, 21.4_
  - [x] 11.3 [Repo Partner] Implementasikan endpoint register dan availability nomor
    - Buat `POST /numbers/register` dan `POST /numbers/{id}/availability` melalui command domain bersama, ownership check, idempotency, serta effective-state enforcement.
    - _Requirements: 7.1, 7.3, 17.2, 18.5, 21.1_
  - [x] 11.4 [Repo Partner] Implementasikan client simulator private beta
    - Buat simulator terautentikasi untuk heartbeat, register `+62`, ubah availability, dan submit SMS melalui Agent API yang sama; batasi creation berdasarkan environment atau `simulatorAllowed`.
    - Jangan membuat endpoint bypass, APK, modem, GoIP, notification listener, resend, atau direct supplier API.
    - _Requirements: 17.1, 17.2, 17.3, 21.1, 21.5, 23.1, 23.4_
  - [x] 11.5 [Repo Partner] Tulis integration test keamanan Agent API dan simulator
    - Uji token rotation/revoke, disabled/non-approved, skew/nonce replay, ownership, payload/rate-limit boundary, metadata non-otoritatif, dan ekuivalensi command simulator.
    - _Requirements: 5.5, 5.6, 17.1, 17.2, 17.3, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 12. Membangun ingestion SMS dan ekstraksi OTP
  - [x] 12.1 [Repo Partner] Implementasikan enkripsi dan persistence SMS/OTP
    - Buat AES-256-GCM envelope dengan key version, fingerprint dedupe, ciphertext sender/body/OTP, unique `(deviceId,messageId)`, dan redaction-safe DTO/logging.
    - _Requirements: 11.2, 11.3, 11.6, 19.3, 19.6_
  - [x] 12.2 [Repo Partner] Implementasikan pipeline matching dan parser SMS
    - Dalam transaksi, validasi Device-number tenant, persist SMS, cari tepat satu order waiting_sms pada window yang cocok, parse rule `wa`, dan tandai matched/unmatched/ambiguous tanpa misdelivery.
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.7_
  - [x] 12.3 [Repo Partner] Implementasikan `POST /api/agent/v1/sms`
    - Validasi `messageId`, number, sender, receivedAt, body maksimal 4 KiB, idempotency/replay, lalu panggil pipeline bersama dan kembalikan envelope aman.
    - _Requirements: 11.1, 11.2, 11.3, 18.5, 18.6_
  - [x] 12.4 [Repo Partner] Tulis unit dan integration test SMS/OTP
    - Uji ciphertext bukan plaintext, key version, duplicate retry, cross-tenant, no/multi-order ambiguity, keyword/candidate/Unicode/decoy/oversized body, dan redaction log/error.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 19.6_

- [x] 13. Menyelesaikan lifecycle order dan recovery transaksional
  - [x] 13.1 [Repo Partner] Implementasikan activation reservasi dan transition service
    - Hubungkan reserve→activation CAS, tulis OrderTransition/NumberStateHistory, actor/reason/operation key, dan terminal conflict semantics.
    - _Requirements: 9.2, 12.1, 12.2, 12.3, 12.6, 12.7_
  - [x] 13.2 [Repo Partner] Implementasikan cancel, timeout, fail, dan release number
    - Terapkan cancel setelah 3 menit kecuali `MAIN_COMPENSATION`, timeout 20 menit, no-success override, serta release ke available/offline berdasarkan effective Device state.
    - _Requirements: 12.4, 12.5, 12.6, 20.2_
  - [x] 13.3 [Repo Partner] Satukan SMS success, order, Earning, dan ledger dalam satu transaksi
    - Commit matched SMS, OTP, order success, number release, satu Earning pending, dan ledger success sebagai satu unit; rollback harus meninggalkan tidak satu pun efek parsial.
    - _Requirements: 11.6, 12.3, 13.1, 13.7, 20.2_
  - [x] 13.4 [Repo Partner] Tulis integration test lifecycle dan crash recovery
    - Uji cancel terlalu awal, success lalu cancel, timeout offline, terminal retry/conflict, crash reserve-activation, crash SMS-success, dan restart proses tanpa duplicate assignment/Earning.
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 20.2_

- [x] 14. Membangun ledger, earning, dan payout manual
  - [x] 14.1 [Repo Partner] Implementasikan projection Earning dan ledger repository
    - Persist event key unik serta minimal dua LedgerEntry zero-sum untuk success, hold release, reversal, payout lock/unlock/paid; hitung saldo dari SUM bucket.
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 13.7_
  - [x] 14.2 [Repo Partner] Implementasikan hold release dan reversal
    - Ubah pending→available setelah 24 jam tanpa dispute, buat compensating transaction untuk reversal, dan blok automatic reversal Earning paid menjadi reconciliation issue.
    - _Requirements: 13.4, 13.5, 20.6_
  - [x] 14.3 [Repo Partner] Implementasikan tujuan payout dan request atomic
    - Enkripsi rekening, simpan last4, validasi bank Indonesia, snapshot tujuan, minimum Rp1.000, pilih whole Earning, serta buat payout+allocation+lock dalam satu transaksi.
    - _Requirements: 14.1, 14.2, 14.3, 14.6, 14.7, 23.3_
  - [x] 14.4 [Repo Partner] Implementasikan review dan penyelesaian payout admin
    - Buat transition requested→approved→processing→paid atau rejected/failed, reason/audit, unique payment reference, method `bank_transfer_manual`, paid timestamp/actor, dan unlock idempotent.
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7, 16.6, 23.3_
  - [x] 14.5 [Repo Partner] Tulis integration test ledger dan payout concurrency
    - Uji zero-sum/projection, event retry, hold/reversal, allocation full-only, payout paralel atas Earning sama, rejected/failed unlock, crash lock/paid, dan duplicate payment reference.
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 14.1, 14.2, 14.5, 14.6_

- [x] 15. Membangun portal Partner dan area Admin MVP
  - [x] 15.1 [Repo Partner] Implementasikan shell portal dan dashboard tenant
    - Buat protected layout, navigasi, dashboard status Partner, Device online, nomor available, order, earning pending/available, payout, empty state, IDR/Jakarta formatter, dan feedback mutation.
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6_
  - [x] 15.2 [Repo Partner] Implementasikan halaman operasional Partner
    - Buat halaman/form Device, PartnerNumber, Offer, order aktif/history, Earning, Payout, member, API key, dan payout destination dengan server authorization pada setiap mutation.
    - _Requirements: 5.2, 6.5, 15.2, 15.3, 15.5, 15.6_
  - [x] 15.3 [Repo Partner] Implementasikan dashboard dan resource explorer Admin
    - Buat area terpisah untuk review Partner serta melihat Device, nomor, offer, order, SMS teredaksi, Earning, dan payout; sediakan disable tanpa menghapus history.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.7_
  - [x] 15.4 [Repo Partner] Implementasikan konfigurasi, recovery, audit, dan raw SMS access Admin
    - Buat form config tervalidasi/terversi, recovery melalui command CAS, audit browser, serta raw SMS gate `sms:raw` dengan re-auth 15 menit, reason, dan audit; jangan tampilkan secret mentah.
    - _Requirements: 16.5, 16.6, 16.7, 19.1, 19.2, 19.3_
  - [x] 15.5 [Repo Partner] Tulis component test portal dan Admin
    - Uji empty state, action per role/status, tenant data boundary, IDR/Jakarta, success/error mutation, admin separation, redaction/raw access gate, dan accessibility dasar.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 16.1, 19.3_

- [x] 16. Membangun jobs, rekonsiliasi, retensi, dan observability
  - [x] 16.1 [Repo Partner] Implementasikan cron auth, lease, dan batch runner idempotent
    - Buat endpoint cron bearer terpisah, JobLease dengan owner/expiry/cursor, `SKIP LOCKED`/conditional update, operation key, bounded batch, dan safe retry setelah crash.
    - _Requirements: 20.1, 20.2, 20.5_
  - [x] 16.2 [Repo Partner] Implementasikan offline sweep, reservation recovery, dan order timeout jobs
    - Jalankan offline threshold 90 detik/sweep 30 detik, recovery reservation tertinggal 30 detik, serta timeout 20 menit melalui application command bersama tanpa merelokasi order aktif.
    - _Requirements: 6.2, 6.3, 12.5, 20.2_
  - [x] 16.3 [Repo Partner] Implementasikan earning release dan retention jobs
    - Release hold 24 jam dan redaksi raw SMS 7 hari, OTP 24 jam setelah terminal, heartbeat 30 hari, security log 90 hari, audit/ledger/payout 7 tahun dengan cursor resumable.
    - _Requirements: 13.4, 19.4, 19.5, 20.2_
  - [x] 16.4 [Repo Partner] Implementasikan reconciler operasional dan finansial
    - Deteksi stale Device, order-number mismatch, duplicate earning/allocation, ledger imbalance, snapshot/payout mismatch, dan projection drift; persist/dedupe issue dan blok operasi finansial berisiko tanpa silent fix.
    - _Requirements: 20.2, 20.6_
  - [x] 16.5 [Repo Partner] Implementasikan logging, security events, metrics, dan alerts signal
    - Emit JSON log teredaksi, stable error/request correlation, auth/replay/rate-limit/ownership events, serta metrik API/DB/inventory/order/SMS/heartbeat/earning/payout/job/reconciliation.
    - Sediakan signal untuk readiness 2 menit, 5xx >5%, stale simulator, stuck order, ledger imbalance, dan payout processing >24 jam.
    - _Requirements: 18.7, 19.6, 20.3, 20.4_
  - [x] 16.6 [Repo Partner] Tulis integration test jobs, retention, reconciliation, dan observability
    - Gunakan fake clock/failure injection untuk lease contention, retry/restart, retention boundary, ciphertext/key version, issue detection, structured metrics/log redaction, dan bukti finansial tetap utuh.
    - _Requirements: 19.4, 19.5, 19.6, 20.2, 20.3, 20.6_

- [x] 17. Menutup MVP dengan contract, concurrency, smoke, dan E2E private beta
  - [x] 17.1 [Lintas repo] Tulis consumer-driven contract test Internal API v1
    - Verifikasi inventory/reserve/status/cancel/timeout/reconciliation, HMAC canonicalization/current+previous key, envelope/error code, idempotency conflict, timeout, dan kompatibilitas field optional antara Partner producer dan Main consumer.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [x] 17.2 [Repo Partner] Tulis PostgreSQL concurrency test reservasi atomic
    - Jalankan 20–100 reserve paralel untuk nomor sama dan stockout; buktikan maksimal satu sukses, satu order aktif, snapshot konsisten, serta tidak ada row/idempotency parsial.
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  - [x] 17.3 [Lintas repo] Tulis integration test saga dan failure boundary
    - Injeksi timeout/crash pada debit, reserve, persist link, refund, cancel, dan reconcile; jalankan retry/restart sampai state konsisten tanpa double debit/refund/earning.
    - _Requirements: 9.6, 17.5, 20.2, 20.5, 22.5_
  - [x] 17.4 [Repo Main] Tulis regression test migration additive dan provider existing
    - Terapkan migration Main pada copy database production-like, verifikasi tidak ada drop/perubahan destructive, lalu jalankan regression dispatcher `api1`–`api10`/`unified` saat Pluto aktif, mati, stockout, dan unavailable.
    - _Requirements: 1.3, 22.3, 22.5_
  - [x] 17.5 [Lintas repo] Tulis automated smoke test isolasi build dan deployment
    - Build/lint/typecheck/test Partner tanpa Main; validasi port/process/output/env/log terpisah, template Nginx HTTPS/live/readiness, grant DB tanpa akses silang, dan reload config Partner tidak menargetkan PID/process Main.
    - Matikan Partner API dan pastikan fitur/provider existing Main tetap lulus serta Pluto gagal secara terstruktur.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 18.1, 22.1, 22.5, 22.6_
  - [x] 17.6 [Lintas repo] Tulis E2E otomatis alur private beta lengkap
    - Seed satu Partner approved, simulator, nomor `+62`, offer `wa/ID/any` base Rp1.000, dan buyer allowlist; reserve Pluto, submit SMS, baca OTP, verifikasi success/Earning pending, majukan 24 jam, request payout Rp1.000, admin paid, lalu pastikan reconciliation zero issue.
    - _Requirements: 17.2, 17.4, 17.5, 23.1, 23.2, 23.3_
  - [x] 17.7 [Lintas repo] Tulis E2E otomatis disable private beta dan order existing
    - Matikan flag setelah order Pluto dibuat; verifikasi supply baru tersembunyi tanpa menghapus data, sedangkan status/cancel order existing dan audit tetap berfungsi.
    - _Requirements: 17.6, 22.5, 22.7_
  - [x] 17.8 [Repo Partner] Tulis automated release-gate untuk backup dan invariant MVP
    - Verifikasi backup/restore drill database Partner tidak menyentuh Main, ledger zero-sum, tidak ada issue severity high, seluruh test non-eksternal lulus, dan acceptance tidak bergantung APK/modem/direct API/payout otomatis.
    - _Requirements: 20.1, 20.2, 20.6, 23.4, 23.5_

- [x] 18. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Task bertanda `*` adalah testing opsional dan dapat dilewati untuk MVP lebih cepat; task implementasi inti tidak bertanda `*`.
- Setiap property test memakai satu file/task terpisah, komentar `Feature: partner-platform, Property {number}: {property_text}`, `fc.assert`, minimal `numRuns: 100`, dan mencetak seed kegagalan; pricing, parser, state machine, dan ledger memakai 500 run pada profil CI malam.
- `[Repo Partner]` hanya mengubah repository `Crazyssh/kirimkode-partner`; `[Repo Main]` hanya mengubah repository KirimKode existing; `[Lintas repo]` menyentuh contract/test fixture kedua repo tanpa berbagi Prisma Client, memory, atau private implementation.
- Semua migration Partner dimiliki repo Partner dan hanya menargetkan `kirimkode_partner`; semua migration buyer dimiliki repo Main dan wajib additive.
- Scope task berhenti pada simulator private beta, payout bank manual, dan satu katalog `wa/ID/any`; roadmap pasca-MVP tidak boleh diimplementasikan melalui task ini.


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3", "2.4"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.4"] },
    { "id": 10, "tasks": ["3.5"] },
    { "id": 11, "tasks": ["5.1"] },
    { "id": 12, "tasks": ["5.2"] },
    { "id": 13, "tasks": ["5.3"] },
    { "id": 14, "tasks": ["5.4"] },
    { "id": 15, "tasks": ["5.5"] },
    { "id": 16, "tasks": ["5.6"] },
    { "id": 17, "tasks": ["5.7"] },
    { "id": 18, "tasks": ["5.8", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14", "5.15", "5.16", "5.17", "5.18", "5.19", "5.20", "5.21", "5.22", "5.23", "5.24", "5.25", "5.26", "5.27", "5.28", "5.29", "5.30", "5.31", "5.32", "5.33", "5.34", "5.35", "5.36", "5.37", "5.38", "5.39"] },
    { "id": 19, "tasks": ["7.1"] },
    { "id": 20, "tasks": ["7.2"] },
    { "id": 21, "tasks": ["7.3"] },
    { "id": 22, "tasks": ["7.4"] },
    { "id": 23, "tasks": ["7.5"] },
    { "id": 24, "tasks": ["7.6"] },
    { "id": 25, "tasks": ["8.1"] },
    { "id": 26, "tasks": ["8.2"] },
    { "id": 27, "tasks": ["8.3"] },
    { "id": 28, "tasks": ["8.4"] },
    { "id": 29, "tasks": ["8.5"] },
    { "id": 30, "tasks": ["9.1"] },
    { "id": 31, "tasks": ["9.2"] },
    { "id": 32, "tasks": ["9.3"] },
    { "id": 33, "tasks": ["9.4"] },
    { "id": 34, "tasks": ["9.5"] },
    { "id": 35, "tasks": ["9.6"] },
    { "id": 36, "tasks": ["9.7"] },
    { "id": 37, "tasks": ["9.8"] },
    { "id": 38, "tasks": ["11.1"] },
    { "id": 39, "tasks": ["11.2"] },
    { "id": 40, "tasks": ["11.3"] },
    { "id": 41, "tasks": ["11.4"] },
    { "id": 42, "tasks": ["11.5"] },
    { "id": 43, "tasks": ["12.1"] },
    { "id": 44, "tasks": ["12.2"] },
    { "id": 45, "tasks": ["12.3"] },
    { "id": 46, "tasks": ["12.4"] },
    { "id": 47, "tasks": ["13.1"] },
    { "id": 48, "tasks": ["13.2"] },
    { "id": 49, "tasks": ["13.3"] },
    { "id": 50, "tasks": ["13.4"] },
    { "id": 51, "tasks": ["14.1"] },
    { "id": 52, "tasks": ["14.2"] },
    { "id": 53, "tasks": ["14.3"] },
    { "id": 54, "tasks": ["14.4"] },
    { "id": 55, "tasks": ["14.5"] },
    { "id": 56, "tasks": ["15.1"] },
    { "id": 57, "tasks": ["15.2"] },
    { "id": 58, "tasks": ["15.3"] },
    { "id": 59, "tasks": ["15.4"] },
    { "id": 60, "tasks": ["15.5"] },
    { "id": 61, "tasks": ["16.1"] },
    { "id": 62, "tasks": ["16.2"] },
    { "id": 63, "tasks": ["16.3"] },
    { "id": 64, "tasks": ["16.4"] },
    { "id": 65, "tasks": ["16.5"] },
    { "id": 66, "tasks": ["16.6"] },
    { "id": 67, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 68, "tasks": ["17.6", "17.7"] },
    { "id": 69, "tasks": ["17.8"] }
  ]
}
```