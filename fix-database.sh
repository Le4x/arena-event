#!/bin/bash

echo "🔍 Diagnostic de la base de données PostgreSQL..."
echo ""

# Test 1: PostgreSQL est-il en cours d'exécution ?
echo "1️⃣ Vérification du service PostgreSQL..."
systemctl status postgresql 2>&1 | grep -E "(Active|running)" || echo "⚠️ PostgreSQL n'est peut-être pas démarré"
echo ""

# Test 2: Quelle version de PostgreSQL ?
echo "2️⃣ Version PostgreSQL..."
sudo -u postgres psql -c "SELECT version();" 2>&1 | head -3
echo ""

# Test 3: Lister les utilisateurs PostgreSQL
echo "3️⃣ Utilisateurs PostgreSQL..."
sudo -u postgres psql -c "\du" 2>&1
echo ""

# Test 4: Lister les bases de données
echo "4️⃣ Bases de données..."
sudo -u postgres psql -c "\l" 2>&1 | grep arena
echo ""

# Test 5: Tester la connexion avec les identifiants du .env
echo "5️⃣ Test de connexion avec les identifiants actuels..."
PGPASSWORD=arena123 psql -U arena -h localhost -d arena_event -c "SELECT 1;" 2>&1
echo ""

# Test 6: Vérifier pg_hba.conf
echo "6️⃣ Configuration d'authentification (pg_hba.conf)..."
PG_VERSION=$(sudo -u postgres psql -t -c "SHOW server_version;" 2>/dev/null | cut -d. -f1 | tr -d ' ')
if [ -n "$PG_VERSION" ]; then
    echo "Lignes locales dans pg_hba.conf:"
    sudo cat /etc/postgresql/$PG_VERSION/main/pg_hba.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -10
else
    echo "⚠️ Impossible de détecter la version PostgreSQL"
fi
echo ""

echo "======================================"
echo "📋 SOLUTIONS POSSIBLES:"
echo "======================================"
echo ""
echo "Si l'utilisateur 'arena' n'existe pas, créez-le:"
echo "  sudo -u postgres psql -c \"CREATE USER arena WITH PASSWORD 'arena123';\""
echo "  sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE arena_event TO arena;\""
echo ""
echo "Si l'authentification échoue, modifiez pg_hba.conf:"
echo "  sudo nano /etc/postgresql/$PG_VERSION/main/pg_hba.conf"
echo "  Changez 'peer' en 'md5' pour les connexions locales"
echo "  Puis: sudo systemctl reload postgresql"
echo ""
echo "Si la base arena_event n'existe pas:"
echo "  sudo -u postgres psql -c \"CREATE DATABASE arena_event OWNER arena;\""
echo ""
