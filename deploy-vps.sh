#!/bin/bash

# Script de déploiement automatique pour le VPS
# Exécuter avec: bash deploy-vps.sh

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

# Vérifier si le fichier .env existe
if [ ! -f "apps/api/.env" ]; then
    echo -e "${RED}❌ Fichier apps/api/.env non trouvé${NC}"
    exit 1
fi

# Backup de l'ancien .env
cp apps/api/.env apps/api/.env.backup.$(date +%Y%m%d_%H%M%S)

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

echo -e "${GREEN}✅ API .env configuré${NC}"

# Configuration des variables d'environnement pour web-player
echo -e "${YELLOW}⚙️  Configuration du web-player...${NC}"

# Créer le fichier .env.local pour web-player s'il n'existe pas
cat > apps/web-player/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF

echo -e "${GREEN}✅ Web-player .env.local configuré${NC}"

# Configuration des variables d'environnement pour web-gamemaster
echo -e "${YELLOW}⚙️  Configuration du web-gamemaster...${NC}"

cat > apps/web-gamemaster/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF

echo -e "${GREEN}✅ Web-gamemaster .env.local configuré${NC}"

# Configuration des variables d'environnement pour web-screen
echo -e "${YELLOW}⚙️  Configuration du web-screen...${NC}"

cat > apps/web-screen/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF

echo -e "${GREEN}✅ Web-screen .env.local configuré${NC}"

# Afficher le nouveau JWT secret
echo -e "${YELLOW}🔐 Nouveau JWT Secret généré et configuré${NC}"
echo -e "${GREEN}JWT_SECRET=${NEW_JWT_SECRET}${NC}"

# Installation des dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install

# Rebuild et redémarrage avec Docker
echo -e "${YELLOW}🐳 Rebuild et redémarrage des containers Docker...${NC}"

# Arrêter les containers
docker-compose down

# Rebuild les images
docker-compose build

# Redémarrer en mode détaché
docker-compose up -d

# Attendre que les services démarrent
echo -e "${YELLOW}⏳ Attente du démarrage des services (30s)...${NC}"
sleep 30

# Vérifier le health check
echo -e "${YELLOW}🏥 Vérification du health check...${NC}"
HEALTH_CHECK=$(curl -s http://localhost:3001/health || echo "failed")

if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check OK!${NC}"
    echo "$HEALTH_CHECK"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo -e "${YELLOW}Logs de l'API:${NC}"
    docker-compose logs api | tail -20
fi

# Afficher le statut des containers
echo -e "${YELLOW}📊 Statut des containers:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Déploiement terminé!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}Services disponibles:${NC}"
echo "  - API: http://91.134.135.247:3001"
echo "  - Health: http://91.134.135.247:3001/health"
echo "  - Player: http://91.134.135.247:3002"
echo "  - GameMaster: http://91.134.135.247:3003"
echo "  - Screen: http://91.134.135.247:3004"
echo ""
echo -e "${YELLOW}Voir les logs:${NC}"
echo "  docker-compose logs -f"
echo ""
echo -e "${YELLOW}Redémarrer un service:${NC}"
echo "  docker-compose restart [api|web-player|web-gamemaster|web-screen]"
echo ""
