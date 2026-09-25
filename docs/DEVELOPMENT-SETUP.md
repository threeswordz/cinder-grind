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
pnpm --filter @construction-erp/api exec prisma db push
pnpm validate
```

Commit the generated `pnpm-lock.yaml` once dependency installation has been validated.

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
- Do not expose local PostgreSQL port 5432 to the public internet.
- Do not place secrets in frontend `VITE_*` variables.
- Do not use local prototype document storage for confidential Production data until Production backup/storage controls are designed.
