#!/bin/bash
# Reads .env and pushes all non-empty values to EAS as project secrets.
# Usage: bash push-secrets.sh

set -e

if [ ! -f .env ]; then
  echo "No .env file found. Create one first."
  exit 1
fi

echo "Pushing secrets to EAS..."

while IFS= read -r line; do
  # Skip comments and blank lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue

  KEY="${line%%=*}"
  VALUE="${line#*=}"

  # Skip empty values
  if [[ -z "$VALUE" ]]; then
    echo "  Skipping $KEY (empty)"
    continue
  fi

  echo "  Setting $KEY..."
  bunx eas-cli secret:create --scope project --name "$KEY" --value "$VALUE" --force
done < .env

echo ""
echo "Done. All secrets pushed to EAS."
