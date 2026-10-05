# Construction ERP — Dependency License Register

**Document Status:** Dependency License Baseline v0.1  
**Current Phase:** V0.8 Management — ACTIVE / V0.8-A through V0.8-D COMPLETE / V0.8-E PRE-FLIGHT REVIEW RECONCILIATION ACTIVE  
**Policy:** Open-Source First  
**License Verification Date:** 2026-09-26  
**Version Status:** V0.1-A direct package versions selected and pinned in package manifests.

**V0.8-E dependency note — 2026-10-05:** The active PR #181 pre-flight review reconciliation introduces no runtime or hosted-service dependency. Stage-E implementation is not authorized to proceed until that documentation gate closes. DEC-008 remains mandatory; controlled CSV/reporting must remain zero-cost/open-source-first and must not introduce mandatory paid BI/reporting services.

---

# 1. Purpose

This register controls significant software dependencies, developer tooling and hosted services used by the Construction ERP prototype.

The goals are to:

- keep the ERP runtime free/open-source during the prototype
- prevent accidental commercial license obligations
- distinguish open-source software from merely free hosted services
- document copyleft exceptions
- preserve replaceability
- require review before new significant dependencies are adopted

This is an engineering dependency register.

It does not replace professional legal advice where a future distribution or licensing scenario requires one.

---

# 2. Approval Categories

## APPROVED — Runtime

Approved for the ERP runtime under the prototype Open-Source First Policy.

## APPROVED — Development

Approved for development/build/tooling use.

The tool is not part of the ERP runtime delivered to users.

## APPROVED — Optional / Future

May be introduced later if the requirement becomes real.

It is not required for the current prototype.

## REVIEW REQUIRED

Not approved for automatic adoption.

A deliberate review / Change Control decision is required.

## NOT APPROVED

Must not become a mandatory prototype dependency.

---

# 3. License Policy

Preferred licenses:

- MIT
- Apache-2.0
- BSD-style licenses
- PostgreSQL License

GPL / AGPL / other copyleft licenses require explicit review before adoption.

Source-available licenses must not be described internally as open-source unless they meet the project's approved open-source criteria.

Commercial/proprietary components are not required by the prototype.

---

# 4. Approved Runtime / Build Stack

| Component | Purpose | License | Role | Prototype Cost | Replaceable | Status | Source / Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js | JavaScript runtime for React tooling and NestJS | MIT-style Node.js core license; official distribution includes third-party notices | Runtime / Build | Free | Yes | APPROVED | https://github.com/nodejs/node — exact LTS version to be pinned and its bundled notices retained |
| React | Frontend UI library | MIT | Runtime | Free | Yes | APPROVED | https://github.com/react/react |
| TypeScript | Application language/tooling | Apache-2.0 | Build / Runtime source | Free | Yes | APPROVED | https://github.com/microsoft/TypeScript |
| Vite | Frontend build/dev tooling | MIT | Build / Development | Free | Yes | APPROVED | https://github.com/vitejs/vite |
| MUI Core | UI component library | MIT | Runtime | Free | Yes | APPROVED | https://github.com/mui/material-ui — MUI X Pro/Premium are not included |
| TanStack Query | Frontend server-state management | MIT | Runtime | Free | Yes | APPROVED | https://github.com/TanStack/query |
| React Hook Form | Form state/validation integration | MIT | Runtime | Free | Yes | APPROVED | https://github.com/react-hook-form/react-hook-form |
| Zod | Runtime schema validation / typed validation support | MIT | Runtime | Free | Yes | APPROVED | https://github.com/colinhacks/zod |
| Frappe Gantt | Prototype Gantt visualization | MIT | Runtime UI | Free | Yes | APPROVED | https://github.com/frappe/gantt — visualization only; ERP scheduling logic remains backend-owned |
| NestJS | Backend application framework | MIT | Runtime | Free | Yes | APPROVED | https://github.com/nestjs/nest |
| Prisma ORM | PostgreSQL application ORM / migration tooling | Apache-2.0 | Runtime / Build | Free | Yes | APPROVED | Current upstream project: https://github.com/prisma/orm |
| PostgreSQL | Relational database | PostgreSQL License | Runtime | Free | Yes | APPROVED | https://www.postgresql.org/about/licence/ |
| Local Filesystem | Prototype document-file storage | Operating-system facility; no commercial storage license required | Runtime infrastructure | Free | Yes | APPROVED | Accessed through ERP storage abstraction |

