#!/bin/bash
# Prints the hex SHA-256 of the station's sources: station/Package.swift, every
# file under station/Sources whose name does not start with a dot, and
# scripts/build-station.sh. They are taken in byte order of their paths from the
# repository's root, each one as its path, a NUL byte and its content.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

{
  echo station/Package.swift
  find station/Sources -type f ! -name '.*'
  echo scripts/build-station.sh
} | LC_ALL=C sort | while IFS= read -r file; do
  printf '%s\0' "$file"
  cat "$file"
done | shasum -a 256 | cut -d ' ' -f 1
