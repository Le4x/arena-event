# 🎤 Dashboard Animateur - Guide de déploiement

## Architecture

Le dashboard animateur (anim.arena-event.fr) permet aux présentateurs de suivre le jeu en temps réel sans contrôler les questions.

## Prérequis

- PostgreSQL (base de données)
- Redis (optionnel, pour multi-instance)
- Node.js 18+
- Nginx (pour reverse proxy)

## Installation

### 1. Créer un utilisateur PRESENTER

```sql
-- Via Prisma Studio ou directement en SQL
UPDATE users SET role = 'PRESENTER' WHERE email = 'presenter@arena-event.fr';
```

### 2. Variables d'environnement

Créer `.env.local` dans `apps/web-presenter/`:

```bash
NEXT_PUBLIC_API_URL=https://api.arena-event.fr
NEXT_PUBLIC_PLAYER_URL=https://player.arena-event.fr
```

### 3. Build et démarrage

```bash
cd apps/web-presenter
npm install
npm run build
npm run start  # Port 3005
```

### 4. Configuration Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name anim.arena-event.fr;

    ssl_certificate /etc/letsencrypt/live/arena-event.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arena-event.fr/privkey.pem;

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

## Utilisation

1. **Connexion**: Ouvrir https://anim.arena-event.fr
2. **Login**: Email/mot de passe avec rôle PRESENTER
3. **Sélectionner session**: Choisir session active
4. **Suivre le jeu**: 
   - Voir question actuelle
   - Suivre qui répond (checkmarks)
   - Voir bonne réponse au reveal
   - Classement temps réel

## Fonctionnalités

### ✅ Vue Lecture Seule
- Question actuelle avec timer
- Type et points de la question
- Indicateurs réponses équipes
- Bonne réponse en phase REVEAL
- Leaderboard avec top 3

### ❌ Pas de Contrôle
- Impossible de démarrer/arrêter questions
- Pas de gestion du buzzer
- Pas de modification des scores
- Interface 100% lecture seule

## Migration depuis l'autre branche

Si vous êtes sur `claude/review-animator-dashboard-01UtFH8oxcjRRoiUQsZgFMby`:

```bash
# Récupérer le dashboard depuis l'autre branche
git checkout claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt -- apps/web-presenter

# Ajouter le rôle PRESENTER au schema Prisma
git checkout claude/fix-bugs-stabilize-019kR1jS3zCKExSCV2n3oTFt -- simple-api/prisma/schema.prisma

# Migrer la base de données
cd simple-api
npx prisma migrate dev --name add_presenter_role
npx prisma generate
```

## Troubleshooting

### Erreur: "Access denied. Presenter role required"
→ Vérifier que l'utilisateur a bien le rôle PRESENTER ou SUPER_ADMIN

### Pas de sessions affichées
→ Vérifier que des sessions sont en statut ACTIVE

### WebSocket déconnecté
→ Vérifier que l'API est accessible et que Nginx autorise les WebSockets

### Timer non synchronisé
→ Le timer est géré côté serveur via l'événement 'timer-sync' toutes les 100ms
