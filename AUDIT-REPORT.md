# AUDIT COMPLET - Arena Event Platform

**Date:** 2025-12-11
**Version:** 2.1.0
**Auditeur:** Claude Code (Opus 4)

---

## SOMMAIRE EXECUTIF

| Catégorie | Score | Status |
|-----------|-------|--------|
| **Sécurité** | 6/10 | :warning: Améliorations nécessaires |
| **Qualité du code** | 7/10 | :white_check_mark: Bon |
| **Performance** | 7/10 | :white_check_mark: Bon |
| **Tests** | 1/10 | :x: Critique - Aucun test |
| **Documentation** | 8/10 | :white_check_mark: Très bon |
| **Architecture** | 8/10 | :white_check_mark: Très bon |

**Verdict global:** Le projet est bien structuré avec une architecture monorepo professionnelle, mais présente des **vulnérabilités de sécurité critiques** et une **absence totale de tests automatisés**.

---

## 1. AUDIT DE SECURITE

### 1.1 Problèmes CRITIQUES :red_circle:

#### 1.1.1 Endpoint de registration sans restriction
**Fichier:** `apps/api/src/auth/auth.controller.ts:30-38` et `simple-api/index.js:528-558`

```typescript
@Post('register')
async register(@Body() registerDto: RegisterDto) {
  return this.authService.register(
    registerDto.email,
    registerDto.password,
    registerDto.firstName,
    registerDto.lastName,
    registerDto.role,  // ⚠️ L'utilisateur peut choisir son propre rôle!
  );
}
```

**Risque:** N'importe qui peut créer un compte avec le rôle `SUPER_ADMIN` en envoyant:
```json
{ "email": "hacker@evil.com", "password": "...", "role": "SUPER_ADMIN" }
```

**Recommandation:**
- Supprimer le paramètre `role` de l'endpoint public
- Créer un endpoint admin séparé pour l'attribution des rôles
- Ajouter validation du rôle côté serveur

#### 1.1.2 DTOs sans validation
**Fichiers:** Tous les controllers NestJS

```typescript
// ⚠️ Pas de décorateurs class-validator!
class LoginDto {
  email: string;    // Pas de @IsEmail()
  password: string; // Pas de @IsString(), @MinLength()
}
```

**Risque:** Injection de données malformées, pas de validation de longueur ni de format.

**Recommandation:** Ajouter des décorateurs de validation:
```typescript
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

#### 1.1.3 JWT Secret faible par défaut
**Fichier:** `simple-api/index.js:394`

```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'arena-event-super-secret-jwt-key-2024';
```

**Risque:** Si `.env` n'est pas configuré, le secret par défaut est prévisible.

**Recommandation:**
- Générer un secret aléatoire fort (256 bits minimum)
- Échouer au démarrage si `JWT_SECRET` n'est pas défini en production

### 1.2 Problèmes MAJEURS :orange_circle:

#### 1.2.1 CORS trop permissif
**Fichier:** `simple-api/index.js:23-27`

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: '*',  // ⚠️ Accepte toutes les origines!
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
```

**Risque:** Attaques CSRF, accès non autorisé aux WebSockets.

**Recommandation:** Limiter aux domaines autorisés:
```javascript
cors: {
  origin: ['https://arena-event.fr', 'https://admin.arena-event.fr'],
  credentials: true
}
```

#### 1.2.2 Endpoints publics sans authentification
**Fichier:** `simple-api/index.js:2138-2610`

Les endpoints suivants sont accessibles sans authentification:
- `GET /sessions` - Liste toutes les sessions
- `GET /sessions/:sessionId` - Détails complets d'une session
- `POST /sessions/join` - Rejoindre une session
- `POST /sessions/:sessionId/teams` - Créer une équipe
- `PUT /sessions/:sessionId/teams/:teamId/score` - **Modifier les scores!**
- `POST /sessions/:sessionId/emit` - **Émettre des événements WebSocket!**

**Risque CRITIQUE:** Un attaquant peut:
1. Modifier les scores de n'importe quelle équipe
2. Émettre des événements WebSocket arbitraires
3. Perturber complètement le jeu

