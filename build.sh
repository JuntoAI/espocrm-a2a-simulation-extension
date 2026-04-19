#!/usr/bin/env bash
#
# Build script for A2A Simulation EspoCRM Extension
# Packages manifest.json and files/ into a2a-simulation-extension.zip
#
# Always uses Python zipfile to guarantee forward-slash paths in the archive,
# regardless of whether the build runs on Windows, WSL, macOS, or Linux.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_NAME="a2a-simulation-extension.zip"

rm -f "$OUTPUT_NAME"

python3 -c "
import zipfile, os

output = '${OUTPUT_NAME}'
dirs_to_pack = ['files']
if os.path.isdir('scripts'):
    dirs_to_pack.append('scripts')

with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    zf.write('manifest.json', 'manifest.json')
    for pack_dir in dirs_to_pack:
        for root, dirs, files in os.walk(pack_dir):
            arc_dir = root.replace(os.sep, '/') + '/'
            zf.write(root, arc_dir)
            for f in files:
                full_path = os.path.join(root, f)
                arc_name = full_path.replace(os.sep, '/')
                zf.write(full_path, arc_name)

print()
print('Build complete: ' + output)
" || {
    python -c "
import zipfile, os

output = '${OUTPUT_NAME}'
dirs_to_pack = ['files']
if os.path.isdir('scripts'):
    dirs_to_pack.append('scripts')

with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    zf.write('manifest.json', 'manifest.json')
    for pack_dir in dirs_to_pack:
        for root, dirs, files in os.walk(pack_dir):
            arc_dir = root.replace(os.sep, '/') + '/'
            zf.write(root, arc_dir)
            for f in files:
                full_path = os.path.join(root, f)
                arc_name = full_path.replace(os.sep, '/')
                zf.write(full_path, arc_name)

print()
print('Build complete: ' + output)
"
}