---

# 4.1 V0.1-A Selected Direct Versions

The V0.1-A Technical Skeleton deliberately uses conservative maintained versions rather than automatically adopting every newest major release.

| Package / Tool | Selected Version | License | Use | Decision |
| --- | ---: | --- | --- | --- |
| Node.js | 24.21.0 LTS | Node.js open-source license + bundled notices | Runtime / build | APPROVED |
| pnpm | 12.6.0 | MIT for pnpm CLI | Package manager | APPROVED |
| React | 19.3.0 | MIT | Frontend runtime | APPROVED |
| React DOM | 19.3.0 | MIT | Browser renderer | APPROVED |
| TypeScript | 5.9.3 | Apache-2.0 | Compiler | APPROVED |
| Vite | 8.3.1 | MIT | Frontend build/dev server | APPROVED |
| @vitejs/plugin-react | 6.1.1 | MIT | Vite React integration | APPROVED |
| MUI Core | 7.3.11 | MIT | UI components | APPROVED |
| @emotion/react | 11.14.0 | MIT | MUI styling peer | APPROVED |
| @emotion/styled | 11.14.1 | MIT | MUI styling peer | APPROVED |
| TanStack Query | 5.103.2 | MIT | Server-state client | APPROVED |
| React Hook Form | 7.88.0 | MIT | Form state | APPROVED |
| Zod | 4.6.5 | MIT | Runtime validation | APPROVED |
| Frappe Gantt | 1.2.2 | MIT | V0.2 scheduling visualization only; official 1.2.2 CSS vendored locally with MIT notice to avoid package-export/layout coupling | APPROVED |
| NestJS common/core/platform-express | 11.2.6 | MIT | Backend framework | APPROVED |
| Prisma CLI / Client | 6.19.3 | Apache-2.0 | ORM / migrations | APPROVED |
| dotenv | 17.4.2 | BSD-2-Clause | Local environment loading | APPROVED |
| reflect-metadata | 0.2.2 | Apache-2.0 | NestJS decorator metadata | APPROVED |
| RxJS | 7.8.2 | Apache-2.0 | NestJS runtime dependency | APPROVED |
| @types/node | 24.13.6 | MIT | Development types | APPROVED |
| @types/react | 19.3.0 | MIT | Development types | APPROVED |
| @types/react-dom | 19.3.0 | MIT | Development types | APPROVED |
| PostgreSQL | 17.11 for local CI/container baseline | PostgreSQL License | Database | APPROVED |

Notes:

- Prisma 6.19.3 was selected for V0.1-A because it supports Node.js 24 and TypeScript 5.4+ while retaining the simpler, mature Prisma 6 runtime model.
- NestJS 11 and MUI 7 are intentionally selected instead of immediately moving the prototype to newly released major versions.
- Exact direct versions are pinned in `package.json`; the deterministic `pnpm-lock.yaml` must be committed after the first validated dependency installation.
- The PostgreSQL container tag is for Development/CI convenience only. PostgreSQL remains provider-independent.

---

# 4.2 Additional Direct Dependency Review

The following direct packages are required by the selected frameworks and are explicitly approved rather than being left implicit:

- React DOM — MIT
- Emotion React / Emotion Styled — MIT
- Vite React Plugin — MIT
- reflect-metadata — Apache-2.0
- RxJS — Apache-2.0
- dotenv — BSD-2-Clause
- DefinitelyTyped packages used directly by the project — MIT

GitHub workflow actions such as `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` are Development/CI tooling only and are not ERP runtime dependencies.

---

# 4.3 Temporary Security Override

A current Prisma stable dependency chain pins `deepmerge-ts` below the patched 8.x line.

Temporary override:

| Package | Forced Version | License | Reason | Removal Condition |
| --- | ---: | --- | --- | --- |
| deepmerge-ts | 8.0.2 | BSD-3-Clause | Remediates GHSA-ggr8-5vv4-36mx / CVE-2026-40345 detected by `pnpm audit` | Remove when the selected stable Prisma line consumes a patched compatible version upstream |

