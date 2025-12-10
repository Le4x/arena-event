# 🌐 Guide de Configuration - Landing Page

## Problème Résolu

**Avant** : arena-event.fr redirige vers l'admin (port 3000)
**Après** : arena-event.fr affiche la landing page professionnelle

---

## 📋 Ce qui a été créé

Une nouvelle application **web-landing** avec :

- ✅ Page d'accueil professionnelle
- ✅ Design moderne (gradient purple/indigo/blue)
- ✅ Sections complètes (Hero, Features, How it works, CTA, Footer)
- ✅ Responsive mobile-first
- ✅ Animations fluides
- ✅ Modal vidéo de démo

---

## 🚀 Déploiement Rapide

### 1. Installer les dépendances

```bash
cd apps/web-landing
npm install
cd ../..
```

### 2. Tester en développement

```bash
cd apps/web-landing
npm run dev
```

La landing page sera accessible sur http://localhost:3005

### 3. Build pour production

```bash
cd apps/web-landing
npm run build
npm start
```

---

## 🌍 Configuration Nginx (IMPORTANT)

Pour que **arena-event.fr** affiche la landing page au lieu de l'admin, vous devez configurer Nginx.

### Option A: Configuration complète avec sous-domaines

```bash
# 1. Copier le fichier de configuration
sudo cp nginx-arena-event.conf /etc/nginx/sites-available/arena-event

# 2. Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/

# 3. Tester la configuration
sudo nginx -t

# 4. Recharger Nginx
sudo systemctl reload nginx
```

Cette configuration crée :
- `arena-event.fr` → Landing Page (port 3005)
- `admin.arena-event.fr` → Admin Dashboard (port 3000)
- `api.arena-event.fr` → API Backend (port 3001)
- `studio.arena-event.fr` → Studio (port 3002)
- `play.arena-event.fr` → Player (port 3003)
- `screen.arena-event.fr` → Screen (port 3004)

### Option B: Configuration simple (juste le domaine principal)

Si vous voulez juste rediriger arena-event.fr vers la landing page :

```bash
sudo nano /etc/nginx/sites-available/arena-event
```

Ajoutez :

```nginx
server {
    listen 80;
    server_name arena-event.fr www.arena-event.fr;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Puis :

```bash
sudo ln -s /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 Certificat SSL (Optionnel mais recommandé)

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir le certificat pour tous les domaines
sudo certbot --nginx -d arena-event.fr -d www.arena-event.fr \
  -d admin.arena-event.fr -d api.arena-event.fr \
  -d studio.arena-event.fr -d play.arena-event.fr \
  -d screen.arena-event.fr

# Ou juste pour le domaine principal
sudo certbot --nginx -d arena-event.fr -d www.arena-event.fr
```

---

## 🎯 Gestion avec PM2

La landing page est déjà configurée dans `ecosystem.config.js` :

```bash
# Démarrer tous les services (y compris la landing)
pm2 start ecosystem.config.js

# Démarrer uniquement la landing
pm2 start ecosystem.config.js --only arena-landing

# Voir le status
pm2 status

# Voir les logs
pm2 logs arena-landing

# Redémarrer
pm2 restart arena-landing

# Arrêter
pm2 stop arena-landing
```

---

## ✅ Checklist de Vérification

Après le déploiement, vérifiez :

- [ ] La landing page tourne sur le port 3005 : `curl http://localhost:3005`
- [ ] Nginx est configuré et redémarre sans erreur : `sudo nginx -t`
- [ ] arena-event.fr affiche la landing page (pas l'admin)
- [ ] Les liens vers Admin, Studio, etc. fonctionnent
- [ ] Le certificat SSL est actif (si configuré)
- [ ] PM2 a bien démarré arena-landing : `pm2 status`

---

## 🔧 Dépannage

### La landing page ne démarre pas

```bash
# Vérifier les logs
cd apps/web-landing
npm run build

# Si erreur de dépendances
npm install

# Vérifier le port
sudo lsof -i :3005
```

### arena-event.fr affiche toujours l'admin

```bash
# Vérifier la config Nginx
sudo nginx -t
cat /etc/nginx/sites-enabled/arena-event

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/error.log

# Forcer le rechargement
sudo systemctl restart nginx
```

### Erreur 502 Bad Gateway

```bash
# La landing page n'est pas démarrée
pm2 status
pm2 start ecosystem.config.js --only arena-landing

# Ou en mode dev
cd apps/web-landing && npm run dev
```

---

## 📝 Personnalisation

Pour personnaliser la landing page :

1. Ouvrir `apps/web-landing/src/app/page.tsx`
2. Modifier :
   - Titre et description (ligne 50-60)
   - Statistiques (ligne 66-82)
   - Fonctionnalités (ligne 99-129)
   - Étapes (ligne 138-168)
   - Liens URLs (chercher `91.134.135.247` et remplacer par vos domaines)

3. Rebuild :
   ```bash
   cd apps/web-landing
   npm run build
   pm2 restart arena-landing
   ```

---

## 📞 URLs de Référence

Après déploiement complet :

- **Landing Page** : https://arena-event.fr
- **Admin** : https://admin.arena-event.fr
- **API** : https://api.arena-event.fr
- **Studio** : https://studio.arena-event.fr
- **Player** : https://play.arena-event.fr
- **Screen** : https://screen.arena-event.fr

---

**La landing page est prête ! 🎉**

Pour toute question, consultez `apps/web-landing/README.md`
