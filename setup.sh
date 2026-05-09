#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="/Users/dehoux/dev/agentic-swe-setup"
SHELL_RC="$HOME/.zshrc"
EXPORT_LINE="export PI_CODING_AGENT_DIR=$REPO_DIR"

# Functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

check_pi_installation() {
    info "Checking if pi is installed..."

    if which pi > /dev/null 2>&1; then
        local version
        version=$(pi --version 2>&1 || echo "unknown")
        success "pi is installed (version: $version)"
        return 0
    else
        warning "pi is not installed"
        return 1
    fi
}

install_pi() {
    info "To install pi, visit: https://pi.dev"
    info "Or run: npm install -g @earendil-works/pi-coding-agent"
    read -p "Would you like to install pi now? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if npm install -g @earendil-works/pi-coding-agent; then
            success "pi installed successfully"
            return 0
        else
            error "Failed to install pi"
            return 1
        fi
    fi

    return 1
}

add_env_export() {
    info "Adding PI_CODING_AGENT_DIR to $SHELL_RC..."

    if grep -q "PI_CODING_AGENT_DIR" "$SHELL_RC" 2>/dev/null; then
        # Update existing line
        if grep -q "$EXPORT_LINE" "$SHELL_RC" 2>/dev/null; then
            success "PI_CODING_AGENT_DIR already set correctly in $SHELL_RC"
        else
            # Replace existing line with new path
            sed -i.bak "/PI_CODING_AGENT_DIR/d" "$SHELL_RC"
            echo "$EXPORT_LINE" >> "$SHELL_RC"
            success "Updated PI_CODING_AGENT_DIR in $SHELL_RC"
        fi
    else
        # Add new line
        echo "$EXPORT_LINE" >> "$SHELL_RC"
        success "Added PI_CODING_AGENT_DIR to $SHELL_RC"
    fi
}

verify_config_files() {
    info "Verifying configuration files..."

    local missing_files=()

    for file in "settings.json" "models.json"; do
        if [[ -f "$REPO_DIR/$file" ]]; then
            success "Found: $file"
        else
            error "Missing: $file"
            missing_files+=("$file")
        fi
    done

    if [[ ${#missing_files[@]} -gt 0 ]]; then
        return 1
    fi

    return 0
}

show_config_summary() {
    echo ""
    info "=== Configuration Summary ==="
    echo ""

    # Show default provider and model
    if [[ -f "$REPO_DIR/settings.json" ]]; then
        echo "Default Provider:"
        grep -A1 "defaultProvider" "$REPO_DIR/settings.json" | tail -1 | xargs || echo "  (not set)"

        echo ""
        echo "Default Model:"
        grep -A1 "defaultModel" "$REPO_DIR/settings.json" | tail -1 | xargs || echo "  (not set)"

        echo ""
        echo "Extensions:"
        grep -A5 '"extensions"' "$REPO_DIR/settings.json" | grep '".*"' | sed 's/.*"\(.*\)".*/  - \1/' || echo "  (none)"
    fi

    echo ""

    # Show available models
    if [[ -f "$REPO_DIR/models.json" ]]; then
        echo "Available Providers:"
        grep -o '"[a-z-]*":' "$REPO_DIR/models.json" | grep -E 'zai-anthropic|zai-glm|openrouter' | sed 's/:"//; s/"$//' | while read provider; do
            echo "  - $provider"
        done
    fi

    echo ""
    info "Environment: PI_CODING_AGENT_DIR=$REPO_DIR"
    echo ""
}

validate_setup() {
    info "Validating setup..."
    echo ""

    local all_good=true

    # Check pi installation
    if ! check_pi_installation; then
        all_good=false
    fi

    # Check environment variable
    if [[ -z "${PI_CODING_AGENT_DIR:-}" ]]; then
        warning "PI_CODING_AGENT_DIR is not set in current session"
        info "Run: source $SHELL_RC"
    else
        success "PI_CODING_AGENT_DIR is set to: $PI_CODING_AGENT_DIR"
    fi

    # Verify config files exist
    if ! verify_config_files; then
        all_good=false
    fi

    # Check for API keys
    echo ""
    info "Checking API keys..."

    if [[ -f "$HOME/.hermes/.env" ]]; then
        if grep -q "ANTHROPIC_API_KEY" "$HOME/.hermes/.env" 2>/dev/null; then
            success "ANTHROPIC_API_KEY found in ~/.hermes/.env"
        else
            warning "ANTHROPIC_API_KEY not found in ~/.hermes/.env"
        fi

        if grep -q "GLM_API_KEY" "$HOME/.hermes/.env" 2>/dev/null; then
            success "GLM_API_KEY found in ~/.hermes/.env"
        else
            warning "GLM_API_KEY not found in ~/.hermes/.env"
        fi

        if grep -q "OPENROUTER_API_KEY" "$HOME/.hermes/.env" 2>/dev/null; then
            success "OPENROUTER_API_KEY found in ~/.hermes/.env"
        else
            warning "OPENROUTER_API_KEY not found in ~/.hermes/.env (optional)"
        fi
    else
        warning "~/.hermes/.env not found"
    fi

    echo ""

    if [[ "$all_good" == true ]]; then
        success "Setup validation passed!"
        show_config_summary
        return 0
    else
        error "Setup validation found issues"
        return 1
    fi
}

# Main setup flow
main() {
    local check_mode=false

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --check)
                check_mode=true
                shift
                ;;
            *)
                error "Unknown option: $arg"
                echo "Usage: $0 [--check]"
                echo "  --check    Validate setup without making changes"
                exit 1
                ;;
        esac
    done

    echo ""
    info "=== Pi Coding Agent Setup ==="
    echo ""

    if [[ "$check_mode" == true ]]; then
        validate_setup
        exit $?
    fi

    # Normal setup mode
    if ! check_pi_installation; then
        if ! install_pi; then
            error "pi is required to continue"
            exit 1
        fi
    fi

    add_env_export
    verify_config_files

    echo ""
    success "Setup complete!"
    echo ""

    info "Next steps:"
    echo "  1. Run: source $SHELL_RC"
    echo "  2. Start pi: pi"
    echo "  3. Verify: pi --version"
    echo ""

    show_config_summary

    info "For agentic-loop integration (Python RPC mode), see README.md"
}

# Run main function
main "$@"