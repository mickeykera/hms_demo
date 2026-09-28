#!/bin/sh
# Prepare the data volume before starting the server.
#
# A mounted volume is usually owned by root, so the non-root "node" user cannot
# create hospital.db or upload files there. Fix ownership first, then drop
# privileges if a helper is available.
set -e

mkdir -p "$(dirname "${DB_PATH:-/data/hospital.db}")" 2>/dev/null || true
mkdir -p "${UPLOAD_DIR:-/data/uploads/documents}" 2>/dev/null || true

chown -R node:node /data 2>/dev/null || true

if command -v gosu >/dev/null 2>&1; then
  exec gosu node node src/server.js
fi

# Verify the privilege drop actually works before committing to it, so a failure
# here degrades to "runs as root" instead of a container that refuses to boot.
if command -v su >/dev/null 2>&1 && su -s /bin/sh node -c 'exit 0' 2>/dev/null; then
  exec su -s /bin/sh node -c 'exec node src/server.js'
fi

exec node src/server.js
