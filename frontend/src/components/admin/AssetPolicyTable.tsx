"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import { useSnackbar } from "notistack";
import { apiPost } from "@/lib/api";
import { ADMIN_COLLATERAL_MINTS, mintLabel, shortMint } from "@/lib/mints";
import { sendWithBlockhashRefresh } from "@/lib/sendWithRefresh";
import type { AssetStatus, VaultAsset, VaultSummary } from "@/types/vault";

type TxResponse = { transactionB64: string };

type PolicyDraft = {
  mint: string;
  registered: boolean;
  mintEnabled: boolean;
  redeemEnabled: boolean;
  mintHaircutBps: string;
  redemptionHaircutBps: string;
  mintCap: string;
  exposureCap: string;
  minLiquidityTarget: string;
  assetStatus: AssetStatus;
};

const STATUS_OPTIONS: AssetStatus[] = [
  "active",
  "paused",
  "mint_only",
  "redeem_only",
  "deprecated",
];

function assetToDraft(mint: string, asset?: VaultAsset): PolicyDraft {
  return {
    mint,
    registered: asset != null,
    mintEnabled: asset?.mintEnabled ?? true,
    redeemEnabled: asset?.redeemEnabled ?? true,
    mintHaircutBps: String(asset?.mintHaircutBps ?? 0),
    redemptionHaircutBps: String(asset?.redemptionHaircutBps ?? 0),
    mintCap: String(asset?.mintCap ?? 0),
    exposureCap: String(asset?.exposureCap ?? 0),
    minLiquidityTarget: String(asset?.minLiquidityTarget ?? 0),
    assetStatus: (asset?.assetStatus as AssetStatus) ?? "active",
  };
}

type Props = {
  summary: VaultSummary | null;
  paused: boolean;
  onRefresh: () => Promise<void>;
};

