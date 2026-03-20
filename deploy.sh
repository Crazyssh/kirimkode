#!/bin/bash
# ============================================
# Deploy Script KirimKode ke VPS
# Jalankan: bash deploy.sh
# ============================================

set -e

APP_DIR="/var/www/kirimkode"
REPO_URL="https://github.com/Crazyssh/kirimkode.git"
DOMAIN="kirimkode.com"

echo "🚀 Deploy KirimKode ke VPS..."
echo "================================"

# === 1. Update system ===
echo "📦 [1/8] Update system..."
sudo apt update && sudo apt upgrade -y

# === 2. Install Node.js 20 LTS ===
echo "📦 [2/8] Install Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "   Node: $(node -v)"
echo "   NPM: $(npm -v)"

# === 3. Install PM2 & Nginx ===
echo "📦 [3/8] Install PM2 & Nginx..."
sudo npm install -g pm2
sudo apt install -y nginx

# === 4. Clone/Pull repo ===
echo "📦 [4/8] Setup project..."
if [ -d "$APP_DIR" ]; then
    echo "   Folder sudah ada, pull latest..."
    cd $APP_DIR
    git pull origin main
else
    echo "   Clone repo..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# === 5. Install dependencies & build ===
echo "📦 [5/8] Install dependencies & build..."
npm install
npx prisma generate
npm run build

# === 6. Setup .env ===
if [ ! -f "$APP_DIR/.env" ]; then
    echo ""
    echo "⚠️  FILE .env BELUM ADA!"
    echo "   Copy .env dari lokal ke: $APP_DIR/.env"
    echo "   Atau buat manual dengan: nano $APP_DIR/.env"
    echo ""
    echo "   Minimal isi:"
    echo "   DATABASE_URL=postgresql://..."
    echo "   AUTH_SECRET=..."
    echo "   NEXT_PUBLIC_APP_URL=https://kirimkode.com"
    echo ""
    read -p "   Sudah setup .env? (y/n): " env_ready
    if [ "$env_ready" != "y" ]; then
        echo "❌ Setup .env dulu, lalu jalankan deploy.sh lagi."
        exit 1
    fi
fi

# === 7. Setup Nginx & SSL ===
echo "📦 [6/8] Setup Nginx..."
sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/$DOMAIN
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "📦 [7/8] Setup SSL dengan Let's Encrypt..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi
# Untuk pertama kali, harus pakai HTTP dulu (comment HTTPS block di nginx.conf)
# sudo certbot --nginx -d kirimkode.com -d www.kirimkode.com

# === 8. Start/Restart PM2 ===
echo "📦 [8/8] Start app dengan PM2..."
sudo mkdir -p /var/log/kirimkode
pm2 stop kirimkode 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "✅ Deploy selesai!"
echo "================================"
echo "🌐 Website: https://$DOMAIN"
echo "📊 PM2 status: pm2 status"
echo "📋 PM2 logs: pm2 logs kirimkode"
echo ""
echo "⚠️  CATATAN PENTING:"
echo "   1. Pastikan .env sudah diisi dengan benar"
echo "   2. Jalankan SSL: sudo certbot --nginx -d kirimkode.com -d www.kirimkode.com"
echo "   3. Pastikan DNS A record kirimkode.com mengarah ke IP VPS ini"
echo ""
