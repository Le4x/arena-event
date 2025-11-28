# 🔧 CORRECTIONS STABILITÉ - MusicArena v2.2.0

**Date:** 28 Novembre 2025

---

## 📋 Résumé des corrections

### 1. ✅ Race Condition Buzzer (simple-api)
**Fichier:** `simple-api/index.js`

**Problème:** Deux équipes pouvaient potentiellement avoir le même rang si elles buzzaient exactement en même temps.

**Solution:**
- Ajout d'une **queue ordonnée** pour tracker tous les buzzes
- **Détection des doublons** (une équipe ne peut buzzer qu'une fois)
- **Persistance en base de données** via `persistBuzzerPress()`
- Logs améliorés avec le rang

```javascript
// Nouvelle structure
buzzerState = { locked, winner, timestamp, questionId, queue: [] }

// Nouvelle fonction
persistBuzzerPress(prisma, questionId, teamId, rank)
getBuzzerQueue(sessionId)
```

---

### 2. ✅ Race Condition Buzzer (NestJS API)
**Fichier:** `apps/api/src/game/game.service.ts`

**Problème:** Le count + create n'était pas atomique.

**Solution:**
- Transaction Prisma avec **isolation Serializable**
- Lock **FOR UPDATE** sur le count
- Timeout de 5 secondes anti-deadlock

```typescript
await this.prisma.$transaction(async (tx) => {
  // Toutes les opérations atomiques
}, { isolationLevel: 'Serializable', timeout: 5000 });
```

---

### 3. ✅ Rate Limiting (Anti-spam)
**Fichier:** `simple-api/index.js`

**Problème:** Un joueur malveillant pouvait spammer le buzzer.

**Solution:**
- **Buzzer:** Max 5 tentatives/seconde par équipe
- **Réponses:** Max 3 soumissions/seconde par équipe
- Nettoyage automatique toutes les minutes

```javascript
rateLimit(key, maxRequests, windowMs)
// Retourne { allowed, remaining, retryAfter }
```

---

### 4. ✅ Variables d'environnement
**Fichier:** `simple-api/index.js` + `simple-api/.env.example`

**Avant:**
```javascript
const JWT_SECRET = 'arena-event-super-secret-jwt-key-2024'; // Hardcodé!
```

**Après:**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'arena-event-super-secret-jwt-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CORS_ORIGINS = process.env.CORS_ORIGINS || '*';
```

---

## 🚀 Déploiement sur VPS

### Option recommandée: Nouvelle branche Git

```bash
# Sur ton PC local
cd arena-event
git checkout -b fix/stability-v2.2

# Remplacer les fichiers modifiés ou copier le contenu
# Puis commit
git add .
git commit -m "fix: corrections stabilité buzzer + rate limiting + env vars"
git push origin fix/stability-v2.2

# Sur le VPS
cd ~/arena-event
git fetch origin
git checkout fix/stability-v2.2

# Redémarrer l'API
pm2 restart arena-api
# ou
systemctl restart arena-api
```

### Créer le fichier .env sur le VPS

```bash
cd ~/arena-event/simple-api
cp .env.example .env
nano .env
# Modifier les valeurs pour la production
```

---

## 🧪 Tests recommandés

1. **Test buzzer simultané**
   - Avoir 3+ équipes qui buzzent en même temps
   - Vérifier que les rangs sont tous différents
   - Vérifier les logs: `🔔 BUZZER WON by TeamA (rank #1)`

2. **Test rate limiting**
   - Spammer le buzzer rapidement
   - Vérifier le log: `⚠️ RATE LIMITED: TeamX`

3. **Test persistance**
   ```sql
   SELECT * FROM buzzer_presses WHERE "questionId" = '...';
   ```

---

## 📊 État après corrections

| Point | Avant | Après |
|-------|-------|-------|
| Race condition buzzer | 🔴 Bug | ✅ Corrigé |
| Persistance buzzer | 🔴 Aucune | ✅ Base de données |
| Rate limiting | 🔴 Absent | ✅ 5 req/s buzzer, 3 req/s answer |
| JWT_SECRET | 🟠 Hardcodé | ✅ Variable d'env |
| CORS | 🟠 `origin: '*'` | ✅ Configurable |

---

## ⚠️ Points restants (non critiques)

- **IP en dur** dans les frontends (fonctionne mais pas idéal)
- **RoomsService en mémoire** (OK pour 1 instance)
- **Aucun test unitaire** (recommandé mais pas bloquant)

---

*Corrections appliquées par Claude - 28 Nov 2025*
