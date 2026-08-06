#!/bin/bash

################################################################################
# SVL-SMS Render Deployment Script
# Purpose: Pre-deployment checks, database migrations, and validation
# Usage: ./.render.sh [check|migrate|validate|health|rollback]
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_ENDPOINT="${RENDER_EXTERNAL_URL:-http://localhost:10000}"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=5
LOG_FILE="/tmp/svl-sms-deployment.log"

################################################################################
# Logging Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

################################################################################
# Pre-Deployment Checks
################################################################################

check_environment() {
    log_info "Starting pre-deployment environment checks..."

    local failed=0

    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        failed=1
    else
        local node_version=$(node -v)
        log_success "Node.js version: $node_version"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        failed=1
    else
        local npm_version=$(npm -v)
        log_success "npm version: $npm_version"
    fi

    # Check required environment variables
    local required_vars=("NODE_ENV" "PORT" "JWT_SECRET" "LICENSE_PRIVATE_KEY" "CORS_ORIGINS")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_warning "Environment variable $var is not set"
        else
            log_success "Environment variable $var is set"
        fi
    done

    # Check database path
    if [ ! -d "./data" ]; then
        log_warning "Data directory does not exist, creating it..."
        mkdir -p ./data
        log_success "Created data directory"
    fi

    # Check if npm dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found, installing dependencies..."
        npm install
        log_success "Dependencies installed"
    fi

    # Check if TypeScript build exists
    if [ ! -d "dist" ]; then
        log_warning "dist directory not found, building TypeScript..."
        npm run build
        log_success "TypeScript build completed"
    fi

    if [ $failed -eq 0 ]; then
        log_success "All pre-deployment checks passed"
        return 0
    else
        log_error "Some pre-deployment checks failed"
        return 1
    fi
}

################################################################################
# Database Migrations
################################################################################

run_database_migrations() {
    log_info "Starting database migrations..."

    # This function assumes database schema initialization is handled by the backend
    # when the application starts. If manual migrations are needed, add them here.

    local db_path="${DB_PATH:-./data/svl-sms.db}"

    if [ ! -f "$db_path" ]; then
        log_info "Database file does not exist, it will be created on first run"
    else
        log_success "Database file exists at $db_path"
    fi

    log_success "Database migration check completed"
}

################################################################################
# Environment Validation
################################################################################

validate_configuration() {
    log_info "Validating deployment configuration..."

    local failed=0

    # Validate PORT is a number
    if ! [[ "${PORT:-10000}" =~ ^[0-9]+$ ]]; then
        log_error "PORT must be a valid number"
        failed=1
    fi

    # Validate NODE_ENV
    local valid_envs=("development" "staging" "production")
    local env_valid=0
    for valid_env in "${valid_envs[@]}"; do
        if [ "${NODE_ENV:-production}" = "$valid_env" ]; then
            env_valid=1
            break
        fi
    done

    if [ $env_valid -eq 0 ]; then
        log_error "NODE_ENV must be one of: ${valid_envs[*]}"
        failed=1
    fi

    # Validate JWT_SECRET is set and not default
    if [ "${JWT_SECRET:-}" = "changeme" ] || [ -z "${JWT_SECRET:-}" ]; then
        log_error "JWT_SECRET must be set to a secure value"
        failed=1
    fi

    # Validate LICENSE_PRIVATE_KEY is set (if using license system)
    if [ "${LICENSE_PRIVATE_KEY:-}" = "changeme" ] || [ -z "${LICENSE_PRIVATE_KEY:-}" ]; then
        log_warning "LICENSE_PRIVATE_KEY should be set for license validation"
    fi

    # Validate CORS_ORIGINS is set
    if [ -z "${CORS_ORIGINS:-}" ]; then
        log_error "CORS_ORIGINS must be configured"
        failed=1
    fi

    if [ $failed -eq 0 ]; then
        log_success "All configuration validations passed"
        return 0
    else
        log_error "Configuration validation failed"
        return 1
    fi
}

################################################################################
# Health Checks
################################################################################

health_check() {
    log_info "Performing health checks on $API_ENDPOINT..."

    local retry_count=0
    local max_retries="${HEALTH_CHECK_RETRIES}"

    while [ $retry_count -lt $max_retries ]; do
        log_info "Health check attempt $((retry_count + 1))/$max_retries..."

        if curl -sf "${API_ENDPOINT}/api/health" > /dev/null 2>&1; then
            local response=$(curl -s "${API_ENDPOINT}/api/health")
            log_success "Health check passed"
            log_info "Response: $response"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                log_warning "Health check failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
                sleep "$HEALTH_CHECK_INTERVAL"
            fi
        fi
    done

    log_error "Health check failed after $max_retries attempts"
    return 1
}

################################################################################
# API Endpoint Testing
################################################################################

test_api_endpoints() {
    log_info "Testing critical API endpoints..."

    local endpoints=(
        "/api/health"
        "/api/auth/status"
    )

    for endpoint in "${endpoints[@]}"; do
        log_info "Testing endpoint: $endpoint"
        if curl -sf "${API_ENDPOINT}${endpoint}" > /dev/null 2>&1; then
            log_success "Endpoint $endpoint is working"
        else
            log_warning "Endpoint $endpoint returned an error"
        fi
    done

    log_success "API endpoint testing completed"
}

