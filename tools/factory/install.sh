#!/bin/bash
set -euo pipefail

# Factory installer
# Usage: curl -fsSL https://morrisclay.com/tools/factory/install.sh | bash

REPO="lunar-vc/factory"
REPO_API="https://api.github.com/repos/$REPO/releases/latest"
DIRECT_URL="https://github.com/$REPO/releases/latest/download/factory-darwin-arm64"
ASSET_NAME="factory-darwin-arm64"
INSTALL_DIR="$HOME/.local/bin"
INSTALL_PATH="$INSTALL_DIR/factory"
FACTORY_HOME="${FACTORY_HOME:-$HOME/.factory}"
REGISTRY_SLUG="lunar-vc/factory-registry"
REGISTRY_NAME="factory-registry"

# ---------------------------------------------------------------------------
# Colors (degrade gracefully when not a tty)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    DIM='\033[2m'
    RESET='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' DIM='' RESET=''
fi

info()    { printf "${BLUE}[*]${RESET} %s\n" "$1"; }
success() { printf "${GREEN}[+]${RESET} %s\n" "$1"; }
warn()    { printf "${YELLOW}[!]${RESET} %s\n" "$1"; }
error()   { printf "${RED}[x]${RESET} %s\n" "$1" >&2; }
step()    { printf "\n${BOLD}--- %s ---${RESET}\n\n" "$1"; }

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
TMP_BINARY=""
cleanup() { rm -f "$TMP_BINARY" 2>/dev/null || true; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
    step "Checking prerequisites"

    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    if [ "$os" != "Darwin" ]; then
        error "Factory requires macOS. Detected: $os"
        exit 1
    fi
    success "macOS detected"

    if [ "$arch" != "arm64" ]; then
        error "Factory requires Apple Silicon (arm64). Detected: $arch"
        exit 1
    fi
    success "Apple Silicon detected"

    if ! command -v git &>/dev/null; then
        error "git is required. Install Xcode Command Line Tools:"
        error "  xcode-select --install"
        exit 1
    fi
    success "git installed"

    if ! command -v curl &>/dev/null; then
        error "curl is required but not found."
        exit 1
    fi
    success "curl installed"
}

# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------
download_binary() {
    step "Downloading Factory"

    TMP_BINARY="$(mktemp)"

    # Try direct public URL first
    info "Trying public download..."
    if curl -fSL --progress-bar -o "$TMP_BINARY" "$DIRECT_URL" 2>/dev/null; then
        local size
        size=$(wc -c < "$TMP_BINARY" | tr -d ' ')
        if [ "$size" -gt 1000000 ]; then
            success "Downloaded ($((size / 1024 / 1024)) MB)"
            return 0
        fi
    fi

    # Fall back to authenticated download via gh CLI
    info "Public download unavailable, trying authenticated download..."

    if ! command -v gh &>/dev/null; then
        error "The Factory release requires GitHub authentication to download."
        error ""
        error "Install the GitHub CLI and authenticate:"
        error "  brew install gh"
        error "  gh auth login"
        error ""
        error "Then re-run this installer."
        exit 1
    fi

    local token
    token="$(gh auth token 2>/dev/null || true)"
    if [ -z "$token" ]; then
        error "GitHub CLI is not authenticated. Run:"
        error "  gh auth login"
        exit 1
    fi

    # Fetch release metadata
    local release_json
    release_json="$(curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer $token" \
        -H "User-Agent: factory-installer" \
        "$REPO_API" 2>/dev/null)" || {
        error "Could not fetch release info from GitHub. Check your connection."
        exit 1
    }

    # Extract asset API URL using python3 (ships with macOS)
    local asset_url
    asset_url="$(echo "$release_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    if asset['name'] == '$ASSET_NAME':
        print(asset['url'])
        break
