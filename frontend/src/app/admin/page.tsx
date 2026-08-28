"use client";

import { useCallback, useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { ADDR, fetchVaultSnapshot, fmt, VaultSnapshot } from "@/lib/devnetVault";

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const REFRESH_MS = 15_000;

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "success" | "warning" | "info";
}) {
  const color =
    accent === "success"
      ? "#4ade80"
      : accent === "warning"
        ? "#facc15"
        : accent === "info"
          ? "#a78bfa"
          : "#e5e5e5";
  return (
    <Card variant="outlined" sx={{ bgcolor: "#171717", height: "100%" }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ color, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FlowStep({ title, amount, note }: { title: string; amount: string; note: string }) {
  return (
    <Card variant="outlined" sx={{ bgcolor: "#171717", flex: 1, minWidth: 150 }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h6" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const conn = new Connection(RPC, "confirmed");
      setSnap(await fetchVaultSnapshot(conn));
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const explorer = (pk: { toBase58(): string }) =>
    `https://explorer.solana.com/address/${pk.toBase58()}?cluster=devnet`;

  const backing =
    snap && snap.wrappedSupply > 0n
      ? Number(snap.freeLiquidity + snap.liveKlendValue) / Number(snap.wrappedSupply)
      : null;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 5 }}>
      <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h4">Vault dashboard</Typography>
        <Chip size="small" label="devnet" color="secondary" variant="outlined" />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Live wStable vault + KLend position. Interest accrues lazily on-chain, so the
        KLend value is read through a simulated refresh_reserve. Auto-refreshes every 15s
        {updatedAt ? ` — last update ${updatedAt.toLocaleTimeString()}` : ""}.
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!snap ? <LinearProgress /> : null}

      {snap ? (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Chip label={snap.paused ? "PAUSED" : "active"} color={snap.paused ? "error" : "success"} size="small" />
            <Chip label={`wrap ${snap.wrapPublic ? "public" : "allowlist"}`} size="small" variant="outlined" />
            <Chip label={`unwrap ${snap.unwrapPublic ? "public" : "allowlist"}`} size="small" variant="outlined" />
            <Chip label={`slot ${snap.slot}`} size="small" variant="outlined" />
          </Stack>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Stat label="wStable supply" value={fmt(snap.wrappedSupply)} hint="1:1 par with tUSDC" />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Stat
                label="Backing ratio"
                value={backing === null ? "—" : `${(backing * 100).toFixed(4)}%`}
                hint="(free + KLend live value) / supply"
                accent={backing !== null && backing >= 1 ? "success" : "warning"}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Stat
                label="Unharvested yield"
                value={fmt(snap.unharvestedYield)}
                hint="KLend live value − tracked principal"
                accent="success"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Stat
                label="Treasury (harvested)"
                value={fmt(snap.treasuryBalance)}
                hint="accumulated via harvest_yield"
                accent="success"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Where the stablecoin sits
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="stretch" sx={{ mb: 4 }}>
            <FlowStep title="Users wrapped" amount={fmt(snap.totalStableDeposited)} note="tUSDC deposited all-time net" />
            <FlowStep title="Vault (free)" amount={fmt(snap.freeLiquidity)} note="instantly redeemable" />
            <FlowStep
              title="KLend (tracked)"
              amount={fmt(snap.trackedInKlend)}
              note={`${fmt(snap.collateralKTokens)} kTokens held`}
            />
            <FlowStep
              title="KLend (live value)"
              amount={fmt(snap.liveKlendValue)}
              note={`exchange rate ${snap.exchangeRate.toFixed(9)}`}
            />
          </Stack>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Reserve economics
          </Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, md: 4 }}>
              <Stat label="Utilization" value={`${snap.utilizationPct.toFixed(2)}%`} hint="borrowed / total liquidity" accent="info" />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Stat label="Borrow APR (est.)" value={`${snap.borrowAprPct.toFixed(1)}%`} hint="curve: 500% → 1000%" accent="info" />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Stat label="Supply APY (est.)" value={`${snap.supplyApyPct.toFixed(1)}%`} hint="borrow APR × utilization" accent="info" />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Accounts
          </Typography>
          <Stack spacing={0.5}>
            {Object.entries(ADDR).map(([name, pk]) => (
              <Typography key={name} variant="body2" sx={{ fontFamily: "monospace" }}>
                {name.padEnd(16)}{" "}
                <Link href={explorer(pk)} target="_blank" rel="noreferrer" underline="hover">
                  {pk.toBase58()}
                </Link>
              </Typography>
            ))}
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
