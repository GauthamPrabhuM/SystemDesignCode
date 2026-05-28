FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then npm install -g pnpm@9 && pnpm install; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
