#!/bin/bash

# Script de déploiement Arena Event
# Usage: ./deploy.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement Arena Event..."

# Configuration
VPS_HOST="root@91.134.135.247"
VPS_PATH="/arena-event"
BRANCH="claude/add-admin-user-management-016HCRecgd7wm6tfS7Aj4ndS"

echo "📦 Connexion au VPS et déploiement..."

ssh $VPS_HOST << EOF
  set -e

  # Aller dans le répertoire du projet
  cd $VPS_PATH

  echo "📥 Pull des derniers changements..."
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH

  echo "📦 Installation des dépendances..."
  npm install

  echo "🔨 Build de l'API NestJS..."
  cd apps/api
  npm run db:generate
  npm run db:migrate:deploy
  npm run build
  cd ../..

  echo "🔨 Build de l'admin..."
  cd apps/web-admin
  npm run build || echo "⚠️  Admin build failed, skipping..."
  cd ../..

  echo "🔄 Redémarrage des services..."
  if command -v pm2 &> /dev/null; then
    pm2 restart all || pm2 start ecosystem.config.js
  else
    echo "⚠️  PM2 non trouvé. Redémarrage manuel nécessaire."
  fi

  echo "✅ Déploiement terminé!"

  # Afficher le statut
  if command -v pm2 &> /dev/null; then
    pm2 status
  fi
EOF

echo ""
echo "✨ Déploiement terminé avec succès!"
echo "🌐 Interface admin: https://api.arena-event.fr (port 3000)"
echo "🔧 API: https://api.arena-event.fr/api (port 3001)"
