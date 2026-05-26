#!/usr/bin/env bash
###############################################################################
# KirimKode VPS Setup — All-in-One (App + Postgres + Bot)
#
# Target: VPS 6 vCPU / 6 GB / 200 GB NVMe
# Use case: 10k user / 1k active per hari (~50-100 concurrent SSE peak)
#
# Run sebagai root di Ubuntu 22.04 LTS fresh install:
#   curl -O https://raw.githubusercontent.com/Crazyssh/kirimkode/main/scripts/setup-vps-allinone.sh
#   chmod +x setup-vps-allinone.sh
#   ./setup-vps-allinone.sh
###############################################################################

set -euo pipefail

# Konfigurasi (edit sesuai kebutuhan)
DOMAIN="kirimkode.com"
EMAIL="admin@kirimkode.id"           # untuk Let's Encrypt
DB_NAME="kirimkode"
DB_USER="kirimkode_app"
DB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"  # auto-generate
APP_DIR="/var/www/kirimkode"
NODE_VERSION="20"

echo "==> [1/10] Update system"
apt update -y && apt upgrade -y

echo "==> [2/10] Install build essentials"
apt install -y curl wget git build-essential ufw fail2ban htop

echo "==> [3/10] Install Node.js ${NODE_VERSION}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs
npm install -g pm2 tsx

echo "==> [4/10] Install Postgres 16 (tuned untuk 6 GB RAM)"
sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update -y
apt install -y postgresql-16 postgresql-contrib-16

# Tune Postgres untuk VPS 6 GB
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
sed -i "s/^#*shared_buffers = .*/shared_buffers = 512MB/" $PG_CONF
sed -i "s/^#*effective_cache_size = .*/effective_cache_size = 1500MB/" $PG_CONF
sed -i "s/^#*work_mem = .*/work_mem = 8MB/" $PG_CONF
sed -i "s/^#*maintenance_work_mem = .*/maintenance_work_mem = 128MB/" $PG_CONF
sed -i "s/^#*max_connections = .*/max_connections = 50/" $PG_CONF
sed -i "s/^#*random_page_cost = .*/random_page_cost = 1.1/" $PG_CONF
sed -i "s/^#*effective_io_concurrency = .*/effective_io_concurrency = 200/" $PG_CONF

# Restart Postgres
systemctl restart postgresql

echo "==> [5/10] Setup database & user"
sudo -u postgres psql <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

echo "==> [6/10] Install Nginx"
apt install -y nginx
systemctl enable nginx

echo "==> [7/10] Install Certbot"
apt install -y certbot python3-certbot-nginx

echo "==> [8/10] Setup firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> [9/10] Clone repo"
mkdir -p $APP_DIR
cd $APP_DIR
if [ ! -d ".git" ]; then
  git clone https://github.com/Crazyssh/kirimkode.git .
fi

echo "==> [10/10] Buat .env template"
cat > $APP_DIR/.env.template <<ENVFILE
# === Database (LOKAL, di VPS sama) ===
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"

# === Auth ===
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# === Payment Gateway: Paymenku ===
PAYMENKU_API_KEY=""
PAYMENKU_WEBHOOK_SECRET=""

# === Payment Gateway: BAYAR.GG ===
BAYARGG_API_KEY=""
BAYARGG_QRIS_STRING=""
BAYARGG_WEBHOOK_SECRET=""

# === Manual QRIS ===
MANUAL_QRIS_STRING=""

# === Provider OTP ===
JASAOTP_API_KEY=""
PROVIDER3_API_KEY=""
PROVIDER4_API_KEY=""
PROVIDER5_API_KEY=""
PROVIDER6_API_KEY=""
PROVIDER7_API_KEY=""

# === Cloudflare Turnstile ===
TURNSTILE_SECRET_KEY=""
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""

# === Mailgun ===
MAILGUN_API_KEY=""
MAILGUN_DOMAIN=""
MAILGUN_FROM=""

# === Cron ===
CRON_SECRET="$(openssl rand -hex 24)"

# === Analytics ===
NEXT_PUBLIC_GA_ID=""
NEXT_PUBLIC_FPJS_API_KEY=""

# === WhatsApp Fonnte ===
FONNTE_API_TOKEN=""

# === ShadowOTP ===
SHADOW_API_KEY=""

# === App ===
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"

# === Telegram Bot ===
TELEGRAM_BOT_TOKEN=""
ADMIN_TELEGRAM_ID=""

# === USD/IDR fallback ===
USD_IDR_FALLBACK_RATE=17500
ENVFILE

echo ""
echo "==============================================================================="
echo "  ✅ Setup VPS selesai!"
echo "==============================================================================="
echo ""
echo "  📋 LANGKAH SELANJUTNYA (manual):"
echo ""
echo "  1. Edit $APP_DIR/.env.template → save jadi .env, isi semua secret"
echo "     cd $APP_DIR && cp .env.template .env && nano .env"
echo ""
echo "  2. Install dependencies:"
echo "     cd $APP_DIR && npm install"
echo ""
echo "  3. Generate Prisma client + run migrations:"
echo "     npx prisma generate"
echo "     npx prisma migrate deploy"
echo ""
echo "  4. Build:"
echo "     npm run build"
echo ""
echo "  5. Start dengan PM2:"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo "     pm2 startup  # ikuti instruksi"
echo ""
echo "  6. Setup Nginx + SSL:"
echo "     cp nginx.conf /etc/nginx/sites-available/${DOMAIN}"
echo "     ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
echo "     # Edit nginx.conf, ubah server_name jadi ${DOMAIN}"
echo "     # Test config:"
echo "     nginx -t && systemctl reload nginx"
echo "     # Generate SSL:"
echo "     certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --redirect"
echo ""
echo "  7. Setup cron (edit crontab -e):"
echo "     */1 * * * * curl -s -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/orders"
echo "     */2 * * * * curl -s -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/deposits"
echo "     0 */1 * * * curl -s 'http://127.0.0.1:3000/api/cron/sync?key=\$CRON_SECRET'"
echo "     */3 * * * * curl -s -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/health"
echo ""
echo "  📝 SECRETS YANG BARU DI-GENERATE (SIMPAN!):"
echo ""
echo "     DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
echo "     DB_USER:      ${DB_USER}"
echo "     DB_PASSWORD:  ${DB_PASS}"
echo "     DB_NAME:      ${DB_NAME}"
echo ""
echo "==============================================================================="
