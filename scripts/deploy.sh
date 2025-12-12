#!/bin/bash
# ============================================
# Arena Event - Deployment Script
# ============================================
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/Le4x/arena-event.git"
BRANCH="main"
INSTALL_DIR="/opt/arena-event"
DOMAIN="arena-event.fr"

# Print functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Install dependencies
install_dependencies() {
    info "Installing system dependencies..."

    apt-get update
    apt-get install -y \
        curl \
        git \
        wget \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        jq

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        systemctl enable docker
        systemctl start docker
    fi

    # Install Docker Compose v2 if not present
    if ! docker compose version &> /dev/null; then
        info "Installing Docker Compose..."
        apt-get install -y docker-compose-plugin
    fi

    success "Dependencies installed"
}

# Clone or update repository
setup_repository() {
    info "Setting up repository..."

    if [ -d "$INSTALL_DIR" ]; then
        warning "Directory exists, pulling latest changes..."
        cd "$INSTALL_DIR"
        git fetch origin
        git checkout $BRANCH
        git pull origin $BRANCH
    else
        info "Cloning repository..."
        git clone -b $BRANCH $REPO_URL $INSTALL_DIR
        cd "$INSTALL_DIR"
    fi

    success "Repository ready"
}

# Setup environment
setup_environment() {
    info "Setting up environment..."

    if [ ! -f "$INSTALL_DIR/.env.production" ]; then
        if [ -f "$INSTALL_DIR/.env.production.example" ]; then
            cp "$INSTALL_DIR/.env.production.example" "$INSTALL_DIR/.env.production"
            warning "Created .env.production from example"
            warning "Please edit $INSTALL_DIR/.env.production with your settings!"

            # Generate random secrets
            JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
            UPLOAD_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
            DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$INSTALL_DIR/.env.production"
            sed -i "s|UPLOAD_TOKEN=.*|UPLOAD_TOKEN=$UPLOAD_TOKEN|g" "$INSTALL_DIR/.env.production"
            sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|g" "$INSTALL_DIR/.env.production"

            success "Generated secure secrets"
        else
            error ".env.production.example not found!"
        fi
    else
        info "Using existing .env.production"
    fi

    # Create symlink for docker-compose
    ln -sf "$INSTALL_DIR/.env.production" "$INSTALL_DIR/.env"

    success "Environment configured"
}

# Setup SSL certificates
setup_ssl() {
    info "Setting up SSL certificates..."

    mkdir -p "$INSTALL_DIR/certbot/conf"
    mkdir -p "$INSTALL_DIR/certbot/www"

    # Check if certificates already exist
    if [ -d "$INSTALL_DIR/certbot/conf/live/$DOMAIN" ]; then
        info "SSL certificates already exist"
        return
    fi

    # Initial certificate request with staging (for testing)
    read -p "Request SSL certificates now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Requesting SSL certificates..."

        # Start nginx temporarily for ACME challenge
        docker compose -f docker-compose.prod.yml up -d nginx
        sleep 5

        # Request certificate
        docker compose -f docker-compose.prod.yml run --rm certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email admin@$DOMAIN \
            --agree-tos \
            --no-eff-email \
            -d $DOMAIN \
            -d api.$DOMAIN \
            -d ws.$DOMAIN \
            -d admin.$DOMAIN \
            -d player.$DOMAIN \
            -d screen.$DOMAIN \
            -d studio.$DOMAIN

        success "SSL certificates obtained"
    else
        warning "Skipping SSL setup. You'll need to configure certificates manually."
    fi
}

# Build and deploy
deploy() {
    info "Building and deploying services..."

    cd "$INSTALL_DIR"

    # Pull latest images
    docker compose -f docker-compose.prod.yml pull

    # Build custom images
    docker compose -f docker-compose.prod.yml build --no-cache

    # Start services
    docker compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    info "Waiting for services to start..."
    sleep 10

    # Run database migrations
    info "Running database migrations..."
    docker compose -f docker-compose.prod.yml exec -T simple-api npx prisma migrate deploy || true

    success "Deployment complete!"
}

# Show status
show_status() {
    echo ""
    echo "============================================"
    echo "          Arena Event Deployment"
    echo "============================================"
    echo ""
    docker compose -f docker-compose.prod.yml ps
    echo ""
    info "Services URLs:"
    echo "  - Admin:   https://admin.$DOMAIN"
    echo "  - Player:  https://player.$DOMAIN"
    echo "  - Screen:  https://screen.$DOMAIN"
    echo "  - Studio:  https://studio.$DOMAIN"
    echo "  - API:     https://api.$DOMAIN"
    echo "  - WS:      https://ws.$DOMAIN"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "============================================"
    echo "     Arena Event - Deployment Script"
    echo "============================================"
    echo ""

    check_root
    install_dependencies
    setup_repository
    setup_environment
    setup_ssl
    deploy
    show_status

    success "Arena Event is now running!"
}

# Parse arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    update)
        cd "$INSTALL_DIR"
        git pull origin $BRANCH
        docker compose -f docker-compose.prod.yml build --no-cache
        docker compose -f docker-compose.prod.yml up -d
        show_status
        ;;
    restart)
        cd "$INSTALL_DIR"
        docker compose -f docker-compose.prod.yml restart
        show_status
        ;;
    stop)
        cd "$INSTALL_DIR"
        docker compose -f docker-compose.prod.yml down
        info "Services stopped"
        ;;
    logs)
        cd "$INSTALL_DIR"
        docker compose -f docker-compose.prod.yml logs -f
        ;;
    status)
        cd "$INSTALL_DIR"
        show_status
        ;;
    *)
        echo "Usage: $0 {deploy|update|restart|stop|logs|status}"
        exit 1
        ;;
esac
