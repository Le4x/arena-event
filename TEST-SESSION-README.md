# 🧪 Session de Test - Guide Complet

Ce guide vous permet de créer et tester une session complète pour valider les corrections apportées.

## 🚀 Création rapide de la session

### Option 1: Script automatique (Recommandé)

```bash
cd /home/user/arena-event
./create-test-session.sh
```

Le script créera automatiquement:
- ✅ 1 événement de test
- ✅ 2 rounds (questions variées + spécial TRUE_FALSE)
- ✅ 9 questions au total
- ✅ 1 session prête à utiliser

### Option 2: Utiliser l'API de production

```bash
cd /home/user/arena-event
API_URL=https://api.arena-event.fr ./create-test-session.sh
```

---

## 📋 Contenu de la session de test

### Round 1: Questions Variées (4 questions)
1. **MCQ** - "Quelle est la capitale de la France?" (A: Paris) - 100pts, 15s
2. **TRUE_FALSE** - "La Terre est plate" (FALSE) - 100pts, 10s
3. **BUZZER** - "Qui a peint la Joconde?" (Leonardo da Vinci) - 150pts, 20s
4. **MCQ** - "Combien de continents y a-t-il sur Terre?" (C: 7) - 100pts, 15s

### Round 2: TRUE_FALSE Spécial (5 questions)
1. "Le soleil est une étoile" **(TRUE)** - 100pts, 10s
2. "Les humains peuvent respirer sous l'eau sans équipement" **(FALSE)** - 100pts, 10s
3. "1 + 1 = 2" **(TRUE)** - 50pts, 5s
4. "La Lune est faite de fromage" **(FALSE)** - 100pts, 10s
5. "Paris est la capitale de la France" **(TRUE)** - 100pts, 10s

---

## 🧪 Plan de Test

### Test 1: Validation TRUE_FALSE ✅
**Objectif:** Vérifier que les réponses TRUE/FALSE sont correctement validées

1. Lancez le studio et sélectionnez la session
2. Allez au Round 2 (TRUE_FALSE Spécial)
3. Sur votre smartphone, rejoignez avec le code de session
4. Répondez à chaque question TRUE_FALSE
5. **Vérifiez:** Les bonnes réponses donnent des points ✅

**Réponses attendues:**
- Q1: VRAI ✅
- Q2: FAUX ✅
- Q3: VRAI ✅
- Q4: FAUX ✅
- Q5: VRAI ✅

### Test 2: Statut Online/Offline 📱
**Objectif:** Vérifier que le statut reste stable lors du changement d'app

1. Rejoignez la session sur votre smartphone
2. Sur le studio/écran, vérifiez que vous êtes **ONLINE** 🟢
3. **Changez d'app** sur votre téléphone (mettez en arrière-plan)
4. Attendez 2-3 secondes
5. **Revenez sur Arena Event**
6. **Vérifiez:** Le statut est resté **ONLINE** 🟢 (grace period de 5s)

### Test 3: Reconnexion Automatique 🔄
**Objectif:** Vérifier la reconnexion automatique après changement d'app

1. Rejoignez la session sur votre smartphone
2. Mettez l'app en arrière-plan pendant 10 secondes
3. Le statut passe **OFFLINE** 🔴 (normal après 5s)
4. **Revenez sur Arena Event**
5. **Vérifiez:** La reconnexion est automatique et le statut repasse **ONLINE** 🟢

### Test 4: Modification de Réponse 🔁
**Objectif:** Vérifier qu'on peut modifier sa réponse (upsert)

1. Répondez à une question MCQ
2. Tentez de répondre à nouveau (si possible avant la fin du timer)
3. **Vérifiez:** Aucune erreur de contrainte unique ✅
4. La nouvelle réponse remplace l'ancienne ✅

---

## 📊 Vérification des Logs

Pendant les tests, surveillez les logs du serveur:

```bash
# Afficher les logs en temps réel
tail -f /var/log/arena-event-api.log

# Ou si vous utilisez PM2
pm2 logs simple-api
```

### Logs à surveiller:

**Pour TRUE_FALSE:**
```
🔍 TRUE_FALSE Debug: {
  originalAnswer: 'TRUE',
  normalizedAnswer: 'TRUE',
  originalCorrect: 'TRUE',
  normalizedCorrect: 'TRUE',
  isCorrect: true,
  match: true
}
```
✅ Si `isCorrect: true` et les valeurs correspondent → **Validation OK**

**Pour le statut:**
```
Team c7a256eb reconnected (disconnect cancelled)
Team c7a256eb disconnect scheduled (5s grace period)
```
✅ Si "reconnected (disconnect cancelled)" → **Grace period OK**

---

## 🐛 Problèmes Connus

### Si les questions TRUE_FALSE ne fonctionnent toujours pas:

1. **Vérifiez la BDD:** Les anciennes questions ont peut-être "A" au lieu de "TRUE"
   ```sql
   SELECT id, content, type, correctAnswer
   FROM Question
   WHERE type = 'TRUE_FALSE';
   ```

2. **Solution:** Supprimez et recréez les questions problématiques dans l'admin

### Si le statut ne change pas:

1. Vérifiez que l'API a bien la grace period de 5s (ligne 141 de `simple-api/index.js`)
2. Redémarrez l'API pour appliquer les changements
3. Vérifiez les logs pour voir si "disconnect scheduled" apparaît

---

## 📝 Notes

- **Grace Period:** 5 secondes pour les changements d'app mobile
- **Debug TRUE_FALSE:** Les logs détaillés sont activés automatiquement
- **Upsert:** Permet de modifier sa réponse sans erreur de contrainte

---

## ✅ Checklist de Test

- [ ] Session créée avec le script
- [ ] Code de session obtenu
- [ ] Round 1 testé (MCQ, TRUE_FALSE, BUZZER)
- [ ] Round 2 testé (5x TRUE_FALSE)
- [ ] Toutes les réponses TRUE_FALSE validées correctement
- [ ] Statut reste online pendant changement d'app < 5s
- [ ] Reconnexion automatique fonctionne
- [ ] Pas d'erreur de contrainte unique sur les réponses
- [ ] Logs serveur vérifiés

---

## 🆘 Besoin d'aide?

Si vous rencontrez des problèmes:

1. Vérifiez les logs: `tail -f /tmp/api.log`
2. Vérifiez que l'API est démarrée: `ps aux | grep node`
3. Testez l'API: `curl http://localhost:3001/health`

Bon test! 🚀
