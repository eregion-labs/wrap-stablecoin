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
import { useSnackbar } from "notistack";
import { mintLabel, shortMint } from "@/lib/mints";
import { selectRowMints } from "@/stores/selectors";
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

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            {adminCopy.reserveGovernance}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
            Register collateral reserves and configure issue/redeem flags, haircuts, caps, and
            status. The treasury signer composes and submits transactions via the backend.
          </Typography>
        </Box>
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
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
