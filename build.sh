#!/usr/bin/env bash
#
# Build script for A2A Simulation EspoCRM Extension
# Packages manifest.json and files/ into a2a-simulation-extension.zip
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_NAME="a2a-simulation-extension.zip"

rm -f "$OUTPUT_NAME"

if command -v zip &> /dev/null && [[ "$(uname -s)" != MINGW* ]] && [[ "$(uname -s)" != CYGWIN* ]]; then
    zip -r -9 "$OUTPUT_NAME" manifest.json files/
else
    python -c "
import zipfile, os

with zipfile.ZipFile('${OUTPUT_NAME}', 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write('manifest.json', 'manifest.json')
    for root, dirs, files in os.walk('files'):
        for f in files:
            full_path = os.path.join(root, f)
            rel = os.path.relpath(full_path, '.').replace(os.sep, '/')
            zf.write(full_path, rel)
"
fi

echo ""
echo "Build complete: ${OUTPUT_NAME}"
