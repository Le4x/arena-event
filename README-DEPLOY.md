# Guide de Déploiement Arena Event

## 📋 Prérequis

- Accès SSH au VPS (root@91.134.135.247)
- PM2 installé sur le VPS
- Node.js 18+ et npm 9+ installés sur le VPS

## 🚀 Méthodes de Déploiement

### Méthode 1 : Script Automatique (Recommandé)

Le moyen le plus simple pour déployer vos changements :

```bash
./deploy.sh
```

Ce script va :
1. Se connecter au VPS via SSH
2. Pull les derniers changements de la branche
3. Installer les dépendances
4. Build l'API et l'admin
5. Appliquer les migrations de base de données
6. Redémarrer tous les services

### Méthode 2 : Déploiement Manuel

Si vous préférez contrôler chaque étape :

```bash
# 1. Se connecter au VPS
ssh root@91.134.135.247

# 2. Aller dans le répertoire du projet
cd /arena-event

# 3. Pull les changements
git checkout claude/add-admin-user-management-016HCRecgd7wm6tfS7Aj4ndS
git pull

# 4. Installer les dépendances
npm install

# 5. Build l'API NestJS
cd apps/api
npm run db:generate
npm run db:migrate:deploy
npm run build
cd ../..

# 6. Build l'admin (si nécessaire)
cd apps/web-admin
npm run build
cd ../..

# 7. Redémarrer les services avec PM2
pm2 restart all

# Ou redémarrer individuellement :
pm2 restart arena-api
pm2 restart arena-admin
```

### Méthode 3 : Premier Déploiement avec PM2

Si c'est la première fois ou si PM2 n'est pas configuré :

```bash
# Sur le VPS
cd /arena-event

# Installer PM2 globalement (si pas déjà fait)
npm install -g pm2

# Démarrer tous les services
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Configurer PM2 pour démarrer au boot
pm2 startup
```

## 🔍 Vérification du Déploiement

```bash
# Sur le VPS - Vérifier le statut des services
pm2 status

# Voir les logs en temps réel
pm2 logs

# Voir les logs d'un service spécifique
pm2 logs arena-api
pm2 logs arena-admin

# Monitorer les performances
pm2 monit
```

## 🌐 URLs de l'Application

Après le déploiement, vos applications sont accessibles à :

- **Admin Interface**: http://91.134.135.247:3000 ou https://api.arena-event.fr
- **API**: http://91.134.135.247:3001 ou https://api.arena-event.fr/api
- **Studio**: http://91.134.135.247:3002
- **Player**: http://91.134.135.247:3003
- **Screen**: http://91.134.135.247:3004

## 🐛 Dépannage

### Le build échoue

```bash
# Nettoyer et réinstaller les dépendances
npm run clean
npm install
```

### PM2 ne fonctionne pas

```bash
# Vérifier si PM2 est installé
pm2 --version

# Réinstaller PM2
npm install -g pm2

# Redémarrer tous les processus
pm2 restart all
```

### Problème de base de données

```bash
cd apps/api

# Vérifier l'état des migrations
npx prisma migrate status

# Appliquer les migrations manuellement
npx prisma migrate deploy

# Regénérer le client Prisma
npx prisma generate
```

### Voir les erreurs détaillées

```bash
# Logs de l'API
pm2 logs arena-api --lines 100

# Logs de l'admin
pm2 logs arena-admin --lines 100

# Logs de tous les services
pm2 logs --lines 50
```

## 🔄 Rollback en cas de problème

Si le déploiement cause des problèmes :

```bash
# Sur le VPS
cd /arena-event

# Revenir au commit précédent
git log --oneline -10  # Voir les commits récents
git checkout <commit-hash>  # Remplacer par le hash du commit stable

# Redémarrer les services
pm2 restart all
```

## 📝 Notes Importantes

1. **Toujours tester localement** avant de déployer en production
2. **Faire un backup de la base de données** avant les migrations importantes
3. **Surveiller les logs** après un déploiement pour détecter les erreurs
4. **Utiliser les branches** : déployez depuis `main` en production, testez sur des branches de feature

## 🆘 Support

En cas de problème :
1. Vérifier les logs : `pm2 logs`
2. Vérifier le statut : `pm2 status`
3. Redémarrer les services : `pm2 restart all`
4. Vérifier les variables d'environnement dans les fichiers `.env`
