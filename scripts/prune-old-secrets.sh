#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

DEFAULT_APPS=("auth-provider" "auth-client")

DRY_RUN=false
KEEP_VERSIONS=1
declare -a SELECTED_APPS=()

TOTAL_VERSIONS_PRUNED=0
LAST_PRUNED_COUNT=0

usage() {
  cat <<'EOF'
Usage: scripts/prune-old-secrets.sh [options]

Deletes historic versions of Firebase / Secret Manager secrets for the auth apps.

Options:
  --dry-run           Only log the destroy commands; do not delete anything
  --keep <count>      Number of newest versions to keep for each secret (default: 1)
  --app <name>        Limit pruning to a specific app (can be provided multiple times)
  -h, --help          Show this help message

Examples:
  scripts/prune-old-secrets.sh
  scripts/prune-old-secrets.sh --dry-run
  scripts/prune-old-secrets.sh --keep 2 --app auth-provider
EOF
}

log_info() {
  echo "ℹ️  $1"
}

log_success() {
  echo "✅ $1"
}

log_warning() {
  echo "⚠️  $1"
}

log_error() {
  echo "❌ $1"
}

log_step() {
  echo "🔧 $1"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '$cmd' not found in PATH"
    exit 1
  fi
}

extract_project_id() {
  local file="$1"
  local project_id
  project_id="$(grep -E 'local[[:space:]]+project_id=' "$file" | head -n1 | sed -E 's/.*local[[:space:]]+project_id="([^"]+)".*/\1/')"
  if [[ -z "${project_id:-}" ]]; then
    log_warning "Could not infer project_id from $file"
    return 1
  fi
  echo "$project_id"
}

SECRET_IDS_ARRAY=()
extract_secret_ids() {
  local file="$1"
  local array_line
  array_line="$(grep -E '^SECRET_IDS=\(' "$file" | head -n1 | tr -d '\r')"
  if [[ -z "${array_line:-}" ]]; then
    log_warning "Could not find SECRET_IDS array in $file"
    return 1
  fi

  local sanitized="${array_line#SECRET_IDS=}"
  local parsed=()
  eval "parsed=$sanitized"
  SECRET_IDS_ARRAY=("${parsed[@]}")
}

validate_keep_value() {
  local value="$1"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    log_error "--keep must be a positive integer (received '$value')"
    exit 1
  fi

  if (( value < 1 )); then
    log_error "--keep must be at least 1 (received '$value')"
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --keep)
        if [[ $# -lt 2 ]]; then
          log_error "--keep requires a numeric argument"
          exit 1
        fi
        KEEP_VERSIONS="$2"
        shift 2
        ;;
      --app)
        if [[ $# -lt 2 ]]; then
          log_error "--app requires a value"
          exit 1
        fi
        SELECTED_APPS+=("$2")
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_error "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

prune_secret_versions() {
  local app="$1"
  local project_id="$2"
  local secret_id="$3"
  local keep="$4"

  LAST_PRUNED_COUNT=0

  local cmd_output
  if ! cmd_output="$(
    gcloud secrets versions list "$secret_id" \
      --project="$project_id" \
      --filter='state!="DESTROYED"' \
      --sort-by=~createTime \
      --format='value(name)' 2>/dev/null
  )"; then
    log_warning "Failed to list versions for secret '$secret_id' in project '$project_id'; skipping"
    return
  fi

  local versions=()
  if [[ -n "$cmd_output" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] && versions+=("$line")
    done <<<"$cmd_output"
  fi

  if [[ ${#versions[@]} -eq 0 ]]; then
    log_warning "No accessible versions found for secret '$secret_id' in project '$project_id'; skipping"
    return
  fi

  if [[ ${#versions[@]} -le keep ]]; then
    log_info "Secret '$secret_id' already has ${#versions[@]} version(s); keeping $keep newest"
    return
  fi

  local to_delete=("${versions[@]:$keep}")
  local pruned=0

  log_step "Pruning ${#to_delete[@]} old version(s) from '$secret_id' (keeping $keep newest)"

  for version in "${to_delete[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
      log_info "[DRY RUN] Would destroy version $version for '$secret_id' in project '$project_id'"
      ((pruned++))
      continue
    fi

    if gcloud secrets versions destroy "$version" \
      --secret="$secret_id" \
      --project="$project_id" \
      --quiet >/dev/null; then
      log_info "Destroyed version $version for '$secret_id'"
      ((pruned++))
    else
      log_warning "Failed to destroy version $version for '$secret_id'"
    fi
  done

  LAST_PRUNED_COUNT=$pruned
}

process_app() {
  local app="$1"
  local script_path="$REPO_ROOT/$app/scripts/firebase-secrets.sh"

  if [[ ! -f "$script_path" ]]; then
    log_warning "Skipping app '$app' (missing $script_path)"
    return
  fi

  local project_id
  if ! project_id="$(extract_project_id "$script_path")"; then
    log_warning "Skipping app '$app' (unable to determine project ID)"
    return
  fi

  SECRET_IDS_ARRAY=()
  if ! extract_secret_ids "$script_path"; then
    log_warning "Skipping app '$app' (unable to parse SECRET_IDS)"
    return
  fi

  if [[ ${#SECRET_IDS_ARRAY[@]} -eq 0 ]]; then
    log_warning "No secret IDs defined for app '$app'; skipping"
    return
  fi

  log_step "Processing app '$app' (project: $project_id)"

  local app_pruned=0
  for secret_id in "${SECRET_IDS_ARRAY[@]}"; do
    prune_secret_versions "$app" "$project_id" "$secret_id" "$KEEP_VERSIONS"
    if (( LAST_PRUNED_COUNT > 0 )); then
      app_pruned=$((app_pruned + LAST_PRUNED_COUNT))
      TOTAL_VERSIONS_PRUNED=$((TOTAL_VERSIONS_PRUNED + LAST_PRUNED_COUNT))
    fi
  done

  if (( app_pruned > 0 )); then
    if [[ "$DRY_RUN" == true ]]; then
      log_success "App '$app': would prune $app_pruned version(s)"
    else
      log_success "App '$app': pruned $app_pruned version(s)"
    fi
  else
    log_info "App '$app': no versions pruned"
  fi
}

main() {
  parse_args "$@"
  validate_keep_value "$KEEP_VERSIONS"

  if [[ ${#SELECTED_APPS[@]} -eq 0 ]]; then
    SELECTED_APPS=("${DEFAULT_APPS[@]}")
  fi

  require_command gcloud

  if [[ "$DRY_RUN" == true ]]; then
    log_info "Running in dry-run mode; no secrets will be destroyed"
  fi

  for app in "${SELECTED_APPS[@]}"; do
    process_app "$app"
  done

  if (( TOTAL_VERSIONS_PRUNED == 0 )); then
    if [[ "$DRY_RUN" == true ]]; then
      log_info "Dry run complete; nothing to prune"
    else
      log_info "No secret versions were pruned"
    fi
    return
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_success "Dry run: would prune $TOTAL_VERSIONS_PRUNED secret version(s)"
  else
    log_success "Pruned $TOTAL_VERSIONS_PRUNED secret version(s)"
  fi
}

main "$@"