**Recommandation:** Ajouter authentification ou rate limiting strict sur ces endpoints.

#### 1.2.3 Pas de rate limiting sur les endpoints sensibles
**Fichier:** `simple-api/index.js`

Seuls les buzzers et réponses ont un rate limiting. Les endpoints suivants n'en ont pas:
- `/api/auth/login` - Vulnérable aux attaques par force brute
- `/api/auth/register` - Vulnérable au spam de création de comptes
- `/api/upload` - Vulnérable au déni de service

**Recommandation:** Implémenter rate limiting global avec `express-rate-limit`:
```javascript
const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

#### 1.2.4 Upload de fichiers sans validation stricte
**Fichier:** `simple-api/index.js:353-389`

```javascript
app.post('/api/upload', async (req, res) => {
  const { filename, data, type } = req.body;
  // ⚠️ Pas de validation du type MIME réel
  // ⚠️ Pas de limite de taille
  // ⚠️ Pas de scan antivirus
  const ext = extname(filename) || '.mp3';
  // ...
});
```

**Risques:**
- Upload de fichiers malveillants déguisés
- Déni de service via fichiers volumineux (limite body: 50mb)
- Exécution de code si les fichiers sont servis directement

**Recommandation:**
- Valider le type MIME réel du fichier
- Limiter les extensions autorisées (.mp3, .wav, .jpg, .png)
- Scanner les fichiers uploadés
- Servir via CDN avec headers de sécurité

### 1.3 Problèmes MINEURS :yellow_circle:

#### 1.3.1 Informations sensibles dans les logs
```javascript
console.log(`Team ${teamId} connected to session ${sessionId}`);
console.log(`Answer submitted: team=${teamId}, correct=${isCorrect}`);
```

**Recommandation:** Utiliser un logger structuré (Winston/Pino) avec niveaux configurables.

#### 1.3.2 Absence de headers de sécurité HTTP
**Recommandation:** Ajouter Helmet.js:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

#### 1.3.3 Pas de validation d'UUID
Les paramètres `:id`, `:sessionId`, `:teamId` ne sont pas validés comme UUIDs valides.

---

## 2. AUDIT DE QUALITE DU CODE

### 2.1 Points positifs :white_check_mark:

1. **Architecture monorepo bien structurée** - Turborepo avec packages partagés
2. **TypeScript partout** - Typage fort, meilleure maintenabilité
3. **Séparation des responsabilités** - Modules NestJS bien découpés
4. **Gestion atomique des buzzers** - Transaction Prisma avec isolation Serializable
5. **Gestion des reconnexions** - Grace period de 5s pour les joueurs
6. **Timer côté serveur** - Synchronisation parfaite entre clients

### 2.2 Points à améliorer :warning:

#### 2.2.1 Duplication de code massive
**simple-api vs apps/api:**
Le fichier `simple-api/index.js` (2639 lignes) duplique toute la logique du backend NestJS. Cette duplication:
- Multiplie les risques de bugs
- Rend la maintenance difficile
- Crée des incohérences potentielles

**Recommandation:** Supprimer `simple-api` et utiliser uniquement le backend NestJS.

#### 2.2.2 Services sans gestion d'erreurs cohérente
```typescript
// scoring.service.ts
async validateAnswer(answerId: string, isCorrect: boolean, points: number) {
  const answer = await this.prisma.answer.findUnique({...});
  if (!answer) {
    throw new Error('Answer not found');  // ⚠️ Error générique, pas NotFoundException
  }
}
```

#### 2.2.3 Types `any` dans plusieurs fichiers
```typescript
async login(@Request() req, @Body() loginDto: LoginDto) {
  return this.authService.login(req.user);  // req.user est any
}
```

#### 2.2.4 État mutable global dans simple-api
```javascript
const activeTimers = new Map();
const connectedTeams = new Map();
const buzzerState = new Map();
const finaleState = new Map();
```

Ces Maps globales peuvent causer des problèmes de mémoire et ne survivent pas aux redémarrages.

---

## 3. AUDIT DE PERFORMANCE

### 3.1 Points positifs :white_check_mark:

1. **WebSocket optimisé** - Compression désactivée pour faible latence
2. **Timer côté serveur** - Sync 100ms pour fluidité
3. **Rate limiting sur buzzers** - Protection anti-spam
4. **Indexes Prisma** - Sur les colonnes fréquemment requêtées
5. **Transactions atomiques** - Pour les buzzers (isolation Serializable)

### 3.2 Problèmes identifiés :warning:

#### 3.2.1 N+1 queries potentiels
**Fichier:** `simple-api/index.js:711-759`

```javascript
const event = await prisma.event.findUnique({
  where: { id: req.params.id },
  include: {
    rounds: {
      include: {
        questions: { orderBy: { order: 'asc' } }
      }
    },
    sessions: true
  }
});
```

Ce pattern charge tout l'événement en une requête, mais peut devenir lent avec beaucoup de données.

#### 3.2.2 Pas de pagination
Tous les endpoints `findMany` retournent tous les résultats:
```javascript
const sessions = await prisma.session.findMany({...});  // Tous les résultats
```

**Recommandation:** Ajouter pagination avec `skip` et `take`.

#### 3.2.3 Timer sync à 100ms = charge réseau élevée
```javascript
const interval = setInterval(() => {
  io.to(`session:${sessionId}`).emit('timer-sync', {...});
}, 100);  // 10 événements/seconde par session
```

Avec 50 joueurs et 30 secondes de timer = 15000 messages WebSocket par question.

**Recommandation:** Réduire à 1 sync/seconde côté serveur, interpoler côté client.

#### 3.2.4 Pas de cache Redis utilisé
Redis est configuré dans docker-compose mais n'est pas utilisé. Le cache pourrait:
- Stocker l'état des sessions
- Mettre en cache les leaderboards
- Gérer les sessions JWT

---

## 4. AUDIT DES TESTS

### 4.1 État actuel: CRITIQUE :x:

**Aucun test automatisé n'existe dans le projet.**

```
apps/api/test/          # Vide
apps/web-*/             # Pas de tests
packages/*/             # Pas de tests
```

Les scripts npm existent mais ne font rien:
```json
"test": "turbo run test",
"test:cov": "turbo run test:cov",
"test:e2e": "turbo run test:e2e"
```

### 4.2 Risques :red_circle:

1. **Régressions non détectées** lors des modifications
2. **Bugs en production** non prévenus
3. **Refactoring dangereux** sans filet de sécurité
4. **Documentation manquante** (les tests documentent le comportement)

### 4.3 Recommandations

Voir section 6 pour l'implémentation des tests.

---

## 5. AUDIT DE L'ARCHITECTURE

### 5.1 Points positifs :white_check_mark:

| Aspect | Évaluation |
|--------|------------|
| Monorepo Turborepo | Excellent choix pour la scalabilité |
| Packages partagés | Bonne réutilisation (types, UI, config) |
| Base de données | Schéma Prisma bien normalisé |
| Multi-frontend | Adaptation aux différents usages (Admin, Studio, Player, Screen) |
| WebSocket | Architecture de rooms bien pensée |
| Docker | Configuration prête pour production |

### 5.2 Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
├─────────────────────────────────────────────────────────────────┤
│ web-admin    │ web-studio    │ web-player    │ web-screen       │
│ (Port 3000)  │ (Port 3002)   │ (Port 3003)   │ (Port 3004)      │
│ Next.js 14   │ Next.js 14    │ Next.js 14    │ Next.js 14       │
└──────┬───────┴───────┬───────┴───────┬───────┴───────┬──────────┘
       │               │               │               │
       │      HTTP/REST & WebSocket (Socket.IO)        │
       │               │               │               │
┌──────▼───────────────▼───────────────▼───────────────▼──────────┐
│                     simple-api (Express)                        │
│                        Port 3001                                │
├─────────────────────────────────────────────────────────────────┤
│  Auth  │  Events  │  Sessions  │  Game  │  WebSocket Gateway    │
└──────┬───────────────────────────────────────────────┬──────────┘
       │                                               │
┌──────▼───────────────┐                 ┌─────────────▼──────────┐
│   PostgreSQL 16      │                 │      Redis 7           │
│   (Port 5432)        │                 │   (Port 6379)          │
│   - users            │                 │   - Sessions (TODO)    │
│   - events           │                 │   - Cache (TODO)       │
│   - sessions         │                 │                        │
│   - teams            │                 │                        │
│   - questions        │                 │                        │
│   - answers          │                 │                        │
└──────────────────────┘                 └────────────────────────┘
```

### 5.3 Flux de données du jeu

```
Studio                    Server                    Player/Screen
   │                         │                            │
   │──question-start────────►│                            │
   │                         │───question-start──────────►│
   │                         │                            │
   │                         │◄──submit-answer────────────│
   │◄──answer-submitted──────│                            │
   │                         │                            │
   │                         │───timer-sync (100ms)──────►│
   │                         │                            │
   │──question-end──────────►│                            │
   │                         │───question-end────────────►│
   │                         │                            │
   │──show-leaderboard──────►│                            │
   │                         │───show-leaderboard────────►│
```

---

## 6. PLAN D'IMPLEMENTATION DES TESTS

### 6.1 Tests unitaires (Jest)

**Cibles prioritaires:**
1. `scoring.service.ts` - Calcul des scores
2. `game.service.ts` - Logique de jeu, buzzer atomique
3. `auth.service.ts` - Authentification, JWT

### 6.2 Tests d'intégration API (Supertest)

**Endpoints critiques:**
1. Auth flow complet (register, login, me)
2. CRUD Events/Rounds/Questions
3. Session lifecycle (create, start, end)
4. Team management
5. Answer submission

### 6.3 Tests E2E (Playwright/Cypress)

**Scénarios:**
1. Parcours admin: login → create event → add questions
2. Parcours studio: select session → start game → control questions
3. Parcours player: join → answer → see results
4. Flux complet multi-joueurs

---

## 7. RECOMMANDATIONS PRIORITAIRES

### Priorité 1 - CRITIQUE (à faire immédiatement)

| Action | Fichier | Effort |
|--------|---------|--------|
| Retirer `role` de register public | `auth.controller.ts`, `simple-api` | 30min |
| Ajouter validation DTOs | Tous les controllers | 2h |
| Sécuriser endpoints publics | `simple-api/index.js:2138+` | 3h |
| Rate limiting login/register | `simple-api/index.js` | 1h |
| Forcer JWT_SECRET en prod | `simple-api/index.js` | 30min |

### Priorité 2 - MAJEUR (cette semaine)

| Action | Fichier | Effort |
|--------|---------|--------|
| Implémenter tests unitaires | `apps/api/test/` | 1 jour |
| Restreindre CORS | `simple-api/index.js` | 1h |
| Valider uploads | `simple-api/index.js` | 2h |
| Ajouter Helmet.js | `simple-api/index.js` | 30min |
| Logger structuré | Tout le projet | 3h |

### Priorité 3 - RECOMMANDÉ (ce mois)

| Action | Fichier | Effort |
|--------|---------|--------|
| Supprimer simple-api (utiliser NestJS) | Architecture | 1 semaine |
| Utiliser Redis pour cache/sessions | Backend | 2 jours |
| Tests d'intégration | `apps/api/test/` | 2 jours |
| Tests E2E | Nouveau dossier | 3 jours |
| Pagination sur tous les endpoints | Controllers | 1 jour |

---

## 8. CONCLUSION

**Arena Event** est un projet bien conçu avec une architecture solide, mais qui présente des **failles de sécurité critiques** qui doivent être corrigées avant toute mise en production réelle.

Les points forts:
- Architecture monorepo moderne
- TypeScript partout
- Gestion temps réel efficace
- Documentation complète

Les points faibles:
- Vulnérabilités de sécurité critiques
- Absence totale de tests
- Duplication de code (simple-api)
- Endpoints publics trop permissifs

**Score global: 6.2/10** - Bon potentiel, mais travail de sécurisation nécessaire.

---

*Rapport généré automatiquement par Claude Code (Opus 4)*
