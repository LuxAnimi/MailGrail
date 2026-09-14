#!/usr/bin/env bash
#------------------------------------------------------------------------------
# Publish one package, unless that exact version is already on the registry.
#
# Makes the release workflow safe to re-run: a job that failed after the first
# of two packages published can simply be run again, rather than needing someone
# to reason about which half landed. Only an exact name@version match is
# skipped, so a real version bump always publishes.
#------------------------------------------------------------------------------
set -euo pipefail

dir="${1:?usage: publish-if-new.sh <package-dir>}"
cd "$dir"

name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")

if npm view "$name@$version" version >/dev/null 2>&1; then
  echo "$name@$version is already published - skipping."
  exit 0
fi

echo "Publishing $name@$version ..."
npm publish
