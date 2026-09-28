FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Frontend devDependencies (vite, @vitejs/plugin-react, tailwind) are required to
# produce the bundle, so they are installed first and pruned after the build.
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

COPY . .

RUN npm run build \
 && npm prune --omit=dev \
 && npm prune --prefix frontend --omit=dev

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/hospital.db \
    UPLOAD_DIR=/data/uploads/documents \
    SEED_DEMO_DATA=true

RUN mkdir -p /data/uploads/documents && chown -R node:node /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The entrypoint starts as root so it can chown the mounted volume to the
# "node" user, then re-execs the server as "node" via gosu/su.
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
