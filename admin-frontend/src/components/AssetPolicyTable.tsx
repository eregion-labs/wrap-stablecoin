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
import AddCollateralPanel from "@/components/AddCollateralPanel";
import EnableKlendExpander from "@/components/EnableKlendExpander";
import PageHeading from "@/components/layout/PageHeading";
import { mintLabel, shortMint } from "@/lib/mints";
import ExplorerLink from "@/components/ExplorerLink";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { selectRowMints } from "@/stores/selectors";
import { useGovernanceStore } from "@/stores/governanceStore";
import { usePolicyStore } from "@/stores/policyStore";
import type { AssetStatus } from "@/types/vault";
import { wrappedTokenSymbol } from "@/types/vault";
import { monoSx, pageColumnSx } from "@/theme/tokens";
import { useVaultStore } from "@/stores/vaultStore";
import { adminCopy, metricHints } from "@/theme/copy";
import HintLabel from "@/components/HintLabel";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";

const STATUS_OPTIONS: AssetStatus[] = [
  "active",
  "paused",
  "mint_only",
  "redeem_only",
  "deprecated",
];

export default function AssetPolicyTable() {
  const { enqueueSnackbar } = useSnackbar();
  const config = useClientConfig();
  const includeCatalog = config.solana.network === "localnet";

  const summary = useVaultStore((s) => s.summary);
  const meta = useVaultStore((s) => s.meta);
  const refresh = useVaultStore((s) => s.refresh);

  const drafts = usePolicyStore((s) => s.drafts);
  const busyMint = usePolicyStore((s) => s.busyMint);
  const updateDraft = usePolicyStore((s) => s.updateDraft);
  const registerAsset = usePolicyStore((s) => s.registerAsset);
  const savePolicy = usePolicyStore((s) => s.savePolicy);

  const enableKlend = useGovernanceStore((s) => s.enableKlend);
  const govBusy = useGovernanceStore((s) => s.busy);
  const govBusyMint = useGovernanceStore((s) => s.busyMint);

  const rowMints = selectRowMints(summary, { includeCatalog });
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
    <Box sx={{ ...pageColumnSx, py: { xs: 3, md: 5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
        <PageHeading
          label={adminCopy.reserves}
          title={adminCopy.reserveGovernance}
          description="Register collateral reserves and configure issue/redeem flags, haircuts, caps, and status. The admin signs and submits transactions via the backend."
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

      {summary && summary.assets.length > 0 && (
        <VaultAccountingPanel
          assets={summary.assets}
          wrappedDecimals={summary.wrappedDecimals}
          wrappedSymbol={wrappedTokenSymbol(summary)}
        />
      )}

      <AddCollateralPanel />

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ width: "100%", minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <HintLabel metric={metricHints.asset} />
              </TableCell>
              <TableCell align="center">
                <HintLabel metric={metricHints.mintEnabled} align="center" />
              </TableCell>
              <TableCell align="center">
                <HintLabel metric={metricHints.redeemEnabled} align="center" />
              </TableCell>
              <TableCell>
                <HintLabel metric={metricHints.assetStatus} />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.mintHaircutBps} align="right" />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.redeemHaircutBps} align="right" />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.mintCap} align="right" />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.exposureCap} align="right" />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.cushion} align="right" />
              </TableCell>
              <TableCell align="right">
                <HintLabel metric={metricHints.policyActions} align="right" />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowMints.map((mint) => {
              const draft = drafts[mint];
              if (!draft) return null;
              const isBusy = busyMint === mint;
              const asset = summary?.assets.find((a) => a.mint === mint);
              const showEnableKlend = draft.registered && asset != null && !asset.klendEnabled;
              const enableBusy = govBusy === "enableKlend" && govBusyMint === mint;
              return (
                <Fragment key={mint}>
                  <TableRow hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={600}>
                          {mintLabel(mint)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={monoSx}>
                          <ExplorerLink address={mint} type="token">
                            {shortMint(mint)}
                          </ExplorerLink>
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
                        value={draft.cushion}
                        onChange={(e) => updateDraft(mint, { cushion: e.target.value })}
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
                    <EnableKlendExpander
                      mint={mint}
                      enableBusy={enableBusy}
                      onEnable={() => void onEnableKlend(mint)}
                    />
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
