#!/bin/bash
# ============================================
# Arena Event - VPS Deployment (sans Docker)
# ============================================
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/arena-event}"
NODE_VERSION="20"

# ============================================
# Installation des dépendances système
# ============================================
install_dependencies() {
    info "Installation des dépendances système..."

    apt-get update
    apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

    # Node.js via nvm ou NodeSource
    if ! command -v node &> /dev/null; then
        info "Installation de Node.js $NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
    fi

    # PM2 pour la gestion des processus
    if ! command -v pm2 &> /dev/null; then
        info "Installation de PM2..."
        npm install -g pm2
    fi

    # PostgreSQL
    if ! command -v psql &> /dev/null; then
        info "Installation de PostgreSQL..."
        apt-get install -y postgresql postgresql-contrib
        systemctl enable postgresql
        systemctl start postgresql
    fi

    success "Dépendances installées"
}

# ============================================
# Configuration PostgreSQL
# ============================================
setup_database() {
    info "Configuration de la base de données..."

    # Créer l'utilisateur et la base si non existants
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='arena'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER arena WITH PASSWORD '${DB_PASSWORD:-arena123}';"

    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='arena_event'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE arena_event OWNER arena;"

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE arena_event TO arena;"

    success "Base de données configurée"
}

# ============================================
# Clone/Update du repository
# ============================================
setup_repository() {
    info "Configuration du repository..."

    if [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
        git fetch origin
        git pull origin main
    else
        git clone https://github.com/Le4x/arena-event.git "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    success "Repository prêt"
}

# ============================================
# Installation et Build
# ============================================
build_application() {
    info "Installation des dépendances npm..."
    cd "$INSTALL_DIR"

    npm ci

    info "Build de l'application..."
    npm run build

    info "Génération Prisma et migration..."
    cd "$INSTALL_DIR/simple-api"
    npx prisma generate
    npx prisma migrate deploy

    success "Application buildée"
}

# ============================================
# Configuration des environnements
# ============================================
setup_environment() {
    info "Configuration de l'environnement..."

    # Simple API
    cat > "$INSTALL_DIR/simple-api/.env" << EOF
DATABASE_URL="postgresql://arena:${DB_PASSWORD:-arena123}@localhost:5432/arena_event?schema=public"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64 | tr -d '\n')}"
PORT=3000
NODE_ENV=production
SIMPLE_API_UPLOAD_TOKEN="${UPLOAD_TOKEN:-$(openssl rand -base64 32 | tr -d '\n')}"
EOF

    # Apps Next.js - créer les .env.local
    for app in web-admin web-player web-screen web-studio; do
        cat > "$INSTALL_DIR/apps/$app/.env.local" << EOF
NEXT_PUBLIC_API_URL=https://api.${DOMAIN:-arena-event.fr}
NEXT_PUBLIC_WS_URL=https://ws.${DOMAIN:-arena-event.fr}
NEXT_PUBLIC_ADMIN_URL=https://admin.${DOMAIN:-arena-event.fr}
NEXT_PUBLIC_PLAYER_URL=https://player.${DOMAIN:-arena-event.fr}
NEXT_PUBLIC_SCREEN_URL=https://screen.${DOMAIN:-arena-event.fr}
NEXT_PUBLIC_STUDIO_URL=https://studio.${DOMAIN:-arena-event.fr}
EOF
    done

    success "Environnement configuré"
}

# ============================================
# Configuration PM2
# ============================================
setup_pm2() {
    info "Configuration de PM2..."

    # Créer le fichier ecosystem
    cat > "$INSTALL_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'arena-api',
      cwd: './simple-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'arena-admin',
      cwd: './apps/web-admin',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'arena-player',
      cwd: './apps/web-player',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'arena-screen',
      cwd: './apps/web-screen',
      script: 'node_modules/.bin/next',
      args: 'start -p 3004',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'arena-studio',
      cwd: './apps/web-studio',
      script: 'node_modules/.bin/next',
      args: 'start -p 3005',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

    # Démarrer avec PM2
    cd "$INSTALL_DIR"
    pm2 delete all 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup systemd -u root --hp /root

    success "PM2 configuré"
}

# ============================================
# Configuration Nginx
# ============================================
setup_nginx() {
    info "Configuration de Nginx..."

    DOMAIN="${DOMAIN:-arena-event.fr}"

    cat > "/etc/nginx/sites-available/arena-event" << EOF
# API et WebSocket
server {
    listen 80;
    server_name api.$DOMAIN ws.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        client_max_body_size 100M;
    }
}

# Admin
server {
    listen 80;
    server_name admin.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Player
server {
    listen 80;
    server_name player.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Screen
server {
    listen 80;
    server_name screen.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Studio
server {
    listen 80;
    server_name studio.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/arena-event /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    nginx -t && systemctl reload nginx

    success "Nginx configuré"
}

# ============================================
# SSL avec Certbot
# ============================================
setup_ssl() {
    info "Configuration SSL..."

    DOMAIN="${DOMAIN:-arena-event.fr}"

    read -p "Configurer SSL maintenant ? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        certbot --nginx -d api.$DOMAIN -d ws.$DOMAIN -d admin.$DOMAIN -d player.$DOMAIN -d screen.$DOMAIN -d studio.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        success "SSL configuré"
    else
        warning "SSL ignoré - à configurer manuellement avec: certbot --nginx"
    fi
}

# ============================================
# Afficher le status
# ============================================
show_status() {
    echo ""
    echo "============================================"
    echo "     Arena Event - Déploiement terminé"
    echo "============================================"
    echo ""
    pm2 status
    echo ""
    echo "URLs (après configuration DNS):"
    echo "  Admin:   https://admin.${DOMAIN:-arena-event.fr}"
    echo "  Player:  https://player.${DOMAIN:-arena-event.fr}"
    echo "  Screen:  https://screen.${DOMAIN:-arena-event.fr}"
    echo "  Studio:  https://studio.${DOMAIN:-arena-event.fr}"
    echo "  API:     https://api.${DOMAIN:-arena-event.fr}"
    echo ""
    echo "Commandes utiles:"
    echo "  pm2 logs           - Voir les logs"
    echo "  pm2 restart all    - Redémarrer"
    echo "  pm2 monit          - Monitoring temps réel"
    echo ""
}

# ============================================
# Main
# ============================================
main() {
    echo ""
    echo "============================================"
    echo "    Arena Event - Déploiement VPS"
    echo "============================================"
    echo ""

    if [[ $EUID -ne 0 ]]; then
        error "Ce script doit être exécuté en root"
    fi

    install_dependencies
    setup_database
    setup_repository
    setup_environment
    build_application
    setup_pm2
    setup_nginx
    setup_ssl
    show_status
}

# Arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    update)
        cd "$INSTALL_DIR"
        git pull origin main
        npm ci
        npm run build
        cd simple-api && npx prisma migrate deploy && cd ..
        pm2 restart all
        show_status
        ;;
    restart)
        pm2 restart all
        ;;
    logs)
        pm2 logs
        ;;
    status)
        pm2 status
        ;;
    *)
        echo "Usage: $0 {deploy|update|restart|logs|status}"
        ;;
esac