export default function AssetPolicyTable({ summary, paused, onRefresh }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const [busyMint, setBusyMint] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});

  const assetByMint = useMemo(() => {
    const map = new Map<string, VaultAsset>();
    for (const a of summary?.assets ?? []) {
      map.set(a.mint, a);
    }
    return map;
  }, [summary]);

  const rowMints = useMemo(() => {
    const seen = new Set<string>();
    const mints: string[] = [];
    for (const m of ADMIN_COLLATERAL_MINTS) {
      if (!seen.has(m)) {
        seen.add(m);
        mints.push(m);
      }
    }
    for (const a of summary?.assets ?? []) {
      if (!seen.has(a.mint)) {
        seen.add(a.mint);
        mints.push(a.mint);
      }
    }
    return mints;
  }, [summary]);

  useEffect(() => {
    const next: Record<string, PolicyDraft> = {};
    for (const mint of rowMints) {
      next[mint] = assetToDraft(mint, assetByMint.get(mint));
    }
    setDrafts(next);
  }, [rowMints, assetByMint]);

  const updateDraft = useCallback((mint: string, patch: Partial<PolicyDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [mint]: { ...prev[mint], ...patch },
    }));
  }, []);

  const submitTx = async (buildTx: () => Promise<VersionedTransaction>) => {
    if (!publicKey) throw new Error("Wallet not connected");
    return sendWithBlockhashRefresh({
      connection,
      sendTransaction,
      buildTx,
      onBlockhashExpired: () =>
        enqueueSnackbar("Blockhash expired — please re-approve the refreshed transaction", {
          variant: "warning",
        }),
    });
  };

  const registerAsset = async (mint: string) => {
    if (!publicKey) return;
    const draft = drafts[mint];
    if (!draft) return;
    setBusyMint(mint);
    try {
      const sig = await submitTx(async () => {
        const { transactionB64 } = await apiPost<
          { admin: string; assetMint: string; mintEnabled: boolean; redeemEnabled: boolean },
          TxResponse
        >("/v1/tx/admin/add-asset", {
          admin: publicKey.toBase58(),
          assetMint: mint,
          mintEnabled: draft.mintEnabled,
          redeemEnabled: draft.redeemEnabled,
        });
        return VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64"));
      });
      enqueueSnackbar(`Registered ${mintLabel(mint)} (${sig.slice(0, 8)}…)`, {
        variant: "success",
      });
      await onRefresh();
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusyMint(null);
    }
  };

  const savePolicy = async (mint: string) => {
    if (!publicKey) return;
    const draft = drafts[mint];
    if (!draft) return;
    setBusyMint(mint);
    try {
      const sig = await submitTx(async () => {
        const { transactionB64 } = await apiPost<
          {
            admin: string;
            assetMint: string;
            mintEnabled: boolean;
            redeemEnabled: boolean;
            mintHaircutBps: number;
            redemptionHaircutBps: number;
            mintCap: number;
            exposureCap: number;
            minLiquidityTarget: number;
            assetStatus: string;
          },
          TxResponse
        >("/v1/tx/admin/update-asset-policy", {
          admin: publicKey.toBase58(),
          assetMint: mint,
          mintEnabled: draft.mintEnabled,
          redeemEnabled: draft.redeemEnabled,
          mintHaircutBps: Number(draft.mintHaircutBps) || 0,
          redemptionHaircutBps: Number(draft.redemptionHaircutBps) || 0,
          mintCap: Number(draft.mintCap) || 0,
          exposureCap: Number(draft.exposureCap) || 0,
          minLiquidityTarget: Number(draft.minLiquidityTarget) || 0,
          assetStatus: draft.assetStatus,
        });
        return VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64"));
      });
      enqueueSnackbar(`Policy saved for ${mintLabel(mint)} (${sig.slice(0, 8)}…)`, {
        variant: "success",
      });
      await onRefresh();
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusyMint(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Collateral policy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
            Register CCC and TTT as vault collateral and configure mint/redeem flags, haircuts,
            caps, and status. Changes require an admin signature.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={() => onRefresh()} disabled={busyMint != null}>
          Refresh
        </Button>
      </Stack>

      {paused && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Vault is globally paused. User wrap/unwrap is blocked until an operator clears pause.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell align="center">Mint</TableCell>
              <TableCell align="center">Redeem</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Mint haircut (bps)</TableCell>
              <TableCell align="right">Redeem haircut (bps)</TableCell>
              <TableCell align="right">Mint cap</TableCell>
              <TableCell align="right">Exposure cap</TableCell>
              <TableCell align="right">Min liquidity</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowMints.map((mint) => {
              const draft = drafts[mint];
              if (!draft) return null;
              const isBusy = busyMint === mint;
              return (
                <TableRow key={mint} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>
                        {mintLabel(mint)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {shortMint(mint)}
                      </Typography>
                      <Chip
                        label={draft.registered ? "Registered" : "Not registered"}
                        size="small"
                        color={draft.registered ? "success" : "default"}
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={draft.mintEnabled}
                      onChange={(e) => updateDraft(mint, { mintEnabled: e.target.checked })}
                      disabled={isBusy}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={draft.redeemEnabled}
                      onChange={(e) => updateDraft(mint, { redeemEnabled: e.target.checked })}
                      disabled={isBusy}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    <TextField
                      select
                      size="small"
                      value={draft.assetStatus}
                      onChange={(e) =>
                        updateDraft(mint, { assetStatus: e.target.value as AssetStatus })
                      }
                      disabled={isBusy || !draft.registered}
                      fullWidth
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft.mintHaircutBps}
                      onChange={(e) => updateDraft(mint, { mintHaircutBps: e.target.value })}
                      disabled={isBusy || !draft.registered}
                      inputProps={{ min: 0, max: 9999, style: { textAlign: "right" } }}
                      sx={{ width: 88 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft.redemptionHaircutBps}
                      onChange={(e) =>
                        updateDraft(mint, { redemptionHaircutBps: e.target.value })
                      }
                      disabled={isBusy || !draft.registered}
                      inputProps={{ min: 0, max: 9999, style: { textAlign: "right" } }}
                      sx={{ width: 88 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft.mintCap}
                      onChange={(e) => updateDraft(mint, { mintCap: e.target.value })}
                      disabled={isBusy || !draft.registered}
                      inputProps={{ min: 0, style: { textAlign: "right" } }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft.exposureCap}
                      onChange={(e) => updateDraft(mint, { exposureCap: e.target.value })}
                      disabled={isBusy || !draft.registered}
                      inputProps={{ min: 0, style: { textAlign: "right" } }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={draft.minLiquidityTarget}
                      onChange={(e) =>
                        updateDraft(mint, { minLiquidityTarget: e.target.value })
                      }
                      disabled={isBusy || !draft.registered}
                      inputProps={{ min: 0, style: { textAlign: "right" } }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {draft.registered ? (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={isBusy || !publicKey}
                        onClick={() => savePolicy(mint)}
                      >
                        {isBusy ? "…" : "Save policy"}
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        disabled={isBusy || !publicKey}
                        onClick={() => registerAsset(mint)}
                      >
                        {isBusy ? "…" : "Register"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
