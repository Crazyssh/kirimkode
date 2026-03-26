---
description: Aturan wajib setelah mengubah kode
---

## Aturan Umum

1. **Wajib pakai Bahasa Indonesia** dalam semua komunikasi dengan user.

## Setelah Mengubah Kode

Setelah selesai mengubah kode, **wajib langsung commit, push, dan deploy**:

// turbo-all

1. Stage semua perubahan:
```bash
git add -A
```

2. Commit dengan pesan yang jelas (dalam Bahasa Indonesia):
```bash
git commit -m "deskripsi perubahan"
```

3. Push ke remote:
```bash
git push
```

4. Kasih command deploy ke user untuk dijalankan di VPS:
```
cd /var/www/kirimkode && git pull && npm run build && pm2 restart kirimkode
```

> **PENTING:** Selalu tampilkan command deploy di atas setelah push berhasil, supaya user bisa langsung copy-paste dan jalankan di terminal VPS.
