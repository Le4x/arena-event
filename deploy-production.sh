#!/bin/bash

# Script de déploiement PRODUCTION - Arena Event
# Utilise: simple-api + PM2 + Nginx + Docker (PostgreSQL/Redis)
# Domaines: arena-event.fr

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement PRODUCTION - Arena Event"
echo "========================================"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Ce script doit être exécuté en tant que root${NC}"
  echo "Utilise: sudo bash deploy-production.sh"
  exit 1
fi

echo -e "${BLUE}🔍 Vérification de l'environnement...${NC}"

# Stash les changements locaux
echo -e "${YELLOW}📦 Sauvegarde des changements locaux...${NC}"
git stash

# Checkout la branche avec les corrections
echo -e "${YELLOW}🔀 Basculement vers la branche de correction...${NC}"
git checkout claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Pull les dernières modifications
echo -e "${YELLOW}⬇️  Récupération des modifications...${NC}"
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Installation de Docker si nécessaire
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installation de Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✅ Docker installé${NC}"
else
    echo -e "${GREEN}✅ Docker déjà installé${NC}"
fi

# Installation de Docker Compose si nécessaire
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}🐳 Installation de Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installé${NC}"
else
    echo -e "${GREEN}✅ Docker Compose déjà installé${NC}"
fi

# Générer un nouveau JWT secret sécurisé
echo -e "${YELLOW}🔐 Génération du JWT Secret...${NC}"
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Configuration .env pour simple-api
echo -e "${YELLOW}⚙️  Configuration de simple-api/.env...${NC}"

cat > simple-api/.env <<EOF
# Database
DATABASE_URL="postgresql://arena:arena123@localhost:5432/arena_event?schema=public"

# JWT - SECRET GÉNÉRÉ
JWT_SECRET="${NEW_JWT_SECRET}"
JWT_EXPIRES_IN="7d"

# Redis
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
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔐 JWT SECRET GÉNÉRÉ:${NC}"
echo -e "${GREEN}${NEW_JWT_SECRET}${NC}"
echo -e "${RED}⚠️  SAUVEGARDE CE SECRET IMMÉDIATEMENT !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Installation des dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install

echo -e "${YELLOW}📦 Installation des dépendances de simple-api...${NC}"
cd simple-api && npm install && cd ..

# Démarrer PostgreSQL et Redis avec Docker
echo -e "${YELLOW}🐳 Démarrage de PostgreSQL et Redis (Docker)...${NC}"
docker-compose down 2>/dev/null || true
docker-compose up -d

# Attendre que PostgreSQL soit prêt
echo -e "${YELLOW}⏳ Attente du démarrage de PostgreSQL...${NC}"
for i in {1..30}; do
    if docker exec arena-event-postgres pg_isready -U arena &>/dev/null; then
        echo -e "${GREEN}✅ PostgreSQL est prêt${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# Migration de la base de données
echo -e "${YELLOW}🗄️  Migration de la base de données Prisma...${NC}"
cd simple-api
npx prisma migrate deploy
npx prisma generate
cd ..

# Build des applications Next.js
echo -e "${YELLOW}🏗️  Build des applications web...${NC}"
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

# Configurer PM2 pour démarrer au boot
echo -e "${YELLOW}⚙️  Configuration de PM2 au démarrage système...${NC}"
pm2 startup systemd -u root --hp /root 2>/dev/null || echo -e "${YELLOW}PM2 startup déjà configuré${NC}"

# Attendre que les services démarrent
echo -e "${YELLOW}⏳ Attente du démarrage des services (20s)...${NC}"
sleep 20

# Vérifier les services
echo -e "${YELLOW}🏥 Vérification des services...${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📊 Statut des services Docker:${NC}"
docker-compose ps
echo ""
echo -e "${YELLOW}📊 Statut des applications PM2:${NC}"
pm2 list
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DÉPLOIEMENT TERMINÉ !            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 Services disponibles:${NC}"
echo -e "  ${BLUE}•${NC} API:    ${GREEN}https://api.arena-event.fr${NC}"
echo -e "  ${BLUE}•${NC} Admin:  ${GREEN}https://admin.arena-event.fr${NC}"
echo -e "  ${BLUE}•${NC} Studio: ${GREEN}https://studio.arena-event.fr${NC}"
echo -e "  ${BLUE}•${NC} Player: ${GREEN}https://player.arena-event.fr${NC}"
echo -e "  ${BLUE}•${NC} Screen: ${GREEN}https://screen.arena-event.fr${NC}"
echo ""
echo -e "${YELLOW}📝 Commandes utiles:${NC}"
echo ""
echo -e "${BLUE}Logs en temps réel:${NC}"
echo "  pm2 logs                   # Tous les services"
echo "  pm2 logs arena-api         # API uniquement"
echo "  pm2 logs arena-web-player  # Player uniquement"
echo "  docker-compose logs -f     # PostgreSQL/Redis"
echo ""
echo -e "${BLUE}Redémarrer un service:${NC}"
echo "  pm2 restart arena-api"
echo "  pm2 restart arena-web-admin"
echo "  pm2 restart arena-web-studio"
echo "  pm2 restart arena-web-player"
echo "  pm2 restart arena-web-screen"
echo "  pm2 restart all"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo "  pm2 monit                  # Dashboard interactif"
echo "  pm2 status                 # État des services"
echo ""
echo -e "${BLUE}Arrêter tout:${NC}"
echo "  pm2 stop all"
echo "  docker-compose down"
echo ""
echo -e "${RED}⚠️  N'OUBLIE PAS DE SAUVEGARDER LE JWT SECRET CI-DESSUS !${NC}"
echo ""
