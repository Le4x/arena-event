# Manuel Fix - Answer Validation & Reveal

## Ce qui sera fixé :
1. ✅ Points ajoutés automatiquement au reveal
2. ✅ Comparaison intelligente des réponses (ignore casse/espaces/accents)
3. ✅ Affichage correct du statut des réponses

## Étapes :

### 1. Backup
```bash
cd /root/arena-event/simple-api
cp index.js index.js.backup-manual
```

### 2. Trouver la ligne `socket.on('blindtest-reveal'`

Elle devrait être autour de la ligne 1623.

### 3. Remplacer TOUT le handler par ce nouveau code :

```javascript
// ========================================
// IMPROVED ANSWER COMPARISON
// ========================================
function normalizeAnswer(answer) {
  if (!answer) return '';
  return answer.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function compareAnswers(userAnswer, correctAnswer) {
  const norm1 = normalizeAnswer(userAnswer);
  const norm2 = normalizeAnswer(correctAnswer);
  if (norm1 === norm2) return true;
  if (norm2.length > 5 && norm1.includes(norm2)) return true;
  if (norm1.length > 5 && norm2.includes(norm1)) return true;
  return false;
}

// ========================================
// REVEAL WITH AUTO SCORE CALCULATION
// ========================================
socket.on('blindtest-reveal', async (data) => {
  const sessionId = data.sessionId || socket.sessionId;
  const { questionId } = data;

  console.log(`🎯 Reveal: ${data.artist} - ${data.songTitle}`);

  try {
    if (questionId) {
      const question = await prisma.question.findUnique({ where: { id: questionId } });

      if (question) {
        const answers = await prisma.answer.findMany({
          where: { questionId },
          include: { team: true }
        });

        console.log(`📊 Validating ${answers.length} answers...`);

        for (const answer of answers) {
          const isCorrect = compareAnswers(answer.content, question.correctAnswer);

          if (isCorrect && answer.points === 0) {
            const points = question.points;
            await prisma.team.update({
              where: { id: answer.teamId },
              data: { score: { increment: points } }
            });
            await prisma.answer.update({
              where: { id: answer.id },
              data: { isCorrect: true, points }
            });
            console.log(`✅ ${answer.team.name} +${points} points`);
          } else if (!isCorrect) {
            await prisma.answer.update({
              where: { id: answer.id },
              data: { isCorrect: false, points: 0 }
            });
          }
        }

        const teams = await prisma.team.findMany({
          where: { sessionId },
          orderBy: { score: 'desc' }
        });

        io.to(`session:${sessionId}`).emit('leaderboard-update', {
          teams: teams.map(t => ({ id: t.id, name: t.name, score: t.score }))
        });
      }
    }

    io.to(`session:${sessionId}`).emit('blindtest-reveal', {
      questionId,
      artist: data.artist,
      songTitle: data.songTitle,
      correctAnswer: data.correctAnswer || `${data.artist} - ${data.songTitle}`,
      audioUrl: data.audioUrl,
      startTime: data.startTime || data.revealCueStart || 0,
      endTime: data.endTime || data.revealCueEnd || null,
      revealCueStart: data.revealCueStart,
      revealCueEnd: data.revealCueEnd
    });
  } catch (error) {
    console.error('❌ Reveal error:', error);
    io.to(`session:${sessionId}`).emit('blindtest-reveal', {
      artist: data.artist,
      songTitle: data.songTitle
    });
  }
});
```

### 4. Mettre à jour aussi la fonction handleAnswerSubmit

Ligne ~1660, remplacer :
```javascript
const isCorrect = answer === question.correctAnswer;
```

Par :
```javascript
const isCorrect = compareAnswers(answer, question.correctAnswer);
```

### 5. Redémarrer
```bash
pm2 restart arena-api
pm2 logs arena-api
```

Vous devriez voir les logs "✅ Team XXX +YY points" lors des reveals !
