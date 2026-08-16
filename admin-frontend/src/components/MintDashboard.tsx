"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useSnackbar } from "notistack";
import PageHeading from "@/components/layout/PageHeading";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";
import { mintLabel } from "@/lib/mints";
import { actionCardSx } from "@/theme/tokens";
import { adminCopy } from "@/theme/copy";
import { wrappedTokenName, wrappedTokenSymbol } from "@/types/vault";
import { selectVaultAsset, selectVaultLoading } from "@/stores/selectors";
import { useMintStore } from "@/stores/mintStore";
import { useVaultStore } from "@/stores/vaultStore";

export default function MintDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);

  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const refresh = useVaultStore((s) => s.refresh);

  const assetMint = useMintStore((s) => s.assetMint);
  const mintAmount = useMintStore((s) => s.mintAmount);
  const redeemAmount = useMintStore((s) => s.redeemAmount);
  const redeemQuote = useMintStore((s) => s.redeemQuote);
  const busy = useMintStore((s) => s.busy);
  const setAssetMint = useMintStore((s) => s.setAssetMint);
  const setMintAmount = useMintStore((s) => s.setMintAmount);
  const setRedeemAmount = useMintStore((s) => s.setRedeemAmount);
  const submitMint = useMintStore((s) => s.submitMint);
  const submitRedeem = useMintStore((s) => s.submitRedeem);

  const loading = selectVaultLoading(status);
  const vaultAssets = summary?.assets ?? [];
  const wrappedSymbol = wrappedTokenSymbol(summary);
  const wrappedName = wrappedTokenName(summary);
  const selectedAsset = selectVaultAsset(summary, assetMint);

  const onMint = async () => {
    const result = await submitMint();
    if (result.ok) {
      enqueueSnackbar(`Minted ${wrappedSymbol} — ${result.data.signature.slice(0, 8)}…`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  const onRedeem = async () => {
    const result = await submitRedeem();
    if (result.ok) {
      enqueueSnackbar(`Redeemed underlying — ${result.data.signature.slice(0, 8)}…`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4, gap: 2 }}>
        <Box>
          <PageHeading
            label={adminCopy.officeTitle}
            title={adminCopy.treasuryPageTitle}
            description={adminCopy.treasuryPageDescription(wrappedName, wrappedSymbol)}
          />
          {summary?.admin && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 1, fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
            >
              {adminCopy.treasurySigner}: {summary.admin}
            </Typography>
          )}
        </Box>
        <Button size="small" variant="outlined" onClick={() => refresh()} disabled={busy !== null}>
          {adminCopy.refreshLedger}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {summary && summary.assets.length > 0 && (
        <VaultAccountingPanel
          assets={summary.assets}
          wrappedDecimals={summary.wrappedDecimals}
          wrappedSymbol={wrappedSymbol}
        />
      )}

      <Stack spacing={3} sx={{ mt: 3 }}>
        <TextField
          select
          label={adminCopy.reserveCollateral}
          value={assetMint}
          onChange={(e) => setAssetMint(e.target.value)}
          fullWidth
          disabled={vaultAssets.length === 0}
        >
          {vaultAssets.length === 0 ? (
            <MenuItem value="">No registered assets</MenuItem>
          ) : (
            vaultAssets.map((a) => (
              <MenuItem key={a.mint} value={a.mint}>
                {mintLabel(a.mint)}
              </MenuItem>
            ))
          )}
        </TextField>

        <Box sx={{ ...actionCardSx, mb: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            aria-label="Mint or redeem Florin"
            sx={{ mb: 2, minHeight: 40 }}
          >
            <Tab label={adminCopy.tabMint} />
            <Tab label={adminCopy.tabRedeem} />
          </Tabs>

          {tab === 0 && (
            <Stack spacing={1} role="tabpanel" aria-label={adminCopy.tabMint}>
              {selectedAsset && !selectedAsset.mintAllowed && (
                <Alert severity="warning">Minting is disabled for this asset pool.</Alert>
              )}
              <TextField
                label={adminCopy.collateralAmount}
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                disabled={
                  busy !== null || !assetMint || (selectedAsset != null && !selectedAsset.mintAllowed)
                }
                onClick={onMint}
              >
                {busy === "mint" ? adminCopy.submitting : adminCopy.issueViaTreasury}
              </Button>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1} role="tabpanel" aria-label={adminCopy.tabRedeem}>
              <TextField
                label={adminCopy.redeemAmount(wrappedSymbol)}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                fullWidth
              />
              {redeemQuote && (
                <Typography variant="body2" color="text.secondary">
                  Expected output: {redeemQuote.output} base units
                  {redeemQuote.haircutBps > 0 ? ` (haircut ${redeemQuote.haircutBps} bps)` : ""}
                </Typography>
              )}
              {redeemQuote && !redeemQuote.canRedeem && (
                <Alert severity="warning">Redemption would fail on-chain for this amount.</Alert>
              )}
              <Button
                variant="contained"
                color="secondary"
                disabled={
                  busy !== null ||
                  !assetMint ||
                  !redeemQuote?.canRedeem ||
                  !Number.isFinite(Number(redeemAmount)) ||
                  Number(redeemAmount) <= 0
                }
                onClick={onRedeem}
              >
                {busy === "redeem" ? adminCopy.submitting : adminCopy.redeemViaTreasury}
              </Button>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
