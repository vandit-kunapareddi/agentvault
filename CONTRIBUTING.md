# Contributing to AgentVault

Thanks for your interest. AgentVault is an open-source trust and control layer for AI-agent payments and contributions are very welcome — especially on the gaps listed in the [README's status table](./README.md#what-works-today-and-what-doesnt).

## Before you start

For substantial work, please open an issue first to talk through the approach. This is doubly true for:

- A new protocol handler (MPP sessions, ACP execution, AP2, TAP, etc.)
- A new `TrustProvider` implementation
- Schema changes
- Changes to the checkpoint decision pipeline or its escalation behaviour

Small fixes, doc improvements, and test additions can go straight to a PR.

## Local setup

```bash
git clone https://github.com/vandit-kunapareddi/agentvault
cd agentvault
npm install
docker compose up -d                   # local Postgres on :5432
cp .env.example .env                    # then set JWT_SECRET to a long random string
npm run db:migrate:deploy
npm run db:generate
npm run seed                            # optional — populates demo agents + transactions
npm run dev                             # checkpoint :4000, dashboard :3000
```

The dashboard lives at `http://localhost:3000`, the checkpoint at `http://localhost:4000`. Both auto-reload on change.

## Running checks

```bash
npm test                # Vitest unit tests
npm run typecheck       # tsc --noEmit on checkpoint + dashboard
npm run build:dashboard # full Next.js production build (catches things dev mode doesn't)
```

CI runs all three on every PR; please run them locally first.

## Writing tests

Unit tests live next to the file they cover (`foo.ts` → `foo.test.ts`) and use [Vitest](https://vitest.dev). Anything in `apps/**/lib/`, `apps/checkpoint/src/**/*.ts` (excluding handlers that touch external services), and `packages/sdk/src/` is a great target — see the existing tests for the shape.

The current suite is intentionally pure-function-focused: no database, no HTTP, no Express. If you need to test something that touches Prisma or Express, isolate the pure logic into a separate function and test that.

## Project structure

See [the README's Project layout section](./README.md#project-layout) for the lay of the land.

## Code style

- TypeScript everywhere (the project relies on `tsc --noEmit` for type safety; there is no ESLint config yet — contributions welcome).
- Match existing patterns. The dashboard uses Tailwind v4 directly (no component library); the checkpoint uses plain Express handlers.
- Prefer small, focused PRs over large sweeping ones.

## Things to be aware of when changing the checkpoint pipeline

- **Never fail open on escalations.** If the escalation timeout expires with no decision, the payment must auto-block. This is non-negotiable.
- **All trust logic goes through the `TrustProvider` interface.** Don't reach for `SimpleTrustProvider` directly inside the checkpoint — keep the interface clean so other providers can drop in.
- **The mock fallbacks in the x402, MPP, and ACP handlers are intentional** for local dev / demo flows without a funded wallet or live protocol setup. Don't remove them when adding real-settlement code paths.

## Reporting a vulnerability

If you find a security issue, please email the maintainer directly rather than opening a public issue. (Maintainer contact lives in the repo's GitHub profile.)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
