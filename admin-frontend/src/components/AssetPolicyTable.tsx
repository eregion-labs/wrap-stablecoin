"use client";

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
import { Fragment } from "react";
import { useSnackbar } from "notistack";
import PageHeading from "@/components/layout/PageHeading";
import { mintLabel, shortMint } from "@/lib/mints";
import { selectRowMints } from "@/stores/selectors";
import { useGovernanceStore } from "@/stores/governanceStore";
import { usePolicyStore } from "@/stores/policyStore";
import type { AssetStatus } from "@/types/vault";
import { useVaultStore } from "@/stores/vaultStore";
import { adminCopy } from "@/theme/copy";

const STATUS_OPTIONS: AssetStatus[] = [
  "active",
  "paused",
  "mint_only",
  "redeem_only",
  "deprecated",
];

const LOCALNET_KLEND_PLACEHOLDERS = {
  lendingMarket: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
  reserve: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
  reserveLiquiditySupply: "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
  collateralMint: "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
};

export default function AssetPolicyTable() {
  const { enqueueSnackbar } = useSnackbar();

  const summary = useVaultStore((s) => s.summary);
  const meta = useVaultStore((s) => s.meta);
  const refresh = useVaultStore((s) => s.refresh);

  const drafts = usePolicyStore((s) => s.drafts);
  const busyMint = usePolicyStore((s) => s.busyMint);
  const updateDraft = usePolicyStore((s) => s.updateDraft);
  const registerAsset = usePolicyStore((s) => s.registerAsset);
  const savePolicy = usePolicyStore((s) => s.savePolicy);

  const enableDrafts = useGovernanceStore((s) => s.enableKlendDrafts);
  const setEnableKlendDraft = useGovernanceStore((s) => s.setEnableKlendDraft);
  const enableKlend = useGovernanceStore((s) => s.enableKlend);
  const govBusy = useGovernanceStore((s) => s.busy);
  const govBusyMint = useGovernanceStore((s) => s.busyMint);

  const rowMints = selectRowMints(summary);
  const paused = meta?.paused ?? false;

  const onRegister = async (mint: string) => {
    const result = await registerAsset(mint);
    if (result.ok) {
      enqueueSnackbar(`Registered ${mintLabel(mint)} (${result.data.signature.slice(0, 8)}…)`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  const onSavePolicy = async (mint: string) => {
    const result = await savePolicy(mint);
    if (result.ok) {
      enqueueSnackbar(`Policy saved for ${mintLabel(mint)} (${result.data.signature.slice(0, 8)}…)`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  const onEnableKlend = async (mint: string) => {
    const result = await enableKlend(mint);
    if (result.ok) {
      enqueueSnackbar(`Kamino enabled for ${mintLabel(mint)} (${result.data.signature.slice(0, 8)}…)`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", pt: 3, pb: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
        <PageHeading
          label={adminCopy.chamber}
          title={adminCopy.reserveGovernance}
          description="Register collateral reserves and configure issue/redeem flags, haircuts, caps, and status. The treasury signer signs and submits transactions via the backend."
        />
        <Button variant="outlined" size="small" onClick={() => refresh()} disabled={busyMint != null}>
          {adminCopy.refreshLedger}
        </Button>
      </Stack>

      {paused && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {adminCopy.pausedVaultAlert}
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
              const asset = summary?.assets.find((a) => a.mint === mint);
              const showEnableKlend = draft.registered && asset != null && !asset.klendEnabled;
              const enableDraft = enableDrafts[mint] ?? {
                lendingMarket: "",
                reserve: "",
                reserveLiquiditySupply: "",
                collateralMint: "",
              };
              const enableBusy = govBusy === "enableKlend" && govBusyMint === mint;
              return (
                <Fragment key={mint}>
                  <TableRow hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={600}>
                          {mintLabel(mint)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
                          {shortMint(mint)}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          <Chip
                            label={draft.registered ? "Registered" : "Not registered"}
                            size="small"
                            color={draft.registered ? "success" : "default"}
                            variant="outlined"
                          />
                          {asset?.klendEnabled && (
                            <Chip label="Kamino" size="small" variant="outlined" />
                          )}
                        </Stack>
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
                          disabled={isBusy}
                          onClick={() => onSavePolicy(mint)}
                        >
                          {isBusy ? "…" : "Save policy"}
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          disabled={isBusy}
                          onClick={() => onRegister(mint)}
                        >
                          {isBusy ? "…" : "Register"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {showEnableKlend && (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ bgcolor: "action.hover" }}>
                        <Stack spacing={1} sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {adminCopy.enableKlend}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {adminCopy.enableKlendHint}
                          </Typography>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
                            <TextField
                              size="small"
                              label={adminCopy.lendingMarket}
                              placeholder={LOCALNET_KLEND_PLACEHOLDERS.lendingMarket}
                              value={enableDraft.lendingMarket}
                              onChange={(e) =>
                                setEnableKlendDraft(mint, { lendingMarket: e.target.value })
                              }
                              disabled={enableBusy}
                              sx={{ minWidth: 220, flex: 1 }}
                            />
                            <TextField
                              size="small"
                              label={adminCopy.klendReserve}
                              placeholder={LOCALNET_KLEND_PLACEHOLDERS.reserve}
                              value={enableDraft.reserve}
                              onChange={(e) =>
                                setEnableKlendDraft(mint, { reserve: e.target.value })
                              }
                              disabled={enableBusy}
                              sx={{ minWidth: 220, flex: 1 }}
                            />
                            <TextField
                              size="small"
                              label={adminCopy.reserveLiquiditySupply}
                              placeholder={LOCALNET_KLEND_PLACEHOLDERS.reserveLiquiditySupply}
                              value={enableDraft.reserveLiquiditySupply}
                              onChange={(e) =>
                                setEnableKlendDraft(mint, {
                                  reserveLiquiditySupply: e.target.value,
                                })
                              }
                              disabled={enableBusy}
                              sx={{ minWidth: 220, flex: 1 }}
                            />
                            <TextField
                              size="small"
                              label={adminCopy.collateralMint}
                              placeholder={LOCALNET_KLEND_PLACEHOLDERS.collateralMint}
                              value={enableDraft.collateralMint}
                              onChange={(e) =>
                                setEnableKlendDraft(mint, { collateralMint: e.target.value })
                              }
                              disabled={enableBusy}
                              sx={{ minWidth: 220, flex: 1 }}
                            />
                            <Button
                              size="small"
                              variant="contained"
                              disabled={enableBusy}
                              onClick={() => onEnableKlend(mint)}
                            >
                              {enableBusy ? "…" : adminCopy.enableKlend}
                            </Button>
                          </Stack>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
