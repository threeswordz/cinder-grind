# Construction ERP — Local Development Setup

## Required tools

Install:

1. Git
2. Node.js 24.21.0 LTS
3. pnpm 12.6.0
4. Podman Desktop (recommended for the local PostgreSQL container)

No hosted-service account is required for local development. Neon remains optional and is not a required dependency.

## Setup

```bash
git clone https://github.com/threeswordz/cinder-grind.git
cd cinder-grind
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


## Bootstrap the first System Administrator

After all migrations are applied, create the first Company/System Administrator from the API environment.

Set temporary local environment values based on `apps/api/.env.example`:

```text
BOOTSTRAP_COMPANY_CODE=DEMO
BOOTSTRAP_COMPANY_NAME=Example Construction Company
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_DISPLAY_NAME=System Administrator
BOOTSTRAP_ADMIN_PASSWORD=<strong temporary password>
```

Then build the API and run:

```bash
pnpm --filter @construction-erp/api build
pnpm --filter @construction-erp/api bootstrap:admin
```

Security rules:

- The bootstrap is a CLI command, not a public HTTP endpoint.
- It refuses to run when the Company already has application Users.
- The initial `SYS_ADMIN` Role receives technical Administration permissions only.
- It does not receive Purchase Order, Budget, Invoice, Payment or other business approval permissions.
- Do not commit the real bootstrap password to Git.
- Remove the temporary bootstrap password from the environment after successful bootstrap.
