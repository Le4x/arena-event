# VPS Deployment - Arena Event

## Informations du Serveur

| Specification | Value |
|---------------|-------|
| **IP Publique** | `91.134.135.247` |
| **OS** | Ubuntu 22.04 LTS |
| **vCores** | 6 |
| **RAM** | 12 Go |
| **Stockage** | 100 Go NVMe |
| **Bande passante** | 1 Gbit/s |

---

## URLs des Applications

| Application | URL | Port |
|-------------|-----|------|
| **Admin Dashboard** | http://91.134.135.247:3000 | 3000 |
| **API Backend** | http://91.134.135.247:3001 | 3001 |
| **Studio (Regie)** | http://91.134.135.247:3002 | 3002 |
| **Player (Mobile)** | http://91.134.135.247:3003 | 3003 |
| **Screen (Affichage)** | http://91.134.135.247:3004 | 3004 |

---

## Identifiants

### Utilisateurs Demo

| Role | Email | Mot de passe |
|------|-------|--------------|
| **Admin** | `admin@arena-event.com` | `admin123` |
| **Organizer** | `organizer@arena-event.com` | `organizer123` |

### Base de donnees

| Service | Valeur |
|---------|--------|
| **Type** | PostgreSQL 16 |
| **Database** | `arena_event` |
| **User** | `arena` |
| **Password** | `arena123` |
| **Port** | `5432` |
| **URL** | `postgresql://arena:arena123@localhost:5432/arena_event?schema=public` |

### Redis

| Service | Valeur |
|---------|--------|
| **Host** | `localhost` |
| **Port** | `6379` |

---

## Structure des Fichiers

```
/root/arena-event/
├── apps/
│   ├── api/                 # API NestJS (port 3001)
│   ├── web-admin/           # Admin Dashboard (port 3000)
│   ├── web-studio/          # Regie/Studio (port 3002)
│   ├── web-player/          # Application joueur (port 3003)
│   └── web-screen/          # Affichage public (port 3004)
├── packages/
│   ├── shared/              # Types partages
│   ├── ui/                  # Composants React
│   └── config/              # Configurations
├── simple-api/              # API Express simplifiee
│   ├── index.js
│   └── package.json
└── docker-compose.yml       # PostgreSQL + Redis
```

---

## Commandes de Gestion

### Demarrer tous les services

```bash
# 1. Demarrer Docker (PostgreSQL + Redis)
cd ~/arena-event && docker-compose up -d

# 2. Demarrer l'API
cd ~/arena-event/simple-api && node index.js &

# 3. Demarrer les frontends (dans des terminaux separes ou avec &)
cd ~/arena-event/apps/web-admin && npm run dev &
cd ~/arena-event/apps/web-studio && npm run dev &
cd ~/arena-event/apps/web-player && npm run dev &
cd ~/arena-event/apps/web-screen && npm run dev &
```

### Arreter tous les services

```bash
# Arreter les applications Node.js
pkill -f "next dev"
pkill -f "node index.js"

# Arreter Docker
cd ~/arena-event && docker-compose down
```

### Redemarrer un service specifique

```bash
# API
pkill -f "node index.js"
cd ~/arena-event/simple-api && node index.js &

# Admin Dashboard
pkill -f "next dev -p 3000"
cd ~/arena-event/apps/web-admin && npm run dev &

# Studio
pkill -f "next dev -p 3002"
cd ~/arena-event/apps/web-studio && npm run dev &

# Player
pkill -f "next dev -p 3003"
cd ~/arena-event/apps/web-player && npm run dev &

# Screen
pkill -f "next dev -p 3004"
cd ~/arena-event/apps/web-screen && npm run dev &
```

### Verifier l'etat des services

```bash
# Verifier les ports en ecoute
ss -tlnp | grep -E "300[0-4]"

# Verifier Docker
docker ps

# Tester l'API
curl http://localhost:3001/health

# Verifier les logs Docker
docker-compose logs -f
```

---

## Configuration Firewall (UFW)

Les ports suivants sont ouverts :

```bash
# Verification
sudo ufw status

# Ports ouverts:
# 22/tcp     - SSH
# 80/tcp     - HTTP
# 443/tcp    - HTTPS
# 3000/tcp   - Admin Dashboard
# 3001/tcp   - API
# 3002/tcp   - Studio
# 3003/tcp   - Player
# 3004/tcp   - Screen
```

Pour ajouter un nouveau port :
```bash
sudo ufw allow <port>/tcp
```

---

## Variables d'Environnement

### API (`~/arena-event/apps/api/.env`)

```env
DATABASE_URL="postgresql://arena:arena123@localhost:5432/arena_event?schema=public"
JWT_SECRET="arena-event-super-secret-jwt-key-change-in-production-2024"
JWT_EXPIRES_IN="7d"
REDIS_HOST="localhost"
REDIS_PORT=6379
PORT=3001
NODE_ENV="development"
```

### Simple API (`~/arena-event/simple-api/index.js`)

