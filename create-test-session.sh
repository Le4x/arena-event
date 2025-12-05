#!/bin/bash

# Script pour créer une session de test complète
# Usage: ./create-test-session.sh

API_URL="${API_URL:-http://localhost:3001}"

echo "🎮 Création d'une session de test complète..."
echo "API URL: $API_URL"
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Créer un événement de test
echo -e "${BLUE}📋 Étape 1: Création de l'événement${NC}"
EVENT_RESPONSE=$(curl -s -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "🧪 Session Test - Corrections",
    "description": "Test des corrections TRUE_FALSE et statut online/offline"
  }')

EVENT_ID=$(echo $EVENT_RESPONSE | jq -r '.id')
echo -e "${GREEN}✅ Événement créé: $EVENT_ID${NC}"
echo ""

# 2. Créer des rounds
echo -e "${BLUE}📝 Étape 2: Création des rounds${NC}"

# Round 1: Questions variées
ROUND1_RESPONSE=$(curl -s -X POST "$API_URL/events/$EVENT_ID/rounds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Round 1 - Questions Variées",
    "description": "MCQ, TRUE_FALSE, BUZZER"
  }')

ROUND1_ID=$(echo $ROUND1_RESPONSE | jq -r '.id')
echo -e "${GREEN}✅ Round 1 créé: $ROUND1_ID${NC}"

# Round 2: TRUE_FALSE spécial
ROUND2_RESPONSE=$(curl -s -X POST "$API_URL/events/$EVENT_ID/rounds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Round 2 - TRUE_FALSE Test",
    "description": "Test spécifique pour TRUE_FALSE"
  }')

ROUND2_ID=$(echo $ROUND2_RESPONSE | jq -r '.id')
echo -e "${GREEN}✅ Round 2 créé: $ROUND2_ID${NC}"
echo ""

# 3. Créer des questions pour Round 1
echo -e "${BLUE}❓ Étape 3: Création des questions - Round 1${NC}"

# Question 1: MCQ
curl -s -X POST "$API_URL/rounds/$ROUND1_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Quelle est la capitale de la France?",
    "type": "MCQ",
    "options": ["Paris", "Lyon", "Marseille", "Toulouse"],
    "correctAnswer": "A",
    "points": 100,
    "timeLimit": 15
  }' > /dev/null
echo -e "${GREEN}✅ Q1: MCQ - Capitale de la France${NC}"

# Question 2: TRUE_FALSE
curl -s -X POST "$API_URL/rounds/$ROUND1_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "La Terre est plate",
    "type": "TRUE_FALSE",
    "correctAnswer": "FALSE",
    "points": 100,
    "timeLimit": 10
  }' > /dev/null
echo -e "${GREEN}✅ Q2: TRUE_FALSE - La Terre est plate (FALSE)${NC}"

# Question 3: BUZZER
curl -s -X POST "$API_URL/rounds/$ROUND1_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Qui a peint la Joconde?",
    "type": "BUZZER",
    "correctAnswer": "Leonardo da Vinci",
    "points": 150,
    "timeLimit": 20
  }' > /dev/null
echo -e "${GREEN}✅ Q3: BUZZER - Qui a peint la Joconde?${NC}"

# Question 4: MCQ
curl -s -X POST "$API_URL/rounds/$ROUND1_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Combien de continents y a-t-il sur Terre?",
    "type": "MCQ",
    "options": ["5", "6", "7", "8"],
    "correctAnswer": "C",
    "points": 100,
    "timeLimit": 15
  }' > /dev/null
echo -e "${GREEN}✅ Q4: MCQ - Nombre de continents${NC}"

echo ""

# 4. Créer des questions pour Round 2 (spécial TRUE_FALSE)
echo -e "${BLUE}❓ Étape 4: Création des questions - Round 2 (TRUE_FALSE)${NC}"

# Question 1: TRUE
curl -s -X POST "$API_URL/rounds/$ROUND2_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Le soleil est une étoile",
    "type": "TRUE_FALSE",
    "correctAnswer": "TRUE",
    "points": 100,
    "timeLimit": 10
  }' > /dev/null
echo -e "${GREEN}✅ Q1: Le soleil est une étoile (TRUE)${NC}"

# Question 2: FALSE
curl -s -X POST "$API_URL/rounds/$ROUND2_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Les humains peuvent respirer sous l eau sans équipement",
    "type": "TRUE_FALSE",
    "correctAnswer": "FALSE",
    "points": 100,
    "timeLimit": 10
  }' > /dev/null
echo -e "${GREEN}✅ Q2: Respirer sous l'eau (FALSE)${NC}"

# Question 3: TRUE
curl -s -X POST "$API_URL/rounds/$ROUND2_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "1 + 1 = 2",
    "type": "TRUE_FALSE",
    "correctAnswer": "TRUE",
    "points": 50,
    "timeLimit": 5
  }' > /dev/null
echo -e "${GREEN}✅ Q3: 1 + 1 = 2 (TRUE)${NC}"

# Question 4: FALSE
curl -s -X POST "$API_URL/rounds/$ROUND2_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "La Lune est faite de fromage",
    "type": "TRUE_FALSE",
    "correctAnswer": "FALSE",
    "points": 100,
    "timeLimit": 10
  }' > /dev/null
echo -e "${GREEN}✅ Q4: La Lune est faite de fromage (FALSE)${NC}"

# Question 5: TRUE
curl -s -X POST "$API_URL/rounds/$ROUND2_ID/questions" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Paris est la capitale de la France",
    "type": "TRUE_FALSE",
    "correctAnswer": "TRUE",
    "points": 100,
    "timeLimit": 10
  }' > /dev/null
echo -e "${GREEN}✅ Q5: Paris capitale de France (TRUE)${NC}"

echo ""

# 5. Créer une session
echo -e "${BLUE}🎯 Étape 5: Création de la session${NC}"
SESSION_RESPONSE=$(curl -s -X POST "$API_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\"
  }")

SESSION_CODE=$(echo $SESSION_RESPONSE | jq -r '.session.code')
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session.id')

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                                            ║${NC}"
echo -e "${YELLOW}║      ✅ SESSION DE TEST CRÉÉE !            ║${NC}"
echo -e "${YELLOW}║                                            ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 Détails de la session:${NC}"
echo -e "   Code de session: ${YELLOW}$SESSION_CODE${NC}"
echo -e "   ID de session: $SESSION_ID"
echo -e "   ID d'événement: $EVENT_ID"
echo ""
echo -e "${GREEN}📱 Pour tester:${NC}"
echo -e "   1. Ouvrez https://player.arena-event.fr"
echo -e "   2. Entrez le code: ${YELLOW}$SESSION_CODE${NC}"
echo -e "   3. Créez une équipe et testez!"
echo ""
echo -e "${GREEN}🎮 Studio:${NC}"
echo -e "   Ouvrez https://studio.arena-event.fr"
echo -e "   Sélectionnez la session avec le code ${YELLOW}$SESSION_CODE${NC}"
echo ""
echo -e "${GREEN}📊 Contenu de la session:${NC}"
echo -e "   • Round 1: 4 questions (MCQ, TRUE_FALSE, BUZZER)"
echo -e "   • Round 2: 5 questions TRUE_FALSE pour tester la correction"
echo ""
echo -e "${BLUE}🔍 Points à tester:${NC}"
echo -e "   ✓ Validation TRUE_FALSE (VRAI/FAUX)"
echo -e "   ✓ Statut online/offline (changement d'app mobile)"
echo -e "   ✓ Reconnexion automatique (< 5 secondes)"
echo -e "   ✓ Modification de réponse (upsert)"
echo ""
