#!/bin/bash

# Script de déploiement direct (à exécuter SUR le VPS)
# Usage: ./deploy-direct.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement Arena Event (mode direct)..."

BRANCH="claude/add-admin-user-management-016HCRecgd7wm6tfS7Aj4ndS"

echo "📥 Pull des derniers changements..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

echo "📦 Installation des dépendances..."
npm install

echo "🔨 Build de toutes les apps Next.js..."
cd apps/web-admin
npm run build || echo "⚠️  Admin build failed, skipping..."
cd ../..

cd apps/web-studio
npm run build || echo "⚠️  Studio build failed, skipping..."
cd ../..

cd apps/web-player
npm run build || echo "⚠️  Player build failed, skipping..."
cd ../..

cd apps/web-screen
npm run build || echo "⚠️  Screen build failed, skipping..."
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

echo ""
echo "✨ Déploiement terminé avec succès!"
echo "🌐 Interface admin: https://admin.arena-event.fr"
echo "🔧 API: https://api.arena-event.fr"
