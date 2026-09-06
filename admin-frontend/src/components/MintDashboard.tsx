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
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import { useSnackbar } from "notistack";
import NextLink from "next/link";
import AmountActionRow from "@/components/AmountActionRow";
import PageHeading from "@/components/layout/PageHeading";
import SignerBalancesPanel from "@/components/SignerBalancesPanel";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { actionCardSx, monoSx } from "@/theme/tokens";
import { adminCopy } from "@/theme/copy";
import { wrappedTokenName, wrappedTokenSymbol } from "@/types/vault";
import { selectVaultAsset, selectVaultLoading } from "@/stores/selectors";
import { useMintStore } from "@/stores/mintStore";
import { useSignerBalancesStore } from "@/stores/signerBalancesStore";
import { useVaultStore } from "@/stores/vaultStore";

export default function MintDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);

  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const refresh = useVaultStore((s) => s.refresh);
  const refreshing = useVaultStore((s) => s.refreshing);

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

  const loading = selectVaultLoading(status, summary);
  const vaultAssets = summary?.assets ?? [];
  const wrappedSymbol = wrappedTokenSymbol(summary);
  const wrappedName = wrappedTokenName(summary);
  const selectedAsset = selectVaultAsset(summary, assetMint);
  const signerBalances = useSignerBalancesStore((s) => s.balances);
  const signerStatus = useSignerBalancesStore((s) => s.status);
  const collateralWalletAtoms = assetMint ? (signerBalances[assetMint] ?? 0) : 0;
  const wrappedWalletAtoms = summary ? (signerBalances[summary.wrappedMint] ?? 0) : 0;
  const signerReady = signerStatus === "ready";
  const mintHelperExtra =
    signerStatus === "loading"
      ? adminCopy.loadingSignerBalance
      : signerStatus === "error"
        ? adminCopy.signerBalanceUnavailable
        : adminCopy.humanAmountHint;

  const redeemMaxAtoms = Math.min(
    selectedAsset?.maxRedeemable ?? 0,
    signerReady ? wrappedWalletAtoms : Number.POSITIVE_INFINITY,
  );
  const redeemHelperExtra = selectedAsset
    ? `${adminCopy.redeemableBalance(
        formatTokenAmount(selectedAsset.maxRedeemable, summary?.wrappedDecimals ?? 6),
        wrappedSymbol,
      )}${
        signerReady
          ? ` · ${adminCopy.signerWalletBalance(
              formatTokenAmount(wrappedWalletAtoms, summary?.wrappedDecimals ?? 6),
              wrappedSymbol,
            )}`
          : ""
      } · ${adminCopy.humanAmountHint}`
    : adminCopy.humanAmountHint;

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
              sx={{ mt: 1, ...monoSx }}
            >
              {adminCopy.treasurySigner}: {summary.admin}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            void refresh();
            void useSignerBalancesStore.getState().refresh();
          }}
          disabled={busy !== null || refreshing}
        >
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

      <Box sx={{ ...actionCardSx, mt: 3, mb: 0 }}>
        <Stack spacing={2}>
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
                  {signerReady
                    ? ` · ${formatTokenAmount(signerBalances[a.mint] ?? 0, a.tokenDecimals)}`
                    : ""}
                </MenuItem>
              ))
            )}
          </TextField>

          {summary && <SignerBalancesPanel summary={summary} />}

          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            aria-label="Mint or redeem Florin"
            sx={{ minHeight: 40 }}
          >
            <Tab label={adminCopy.tabMint} />
            <Tab label={adminCopy.tabRedeem} />
          </Tabs>

          {tab === 0 && (
            <Stack spacing={1} role="tabpanel" aria-label={adminCopy.tabMint}>
              {selectedAsset && !selectedAsset.mintAllowed && (
                <Alert severity="warning">Minting is disabled for this asset pool.</Alert>
              )}
              <AmountActionRow
                label={adminCopy.collateralAmount}
                value={mintAmount}
                onChange={setMintAmount}
                availableAtoms={collateralWalletAtoms}
                decimals={selectedAsset?.tokenDecimals ?? 6}
                availableLabel="Signer wallet"
                symbol={selectedAsset ? mintLabel(selectedAsset.mint) : undefined}
                helperText={
                  selectedAsset && signerReady
                    ? undefined
                    : mintHelperExtra
                }
                helperExtra={adminCopy.humanAmountHint}
                fullWidth
                disabled={busy !== null}
                maxDisabled={busy !== null || !signerReady || collateralWalletAtoms <= 0}
                executeLabel={adminCopy.issueViaTreasury}
                executeBusy={busy === "mint"}
                executeDisabled={
                  busy !== null ||
                  !assetMint ||
                  (selectedAsset != null && !selectedAsset.mintAllowed) ||
                  (signerReady && collateralWalletAtoms <= 0)
                }
                onExecute={onMint}
              />
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1} role="tabpanel" aria-label={adminCopy.tabRedeem}>
              <AmountActionRow
                label={adminCopy.redeemAmount(wrappedSymbol)}
                value={redeemAmount}
                onChange={setRedeemAmount}
                availableAtoms={Number.isFinite(redeemMaxAtoms) ? redeemMaxAtoms : 0}
                decimals={summary?.wrappedDecimals ?? 6}
                availableLabel="Available"
                symbol={wrappedSymbol}
                helperText={redeemHelperExtra}
                fullWidth
                disabled={busy !== null}
                maxDisabled={
                  busy !== null ||
                  !selectedAsset ||
                  selectedAsset.maxRedeemable <= 0 ||
                  (signerReady && wrappedWalletAtoms <= 0)
                }
                executeLabel={adminCopy.redeemViaTreasury}
                executeBusy={busy === "redeem"}
                executeColor="secondary"
                executeDisabled={
                  busy !== null ||
                  !assetMint ||
                  !redeemQuote?.canRedeem ||
                  !Number.isFinite(Number(redeemAmount.replace(/,/g, ""))) ||
                  Number(redeemAmount.replace(/,/g, "")) <= 0
                }
                onExecute={onRedeem}
              >
                {redeemQuote && (
                  <Typography variant="body2" color="text.secondary">
                    Expected output:{" "}
                    {formatTokenAmount(redeemQuote.output, selectedAsset?.tokenDecimals ?? 6)}{" "}
                    {selectedAsset ? mintLabel(selectedAsset.mint) : ""}
                    {redeemQuote.haircutBps > 0 ? ` (haircut ${redeemQuote.haircutBps} bps)` : ""}
                  </Typography>
                )}
                {redeemQuote && !redeemQuote.redeemAllowed && (
                  <Alert severity="warning">{adminCopy.redeemDisabledAlert}</Alert>
                )}
                {redeemQuote && redeemQuote.liabilityShortfall > 0 && (
                  <Alert severity="warning">
                    {adminCopy.redeemLiabilityAlert(
                      formatTokenAmount(redeemQuote.liability, summary?.wrappedDecimals ?? 6),
                      wrappedSymbol,
                    )}
                  </Alert>
                )}
                {redeemQuote && redeemQuote.liquidityShortfall > 0 && (
                  <Alert severity="warning">
                    {adminCopy.redeemLiquidityAlertLead(
                      formatTokenAmount(
                        redeemQuote.freeLiquidity,
                        selectedAsset?.tokenDecimals ?? 6,
                      ),
                      selectedAsset ? mintLabel(selectedAsset.mint) : "",
                    )}{" "}
                    <Link
                      component={NextLink}
                      href="/yield"
                      underline="hover"
                      fontWeight={600}
                      color="inherit"
                    >
                      {adminCopy.redeemLiquidityAlertRecall}
                    </Link>{" "}
                    {adminCopy.redeemLiquidityAlertTail}
                  </Alert>
                )}
                {redeemQuote &&
                  !redeemQuote.canRedeem &&
                  redeemQuote.redeemAllowed &&
                  redeemQuote.liabilityShortfall <= 0 &&
                  redeemQuote.liquidityShortfall <= 0 && (
                    <Alert severity="warning">{adminCopy.redeemWouldFailAlert}</Alert>
                  )}
              </AmountActionRow>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
