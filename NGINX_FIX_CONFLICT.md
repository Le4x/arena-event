# Fix Nginx Conflicting Server Names

## Le Problème

Vous avez ces warnings :
```
nginx: [warn] conflicting server name "arena-event.fr" on 0.0.0.0:80, ignored
nginx: [warn] conflicting server name "www.arena-event.fr" on 0.0.0.0:80, ignored
```

Cela signifie que `arena-event.fr` et `www.arena-event.fr` sont définis dans **plusieurs fichiers** Nginx.

## Solution Rapide

### Étape 1 : Identifier les fichiers en conflit

```bash
# Voir tous les fichiers nginx actifs
sudo ls -la /etc/nginx/sites-enabled/

# Chercher où arena-event.fr est défini
sudo grep -r "arena-event.fr" /etc/nginx/sites-enabled/
```

### Étape 2 : Supprimer l'ancienne configuration

D'après vos messages précédents, le fichier `anim.arena-event.fr` contient probablement les anciennes définitions.

```bash
# Voir le contenu du fichier suspect
sudo cat /etc/nginx/sites-enabled/anim.arena-event.fr

# Si c'est bien l'ancienne config, la désactiver
sudo rm /etc/nginx/sites-enabled/anim.arena-event.fr

# OU si vous voulez la garder pour référence
sudo mv /etc/nginx/sites-enabled/anim.arena-event.fr /etc/nginx/sites-enabled/anim.arena-event.fr.old
```

### Étape 3 : S'assurer que seul le bon fichier est actif

```bash
# Vérifier qu'il ne reste qu'arena-event
sudo ls -la /etc/nginx/sites-enabled/
# Devrait montrer seulement: arena-event et default

# Tester la configuration
sudo nginx -t
# Devrait dire: "syntax is ok" et "test is successful" SANS warnings
```

### Étape 4 : Recharger Nginx

```bash
sudo systemctl reload nginx
```

### Étape 5 : Tester

```bash
# Tester que arena-event.fr charge bien la landing page
curl -I http://arena-event.fr
# Devrait répondre 200 OK

# Tester les autres domaines
curl -I http://admin.arena-event.fr
curl -I http://player.arena-event.fr
curl -I http://api.arena-event.fr
```

## Vérification Finale

Après ces étapes, ouvrez dans votre navigateur :
- `http://arena-event.fr` → Devrait afficher la **landing page** (port 3005)
- `http://admin.arena-event.fr` → Devrait afficher l'**admin** (port 3000)
- `http://player.arena-event.fr` → Devrait afficher le **player** (port 3003)

## Si ça ne marche toujours pas

### Vérifier que PM2 tourne bien

```bash
pm2 list
# arena-landing devrait être "online" sur le port 3005
```

Si arena-landing n'est pas là, lancez le déploiement :

```bash
cd ~/arena-event
./deploy-landing.sh
```

### Vérifier les logs Nginx

```bash
# Voir les erreurs Nginx
sudo tail -100 /var/log/nginx/error.log

# Voir les accès
sudo tail -100 /var/log/nginx/access.log
```

### Vérifier que le port 3005 écoute

```bash
sudo netstat -tlnp | grep 3005
# Devrait montrer node qui écoute sur :3005
```

## Configuration Nginx Correcte

Votre fichier `/etc/nginx/sites-available/arena-event` devrait contenir :

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

# ... (autres configurations pour admin, studio, player, screen, api)
```

Le fichier complet est dans `NGINX_CONFIG.md`.

## Résumé des Commandes

```bash
# 1. Supprimer le fichier en conflit
sudo rm /etc/nginx/sites-enabled/anim.arena-event.fr

# 2. Tester
sudo nginx -t

# 3. Recharger
sudo systemctl reload nginx

# 4. Vérifier PM2
pm2 list

# 5. Si arena-landing n'est pas démarré
cd ~/arena-event
./deploy-landing.sh
```

## Contact

Si vous avez encore des problèmes après ces étapes, vérifiez :
1. Les logs Nginx : `sudo tail -100 /var/log/nginx/error.log`
2. Les logs PM2 : `pm2 logs arena-landing --lines 100`
3. Que le port 3005 est bien écouté : `sudo netstat -tlnp | grep 3005`
