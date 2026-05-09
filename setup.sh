#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}!${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }

# ── Repo root ───────────────────────────────────────────────────────────────

# Resolve the directory containing this script, even when called via symlink
# or from a different working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"

# ── Preflight checks ────────────────────────────────────────────────────────

check_command() {
    if command -v "$1" &>/dev/null; then
        success "$1 installed ($("$1" --version 2>&1 | head -1))"
    else
        error "$1 not found"
        return 1
    fi
}

check_pi() {
    if command -v pi &>/dev/null; then
        local ver
        ver="$(pi --version 2>&1 || echo "unknown")"
        success "pi $ver"
    else
        error "pi is not installed"
        info "Install it: npm install -g @earendil-works/pi-coding-agent"
        return 1
    fi
}

# ── Install steps ───────────────────────────────────────────────────────────

install_deps() {
    info "Installing peer dependencies..."
    if command -v pnpm &>/dev/null; then
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
        success "Dependencies installed"
    elif command -v npm &>/dev/null; then
        npm install
        success "Dependencies installed (npm fallback)"
    else
        warning "No package manager found — extensions may fail to load"
    fi
}

link_settings() {
    # Pi reads settings.json from the working directory when you launch `pi`
    # from the repo. No symlink needed — just remind the user.
    if [[ -f "$REPO_DIR/settings.json" ]]; then
        success "settings.json found"
    else
        error "settings.json missing"
        return 1
    fi
}

validate_extensions() {
    info "Validating extensions..."
    local all_ok=true

    for ext_dir in "$REPO_DIR"/extensions/*/; do
        local name
        name="$(basename "$ext_dir")"
        if [[ -f "$ext_dir/index.ts" ]]; then
            success "extension: $name"
        else
            error "extension: $name (missing index.ts)"
            all_ok=false
        fi
    done

    $all_ok
}

validate_skills() {
    info "Validating skills..."
    local all_ok=true

    for skill_dir in "$REPO_DIR"/skills/*/; do
        local name
        name="$(basename "$skill_dir")"
        if [[ -f "$skill_dir/SKILL.md" ]]; then
            success "skill: $name"
        else
            error "skill: $name (missing SKILL.md)"
            all_ok=false
        fi
    done

    $all_ok
}

# ── Usage / help ────────────────────────────────────────────────────────────

usage() {
    cat <<EOF
Usage: $(basename "$0") [command]

Commands:
  (none)     Full install: check deps, install packages, validate
  check       Validate setup without making changes
  help        Show this message

Run pi from this directory after setup:
  cd $REPO_DIR && pi
EOF
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
    local cmd="${1:-install}"

    case "$cmd" in
        help|-h|--help)
            usage
            exit 0
            ;;
        check)
            echo ""
            info "Validating agentic-swe-setup at $REPO_DIR"
            echo ""
            check_pi
            validate_extensions
            validate_skills
            echo ""
            success "Validation complete"
            exit 0
            ;;
        install)
            echo ""
            info "agentic-swe-setup — $REPO_DIR"
            echo ""

            # Preflight
            check_command node || { error "Node.js is required"; exit 1; }
            check_command pnpm || check_command npm || true
            check_pi || true

            # Install
            install_deps
            link_settings

            # Validate
            validate_extensions
            validate_skills

            echo ""
            success "Setup complete"
            echo ""
            info "Launch pi from this directory:"
            echo "  cd $REPO_DIR && pi"
            echo ""
            exit 0
            ;;
        *)
            error "Unknown command: $cmd"
            usage
            exit 1
            ;;
    esac
}

main "$@"
