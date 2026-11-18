FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD ["node", "scripts/healthcheck.js"]
CMD ["node", "server.js"]
