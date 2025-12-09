#!/bin/bash

echo "🔧 Correction automatique de PostgreSQL pour Arena Event"
echo ""

# Détecte la version de PostgreSQL
PG_VERSION=$(sudo -u postgres psql -t -c "SHOW server_version;" 2>/dev/null | cut -d. -f1 | tr -d ' ')

if [ -z "$PG_VERSION" ]; then
    echo "❌ PostgreSQL ne semble pas être en cours d'exécution"
    echo "Démarrez-le avec: sudo systemctl start postgresql"
    exit 1
fi

echo "✅ PostgreSQL version $PG_VERSION détecté"
echo ""

# 1. Créer l'utilisateur arena s'il n'existe pas
echo "1️⃣ Vérification de l'utilisateur 'arena'..."
USER_EXISTS=$(sudo -u postgres psql -t -c "SELECT 1 FROM pg_user WHERE usename='arena';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" != "1" ]; then
    echo "   → Création de l'utilisateur 'arena'..."
    sudo -u postgres psql -c "CREATE USER arena WITH PASSWORD 'arena123';"
    echo "   ✅ Utilisateur créé"
else
    echo "   ✅ L'utilisateur existe déjà"
    # Mettre à jour le mot de passe au cas où
    sudo -u postgres psql -c "ALTER USER arena WITH PASSWORD 'arena123';"
fi
echo ""

# 2. Créer la base de données si elle n'existe pas
echo "2️⃣ Vérification de la base 'arena_event'..."
DB_EXISTS=$(sudo -u postgres psql -t -c "SELECT 1 FROM pg_database WHERE datname='arena_event';" 2>/dev/null | tr -d ' ')

if [ "$DB_EXISTS" != "1" ]; then
    echo "   → Création de la base de données..."
    sudo -u postgres psql -c "CREATE DATABASE arena_event OWNER arena;"
    echo "   ✅ Base de données créée"
else
    echo "   ✅ La base de données existe déjà"
    # S'assurer que arena est propriétaire
    sudo -u postgres psql -c "ALTER DATABASE arena_event OWNER TO arena;"
fi
echo ""

# 3. Donner tous les privilèges
echo "3️⃣ Attribution des privilèges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE arena_event TO arena;" 2>/dev/null
sudo -u postgres psql -d arena_event -c "GRANT ALL ON SCHEMA public TO arena;" 2>/dev/null
echo "   ✅ Privilèges attribués"
echo ""

# 4. Fixer pg_hba.conf pour autoriser l'authentification par mot de passe
echo "4️⃣ Configuration de l'authentification..."
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_HBA" ]; then
    # Backup
    sudo cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d%H%M%S)"

    # Vérifier si md5 est déjà configuré pour localhost
    if sudo grep -q "^host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA"; then
        echo "   ✅ L'authentification md5 est déjà configurée"
    else
        echo "   → Ajout de la règle d'authentification md5..."
        # Ajouter la ligne avant les autres règles host
        sudo sed -i '/^# IPv4 local connections:/a host    all             all             127.0.0.1/32            md5' "$PG_HBA"
        echo "   ✅ Règle ajoutée"

        echo "   → Rechargement de PostgreSQL..."
        sudo systemctl reload postgresql
        echo "   ✅ PostgreSQL rechargé"
    fi
else
    echo "   ⚠️ Fichier pg_hba.conf non trouvé à $PG_HBA"
fi
echo ""

# 5. Tester la connexion
echo "5️⃣ Test de connexion..."
sleep 2
if PGPASSWORD=arena123 psql -U arena -h localhost -d arena_event -c "SELECT 1;" &>/dev/null; then
    echo "   ✅ Connexion réussie !"
    echo ""
    echo "🎉 PostgreSQL est maintenant configuré correctement !"
else
    echo "   ⚠️ La connexion échoue encore"
    echo ""
    echo "Vérifiez manuellement:"
    echo "  PGPASSWORD=arena123 psql -U arena -h localhost -d arena_event -c 'SELECT 1;'"
fi
echo ""

# 6. Exécuter les migrations Prisma
echo "6️⃣ Application des migrations Prisma..."
cd /root/arena-event/simple-api
if [ -f "prisma/schema.prisma" ]; then
    npx prisma migrate deploy 2>&1 | tail -10
    echo "   ✅ Migrations appliquées"
else
    echo "   ⚠️ Schema Prisma non trouvé"
fi
echo ""

echo "======================================"
echo "✨ Configuration terminée !"
echo "======================================"
echo ""
echo "Redémarrez simple-api:"
echo "  pm2 restart simple-api"
echo "  pm2 logs simple-api"
