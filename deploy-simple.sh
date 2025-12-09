#!/bin/bash

# Script de déploiement SIMPLE - Sans Docker
# Utilise: simple-api + PM2 + PostgreSQL/Redis natifs
# Pour VPS avec Nginx + SSL déjà configuré

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement SIMPLE - Arena Event (Sans Docker)"
echo "=================================================="

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Stash les changements locaux
echo -e "${YELLOW}📦 Sauvegarde des changements locaux...${NC}"
git stash 2>/dev/null || true

# Checkout la branche avec les corrections
echo -e "${YELLOW}🔀 Basculement vers la branche de correction...${NC}"
git checkout claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Pull les dernières modifications
echo -e "${YELLOW}⬇️  Récupération des modifications...${NC}"
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Générer un nouveau JWT secret sécurisé
echo -e "${YELLOW}🔐 Génération du JWT Secret...${NC}"
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Configuration .env pour simple-api
echo -e "${YELLOW}⚙️  Configuration de simple-api/.env...${NC}"

cat > simple-api/.env <<EOF
# Database - PostgreSQL natif sur localhost
DATABASE_URL="postgresql://arena:arena123@localhost:5432/arena_event?schema=public"

# JWT - SECRET GÉNÉRÉ
JWT_SECRET="${NEW_JWT_SECRET}"
JWT_EXPIRES_IN="7d"

# Redis - Redis natif sur localhost
REDIS_HOST="localhost"
REDIS_PORT=6379

# Server
PORT=3001
NODE_ENV="production"
EOF

echo -e "${GREEN}✅ simple-api/.env configuré${NC}"

# Configuration des variables d'environnement pour les apps web
echo -e "${YELLOW}⚙️  Configuration des apps web...${NC}"

for app in web-player web-admin web-studio web-screen; do
    cat > apps/$app/.env.local <<EOF
NEXT_PUBLIC_API_URL=https://api.arena-event.fr
EOF
    echo -e "${GREEN}✅ $app/.env.local configuré${NC}"
done

# Afficher le JWT secret
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔐 JWT SECRET GÉNÉRÉ:${NC}"
echo -e "${GREEN}${NEW_JWT_SECRET}${NC}"
echo -e "${RED}⚠️  SAUVEGARDE CE SECRET MAINTENANT !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Installation des dépendances
echo -e "${YELLOW}📦 Installation des dépendances du monorepo...${NC}"
npm install

echo -e "${YELLOW}📦 Installation des dépendances de simple-api...${NC}"
cd simple-api && npm install && cd ..

# Migration de la base de données
echo -e "${YELLOW}🗄️  Migration de la base de données Prisma...${NC}"
cd simple-api
npx prisma migrate deploy 2>/dev/null || echo -e "${YELLOW}Note: Migration déjà appliquée ou base non accessible${NC}"
npx prisma generate
cd ..

# Build des applications Next.js
echo -e "${YELLOW}🏗️  Build des applications web avec Turbo...${NC}"
npm run build

# Installer PM2 si nécessaire
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installé${NC}"
else
    echo -e "${GREEN}✅ PM2 déjà installé${NC}"
fi

# Arrêter les anciens processus PM2
echo -e "${YELLOW}🛑 Arrêt des anciens processus PM2...${NC}"
pm2 delete all 2>/dev/null || true

# Démarrer l'API simple-api avec PM2
echo -e "${YELLOW}🚀 Démarrage de simple-api (port 3001)...${NC}"
cd simple-api
pm2 start index.js --name "arena-api" --node-args="--experimental-modules"
cd ..

# Démarrer les applications web avec PM2
echo -e "${YELLOW}🚀 Démarrage des applications web...${NC}"

# Web Admin (port 3000)
cd apps/web-admin
pm2 start npm --name "arena-web-admin" -- start -- -p 3000
cd ../..

# Web Studio (port 3002)
cd apps/web-studio
pm2 start npm --name "arena-web-studio" -- start -- -p 3002
cd ../..

# Web Player (port 3003)
cd apps/web-player
pm2 start npm --name "arena-web-player" -- start -- -p 3003
cd ../..

# Web Screen (port 3004)
cd apps/web-screen
pm2 start npm --name "arena-web-screen" -- start -- -p 3004
cd ../..

# Sauvegarder la configuration PM2
pm2 save

# Attendre que les services démarrent
echo -e "${YELLOW}⏳ Attente du démarrage des services (15s)...${NC}"
sleep 15

# Afficher le statut
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📊 Statut des applications PM2:${NC}"
pm2 list
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DÉPLOIEMENT TERMINÉ !            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 Services disponibles:${NC}"
echo -e "  ${BLUE}•${NC} API:    ${GREEN}https://api.arena-event.fr${NC} (port 3001)"
echo -e "  ${BLUE}•${NC} Admin:  ${GREEN}https://admin.arena-event.fr${NC} (port 3000)"
echo -e "  ${BLUE}•${NC} Studio: ${GREEN}https://studio.arena-event.fr${NC} (port 3002)"
echo -e "  ${BLUE}•${NC} Player: ${GREEN}https://player.arena-event.fr${NC} (port 3003)"
echo -e "  ${BLUE}•${NC} Screen: ${GREEN}https://screen.arena-event.fr${NC} (port 3004)"
echo ""
echo -e "${YELLOW}📝 Commandes utiles:${NC}"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  pm2 logs                   # Tous les services"
echo "  pm2 logs arena-api         # API uniquement"
echo ""
echo -e "${BLUE}Redémarrer:${NC}"
echo "  pm2 restart arena-api      # API uniquement"
echo "  pm2 restart all            # Tous les services"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo "  pm2 monit                  # Dashboard interactif"
echo "  pm2 status                 # État des services"
echo ""
echo -e "${BLUE}Arrêter:${NC}"
echo "  pm2 stop all"
echo "  pm2 delete all"
echo ""
echo -e "${RED}⚠️  IMPORTANT:${NC}"
echo -e "  - PostgreSQL doit tourner sur localhost:5432"
echo -e "  - Redis doit tourner sur localhost:6379"
echo -e "  - Nginx doit router les domaines vers les ports ci-dessus"
echo -e "  - N'oublie pas de sauvegarder le JWT SECRET !"
echo ""
