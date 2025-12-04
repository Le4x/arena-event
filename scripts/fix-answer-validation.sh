#!/bin/bash

# Arena Event - Answer Validation & Reveal Fix
# Fixes:
# 1. Points not added automatically during reveal
# 2. Incorrect answer display even when correct

set -e

cd /root/arena-event/simple-api

echo "🔧 Applying answer validation fixes..."

# Backup current file
cp index.js index.js.backup-answer-fix-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup created"

# Create the fix patch
cat > /tmp/answer-fix.patch << 'PATCH_EOF'
// ========================================
// IMPROVED ANSWER COMPARISON FUNCTION
// ========================================

// Normalize answer for comparison (case-insensitive, trim spaces, normalize accents)
function normalizeAnswer(answer) {
  if (!answer) return '';
  return answer
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
}

// Compare answers intelligently
function compareAnswers(userAnswer, correctAnswer) {
  const normalized1 = normalizeAnswer(userAnswer);
  const normalized2 = normalizeAnswer(correctAnswer);

  // Exact match after normalization
  if (normalized1 === normalized2) return true;

  // Partial match for long answers (contains the correct answer)
  if (normalized2.length > 5 && normalized1.includes(normalized2)) return true;
  if (normalized1.length > 5 && normalized2.includes(normalized1)) return true;

  return false;
}

// ========================================
// REVEAL WITH AUTOMATIC SCORE CALCULATION
// ========================================

socket.on('blindtest-reveal', async (data) => {
  const sessionId = data.sessionId || socket.sessionId;
  const { questionId } = data;

  console.log(\`🎯 Blindtest reveal in session \${sessionId}: \${data.artist} - \${data.songTitle}\`);

  try {
    // If questionId is provided, validate all answers and award points
    if (questionId) {
      const question = await prisma.question.findUnique({ where: { id: questionId } });

      if (question) {
        // Get all submitted answers for this question
        const answers = await prisma.answer.findMany({
          where: { questionId },
          include: { team: true }
        });

        console.log(\`📊 Validating \${answers.length} answers for reveal...\`);

        // Validate and update each answer
        for (const answer of answers) {
          const isCorrect = compareAnswers(answer.content, question.correctAnswer);

          // Calculate points based on correctness
          let points = 0;
          if (isCorrect) {
            points = answer.points > 0 ? answer.points : question.points;

            // Update team score if not already added
            if (answer.points === 0) {
              await prisma.team.update({
                where: { id: answer.teamId },
                data: { score: { increment: points } }
              });

              // Update answer record
              await prisma.answer.update({
                where: { id: answer.id },
                data: {
                  isCorrect: true,
                  points
                }
              });

              console.log(\`✅ Team \${answer.team.name} awarded \${points} points on reveal\`);
            }
          } else {
            // Update as incorrect if needed
            if (answer.isCorrect === null || answer.isCorrect === undefined) {
              await prisma.answer.update({
                where: { id: answer.id },
                data: { isCorrect: false, points: 0 }
              });
            }
          }
        }

        // Get updated scores
        const teams = await prisma.team.findMany({
          where: { sessionId },
          orderBy: { score: 'desc' }
        });

        // Broadcast updated leaderboard
        io.to(\`session:\${sessionId}\`).emit('leaderboard-update', {
          teams: teams.map(t => ({
            id: t.id,
            name: t.name,
            score: t.score
          }))
        });
      }
    }

    // Broadcast reveal info
    io.to(\`session:\${sessionId}\`).emit('blindtest-reveal', {
      questionId,
      artist: data.artist,
      songTitle: data.songTitle,
      audioUrl: data.audioUrl,
      correctAnswer: data.correctAnswer || \`\${data.artist} - \${data.songTitle}\`,
      startTime: data.startTime || data.revealCueStart || 0,
      endTime: data.endTime || data.revealCueEnd || null,
      revealCueStart: data.revealCueStart,
      revealCueEnd: data.revealCueEnd
    });

  } catch (error) {
    console.error('❌ Error during reveal:', error);
    // Still broadcast reveal even if validation fails
    io.to(\`session:\${sessionId}\`).emit('blindtest-reveal', {
      artist: data.artist,
      songTitle: data.songTitle,
      audioUrl: data.audioUrl,
      startTime: data.startTime || data.revealCueStart || 0,
      endTime: data.endTime || data.revealCueEnd || null
    });
  }
});
PATCH_EOF

echo "✅ Patch file created"

# Now apply the patch by inserting it into index.js
node << 'NODE_PATCH'
const fs = require('fs');

const content = fs.readFileSync('index.js', 'utf-8');
const lines = content.split('\n');

// Find the line with the old blindtest-reveal handler
const revealLineIndex = lines.findIndex(line => line.includes("socket.on('blindtest-reveal'"));

if (revealLineIndex === -1) {
  console.log('❌ Could not find blindtest-reveal handler');
  process.exit(1);
}

// Find the end of the old handler (next closing bracket)
let endIndex = revealLineIndex;
let bracketCount = 0;
let started = false;

for (let i = revealLineIndex; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('{')) {
    started = true;
    bracketCount++;
  }
  if (line.includes('}')) {
    bracketCount--;
  }
  if (started && bracketCount === 0 && line.includes('});')) {
    endIndex = i;
    break;
  }
}

console.log(\`Found old handler from line \${revealLineIndex + 1} to \${endIndex + 1}\`);

// Read the patch
const patch = fs.readFileSync('/tmp/answer-fix.patch', 'utf-8');

// Insert helper functions before the handler
const insertIndex = revealLineIndex - 2;
const newLines = [
  ...lines.slice(0, insertIndex),
  '',
  patch,
  '',
  ...lines.slice(endIndex + 1)
];

fs.writeFileSync('index.js', newLines.join('\n'));
console.log('✅ Patch applied successfully');
NODE_PATCH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Answer validation fixes applied!"
  echo ""
  echo "📋 Changes made:"
  echo "  1. ✅ Added intelligent answer comparison (case-insensitive, accent-insensitive)"
  echo "  2. ✅ Reveal event now validates all answers automatically"
  echo "  3. ✅ Points awarded automatically during reveal"
  echo "  4. ✅ Leaderboard updated after reveal"
  echo ""
  echo "🔄 Restart API to apply:"
  echo "   pm2 restart arena-api"
  echo "   pm2 logs arena-api --lines 30"
  echo ""
else
  echo "❌ Patch failed - restoring backup"
  cp index.js.backup-answer-fix-$(date +%Y%m%d-%H%M%S) index.js
  exit 1
fi
