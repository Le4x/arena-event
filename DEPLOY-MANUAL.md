# 🚀 Guide de Déploiement Manuel VPS

Si le script automatique ne fonctionne pas, voici les commandes à exécuter manuellement.

## Option A : Script Automatique (Recommandé)

```bash
cd ~/arena-event
bash deploy-vps.sh
```

---

## Option B : Étapes Manuelles

### 1. Récupérer les modifications

```bash
cd ~/arena-event

# Sauvegarder les changements locaux
git stash

# Basculer vers la branche de correction
git checkout claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7

# Récupérer les modifications
git pull origin claude/fix-websocket-events-01UiZ6CAxLqWz4odvQtNSsM7
```

### 2. Générer un nouveau JWT Secret

```bash
# Générer un nouveau secret sécurisé
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "Nouveau JWT Secret: $NEW_JWT_SECRET"
```

### 3. Configurer l'API (.env)

```bash
# Backup de l'ancien .env
cp apps/api/.env apps/api/.env.backup

# Éditer le fichier
nano apps/api/.env
```

**Ajouter/Modifier ces lignes :**

```env
# CORS - Remplacer l'ancienne ligne CORS_ORIGINS si elle existe
CORS_ORIGINS=http://91.134.135.247:3002,http://91.134.135.247:3003,http://91.134.135.247:3004

# JWT - Remplacer l'ancien JWT_SECRET
JWT_SECRET=<coller le nouveau secret généré ci-dessus>
```

**OU utiliser sed :**

```bash
# Ajouter CORS_ORIGINS (si n'existe pas)
echo "CORS_ORIGINS=http://91.134.135.247:3002,http://91.134.135.247:3003,http://91.134.135.247:3004" >> apps/api/.env

# Ajouter JWT_SECRET (si n'existe pas)
echo "JWT_SECRET=$NEW_JWT_SECRET" >> apps/api/.env

# OU remplacer si existe déjà:
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://91.134.135.247:3002,http://91.134.135.247:3003,http://91.134.135.247:3004|" apps/api/.env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" apps/api/.env
```

### 4. Configurer les applications front-end

```bash
# Web-player
cat > apps/web-player/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF

# Web-gamemaster
cat > apps/web-gamemaster/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF

# Web-screen
cat > apps/web-screen/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://91.134.135.247:3001
EOF
```

### 5. Installer les dépendances

```bash
npm install
```

### 6. Redémarrer avec Docker

```bash
# Arrêter les containers
docker-compose down

# Rebuild les images
docker-compose build

# Redémarrer en mode détaché
docker-compose up -d
```

### 7. Vérifier le déploiement

```bash
# Attendre 30 secondes pour le démarrage
sleep 30

# Tester le health check
curl http://localhost:3001/health

# Devrait retourner:
# {"status":"ok","timestamp":"...","database":"connected"}

# Voir le statut des containers
docker-compose ps

# Voir les logs si problème
docker-compose logs -f
```

---

## 🔧 Commandes Utiles

### Redémarrer un service spécifique
```bash
docker-compose restart api
docker-compose restart web-player
docker-compose restart web-gamemaster
docker-compose restart web-screen
```

### Voir les logs en temps réel
```bash
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f api
docker-compose logs -f web-player
```

### Vérifier les variables d'environnement chargées
```bash
# Dans le container API
docker-compose exec api printenv | grep -E 'CORS|JWT'
```

### Tester les endpoints
```bash
# Health check
curl http://91.134.135.247:3001/health

# Readiness check
curl http://91.134.135.247:3001/health/ready

# Liste des sessions (nécessite authentification)
curl http://91.134.135.247:3001/sessions
```

---

## ⚠️ En cas de problème

### Les containers ne démarrent pas
```bash
# Voir les erreurs
docker-compose logs api

# Recréer les containers
docker-compose down -v
docker-compose up -d --force-recreate
```

### Problème de CORS
Vérifier que `CORS_ORIGINS` est bien configuré dans `apps/api/.env`

### Problème de connexion WebSocket
1. Vérifier que les ports sont ouverts (3001-3004)
2. Vérifier les variables d'environnement des front-ends
3. Vérifier les logs du container API

### Base de données ne se connecte pas
```bash
# Redémarrer le container PostgreSQL
docker-compose restart postgres

# Vérifier les logs
docker-compose logs postgres
```

---

## 📝 Checklist de Déploiement

- [ ] Code récupéré depuis GitHub
- [ ] Nouveau JWT_SECRET généré et configuré
- [ ] CORS_ORIGINS configuré dans apps/api/.env
- [ ] NEXT_PUBLIC_API_URL configuré pour tous les front-ends
- [ ] Dépendances installées (`npm install`)
- [ ] Containers Docker redémarrés
- [ ] Health check répond "ok"
- [ ] Tous les containers sont "Up"
- [ ] Test de connexion depuis un navigateur

---

## 🎯 URLs de Test

Après déploiement, tester ces URLs dans ton navigateur :

- **API Health**: http://91.134.135.247:3001/health
- **Player**: http://91.134.135.247:3002
- **GameMaster**: http://91.134.135.247:3003
- **Screen**: http://91.134.135.247:3004
