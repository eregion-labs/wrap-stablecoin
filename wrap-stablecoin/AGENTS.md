# Repository Guidelines

## Project Structure & Module Organization
- On-chain program: `programs/wrap-stablecoin/src/lib.rs` (Rust Anchor entrypoint) with crate metadata in `programs/wrap-stablecoin/Cargo.toml`.
- Client tests: `tests/*.ts` executed against the built IDL; `Anchor.toml` points to the generated ID under `[programs.localnet]`.
- Scripts: `migrations/deploy.ts` for deployment automation; adjust if you add custom setup.
- Build artifacts land in `target/` and `so/`; keep source edits inside `programs/` and `tests/` only.

## Build, Test, and Development Commands
- `anchor build` — compile the on-chain program.
- `anchor test` — spin up local validator, build, and run the TS tests defined by the `scripts.test` command.
- `yarn lint` / `yarn lint:fix` — check or auto-format JS/TS with Prettier per `package.json`.
- `yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts` — run the test suite directly when you already have a validator running.

## Coding Style & Naming Conventions
- Rust: default Rustfmt style; modules and files snake_case; prefer explicit account structs and derivations over ad-hoc tuples.
- TypeScript: camelCase for variables/functions, PascalCase for classes/interfaces; keep tests small and descriptive; rely on Prettier for spacing/quoting.
- IDs and public API names should match the Anchor ID in `lib.rs` and `Anchor.toml`.

## Testing Guidelines
- Framework: ts-mocha with chai assertions. Test files live under `tests/` and should mirror program APIs (`wrap-stablecoin` example provided).
- Write isolated integration tests that set up providers via `anchor.AnchorProvider.env()`. Prefer `program.methods.<ix>().rpc()` for clarity.
- When adding new instructions, include at least one happy-path test and, where possible, a failure case with meaningful error matching.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (e.g., `Add rebalance ix test`) and keep commits focused.
- PRs should describe intent, summarize key changes, list testing performed (commands or screenshots for explorer links), and call out any follow-up TODOs.
- Link issues when relevant and note any schema/IDL changes that require client updates.

## Environment & Security Notes
- Default provider is `localnet` with wallet from `~/.config/solana/id.json`; confirm keypair and cluster before running deploys.
- Avoid committing `target/`, `so/`, or test validator ledgers. Keep secrets and private keys out of the repo and logs.
