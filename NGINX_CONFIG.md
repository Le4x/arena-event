# Configuration Nginx pour Arena Event

Ce fichier explique comment configurer Nginx pour router tous les domaines Arena Event vers les bonnes applications.

## Architecture des Ports

| Domaine | Application | Port |
|---------|-------------|------|
| `arena-event.fr` | Landing Page | 3005 |
| `admin.arena-event.fr` | Admin | 3000 |
| `studio.arena-event.fr` | Studio | 3002 |
| `player.arena-event.fr` | Player | 3003 |
| `screen.arena-event.fr` | Screen | 3004 |
| `api.arena-event.fr` | API | 3001 |

## Configuration Nginx

Créez le fichier `/etc/nginx/sites-available/arena-event`:

```nginx
# Landing Page - arena-event.fr
server {
    listen 80;
    listen [::]:80;
    server_name arena-event.fr www.arena-event.fr;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin - admin.arena-event.fr
server {
    listen 80;
    listen [::]:80;
    server_name admin.arena-event.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Studio - studio.arena-event.fr
server {
    listen 80;
    listen [::]:80;
    server_name studio.arena-event.fr;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Player - player.arena-event.fr (PUBLIC)
server {
    listen 80;
    listen [::]:80;
    server_name player.arena-event.fr;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Screen - screen.arena-event.fr
server {
    listen 80;
    listen [::]:80;
    server_name screen.arena-event.fr;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API - api.arena-event.fr
server {
    listen 80;
    listen [::]:80;
    server_name api.arena-event.fr;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS pour API
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    }
}
```

## Installation

```bash
# 1. Créer le fichier de configuration
sudo nano /etc/nginx/sites-available/arena-event

# 2. Copier la configuration ci-dessus

# 3. Activer le site
sudo ln -s /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/

# 4. Tester la configuration
sudo nginx -t

# 5. Recharger Nginx
sudo systemctl reload nginx
```

## SSL avec Certbot (HTTPS)

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir les certificats SSL pour tous les domaines
sudo certbot --nginx -d arena-event.fr -d www.arena-event.fr -d admin.arena-event.fr -d studio.arena-event.fr -d player.arena-event.fr -d screen.arena-event.fr -d api.arena-event.fr

# Renouvellement automatique (déjà configuré par défaut)
sudo certbot renew --dry-run
```

## Vérification

Après configuration, vérifiez que tous les domaines répondent:

```bash
# Landing
curl -I http://arena-event.fr

# Admin
curl -I http://admin.arena-event.fr

# Studio
curl -I http://studio.arena-event.fr

# Player (PUBLIC)
curl -I http://player.arena-event.fr

# Screen
curl -I http://screen.arena-event.fr

# API
curl -I http://api.arena-event.fr
```

## Troubleshooting

### Les domaines ne répondent pas

1. Vérifier que les applications PM2 tournent:
```bash
pm2 list
```

2. Vérifier que Nginx écoute:
```bash
sudo netstat -tlnp | grep nginx
```

3. Vérifier les logs Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
```

### Problèmes WebSocket

Si les WebSockets ne fonctionnent pas, vérifiez que les headers `Upgrade` et `Connection` sont bien configurés dans Nginx (déjà fait dans la config ci-dessus).

## Notes Importantes

- **Player est PUBLIC**: Accessible sans authentification (pour les participants)
- **Admin/Studio/Screen**: Protégés par authentification dans l'app
- **Landing**: Page publique de présentation qui guide vers Admin/Studio
- **API**: CORS configuré pour accepter toutes les origines (ajustez si besoin)
