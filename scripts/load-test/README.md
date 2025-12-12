# Arena Event - Load Testing & Performance Simulation

Scripts de test de charge et simulation de production pour l'API Arena Event.

## Installation

```bash
cd scripts/load-test
npm install
```

## Scripts disponibles

### 1. Test de charge (`run-test.sh`)

Lance une simulation de charge avec WebSocket et HTTP clients.

```bash
# Profils prédéfinis
./run-test.sh light    # 50 WS, 100 HTTP, 1 minute
./run-test.sh default  # 100 WS, 200 HTTP, 2 minutes
./run-test.sh heavy    # 200 WS, 500 HTTP, 5 minutes
./run-test.sh stress   # 500 WS, 1000 HTTP, 10 minutes

# Configuration personnalisée
./run-test.sh custom 150 300 180 45  # WS, HTTP, Durée(s), Ramp-up(s)
```

### 2. Monitoring temps réel (`monitor.sh`)

Affiche les métriques système et API en temps réel.

```bash
./monitor.sh

# Avec configuration personnalisée
API_URL=http://localhost:3001 REFRESH_INTERVAL=5 ./monitor.sh
```

### 3. Test Node.js direct

```bash
# Configuration via variables d'environnement
API_URL=http://localhost:3001 \
WS_CLIENTS=100 \
HTTP_CLIENTS=200 \
DURATION=120 \
RAMP_UP=30 \
node load-test.js
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `API_URL` | URL de l'API | `http://localhost:3001` |
| `WS_URL` | URL WebSocket | `http://localhost:3001` |
| `WS_CLIENTS` | Nombre de clients WebSocket | `100` |
| `HTTP_CLIENTS` | Nombre de clients HTTP | `200` |
| `DURATION` | Durée du test (secondes) | `120` |
| `RAMP_UP` | Durée de montée en charge (secondes) | `30` |
| `HTTP_INTERVAL` | Intervalle entre requêtes HTTP (ms) | `500` |
| `ADMIN_EMAIL` | Email admin pour auth | `admin@arena.local` |
| `ADMIN_PASSWORD` | Mot de passe admin | `admin123` |
| `SIMULATE_ANSWERS` | Simuler les réponses | `true` |
| `SIMULATE_BUZZER` | Simuler le buzzer | `true` |

## Métriques collectées

### WebSocket
- Tentatives de connexion
- Connexions réussies / échouées
- Déconnexions / reconnexions
- Messages envoyés / reçus
- Latence de connexion (avg, p50, p95, p99)

### HTTP
- Requêtes totales
- Succès / Erreurs
- Requêtes par seconde
- Latence (avg, p50, p95, p99, min, max)
- Distribution des codes HTTP

### Simulation de jeu
- Réponses soumises
- Buzzer pressé

### Système
- Utilisation mémoire du test
- Pic de connexions

## Rapport généré

Le test génère un rapport JSON avec toutes les métriques:

```bash
load-test-report-{timestamp}.json
```

Structure du rapport:
```json
{
  "summary": {
    "duration": 120,
    "wsClients": 100,
    "httpClients": 200,
    "status": "PASS"
  },
  "websocket": {
    "connectionAttempts": 100,
    "successful": 98,
    "errors": 2,
    "peakConnections": 98,
    "avgLatencyMs": 45.2,
    "p95LatencyMs": 120
  },
  "http": {
    "totalRequests": 48000,
    "successful": 47950,
    "errors": 50,
    "requestsPerSecond": 400,
    "avgLatencyMs": 12.5,
    "p95LatencyMs": 45
  },
  "errors": { ... }
}
```

## Critères de succès

| Métrique | PASS | WARNING | FAIL |
|----------|------|---------|------|
| WebSocket Success Rate | ≥90% | 70-90% | <70% |
| HTTP Success Rate | ≥95% | 80-95% | <80% |

## Exemples d'utilisation

### Test rapide en développement
```bash
./run-test.sh light
```

### Test de production simulé
```bash
./run-test.sh heavy
```

### Test de stress (trouver les limites)
```bash
./run-test.sh stress
```

### Monitoring pendant le test
Dans un terminal séparé:
```bash
./monitor.sh
```

## Troubleshooting

### Erreur "Too many open files"
```bash
ulimit -n 65535
```

### API non accessible
Vérifier que l'API est lancée:
```bash
curl http://localhost:3001/health
```

### Connexions WebSocket échouent
- Vérifier les logs de l'API
- Augmenter `pingTimeout` et `pingInterval` si nécessaire
