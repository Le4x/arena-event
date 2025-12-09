#!/bin/bash

echo "🔄 Mise à jour du VPS Arena Event"
echo "=================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Pull latest code
echo -e "${YELLOW}1️⃣ Récupération du code...${NC}"
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors du pull${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Code récupéré${NC}"
echo ""

# 2. Install dependencies (if needed)
echo -e "${YELLOW}2️⃣ Vérification des dépendances...${NC}"
npm install
echo -e "${GREEN}✅ Dépendances OK${NC}"
echo ""

# 3. Build all frontend apps
echo -e "${YELLOW}3️⃣ Build des applications frontend...${NC}"

echo "   📦 Building web-player..."
npm run build -w @arena-event/web-player
echo "   📦 Building web-studio..."
npm run build -w @arena-event/web-studio
echo "   📦 Building web-screen..."
npm run build -w @arena-event/web-screen
echo "   📦 Building web-admin..."
npm run build -w @arena-event/web-admin

echo -e "${GREEN}✅ Applications buildées${NC}"
echo ""

# 4. Restart all services with PM2 ecosystem config
echo -e "${YELLOW}4️⃣ Redémarrage de tous les services en mode production...${NC}"

# Stop all running processes
pm2 delete all 2>/dev/null || true

# Start all services using ecosystem.config.js
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✅ Services redémarrés en mode production${NC}"
echo ""

# 5. Show status
echo -e "${YELLOW}5️⃣ Statut des services...${NC}"
pm2 list

echo ""
echo -e "${GREEN}=================================="
echo "✅ Mise à jour terminée!"
echo "==================================${NC}"
echo ""
echo "📝 Instructions pour tester :"
echo "   1. Ouvrez le player sur mobile"
echo "   2. Entrez le code de session"
echo "   3. Vérifiez que l'écran passe en plein écran"
echo "   4. Lancez une question depuis le studio"
echo "   5. Vérifiez que la question s'affiche"
echo "   6. Rafraîchissez la page (doit rester connecté)"
echo ""