Les variables sont definies directement dans le fichier :
- `JWT_SECRET`: Meme valeur que l'API
- `JWT_EXPIRES_IN`: 7 jours
- `PORT`: 3001

---

## Base de Donnees

### Commandes Prisma

```bash
cd ~/arena-event/apps/api

# Generer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Reseed la base de donnees
npx prisma db seed

# Ouvrir Prisma Studio (interface web)
npx prisma studio
```

### Acces PostgreSQL

```bash
# Via Docker
docker exec -it arena-postgres psql -U arena -d arena_event

# Commandes utiles
\dt          # Liste des tables
\d+ users    # Structure de la table users
SELECT * FROM "User";  # Voir les utilisateurs
```

---

## Troubleshooting

### L'API ne demarre pas

1. Verifier que Docker est lance :
   ```bash
   docker ps
   ```

2. Verifier la connexion PostgreSQL :
   ```bash
   docker exec -it arena-postgres psql -U arena -d arena_event -c "SELECT 1"
   ```

3. Verifier les logs :
   ```bash
   cd ~/arena-event/simple-api && node index.js
   ```

### Les frontends ne demarrent pas

1. Verifier que les dependances sont installees :
   ```bash
   cd ~/arena-event && npm install
   ```

2. Verifier les ports libres :
   ```bash
   ss -tlnp | grep 300
   ```

3. Tuer les processus zombie :
   ```bash
   pkill -f "next dev"
   ```

### Erreur de connexion a la base de donnees

1. Verifier Docker :
   ```bash
   docker-compose logs postgres
   ```

2. Regenerer le client Prisma :
   ```bash
   cd ~/arena-event/apps/api && npx prisma generate
   ```

### Page blanche ou erreur CORS

1. Verifier que l'API tourne :
   ```bash
   curl http://localhost:3001/health
   ```

2. Verifier l'IP dans les fichiers frontend :
   - `apps/web-admin/src/app/page.tsx` - Variable API_URL

### Reinitialiser completement

```bash
# Arreter tout
pkill -f "next dev"
pkill -f "node index.js"
docker-compose down -v

# Nettoyer
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf simple-api/node_modules

# Reinstaller
npm install
cd simple-api && npm install && cd ..

# Redemarrer Docker
docker-compose up -d

# Attendre 10 secondes
sleep 10

# Regenerer et migrer
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && cd ../..

# Demarrer
cd simple-api && node index.js &
cd ../apps/web-admin && npm run dev &
cd ../web-studio && npm run dev &
cd ../web-player && npm run dev &
cd ../web-screen && npm run dev &
```

---

## Scripts de Demarrage Automatique

### Script de demarrage (`~/start-arena.sh`)

```bash
#!/bin/bash

echo "Starting Arena Event..."

# Start Docker services
cd ~/arena-event
docker-compose up -d

# Wait for PostgreSQL
sleep 5

# Start API
cd ~/arena-event/simple-api
nohup node index.js > ~/logs/api.log 2>&1 &

# Start frontends
cd ~/arena-event/apps/web-admin
nohup npm run dev > ~/logs/admin.log 2>&1 &

cd ~/arena-event/apps/web-studio
nohup npm run dev > ~/logs/studio.log 2>&1 &

cd ~/arena-event/apps/web-player
nohup npm run dev > ~/logs/player.log 2>&1 &

cd ~/arena-event/apps/web-screen
nohup npm run dev > ~/logs/screen.log 2>&1 &

echo "All services started!"
echo "Admin: http://91.134.135.247:3000"
echo "API: http://91.134.135.247:3001"
echo "Studio: http://91.134.135.247:3002"
echo "Player: http://91.134.135.247:3003"
echo "Screen: http://91.134.135.247:3004"
```

Pour creer ce script :
```bash
mkdir -p ~/logs
cat > ~/start-arena.sh << 'EOF'
# Contenu du script ci-dessus
EOF
chmod +x ~/start-arena.sh
```

### Script d'arret (`~/stop-arena.sh`)

```bash
#!/bin/bash

echo "Stopping Arena Event..."

pkill -f "next dev"
pkill -f "node index.js"
cd ~/arena-event && docker-compose down

echo "All services stopped!"
```

---

## Securite - A Faire en Production

- [ ] Changer `JWT_SECRET` par une vraie cle secrete
- [ ] Changer les mots de passe par defaut (admin123, organizer123, arena123)
- [ ] Configurer HTTPS avec Let's Encrypt
- [ ] Mettre en place un reverse proxy (Nginx)
- [ ] Activer les backups automatiques PostgreSQL
- [ ] Configurer fail2ban pour SSH
- [ ] Mettre a jour regulierement le systeme

---

## Support

Pour tout probleme :
1. Verifier les logs : `~/logs/`
2. Verifier Docker : `docker-compose logs`
3. Verifier les ports : `ss -tlnp`

---

**Derniere mise a jour :** Novembre 2024