Notes:

- The advisory is High severity.
- Prisma's reported use is in configuration merging rather than normal HTTP request processing, so practical remote reachability is limited, but the project does not accept the known High finding when a testable workaround exists.
- The override crosses a dependency major version and therefore must remain covered by CI checks for Prisma Client generation, schema validation and PostgreSQL schema operations.
- This override is not blanket permission to force transitive major-version upgrades elsewhere.

---

# 5. Approved Development Tools

| Component | Purpose | License / Terms | Role | Prototype Cost | Runtime Dependency | Status | Review Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pnpm CLI | JavaScript package manager | MIT for the pnpm CLI/package | Development / Build | Free | No | APPROVED | https://github.com/pnpm/pnpm — the repository also contains a separate `pnpr/` area under PolyForm Shield; that component is not part of our approved toolchain |
| Podman | Local OCI containers | Apache-2.0 project license; distributed packages may include separately licensed dependencies | Development infrastructure | Free | No | APPROVED | https://github.com/containers/podman |
| Git | Source control | GPL-2.0-only | Development | Free | No | APPROVED EXCEPTION | Open-source copyleft development tool. It is not linked into or required by the ERP runtime |
| GitHub | Git hosting / Issues / Projects / PRs | Hosted proprietary service terms; not open-source software | Development service | Free tier currently usable | No | APPROVED SERVICE | Allowed because ERP runtime does not depend on GitHub and source remains portable standard Git |

---

# 6. Optional / Future Approved Component

| Component | Purpose | License | Role | Required Now | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| pg-boss | PostgreSQL-backed background-job queue | MIT | Optional Runtime | No | APPROVED — OPTIONAL | Introduce only when background processing is justified. Redis is not required merely to add queues |

No background queue is required for initial V0.1.

---

# 7. Optional Hosted PostgreSQL

## Neon

Neon may be evaluated later as a **hosted PostgreSQL provider** for shared Development / Staging access.

Important distinction:

- PostgreSQL remains the database technology.
- Neon is a hosted service/provider, not the ERP database architecture.
- Neon is not required for the ERP to function.
- the free service tier may change over time.
- provider-specific business logic is prohibited.
- connection remains a PostgreSQL `DATABASE_URL`.
- local/self-hosted PostgreSQL must remain viable.

Status:

**OPTIONAL SERVICE — NOT REQUIRED DEPENDENCY**

No Neon account/database is required during Phase 0.

---

# 8. Explicitly Not Approved for Mandatory Prototype Use

The following must not become mandatory prototype dependencies without a future approved Change Request.

| Component / Category | Reason |
| --- | --- |
| MUI X Pro | Commercial license / paid functionality not required |
| MUI X Premium | Commercial license / paid functionality not required |
| DHTMLX commercial Gantt offerings | Commercial licensing not required while Frappe Gantt satisfies prototype visualization |
| Paid authentication providers | Authentication must function without mandatory commercial identity services |
| Mandatory AWS/Azure/GCP services | Paid cloud infrastructure is not required to prove the prototype |
| Commercial reporting libraries | Reports must initially use approved open-source/free implementation |
| Redis as mandatory infrastructure | Not required by the current prototype; adding infrastructure needs a real requirement |
| MinIO / other AGPL storage components | Not part of baseline; AGPL use requires explicit review |
| Unreviewed source-available packages | Source-visible does not automatically satisfy Open-Source First policy |
| Unreviewed proprietary npm packages | Cannot enter runtime by convenience |

---

# 9. pnpm Licensing Boundary

The approved package-manager decision is:

**pnpm CLI/package**

The pnpm CLI is MIT licensed.

The current pnpm repository also contains a separate `pnpr/` area that is source-available under PolyForm Shield rather than MIT.

The Construction ERP does **not** approve or require the `pnpr` component.

This distinction must remain clear when tooling is installed or updated.

---

# 10. Git Copyleft Review

Git is GPL-2.0-only.

It is approved as a Development Tool exception because:

- it is open-source
- it is used for source control
- it is not linked into the ERP application
- it is not shipped as a required runtime library
- the ERP remains operational without Git/GitHub after deployment

This approval does not create blanket approval for GPL/AGPL runtime libraries.

