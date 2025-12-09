#!/bin/bash

# Script de déploiement automatique pour le VPS
# Exécuter avec: bash deploy-vps-fixed.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement des corrections critiques Arena Event"
echo "=================================================="

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stash les changements locaux
echo -e "${YELLOW}📦 Sauvegarde des changements locaux...${NC}"
git stash

# Checkout la branche avec les corrections
echo -e "${YELLOW}🔀 Basculement vers la branche de correction...${NC}"
git checkout claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Pull les dernières modifications
echo -e "${YELLOW}⬇️  Récupération des modifications...${NC}"
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Générer un nouveau JWT secret sécurisé
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Configuration des variables d'environnement pour l'API
echo -e "${YELLOW}⚙️  Configuration de l'API...${NC}"

# Créer le fichier .env s'il n'existe pas
if [ ! -f "apps/api/.env" ]; then
    echo -e "${YELLOW}📝 Création du fichier apps/api/.env depuis .env.example...${NC}"
    cp apps/api/.env.example apps/api/.env
else
    # Backup de l'ancien .env
    BACKUP_FILE="apps/api/.env.backup.$(date +%Y%m%d_%H%M%S)"
    cp apps/api/.env "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup créé: $BACKUP_FILE${NC}"
fi

# Mettre à jour ou ajouter CORS_ORIGINS
if grep -q "^CORS_ORIGINS=" apps/api/.env; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://91.134.135.247:3002,http://91.134.135.247:3003,http://91.134.135.247:3004|" apps/api/.env
else
    echo "CORS_ORIGINS=http://91.134.135.247:3002,http://91.134.135.247:3003,http://91.134.135.247:3004" >> apps/api/.env
fi

# Mettre à jour le JWT_SECRET
if grep -q "^JWT_SECRET=" apps/api/.env; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT_SECRET}|" apps/api/.env
else
    echo "JWT_SECRET=${NEW_JWT_SECRET}" >> apps/api/.env
fi

# Mettre NODE_ENV en production
if grep -q "^NODE_ENV=" apps/api/.env; then
    sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" apps/api/.env
else
    echo "NODE_ENV=production" >> apps/api/.env
fi

echo -e "${GREEN}✅ API .env configuré${NC}"

# Configuration des variables d'environnement pour web-player
echo -e "${YELLOW}⚙️  Configuration du web-player...${NC}"
cat > apps/web-player/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF
echo -e "${GREEN}✅ Web-player .env.local configuré${NC}"

# Configuration des variables d'environnement pour web-admin
echo -e "${YELLOW}⚙️  Configuration du web-admin...${NC}"
cat > apps/web-admin/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF
echo -e "${GREEN}✅ Web-admin .env.local configuré${NC}"

# Configuration des variables d'environnement pour web-studio
echo -e "${YELLOW}⚙️  Configuration du web-studio...${NC}"
cat > apps/web-studio/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF
echo -e "${GREEN}✅ Web-studio .env.local configuré${NC}"

# Configuration des variables d'environnement pour web-screen
echo -e "${YELLOW}⚙️  Configuration du web-screen...${NC}"
cat > apps/web-screen/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF
echo -e "${GREEN}✅ Web-screen .env.local configuré${NC}"

# Afficher le nouveau JWT secret
echo -e "${YELLOW}🔐 Nouveau JWT Secret généré et configuré${NC}"
echo -e "${GREEN}JWT_SECRET=${NEW_JWT_SECRET}${NC}"
echo -e "${YELLOW}💾 Sauvegarde ce secret dans un endroit sûr !${NC}"

# Installation des dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install

# Démarrer PostgreSQL et Redis avec Docker
echo -e "${YELLOW}🐳 Démarrage de PostgreSQL et Redis...${NC}"
docker-compose up -d

# Attendre que les DB soient prêtes
echo -e "${YELLOW}⏳ Attente du démarrage de PostgreSQL et Redis (10s)...${NC}"
sleep 10

