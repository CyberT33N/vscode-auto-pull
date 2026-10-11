# Auto Pull [Secured]

Auto Pull [Secured] keeps the checked-out branch of every repository in the open workspace up to date with its upstream. It runs a guarded cycle when the workspace opens and then on a configurable interval (default: every 60 seconds).

## Why an extension

VS Code ships `git.autofetch` / `git.autofetchPeriod`, but those settings only run `git fetch`; the working tree is never updated automatically. There is no built-in setting that performs a pull. This extension closes exactly that gap — with enterprise-grade safety guards.

## Behavior

Each cycle evaluates every repository through a guard pipeline before touching the working tree:

1. The checked-out branch must have an upstream and must not be detached.
2. The working tree must be clean (tracked changes, staged changes, and — by default — untracked files all block the cycle).
3. An in-progress merge or rebase blocks the cycle.
4. A `git fetch` of the upstream ref determines the authoritative behind/ahead state.
5. Only then is integration performed:
   - `ff-only` (default): fast-forward only, never a merge commit.
   - `rebase`: local commits are replayed onto the upstream.
6. A divergent branch (ahead and behind after the fetch) is never merged or rebased automatically — the status bar reports it and you decide.

## Configuration

- `autoPull.enabled` — master switch (default `true`).
- `autoPull.intervalSeconds` — interval between cycles, 5–3600 (default `60`). The first cycle runs when the workspace opens.
- `autoPull.strategy` — `"ff-only"` (default) or `"rebase"`.
- `autoPull.includeUntrackedFiles` — treat untracked files as non-blocking (default `false`).
- `autoPull.showStatusBarItem` — show the last cycle result in the status bar (default `true`).
- `autoPull.logLevel` — `off` | `error` | `warn` | `info` | `debug` (default `info`).

Commands: `Auto Pull: Run Now` (`autoPull.runNow`) triggers a single cycle on demand.

## Git API surface

The extension drives the built-in VS Code Git extension through its official API (`vscode.git`, API version 1). The local declaration surface in `src/infrastructure/git/git-api.d.ts` is a type-only subset of the official Microsoft `git.d.ts` (MIT licensed, copyright Microsoft Corporation); it exists so the extension compiles against the pinned `@types/vscode` baseline without shipping any runtime dependency.

## Development

This repository uses a PNPM-first, bundle-first extension delivery flow.

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run bundle
```

Use the `Run Extension` launch configuration in VS Code to start the extension host against `dist/**`.

## Packaging

```bash
pnpm run package
```

The packaging script materializes `catalog:` dependencies into a staged manifest and creates the VSIX in `artifacts/vsix/` through `@vscode/vsce --no-dependencies`.
