#!/bin/bash
# Script de déploiement de la landing page Arena Event

set -e

echo "🌐 Déploiement Landing Page Arena Event"
echo "========================================"
echo ""

# 1. Aller dans le répertoire
cd ~/arena-event || { echo "❌ Répertoire non trouvé"; exit 1; }
echo "✅ Répertoire: $(pwd)"

# 2. Récupérer le code
echo ""
echo "📥 Récupération du code..."
git fetch origin
git reset --hard origin/claude/fix-realtime-features-01SAQ2g8UCvGiTARwcyxjYWA
echo "✅ Code mis à jour"

# 3. Installer les dépendances
echo ""
echo "📦 Installation des dépendances landing..."
cd apps/web-landing
npm install
echo "✅ Dépendances installées"

# 4. Build
echo ""
echo "🔨 Build de la landing page..."
npm run build
cd ../..
echo "✅ Build terminé"

# 5. Démarrer avec PM2
echo ""
echo "🚀 Démarrage avec PM2..."
pm2 start ecosystem.config.js --only arena-landing || pm2 restart arena-landing
sleep 2
echo "✅ Landing démarrée"

# 6. Vérifier
echo ""
echo "📊 Statut:"
pm2 list | grep landing

echo ""
echo "✅ DÉPLOIEMENT TERMINÉ!"
echo ""
echo "📝 La landing page tourne sur le port 3005"
echo "   Configurez votre reverse proxy pour pointer arena-event.fr → :3005"
echo ""
echo "🔗 URLs configurées:"
echo "   - arena-event.fr → Landing (PORT 3005)"
echo "   - admin.arena-event.fr → Admin (PORT 3000)"
echo "   - studio.arena-event.fr → Studio (PORT 3002)"
echo "   - player.arena-event.fr → Player (PORT 3003)"
echo "   - screen.arena-event.fr → Screen (PORT 3004)"
echo "   - api.arena-event.fr → API (PORT 3001)"
echo ""