# Générer Prisma Client
echo -e "${YELLOW}🔧 Génération du Prisma Client...${NC}"
cd apps/api && npx prisma generate && cd ../..

# Migration de la base de données
echo -e "${YELLOW}🗄️  Migration de la base de données...${NC}"
cd apps/api && npx prisma migrate deploy && cd ../..

# Build toutes les applications
echo -e "${YELLOW}🏗️  Build des applications avec Turbo...${NC}"
npm run build

# Installer PM2 si non installé
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installation de PM2...${NC}"
    npm install -g pm2
fi

# Arrêter les anciens processus PM2 s'ils existent
echo -e "${YELLOW}🛑 Arrêt des anciens processus...${NC}"
pm2 delete all 2>/dev/null || true

# Démarrer les applications avec PM2
echo -e "${YELLOW}🚀 Démarrage des applications avec PM2...${NC}"

# API NestJS
cd apps/api
pm2 start npm --name "arena-api" -- run start:prod
cd ../..

# Web Player (Next.js)
cd apps/web-player
pm2 start npm --name "arena-web-player" -- start -- -p 3002
cd ../..

# Web Admin (Next.js)
cd apps/web-admin
pm2 start npm --name "arena-web-admin" -- start -- -p 3003
cd ../..

# Web Screen (Next.js)
cd apps/web-screen
pm2 start npm --name "arena-web-screen" -- start -- -p 3004
cd ../..

# Sauvegarder la config PM2
pm2 save

# Configurer PM2 pour démarrer au boot
echo -e "${YELLOW}⚙️  Configuration de PM2 pour démarrer au boot...${NC}"
pm2 startup systemd -u root --hp /root 2>/dev/null || echo -e "${YELLOW}Note: PM2 startup déjà configuré${NC}"

# Attendre que les services démarrent
echo -e "${YELLOW}⏳ Attente du démarrage des services (20s)...${NC}"
sleep 20

# Vérifier le health check
echo -e "${YELLOW}🏥 Vérification du health check...${NC}"
HEALTH_CHECK=$(curl -s http://localhost:3001/health || echo "failed")

if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check OK!${NC}"
    echo "$HEALTH_CHECK"
else
    echo -e "${RED}❌ Health check failed - l'API n'est peut-être pas encore prête${NC}"
    echo -e "${YELLOW}Vérifier les logs avec: pm2 logs arena-api${NC}"
fi

# Afficher le statut des containers et processus
echo -e "${YELLOW}📊 Statut des containers Docker:${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}📊 Statut des applications PM2:${NC}"
pm2 list

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Déploiement terminé!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}Services disponibles:${NC}"
echo "  - API: http://91.134.135.247:3001"
echo "  - Health: http://91.134.135.247:3001/health"
echo "  - Player: http://91.134.135.247:3002"
echo "  - Admin: http://91.134.135.247:3003"
echo "  - Screen: http://91.134.135.247:3004"
echo ""
echo -e "${YELLOW}Commandes utiles:${NC}"
echo ""
echo -e "${YELLOW}Voir les logs:${NC}"
echo "  pm2 logs                    # Tous les logs"
echo "  pm2 logs arena-api          # Logs API uniquement"
echo "  pm2 logs arena-web-player   # Logs Player uniquement"
echo "  docker-compose logs -f      # Logs PostgreSQL/Redis"
echo ""
echo -e "${YELLOW}Redémarrer un service:${NC}"
echo "  pm2 restart arena-api"
echo "  pm2 restart arena-web-player"
echo "  pm2 restart arena-web-admin"
echo "  pm2 restart arena-web-screen"
echo "  pm2 restart all"
echo ""
echo -e "${YELLOW}Arrêter tous les services:${NC}"
echo "  pm2 stop all"
echo "  docker-compose down"
echo ""
echo -e "${YELLOW}Monitoring:${NC}"
echo "  pm2 monit"
echo ""