" 2>/dev/null)" || true

    if [ -z "$asset_url" ]; then
        error "No $ASSET_NAME asset found in the latest release."
        exit 1
    fi

    # Download the binary via API
    curl -fSL --progress-bar -o "$TMP_BINARY" \
        -H "Accept: application/octet-stream" \
        -H "Authorization: Bearer $token" \
        -H "User-Agent: factory-installer" \
        "$asset_url" || {
        error "Binary download failed."
        exit 1
    }

    local size
    size=$(wc -c < "$TMP_BINARY" | tr -d ' ')
    if [ "$size" -lt 1000000 ]; then
        error "Download appears corrupt ($size bytes). Try again."
        exit 1
    fi

    success "Downloaded ($((size / 1024 / 1024)) MB)"
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
install_binary() {
    step "Installing binary"

    mkdir -p "$INSTALL_DIR"
    mv "$TMP_BINARY" "$INSTALL_PATH"
    TMP_BINARY="" # prevent cleanup from removing installed binary
    chmod 755 "$INSTALL_PATH"

    # Verify
    if "$INSTALL_PATH" --version &>/dev/null; then
        success "Installed to $INSTALL_PATH"
    else
        success "Installed to $INSTALL_PATH (version check skipped)"
    fi
}

# ---------------------------------------------------------------------------
# PATH
# ---------------------------------------------------------------------------
ensure_path() {
    step "Configuring PATH"

    if echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
        success "~/.local/bin already in PATH"
        return
    fi

    # Determine shell profile
    local profile=""
    case "${SHELL:-/bin/zsh}" in
        */zsh)  profile="$HOME/.zshrc" ;;
        */bash)
            if [ -f "$HOME/.bash_profile" ]; then
                profile="$HOME/.bash_profile"
            else
                profile="$HOME/.bashrc"
            fi
            ;;
        *) profile="$HOME/.profile" ;;
    esac

    # Check if already present (idempotent)
    if [ -f "$profile" ] && grep -qF '.local/bin' "$profile" 2>/dev/null; then
        success "PATH entry already in $profile"
        export PATH="$INSTALL_DIR:$PATH"
        return
    fi

    {
        echo ""
        echo "# Added by Factory installer"
        echo 'export PATH="$HOME/.local/bin:$PATH"'
    } >> "$profile"

    export PATH="$INSTALL_DIR:$PATH"

    success "Added ~/.local/bin to PATH in $(basename "$profile")"
    warn "Open a new terminal or run: source $profile"
}

# ---------------------------------------------------------------------------
# Factory init
# ---------------------------------------------------------------------------
initialize_factory() {
    step "Initializing Factory"

    if [ -f "$FACTORY_HOME/config.yaml" ]; then
        info "Factory already initialized at $FACTORY_HOME"
        return
    fi

    "$INSTALL_PATH" init
    success "Factory initialized"
}

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
add_registry() {
    step "Adding Lunar VC registry"

    if [ -d "$FACTORY_HOME/registries/$REGISTRY_NAME" ]; then
        info "Registry already configured"
        return
    fi

    "$INSTALL_PATH" registry add "$REGISTRY_SLUG" || {
        error "Failed to add registry. You may need git access to $REGISTRY_SLUG."
        error "Try: gh auth login"
        warn "Continuing without registry..."
        return
    }
    success "Registry added"
}

# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
sync_content() {
    step "Syncing agents, skills, and environments"

    "$INSTALL_PATH" update --registries --envs || {
        warn "Some updates had issues (non-critical)"
    }
    success "Content synced"
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
print_banner() {
    printf "${BOLD}"
    cat << 'BANNER'

  ╔═══════════════════════════════════╗
  ║         Factory Installer         ║
  ╚═══════════════════════════════════╝

BANNER
    printf "${RESET}"
}

print_next_steps() {
    step "Installation complete"

    printf "${GREEN}"
    cat << 'DONE'
  Factory is installed and ready.
DONE
    printf "${RESET}"
    echo ""
    info "Next steps:"
    echo ""
    printf "  ${BOLD}1.${RESET} Start the web dashboard:\n"
    printf "     ${DIM}factory ui${RESET}\n"
    echo ""
    printf "  ${BOLD}2.${RESET} Open ${BOLD}http://localhost:1760/settings${RESET} in your browser\n"
    printf "     Add your API keys (at minimum OPENROUTER_API_KEY)\n"
    echo ""
    printf "  ${BOLD}3.${RESET} Verify everything works:\n"
    printf "     ${DIM}factory doctor${RESET}\n"
    echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    print_banner
    check_prerequisites
    download_binary
    install_binary
    ensure_path
    initialize_factory
    add_registry
    sync_content
    print_next_steps
}

main "$@"
