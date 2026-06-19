# wStable / Olympus Complex Wiki

Documentation for the **wrap-stablecoin** monorepo: a Kamino KLend–backed wrapped stablecoin (wStable) on Solana.

## Pages

| Page | Description |
|------|-------------|
| [Architecture](Architecture) | System design, flows, accounts, security model |
| [Monorepo](Monorepo) | Repo layout, build commands, environment variables |
| [On-chain program](On-chain-program) | Instructions, program ID, account types |
| [Backend API](Backend-API) | Transaction builder endpoints and Jupiter composition |
| [Frontend](Frontend) | Next.js app and wallet integration |

## Quick reference

| Item | Value |
|------|-------|
| Program name | `wrap_stablecoin` |
| Program ID | `5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT` |
| Base collateral | USDC (1:1 wStable mint/burn) |
| Yield venue | Kamino KLend |
| Off-chain swaps | Jupiter (backend only) |

## Source docs in repo

- On-chain design deep-dive: [`wrap-stablecoin/ARCHITECTURE.md`](../wrap-stablecoin/ARCHITECTURE.md)
- Program README: [`wrap-stablecoin/README.md`](../wrap-stablecoin/README.md)
- Root README: [`README.md`](../README.md)
