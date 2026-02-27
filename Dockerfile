# -------- deps stage --------
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci


# -------- builder stage --------
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build


# -------- runner stage --------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
