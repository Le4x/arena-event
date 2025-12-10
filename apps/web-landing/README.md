# 🌐 Arena Event - Landing Page

Landing page professionnelle pour Arena Event.

## 🚀 Développement

```bash
# Installer les dépendances
npm install

# Démarrer en mode développement
npm run dev
```

La landing page sera accessible sur http://localhost:3005

## 🏗️ Build

```bash
# Build pour production
npm run build

# Démarrer en production
npm start
```

## 📋 Fonctionnalités

- ✨ Design moderne avec gradient purple/indigo/blue
- 📱 Responsive mobile-first
- 🎨 Animations fluides et glassmorphism
- 🎯 Sections complètes :
  - Header fixe avec navigation
  - Hero avec CTA et statistiques
  - Features (6 fonctionnalités clés)
  - How it works (3 étapes)
  - CTA section
  - Footer complet
- 🎬 Modal vidéo de démo

## 🌍 Configuration pour Production

### Option 1: Nginx Reverse Proxy (Recommandé)

Pour que `arena-event.fr` affiche la landing page, configurez Nginx :

```nginx
# /etc/nginx/sites-available/arena-event
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

# Sous-domaines pour les autres apps
server {
    listen 80;
    server_name admin.arena-event.fr;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.arena-event.fr;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name studio.arena-event.fr;
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name player.arena-event.fr;
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name screen.arena-event.fr;
    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Installation :**

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### Option 2: Port 80 Direct

Pour servir directement sur le port 80 sans Nginx :

1. Modifier `ecosystem.config.js` :
```javascript
{
  name: 'arena-landing',
  cwd: '/arena-event/apps/web-landing',
  script: 'node_modules/next/dist/bin/next',
  args: 'start',
  env: {
    PORT: 80  // Nécessite sudo ou capabilities
  }
}
```

2. Donner les permissions :
```bash
sudo setcap cap_net_bind_service=+ep $(which node)
```

### Certificat SSL (Let's Encrypt)

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d arena-event.fr -d www.arena-event.fr

# Renouvellement automatique (déjà configuré)
sudo certbot renew --dry-run
```

## 🔗 Liens Internes

La landing page contient des liens vers :
- Admin Dashboard : http://91.134.135.247:3000
- Studio : http://91.134.135.247:3002
- Player : http://91.134.135.247:3003
- Screen : http://91.134.135.247:3004
- API Health : http://91.134.135.247:3001/health

Vous devrez mettre à jour ces liens avec vos vrais domaines en production.

## 📝 Personnalisation

Pour personnaliser la landing page, éditez `src/app/page.tsx` :

- **Statistiques** : Ligne 66-82
- **Fonctionnalités** : Ligne 99-129
- **Étapes** : Ligne 138-168
- **Footer** : Ligne 189-243

---

**Bon déploiement ! 🚀**