################################################################################
# Database Backup
################################################################################

backup_database() {
    log_info "Creating database backup..."

    local db_path="${DB_PATH:-./data/svl-sms.db}"
    local backup_dir="./backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/svl-sms_${timestamp}.db"

    if [ ! -d "$backup_dir" ]; then
        mkdir -p "$backup_dir"
        log_success "Created backups directory"
    fi

    if [ -f "$db_path" ]; then
        cp "$db_path" "$backup_file"
        log_success "Database backed up to $backup_file"

        # Keep only last 10 backups
        cd "$backup_dir" || exit 1
        ls -t svl-sms_*.db | tail -n +11 | xargs -r rm
        log_info "Cleaned old backups (kept last 10)"
        cd - > /dev/null || exit 1
    else
        log_warning "Database file not found, skipping backup"
    fi
}

################################################################################
# Rollback Instructions
################################################################################

rollback_instructions() {
    cat > /tmp/ROLLBACK_INSTRUCTIONS.md << 'EOF'
# SVL-SMS Rollback Instructions

## Immediate Rollback (if deployment fails)

1. **Via Render Dashboard:**
   - Go to https://dashboard.render.com
   - Select the svl-sms-backend service
   - Go to "Deploys" tab
   - Click on the previous successful deployment
   - Click "Redeploy"

2. **Via CLI (if available):**
   ```bash
   render deploy --id <previous-deployment-id>
   ```

## Database Rollback

1. **Restore from backup:**
   ```bash
   cp ./backups/svl-sms_YYYYMMDD_HHMMSS.db ./data/svl-sms.db
   ```

2. **Restart the backend service:**
   - Via Render Dashboard: Click "Restart instance"
   - Via SSH: Restart the application process

## Environment Rollback

1. **Revert environment variables:**
   - Go to Render Dashboard
   - Select svl-sms-backend
   - Go to "Environment"
   - Revert variables to previous values
   - Redeploy

## Complete Rollback Procedure

1. Stop the frontend service (optional, if frontend changes caused issues)
2. Restore database from backup
3. Redeploy backend to previous version
4. Verify health checks pass
5. Monitor logs for errors

## Monitoring After Rollback

- Check application logs
- Verify database integrity
- Test critical user flows
- Monitor error rates
EOF

    log_success "Rollback instructions written to /tmp/ROLLBACK_INSTRUCTIONS.md"
    cat /tmp/ROLLBACK_INSTRUCTIONS.md
}

################################################################################
# Deployment Summary
################################################################################

deployment_summary() {
    cat > /tmp/DEPLOYMENT_SUMMARY.txt << EOF
================================================================================
SVL-SMS Deployment Summary
================================================================================
Timestamp: $(date)
Environment: ${NODE_ENV:-production}
Backend URL: ${API_ENDPOINT}
Frontend URL: ${CORS_ORIGINS%%,*}
Database: ${DB_PATH:-./data/svl-sms.db}

Environment Variables:
  - NODE_ENV: ${NODE_ENV:-NOT SET}
  - PORT: ${PORT:-NOT SET}
  - CORS_ORIGINS: ${CORS_ORIGINS:-NOT SET}
  - FRONTEND_URL: ${FRONTEND_URL:-NOT SET}

Deployment Checks:
  - Environment: $([ -f "$LOG_FILE" ] && grep "All pre-deployment" "$LOG_FILE" && echo "PASSED" || echo "PENDING")
  - Configuration: $([ -f "$LOG_FILE" ] && grep "configuration validations" "$LOG_FILE" && echo "PASSED" || echo "PENDING")
  - Health: $([ -f "$LOG_FILE" ] && grep "Health check passed" "$LOG_FILE" && echo "PASSED" || echo "PENDING")

Log File: $LOG_FILE
================================================================================
EOF

    cat /tmp/DEPLOYMENT_SUMMARY.txt
}

################################################################################
# Main Script
################################################################################

main() {
    local command="${1:-check}"

    log_info "Starting SVL-SMS Deployment Script"
    log_info "Command: $command"

    case "$command" in
        check)
            check_environment
            validate_configuration
            deployment_summary
            ;;
        migrate)
            run_database_migrations
            ;;
        validate)
            validate_configuration
            ;;
        health)
            health_check
            test_api_endpoints
            ;;
        backup)
            backup_database
            ;;
        rollback)
            rollback_instructions
            ;;
        *)
            echo "Usage: $0 {check|migrate|validate|health|backup|rollback}"
            echo ""
            echo "Commands:"
            echo "  check       - Run all pre-deployment checks"
            echo "  migrate     - Run database migrations"
            echo "  validate    - Validate deployment configuration"
            echo "  health      - Perform health checks"
            echo "  backup      - Create database backup"
            echo "  rollback    - Display rollback instructions"
            exit 1
            ;;
    esac

    log_success "Deployment script completed"
}

main "$@"
