# Contributing to Bullpen

Thanks for considering a contribution. Bug reports, docs fixes, and PRs are all welcome.

## Before you start

For anything bigger than a small fix, open an issue first so we can agree on the approach. Looking for somewhere to jump in? Check the issues tagged [`good first issue`](https://github.com/NicolasCV/nestjs-bullpen/labels/good%20first%20issue).

## Setup

```bash
git clone https://github.com/NicolasCV/nestjs-bullpen
cd nestjs-bullpen
npm install
npm test
```

To run the dashboard against a real Redis, see [docs/development.md](./docs/development.md).

## Two rules that matter most

1. **Keep it lightweight.** No runtime dependencies (everything is a peer dep), and the UI stays small. After a UI change, run `npm run build` and check the printed `dist/ui/index.html` size.
2. **Keep it scale-safe.** Never load jobs or lists unbounded. Paginate by range, count with `getJobCounts`, and cap bulk/export operations with a clear "capped" signal.

Beyond those: the library is platform-agnostic (no Express- or Fastify-specific code), the UI is dark-first with no glow effects, and comments explain a non-obvious *why* rather than the *what*. [CLAUDE.md](./CLAUDE.md) has the full list.

## Pull requests

1. Branch off `main`.
2. Add or update a test. `npm test` and `npm run typecheck` should pass.
3. If you touched the UI, rebuild and include a screenshot.
4. Update the relevant doc under `docs/` (and the README if it's user-facing).
5. Use clear commit messages (Conventional Commits are appreciated, e.g. `feat: add job search by name`).

## Reporting bugs

Open an issue with the package version, NestJS version, and a minimal reproduction. The smaller the repro, the faster it gets fixed.

## Releases

Releases are automated. Every push to `main` runs CI and publishes to npm, with the version bumped from the commit message: include `[major]` or `[minor]` to pick the level, otherwise it's a patch. The pipeline tags the release and pushes the version bump back, so there's nothing to publish by hand.
