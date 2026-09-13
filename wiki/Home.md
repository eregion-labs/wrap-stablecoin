# Florin (FLRN) / Olympus Complex Wiki

Documentation for the **wrap-stablecoin** monorepo: a Kamino KLend–backed wrapped stablecoin (Florin (FLRN)) on Solana.

## Pages

| Page | Description |
|------|-------------|
| [Architecture](Architecture) | System design, flows, accounts, security model |
| [Flows](Flows) | Interactive diagrams: architecture, deployment CLI, wrap/unwrap, Kamino yield |
| [Monorepo](Monorepo) | Repo layout, build commands, environment variables |
| [On-chain program](On-chain-program) | Instructions, program ID, account types |
| [Backend API](Backend-API) | Transaction builder and admin endpoints |
| [Frontend](Frontend) | Next.js app and wallet integration |

## Quick reference

| Item | Value |
|------|-------|
| Program name | `wrap_stablecoin` |
| Program ID | `DUKXaKc4q6DXKf6mB13iyAB5vgBRvMH8WC2qy3RGUqSJ` |
| Base collateral | Registered USD stables (USDC at launch; 1:1 Florin (FLRN) mint/burn) |
| Yield venue | Kamino KLend |

## Source docs in repo

- On-chain design deep-dive: [`wrap-stablecoin/ARCHITECTURE.md`](../wrap-stablecoin/ARCHITECTURE.md)
- Program README: [`wrap-stablecoin/README.md`](../wrap-stablecoin/README.md)
- Root README: [`README.md`](../README.md)
