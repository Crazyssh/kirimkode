#!/bin/bash
# ============================================================
# KirimKode Database Backup → Cloudflare R2
# ============================================================
# Schedule: harian jam 00:00 WIB (set timezone VPS ke Asia/Jakarta)
# Skema: REPLACE — overwrite kirimkode-latest.sql.gz tiap run
# Optional: PREVIOUS — rotate latest jadi previous sebelum upload baru
# ============================================================

set -euo pipefail

# Konfigurasi
DB_NAME="kirimkode"
DB_USER="postgres"  # pakai user postgres karena pg_dump butuh akses penuh
RCLONE_REMOTE="r2:kirimkode-backups"  # nama remote rclone : nama bucket
TMP_DIR="/tmp"
LOG_FILE="/var/log/kirimkode-backup.log"

# Toggle: set ke "true" untuk simpan 1 backup previous (safer)
KEEP_PREVIOUS="true"

# ============================================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG_FILE"
}

START_TIME=$(date +%s)
log "=== Backup mulai ==="

# 1. Pre-flight check
if ! command -v rclone >/dev/null 2>&1; then
  log "ERROR: rclone belum terpasang. Install dulu: curl https://rclone.org/install.sh | bash"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  log "ERROR: pg_dump tidak ditemukan."
  exit 1
fi

# 2. Dump database (custom format + gzip — efisien untuk restore selektif)
TMP_FILE="$TMP_DIR/kirimkode-$(date +%Y%m%d-%H%M%S).sql.gz"
log "Dump database $DB_NAME → $TMP_FILE"

if ! sudo -u "$DB_USER" pg_dump "$DB_NAME" | gzip -9 > "$TMP_FILE"; then
  log "ERROR: pg_dump gagal"
  rm -f "$TMP_FILE"
  exit 1
fi

DUMP_SIZE=$(du -h "$TMP_FILE" | cut -f1)
log "Dump selesai. Ukuran: $DUMP_SIZE"

# 3. (Optional) Rotate latest → previous sebelum upload baru
if [ "$KEEP_PREVIOUS" = "true" ]; then
  log "Rotate kirimkode-latest.sql.gz → kirimkode-previous.sql.gz"
  rclone copy "$RCLONE_REMOTE/kirimkode-latest.sql.gz" "$RCLONE_REMOTE/" 2>/dev/null || true
  rclone moveto "$RCLONE_REMOTE/kirimkode-latest.sql.gz" "$RCLONE_REMOTE/kirimkode-previous.sql.gz" 2>/dev/null || true
fi

# 4. Upload backup baru sebagai latest (replace)
log "Upload ke R2 sebagai kirimkode-latest.sql.gz"
if ! rclone copyto "$TMP_FILE" "$RCLONE_REMOTE/kirimkode-latest.sql.gz"; then
  log "ERROR: upload R2 gagal"
  rm -f "$TMP_FILE"
  exit 1
fi

# 5. Verify upload
REMOTE_SIZE=$(rclone size "$RCLONE_REMOTE/kirimkode-latest.sql.gz" 2>/dev/null | grep -oP '\d+(?= Byte)' || echo "0")
log "Verify R2: $REMOTE_SIZE bytes"

# 6. Cleanup tmp
rm -f "$TMP_FILE"

DURATION=$(($(date +%s) - START_TIME))
log "=== Backup selesai dalam ${DURATION}s ==="

# 7. (Optional) Notify ke Telegram bot — uncomment kalau perlu
# if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_ADMIN_CHAT_ID:-}" ]; then
#   curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
#     -d chat_id="$TELEGRAM_ADMIN_CHAT_ID" \
#     -d text="✅ KirimKode DB backup OK | size: $DUMP_SIZE | took: ${DURATION}s" >/dev/null
# fi
