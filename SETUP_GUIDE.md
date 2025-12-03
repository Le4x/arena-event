# 🚀 Arena Event - Guide de Configuration Complet

## 📖 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Configuration DNS](#configuration-dns)
3. [Déploiement sur VPS](#déploiement-sur-vps)
4. [Configuration Locale (Développement)](#configuration-locale-développement)
5. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Arena Event est maintenant configuré pour fonctionner avec votre domaine **arena-event.com**.

### Architecture des Services

| Service | Production | Développement |
|---------|-----------|---------------|
| Admin | https://admin.arena-event.com | http://localhost:3000 |
| API | https://api.arena-event.com | http://localhost:3001 |
| Studio | https://studio.arena-event.com | http://localhost:3002 |
| Player | https://player.arena-event.com | http://localhost:3003 |
| Screen | https://screen.arena-event.com | http://localhost:3004 |

---

## 🌐 Configuration DNS

Configurez ces enregistrements DNS chez votre registrar (OVH, Gandi, etc.) :

```
Type    Nom         Valeur                      TTL
A       @           [IP_DE_VOTRE_VPS]          3600
A       admin       [IP_DE_VOTRE_VPS]          3600
A       api         [IP_DE_VOTRE_VPS]          3600
A       studio      [IP_DE_VOTRE_VPS]          3600
A       player      [IP_DE_VOTRE_VPS]          3600
A       screen      [IP_DE_VOTRE_VPS]          3600
CNAME   www         arena-event.com.           3600
```

⏱️ **Propagation DNS** : Peut prendre de 5 minutes à 24 heures

---

## 🖥️ Déploiement sur VPS

### Option 1 : Déploiement Automatique (Recommandé)

```bash
# 1. Connexion au VPS
ssh root@[IP_DE_VOTRE_VPS]

# 2. Cloner le projet
cd /root
git clone https://github.com/Le4x/arena-event.git
cd arena-event
git checkout claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt

# 3. Configuration production
chmod +x update-env-production.sh
./update-env-production.sh

# 4. Déploiement complet
chmod +x deploy.sh
sudo ./deploy.sh
```

Le script va tout installer automatiquement :
- ✅ Node.js 20.x
- ✅ PostgreSQL 16
- ✅ Nginx (reverse proxy)
- ✅ PM2 (process manager)
- ✅ Configuration et lancement des apps

### Option 2 : Installation Manuelle

#### 1. Prérequis
```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2
sudo npm install -g pm2
```

#### 2. Base de données
```bash
sudo -u postgres psql << EOF
CREATE DATABASE arena_event;
CREATE USER arena_user WITH ENCRYPTED PASSWORD 'ArenaEvent2024!';
GRANT ALL PRIVILEGES ON DATABASE arena_event TO arena_user;
ALTER DATABASE arena_event OWNER TO arena_user;
EOF
```

#### 3. Installation
```bash
cd /root/arena-event

# Installer les dépendances
npm install
cd simple-api && npm install && cd ..

# Build des applications
cd apps/web-admin && npm install && npm run build && cd ../..
cd apps/web-player && npm install && npm run build && cd ../..
cd apps/web-screen && npm install && npm run build && cd ../..
cd apps/web-studio && npm install && npm run build && cd ../..

# Migrations de base
cd simple-api
npx prisma migrate deploy
npx prisma generate
cd ..
```

#### 4. Lancer avec PM2
```bash
# Créer le fichier ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'arena-api',
      cwd: './simple-api',
      script: 'index.js',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3001 }
    },
    {
      name: 'arena-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'arena-studio',
      cwd: './apps/web-studio',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3002 }
    },
    {
      name: 'arena-player',
      cwd: './apps/web-player',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3003 }
    },
    {
      name: 'arena-screen',
      cwd: './apps/web-screen',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3004',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3004 }
    }
  ]
};
EOF

# Démarrer
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Installation SSL (HTTPS)

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir les certificats
sudo certbot --nginx -d arena-event.com \
  -d www.arena-event.com \
  -d admin.arena-event.com \
  -d api.arena-event.com \
  -d studio.arena-event.com \
  -d player.arena-event.com \
  -d screen.arena-event.com
```

---

## 💻 Configuration Locale (Développement)

### 1. Prérequis
- Node.js 18+ ou 20+
- PostgreSQL 14+
- npm ou yarn

### 2. Installation

```bash
# Cloner le projet
git clone https://github.com/Le4x/arena-event.git
cd arena-event

# Installer les dépendances
npm install
cd simple-api && npm install && cd ..
```

### 3. Configuration

Les fichiers `.env` sont déjà créés avec les bonnes valeurs pour le développement local :
- `simple-api/.env` → API backend
- `apps/web-admin/.env.local` → Dashboard admin
- `apps/web-player/.env.local` → Interface joueur
- `apps/web-screen/.env.local` → Écran de projection
- `apps/web-studio/.env.local` → Studio de contrôle

### 4. Base de données

```bash
# Créer la base de données
createdb arena_event

# OU via psql
psql postgres -c "CREATE DATABASE arena_event;"

# Lancer les migrations
cd simple-api
npx prisma migrate dev
npx prisma generate
cd ..
```

### 5. Lancement

```bash
# Terminal 1 : API
cd simple-api
node index.js

# Terminal 2 : Admin
cd apps/web-admin
npm run dev

# Terminal 3 : Studio
cd apps/web-studio
npm run dev

# Terminal 4 : Player
cd apps/web-player
npm run dev

# Terminal 5 : Screen
cd apps/web-screen
npm run dev
```

Ou avec PM2 localement :
```bash
pm2 start ecosystem.config.js
pm2 logs
```

---

## 🔍 Vérifications

### Vérifier les services

```bash
# PM2
pm2 status
pm2 logs

# Ports ouverts
netstat -tulpn | grep -E '3000|3001|3002|3003|3004'

# Nginx
sudo systemctl status nginx
sudo nginx -t

# PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"
```

### Tester les URLs

```bash
# En local
curl http://localhost:3001/health
curl http://localhost:3000

# En production
curl https://api.arena-event.com/health
curl https://admin.arena-event.com
```

---

## 🐛 Dépannage

### Les applications ne démarrent pas

```bash
# Voir les logs détaillés
pm2 logs --lines 100

# Redémarrer un service
pm2 restart arena-api
pm2 restart arena-admin

# Vérifier que les ports sont libres
lsof -i :3001
lsof -i :3000
```

### Erreur de connexion à la base de données

```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql

# Tester la connexion
psql -U arena_user -d arena_event -h localhost -W

# Recréer les migrations
cd simple-api
npx prisma migrate reset
npx prisma migrate deploy
```

### Erreur CORS / API non accessible

```bash
# Vérifier l'API
curl http://localhost:3001/health

# Vérifier les variables d'environnement
cat apps/web-admin/.env.local
cat simple-api/.env

# Vérifier Nginx (en production)
sudo nginx -t
sudo systemctl restart nginx
```

### DNS ne fonctionne pas

```bash
# Tester la résolution DNS
nslookup admin.arena-event.com
dig admin.arena-event.com

# Vérifier la propagation DNS
# https://dnschecker.org
```

### Réinitialiser complètement

```bash
# Arrêter tout
pm2 delete all

# Nettoyer
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf apps/*/.next
rm -rf simple-api/node_modules

# Réinstaller
npm install
cd simple-api && npm install && cd ..

# Rebuild
cd apps/web-admin && npm install && npm run build && cd ../..
cd apps/web-player && npm install && npm run build && cd ../..
cd apps/web-screen && npm install && npm run build && cd ../..
cd apps/web-studio && npm install && npm run build && cd ../..

# Relancer
pm2 start ecosystem.config.js
```

---

## 📱 Utilisation

### 1. Créer un événement
1. Accédez à https://admin.arena-event.com
2. Créez un événement
3. Ajoutez des rounds et questions

### 2. Lancer une session
1. Créez une session depuis l'admin
2. Notez le code de session (ex: ABC123)

### 3. Studio de contrôle
1. Ouvrez https://studio.arena-event.com
2. Sélectionnez votre session
3. Contrôlez le jeu depuis le studio

### 4. Écran de projection
1. Ouvrez https://screen.arena-event.com sur un écran/projecteur
2. Sélectionnez votre session
3. L'écran affichera le jeu en temps réel

### 5. Joueurs
1. Les joueurs vont sur https://player.arena-event.com
2. Entrent le code de session
3. Créent leur équipe
4. Jouent !

---

## 🔐 Sécurité

### Changements obligatoires en production

```bash
# 1. Changer le JWT secret
nano simple-api/.env
# Générer un nouveau secret :
openssl rand -base64 32

# 2. Changer le mot de passe PostgreSQL
sudo -u postgres psql
ALTER USER arena_user WITH PASSWORD 'NOUVEAU_MOT_DE_PASSE_FORT';
# Puis mettre à jour dans simple-api/.env

# 3. Configurer le firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 📊 Monitoring

```bash
# Utilisation CPU/RAM
htop

# Espace disque
df -h

# Logs en temps réel
pm2 logs --lines 50

# Status des services
pm2 status

# Redémarrer automatiquement si crash
pm2 resurrect
```

---

## 📞 Support

- 📧 Issues GitHub : https://github.com/Le4x/arena-event/issues
- 📖 Documentation : [README.md](./README.md)
- 🏗️ Architecture : [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**Bon jeu ! 🎮**
