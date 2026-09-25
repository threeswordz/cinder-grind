# Construction ERP — Local Development Setup

## Required tools

Install:

1. Git
2. Node.js 24.21.0 LTS
3. pnpm 12.6.0
4. Podman Desktop (recommended for the local PostgreSQL container)

No new hosted-service account is required for V0.1-A. A Neon account is not required now.

## Setup

```bash
git clone https://github.com/threeswordz/construction-erp.git
cd construction-erp
npm install --global pnpm@12.6.0
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
podman compose up -d
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm validate
```

For future schema changes during development, create reviewed migrations with:

```bash
pnpm prisma:migrate:dev
```

Do not use `prisma db push` as the normal shared-development or release migration path.

## Start the API

```bash
pnpm build:api
pnpm start:api
```

Health endpoint:

`http://localhost:3000/api/v1/health`

## Start the frontend

In another terminal:

```bash
pnpm dev:web
```

Open:

`http://localhost:5173`

## Security notes

- Never commit a real `.env` file.
- Never reuse the local database password in Staging or Production.
- The provided Podman PostgreSQL mapping binds only to 127.0.0.1; do not change it to a public bind without a deliberate environment-security design.
- The local API defaults to 127.0.0.1; production bind/listen behavior must be environment-configured.
- Do not place secrets in frontend `VITE_*` variables.
- Do not use local prototype document storage for confidential Production data until Production backup/storage controls are designed.
