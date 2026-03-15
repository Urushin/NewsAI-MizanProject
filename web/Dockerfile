# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Set API URL to empty string so frontend uses relative paths (proxied by Next.js rewrites)
ENV NEXT_PUBLIC_API_URL=""

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=""

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "run", "start"]
