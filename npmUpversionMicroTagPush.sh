#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

DRY_RUN=0
ASSUME_YES=0
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage: ./npmUpversionMicroTagPush.sh [options]

Release the current connector version, upload the VSIX as a GitHub release asset,
then bump the patch version for the next development cycle.

Options:
  --dry-run     Print the actions without pushing tags, creating releases, or editing files.
  --yes         Skip interactive confirmation prompts.
  --skip-build  Reuse an existing VSIX in dist/ instead of rebuilding it.
  --help, -h    Show this help text.

Prerequisites:
  - Clean git worktree
  - Authenticated GitHub CLI (`gh auth login`)
  - Current package.json version must not already be tagged
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --yes)
      ASSUME_YES=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

run() {
  echo "+ $*"
  if [[ ${DRY_RUN} -eq 0 ]]; then
    "$@"
  fi
}

confirm() {
  local prompt="$1"
  if [[ ${ASSUME_YES} -eq 1 ]]; then
    return 0
  fi

  local answer
  read -r -p "${prompt} [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES)
      return 0
      ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Required command not found: ${cmd}" >&2
    exit 1
  fi
}

parse_repo_slug() {
  local remote_url="$1"
  case "${remote_url}" in
    git@github.com:*.git)
      echo "${remote_url#git@github.com:}" | sed 's/\.git$//'
      ;;
    https://github.com/*.git)
      echo "${remote_url#https://github.com/}" | sed 's/\.git$//'
      ;;
    https://github.com/*)
      echo "${remote_url#https://github.com/}"
      ;;
    *)
      return 1
      ;;
  esac
}

json_field() {
  local file="$1"
  local expr="$2"
  node -e 'const [file, expr] = process.argv.slice(1); const pkg = require(file); process.stdout.write(String(eval("pkg" + expr)));' "${file}" "${expr}"
}

current_version() {
  json_field "./package.json" ".version"
}

package_name() {
  json_field "./package.json" ".name"
}

next_patch_version() {
  node <<'EOF'
const pkg = require('./package.json');
const parts = pkg.version.split('.').map(Number);
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  throw new Error(`Unsupported semver version: ${pkg.version}`);
}
parts[2] += 1;
process.stdout.write(parts.join('.'));
EOF
}

latest_release_tag() {
  git tag --sort=-creatordate | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true
}

build_release_notes() {
  local previous_tag="$1"
  local output_file="$2"
  local version="$3"
  local branch="$4"

  {
    echo "Release ${version}"
    echo
    echo "Branch: ${branch}"
    echo
    echo "Changes:"
    if [[ -n "${previous_tag}" ]]; then
      git log --pretty=format:'- %s' "${previous_tag}..HEAD"
    else
      git log --pretty=format:'- %s'
    fi
  } > "${output_file}"
}

require_command git
require_command node
require_command npm
require_command gh

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "This repository has tracked changes. Commit or stash them before releasing." >&2
  exit 1
fi

UNTRACKED_FILES="$(git ls-files --others --exclude-standard)"
if [[ -n "${UNTRACKED_FILES}" ]]; then
  echo "Warning: untracked files are present and will not be included in the release commit:"
  echo "${UNTRACKED_FILES}" | sed -n '1,20p'
  if [[ "$(echo "${UNTRACKED_FILES}" | wc -l | awk '{print $1}')" -gt 20 ]]; then
    echo "... additional untracked files omitted"
  fi
fi

if [[ ${DRY_RUN} -eq 0 ]]; then
  gh auth status >/dev/null
fi

BRANCH="$(git branch --show-current)"
REMOTE_URL="$(git remote get-url origin)"
REPO_SLUG="$(parse_repo_slug "${REMOTE_URL}")" || {
  echo "Unsupported origin remote URL: ${REMOTE_URL}" >&2
  exit 1
}

VERSION="$(current_version)"
TAG="v${VERSION}"
NEXT_VERSION="$(next_patch_version)"
PKG_NAME="$(package_name)"
VSIX_PATH="dist/${PKG_NAME}-${VERSION}.vsix"
PREVIOUS_TAG="$(latest_release_tag)"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Tag ${TAG} already exists. Bump package.json first or release a new version." >&2
  exit 1
fi

echo "Repository: ${REPO_SLUG}"
echo "Branch: ${BRANCH}"
echo "Release version: ${VERSION}"
echo "Next development version: ${NEXT_VERSION}"
echo "Release tag: ${TAG}"
echo "VSIX path: ${VSIX_PATH}"
if [[ -n "${PREVIOUS_TAG}" ]]; then
  echo "Previous release tag: ${PREVIOUS_TAG}"
fi
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "Mode: dry-run"
fi

confirm "Proceed with the connector release flow?"

if [[ ${SKIP_BUILD} -eq 0 ]]; then
  echo "Building the connector and packaging the VSIX."
  run npm ci
  run npm run build
  run npm run package
  run mkdir -p dist
  if [[ ${DRY_RUN} -eq 0 ]]; then
    rm -f "${VSIX_PATH}"
  else
    echo "+ rm -f ${VSIX_PATH}"
  fi
  run npx @vscode/vsce package --out "${VSIX_PATH}"
else
  echo "Skipping build; expecting an existing VSIX at ${VSIX_PATH}."
fi

if [[ ${DRY_RUN} -eq 0 && ! -f "${VSIX_PATH}" ]]; then
  echo "VSIX not found: ${VSIX_PATH}" >&2
  exit 1
fi

NOTES_FILE="$(mktemp)"
trap 'rm -f "${NOTES_FILE}"' EXIT
build_release_notes "${PREVIOUS_TAG}" "${NOTES_FILE}" "${VERSION}" "${BRANCH}"

echo
echo "Release notes preview:"
sed -n '1,40p' "${NOTES_FILE}"
echo

confirm "Create tag ${TAG}, push it, publish the GitHub release, then bump to ${NEXT_VERSION}?"

run git tag -a "${TAG}" -m "Release ${TAG}"
run git push origin "${TAG}"
run gh release create "${TAG}" "${VSIX_PATH}" \
  --repo "${REPO_SLUG}" \
  --target "${BRANCH}" \
  --title "${TAG}" \
  --notes-file "${NOTES_FILE}"

if [[ ${DRY_RUN} -eq 0 ]]; then
  run npm version patch --no-git-tag-version
  UPDATED_VERSION="$(current_version)"
  if [[ "${UPDATED_VERSION}" != "${NEXT_VERSION}" ]]; then
    echo "Expected bumped version ${NEXT_VERSION}, got ${UPDATED_VERSION}" >&2
    exit 1
  fi
else
  echo "+ npm version patch --no-git-tag-version"
fi

run git add package.json package-lock.json
run git commit -m "Upversion to ${NEXT_VERSION} - Development Begins" --signoff
run git push origin "${BRANCH}"

echo
echo "Release flow complete."
echo "Published tag: ${TAG}"
echo "Bumped development version: ${NEXT_VERSION}"
