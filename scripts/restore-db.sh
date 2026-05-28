#!/bin/bash
# ============================================================
# KirimKode Database RESTORE dari Cloudflare R2
# ============================================================
# WARNING: Script ini OVERWRITE database production.
#          Hanya jalankan saat disaster recovery.
#
# Usage:
#   ./restore-db.sh latest      # restore dari backup terbaru
#   ./restore-db.sh previous    # restore dari backup hari kemarin
# ============================================================

set -euo pipefail

DB_NAME="kirimkode"
DB_USER="postgres"
RCLONE_REMOTE="r2:kirimkode-backups"
TMP_DIR="/tmp"

VERSION="${1:-latest}"

if [ "$VERSION" != "latest" ] && [ "$VERSION" != "previous" ]; then
  echo "Usage: $0 [latest|previous]"
  exit 1
fi

REMOTE_FILE="kirimkode-${VERSION}.sql.gz"
TMP_FILE="$TMP_DIR/$REMOTE_FILE"

echo "=========================================="
echo "  RESTORE DATABASE — DESTRUCTIVE OPERATION"
echo "=========================================="
echo "Source: $RCLONE_REMOTE/$REMOTE_FILE"
echo "Target: database '$DB_NAME' di lokal Postgres"
echo ""
echo "Database SAAT INI akan di-DROP dan di-CREATE ulang."
echo "Semua data sekarang akan HILANG, diganti dengan isi backup."
echo ""
read -p "Ketik 'YES RESTORE' untuk lanjut: " CONFIRM

if [ "$CONFIRM" != "YES RESTORE" ]; then
  echo "Dibatalkan."
  exit 0
fi

# 1. Download backup dari R2
echo "[1/4] Download $REMOTE_FILE dari R2..."
rclone copyto "$RCLONE_REMOTE/$REMOTE_FILE" "$TMP_FILE"

if [ ! -f "$TMP_FILE" ]; then
  echo "ERROR: backup tidak ditemukan di R2."
  exit 1
fi

# 2. Backup safety — dump DB sekarang dulu (kalau ada masalah, bisa balik)
SAFETY_FILE="$TMP_DIR/kirimkode-pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "[2/4] Safety snapshot DB sekarang → $SAFETY_FILE"
sudo -u "$DB_USER" pg_dump "$DB_NAME" | gzip > "$SAFETY_FILE" || {
  echo "WARN: gagal bikin safety snapshot, lanjut tetap ya?"
  read -p "Ketik 'YES' untuk lanjut tanpa safety: " CONFIRM2
  [ "$CONFIRM2" != "YES" ] && exit 1
}

# 3. Stop aplikasi supaya gak ada query masuk saat restore
echo "[3/4] Stop PM2 sementara..."
pm2 stop kirimkode 2>/dev/null || true

# 4. Drop & recreate DB, lalu restore
echo "[4/4] Drop & restore database $DB_NAME..."
sudo -u "$DB_USER" psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u "$DB_USER" psql -c "CREATE DATABASE $DB_NAME OWNER kirimkode_app;"

gunzip -c "$TMP_FILE" | sudo -u "$DB_USER" psql -d "$DB_NAME"

# 5. Start aplikasi balik
echo "Restart PM2..."
pm2 start kirimkode 2>/dev/null || pm2 restart kirimkode

# 6. Cleanup
rm -f "$TMP_FILE"

echo ""
echo "✅ Restore selesai!"
echo "   Safety snapshot DB lama: $SAFETY_FILE"
echo "   (hapus manual kalau yakin restore sukses: rm $SAFETY_FILE)"
