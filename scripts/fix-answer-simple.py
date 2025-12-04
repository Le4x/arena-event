#!/usr/bin/env python3
"""
Simple Python script to fix answer validation bugs
"""

import sys
import shutil
from datetime import datetime

# Read the current index.js
with open('/root/arena-event/simple-api/index.js', 'r') as f:
    content = f.read()

# Backup
backup_name = f'/root/arena-event/simple-api/index.js.backup-{datetime.now().strftime("%Y%m%d-%H%M%S")}'
shutil.copy('/root/arena-event/simple-api/index.js', backup_name)
print(f'✅ Backup created: {backup_name}')

# Define the new reveal handler
new_reveal_code = """
  // ========== HELPER FUNCTIONS FOR ANSWER VALIDATION ==========

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

  // ========== REVEAL WITH AUTO SCORE CALCULATION ==========

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

          console.log(`📊 Validating ${answers.length} answers for reveal...`);

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
              console.log(`✅ Team ${answer.team.name} awarded ${points} points on reveal`);
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
"""

# Find and replace the old handler
# Look for: socket.on('blindtest-reveal', (data) => {
# Until: });  (the closing of that handler)

import re

# Pattern to match the old handler
pattern = r"  socket\.on\('blindtest-reveal', \(data\) => \{[^}]*\n.*?audioUrl: data\.audioUrl,\n.*?startTime:.*?\n.*?endTime:.*?\n.*?revealCueStart:.*?\n.*?revealCueEnd:.*?\n.*?\}\);\n  \}\);"

# Replace with new code
new_content = re.sub(pattern, new_reveal_code.strip(), content, flags=re.DOTALL)

if new_content == content:
    print('❌ Could not find the old handler to replace')
    print('Trying alternative pattern...')

    # Try simpler pattern
    pattern2 = r"  socket\.on\('blindtest-reveal'.*?\n  \}\);"
    new_content = re.sub(pattern2, new_reveal_code.strip(), content, flags=re.DOTALL, count=1)

    if new_content == content:
        print('❌ Still could not find handler')
        sys.exit(1)

# Write the fixed file
with open('/root/arena-event/simple-api/index.js', 'w') as f:
    f.write(new_content)

print('✅ Answer validation fix applied!')
print('')
print('📋 Changes made:')
print('  1. ✅ Added intelligent answer comparison (case/accent insensitive)')
print('  2. ✅ Reveal event now validates all answers automatically')
print('  3. ✅ Points awarded automatically during reveal')
print('  4. ✅ Leaderboard updated after reveal')
print('')
print('🔄 Restart API:')
print('   pm2 restart arena-api')
print('   pm2 logs arena-api --lines 30')