Any future copyleft runtime dependency requires its own review.

---

# 11. Runtime Open-Source Gate

V0.1 fails the Open-Source First acceptance gate if:

- the ERP cannot run without purchasing a mandatory runtime license
- a commercial package is required for core functionality
- an unreviewed proprietary package enters the runtime
- a significant dependency has no recorded license/source
- a copyleft runtime dependency is adopted without explicit review
- a paid hosted service becomes mandatory without Change Control

---

# 12. Version Pinning Rule

This baseline approves technologies/licenses, not floating package versions.

When V0.1 development starts:

1. select an appropriate maintained version
2. record the exact direct version in package manifests / tooling configuration
3. commit the lockfile
4. verify the exact selected version's license
5. review release/security status
6. avoid uncontrolled `latest` dependencies in reproducible build configuration

Dependency upgrades repeat the relevant license/security review.

---

# 13. Transitive Dependency Rule

Approval of a direct dependency does not mean all future transitive packages are automatically trusted.

Before release:

- retain a deterministic lockfile
- review dependency inventory
- review known security vulnerabilities
- investigate unexpected proprietary/source-available/transitive licenses
- document material exceptions
- remove unnecessary dependencies

The project should prefer fewer dependencies when equivalent implementation is practical.

---

# 14. Package Addition Rule

Before adding a significant package, record:

- package/product name
- purpose
- exact intended version
- source repository
- license/SPDX expression
- runtime or dev-only
- free for prototype
- why built-in/current tooling is insufficient
- replaceability
- security/maintenance status
- reviewer decision

Only then should it be added to the project.

---

# 15. Security / Supply-Chain Rules

During implementation:

- use reputable official package sources
- verify package/repository identity before install
- commit deterministic lockfiles
- do not commit registry credentials/tokens
- do not execute arbitrary installation scripts from untrusted sources
- review high-risk postinstall behavior where introduced
- monitor known vulnerabilities before releases
- remove abandoned dependencies when they present unacceptable risk
- review container base-image provenance/license before adoption
- do not assume a package is safe simply because it is popular

---

# 16. Dependencies Not Yet Selected

The following implementation categories remain intentionally unselected:

- exact password-hashing package/implementation
- exact CSRF middleware/implementation
- exact NestJS rate-limiting package
- exact unit-test runner configuration
- exact React component-test stack
- exact E2E browser test package/version
- exact linting/formatting packages
- exact PDF/report-generation package
- exact CSV/export helper, if one is required

Before selection, each enters this register.

No commercial dependency is implied by these open implementation choices.

---

# 17. Current License Verification Notes

License review was performed against current official project sources on 2026-09-26.

Verified baseline examples include:

- React — MIT
- TypeScript — Apache-2.0
- Vite — MIT
- MUI Core — MIT
- TanStack Query — MIT
- React Hook Form — MIT
- Zod — MIT
- Frappe Gantt — MIT
- NestJS — MIT
- Prisma ORM — Apache-2.0
- PostgreSQL — PostgreSQL License
- pg-boss — MIT
- Podman — Apache-2.0
- pnpm CLI — MIT
- Git — GPL-2.0-only

Node.js uses its official open-source license file with MIT-style Node.js terms plus bundled third-party license notices. V0.1-A pins Node.js 24.21.0 LTS; bundled notices must be retained/reviewed when distributing a runtime image.

---

# 18. Review Before Commercial Upgrade

Commercial software may be considered later only when:

1. the working open-source prototype demonstrates a genuine limitation
2. the business benefit is clear
3. open-source alternatives are evaluated
4. license cost is understood
5. recurring cost is understood
6. data portability is preserved
7. replacing the component does not require unnecessary core database redesign
8. the change is approved through Change Control

---

# 19. Baseline Decision

The prototype remains capable of running with a free/open-source core stack:

```text
React + TypeScript
        |
      NestJS
        |
      Prisma
        |
   PostgreSQL
```

with:

- Frappe Gantt for schedule visualization
- local filesystem for initial documents
- Podman for optional local containerization
- pnpm for package management
- Git for source control
- GitHub only as a replaceable development service

No paid runtime license is required by the approved baseline.

**Status: Dependency License Baseline v0.1**
