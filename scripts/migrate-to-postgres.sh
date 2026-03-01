#!/bin/bash
# ============================================
# KirimKode: Migrasi Data SQLite → Neon PostgreSQL
# ============================================
# Script ini TIDAK menghapus dev.db!
# Hanya membaca data dari SQLite dan memasukkan ke PostgreSQL.
#
# Cara pakai di VPS:
#   chmod +x scripts/migrate-to-postgres.sh
#   bash scripts/migrate-to-postgres.sh
# ============================================

set -e

# Warna output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SQLITE_DB="dev.db"
EXPORT_DIR="/tmp/kirimkode-export"

# Cek DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  # Coba baca dari .env
  if [ -f .env ]; then
    export $(grep ^DATABASE_URL .env | xargs)
  fi
  if [ -f .env.local ]; then
    export $(grep ^DATABASE_URL .env.local | xargs)
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL belum di-set!${NC}"
  echo "Set dulu: export DATABASE_URL='postgresql://...'"
  exit 1
fi

# Cek tools
if ! command -v sqlite3 &> /dev/null; then
  echo -e "${YELLOW}Installing sqlite3...${NC}"
  sudo apt install sqlite3 -y
fi

if ! command -v psql &> /dev/null; then
  echo -e "${YELLOW}Installing psql...${NC}"
  sudo apt install postgresql-client -y
fi

# Cek SQLite database ada
if [ ! -f "$SQLITE_DB" ]; then
  echo -e "${RED}ERROR: $SQLITE_DB tidak ditemukan!${NC}"
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Migrasi Data: SQLite → PostgreSQL${NC}"
echo -e "${GREEN}  File SQLite: $SQLITE_DB (TIDAK DIHAPUS)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Buat folder export
mkdir -p "$EXPORT_DIR"

# Tabel-tabel (urutan sesuai foreign key dependencies)
TABLES=(
  "users"
  "accounts"
  "sessions"
  "verification_tokens"
  "price_rules"
  "announcements"
  "vouchers"
  "orders"
  "deposits"
  "audit_logs"
  "voucher_usages"
  "blog_posts"
)

# Step 1: Export data dari SQLite ke CSV
echo -e "${YELLOW}Step 1: Export data dari SQLite...${NC}"
for table in "${TABLES[@]}"; do
  count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
  echo -e "  $table: $count rows"
  
  if [ "$count" != "0" ]; then
    # Export header
    sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM $table;" > "$EXPORT_DIR/$table.csv" 2>/dev/null || true
  fi
done
echo ""

# Step 2: Import ke PostgreSQL
echo -e "${YELLOW}Step 2: Import data ke PostgreSQL...${NC}"

# Disable foreign key checks sementara
psql "$DATABASE_URL" -c "SET session_replication_role = 'replica';" 2>/dev/null || true

for table in "${TABLES[@]}"; do
  csv_file="$EXPORT_DIR/$table.csv"
  
  if [ -f "$csv_file" ] && [ -s "$csv_file" ]; then
    count=$(wc -l < "$csv_file")
    count=$((count - 1)) # minus header
    
    if [ "$count" -gt 0 ]; then
      echo -e "  Importing $table ($count rows)..."
      
      # Hapus data lama di PostgreSQL (kalau ada)
      psql "$DATABASE_URL" -c "DELETE FROM \"$table\";" 2>/dev/null || true
      
      # Import CSV
      psql "$DATABASE_URL" -c "\COPY \"$table\" FROM '$csv_file' WITH (FORMAT csv, HEADER true);" 2>/dev/null
      
      if [ $? -eq 0 ]; then
        echo -e "    ${GREEN}✓ OK${NC}"
      else
        echo -e "    ${RED}✗ GAGAL${NC}"
      fi
    fi
  fi
done

# Re-enable foreign key checks
psql "$DATABASE_URL" -c "SET session_replication_role = 'origin';" 2>/dev/null || true

echo ""

# Step 3: Verifikasi
echo -e "${YELLOW}Step 3: Verifikasi data di PostgreSQL...${NC}"
for table in "${TABLES[@]}"; do
  pg_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tr -d ' ')
  sq_count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
  
  if [ "$pg_count" = "$sq_count" ]; then
    echo -e "  ${GREEN}✓ $table: SQLite=$sq_count → PostgreSQL=$pg_count${NC}"
  else
    echo -e "  ${RED}✗ $table: SQLite=$sq_count → PostgreSQL=$pg_count (MISMATCH!)${NC}"
  fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Migrasi selesai!${NC}"
echo -e "${GREEN}  File $SQLITE_DB TIDAK DIHAPUS (backup)${NC}"
echo -e "${GREEN}========================================${NC}"

# Cleanup
rm -rf "$EXPORT_DIR"
