"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletBalancesPanel from "@/components/WalletBalancesPanel";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useSnackbar } from "notistack";
import { apiGet, apiPost } from "@/lib/api";
import { sendWithBlockhashRefresh } from "@/lib/sendWithRefresh";
import { fetchWalletBalances } from "@/lib/walletBalances";
import { mintLabel } from "@/lib/mints";
import { cardSx } from "@/theme/tokens";
import { publicCopy } from "@/theme/copy";
import { useNetworkStore } from "@/stores/networkStore";
import {
  wrappedTokenName,
  wrappedTokenSymbol,
  type RedeemQuote,
  type VaultSummary,
} from "@/types/vault";

type TxResponse = { transactionB64: string };

const DEFAULT_ASSET_MINT =
  process.env.NEXT_PUBLIC_DEFAULT_ASSET_MINT ||
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function WrapRedeemPanel() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const network = useNetworkStore((s) => s.network);

  const [issueAmount, setIssueAmount] = useState("1000000");
  const [redeemAmount, setRedeemAmount] = useState("1000000");
  const [assetMint, setAssetMint] = useState(DEFAULT_ASSET_MINT);
  const [vaultSummary, setVaultSummary] = useState<VaultSummary | null>(null);
  const [walletBalances, setWalletBalances] = useState<Map<string, number>>(new Map());
  const [redeemQuote, setRedeemQuote] = useState<RedeemQuote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const address = publicKey?.toBase58();
  const vaultAssets = vaultSummary?.assets ?? [];
  const wrappedSymbol = wrappedTokenSymbol(vaultSummary);
  const wrappedName = wrappedTokenName(vaultSummary);

  const selectedAsset = useMemo(
    () => vaultAssets.find((a) => a.mint === assetMint),
    [vaultAssets, assetMint],
  );

  const loadVaultSummary = useCallback(async () => {
    try {
      const summary = await apiGet<VaultSummary>("/v1/vault/assets");
      setVaultSummary(summary);
    } catch {
      setVaultSummary(null);
    }
  }, []);

  const loadWalletBalances = useCallback(async () => {
    if (!publicKey || !vaultSummary) {
      setWalletBalances(new Map());
      return;
    }
    try {
      const mints = [
        ...vaultSummary.assets.map((a) => new PublicKey(a.mint)),
        new PublicKey(vaultSummary.wrappedMint),
      ];
      const balances = await fetchWalletBalances(connection, publicKey, mints);
      setWalletBalances(balances);
    } catch {
      setWalletBalances(new Map());
    }
  }, [connection, publicKey, vaultSummary]);

  const refreshAll = useCallback(async () => {
    await loadVaultSummary();
  }, [loadVaultSummary]);

  useEffect(() => {
    loadVaultSummary();
  }, [loadVaultSummary, network]);

  useEffect(() => {
    if (!vaultSummary || vaultSummary.assets.length === 0) return;
    setAssetMint((current) =>
      vaultSummary.assets.some((a) => a.mint === current)
        ? current
        : vaultSummary.assets[0].mint,
    );
  }, [vaultSummary]);

  useEffect(() => {
    loadWalletBalances();
  }, [loadWalletBalances]);

  useEffect(() => {
    const amount = Number(redeemAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRedeemQuote(null);
      return;
    }
    const params = new URLSearchParams({
      amount: String(amount),
      assetMint,
    });
    apiGet<RedeemQuote>(`/v1/quote/redeem?${params.toString()}`)
      .then(setRedeemQuote)
      .catch(() => setRedeemQuote(null));
  }, [redeemAmount, assetMint, network]);

  const afterTx = async (signature: string, label: string) => {
    enqueueSnackbar(`${label} — ${signature}`, { variant: "success" });
    await loadVaultSummary();
    await loadWalletBalances();
  };

  const submitIssue = async () => {
    if (!publicKey) return;
    const amount = Number(issueAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      enqueueSnackbar("Invalid amount", { variant: "error" });
      return;
    }
    if (!signTransaction) {
      enqueueSnackbar("Wallet does not support signing transactions", { variant: "error" });
      return;
    }
    setBusy("issue");
    try {
      const buildTx = async () => {
        const { transactionB64 } = await apiPost<
          { user: string; assetMint: string; amount: number },
          TxResponse
        >("/v1/tx/issue", { user: address!, assetMint, amount });
        return VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64"));
      };
      const signature = await sendWithBlockhashRefresh({
        connection,
        signTransaction,
        buildTx,
        onBlockhashExpired: () =>
          enqueueSnackbar("Blockhash expired — please re-approve the refreshed transaction", {
            variant: "warning",
          }),
      });
      await afterTx(signature, "Issued");
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const submitRedeem = async () => {
    if (!publicKey) return;
    const amount = Number(redeemAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      enqueueSnackbar("Invalid amount", { variant: "error" });
      return;
    }
    if (!signTransaction) {
      enqueueSnackbar("Wallet does not support signing transactions", { variant: "error" });
      return;
    }
    setBusy("redeem");
    try {
      const buildTx = async () => {
        const { transactionB64 } = await apiPost<
          { user: string; assetMint: string; amount: number },
          TxResponse
        >("/v1/tx/redeem", { user: address!, assetMint, amount });
        return VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64"));
      };
      const signature = await sendWithBlockhashRefresh({
        connection,
        signTransaction,
        buildTx,
        onBlockhashExpired: () =>
          enqueueSnackbar("Blockhash expired — please re-approve the refreshed transaction", {
            variant: "warning",
          }),
      });
      await afterTx(signature, "Redeemed");
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const simulateIssue = async () => {
    if (!publicKey) return;
    setBusy("sim-issue");
    try {
      const { transactionB64 } = await apiPost<
        { user: string; assetMint: string; amount: number },
        TxResponse
      >("/v1/tx/issue", { user: address!, assetMint, amount: Number(issueAmount) || 1 });
      const sim = await connection.simulateTransaction(
        VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64")),
      );
      enqueueSnackbar(
        sim.value.err ? `Sim err: ${JSON.stringify(sim.value.err)}` : "Issue simulation ok",
        { variant: sim.value.err ? "warning" : "success" },
      );
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const simulateRedeem = async () => {
    if (!publicKey) return;
    setBusy("sim-redeem");
    try {
      const { transactionB64 } = await apiPost<
        { user: string; assetMint: string; amount: number },
        TxResponse
      >("/v1/tx/redeem", { user: address!, assetMint, amount: Number(redeemAmount) || 1 });
      const sim = await connection.simulateTransaction(
        VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64")),
      );
      enqueueSnackbar(
        sim.value.err ? `Sim err: ${JSON.stringify(sim.value.err)}` : "Redeem simulation ok",
        { variant: sim.value.err ? "warning" : "success" },
      );
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const redeemAmountNum = Number(redeemAmount);
  const issueDisabled =
    !publicKey ||
    busy !== null ||
    (selectedAsset != null && !selectedAsset.mintAllowed);
  const redeemDisabled =
    !publicKey ||
    busy !== null ||
    !redeemQuote?.canRedeem ||
    !Number.isFinite(redeemAmountNum) ||
    redeemAmountNum <= 0;

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            {publicCopy.pageTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
            {publicCopy.pageDescription.replace("Florin", wrappedName)}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={refreshAll} disabled={busy !== null}>
          {publicCopy.refreshLedger}
        </Button>
      </Stack>

      <Stack spacing={3}>
        <WalletBalancesPanel
          summary={vaultSummary}
          walletBalances={walletBalances}
          connected={connected}
        />

        <TextField
          select
          label={publicCopy.reserveCollateral}
          value={assetMint}
          onChange={(e) => setAssetMint(e.target.value)}
          fullWidth
        >
          {vaultAssets.length === 0 ? (
            <MenuItem value={assetMint}>{mintLabel(assetMint)}</MenuItem>
          ) : (
            vaultAssets.map((a) => (
              <MenuItem key={a.mint} value={a.mint}>
                {mintLabel(a.mint)}
              </MenuItem>
            ))
          )}
        </TextField>

        <Box sx={{ ...cardSx, mb: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            aria-label="Mint or redeem Florin"
            sx={{ mb: 2, minHeight: 40 }}
          >
            <Tab label={publicCopy.tabMint} sx={{ textTransform: "none", fontWeight: 600 }} />
            <Tab label={publicCopy.tabRedeem} sx={{ textTransform: "none", fontWeight: 600 }} />
          </Tabs>

          {tab === 0 && (
            <Stack spacing={1} role="tabpanel" aria-label={publicCopy.tabMint}>
              {selectedAsset && !selectedAsset.mintAllowed && (
                <Alert severity="warning">Minting is disabled for this asset pool.</Alert>
              )}
              <TextField
                label={publicCopy.collateralAmount}
                value={issueAmount}
                onChange={(e) => setIssueAmount(e.target.value)}
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={issueDisabled} onClick={submitIssue}>
                  {busy === "issue" ? publicCopy.signing : publicCopy.signAndSend}
                </Button>
                <Button variant="outlined" disabled={!publicKey || busy !== null} onClick={simulateIssue}>
                  {busy === "sim-issue" ? "…" : publicCopy.simulate}
                </Button>
              </Stack>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1} role="tabpanel" aria-label={publicCopy.tabRedeem}>
              <TextField
                label={publicCopy.redeemAmount(wrappedSymbol)}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                fullWidth
              />
              {redeemQuote && (
                <Typography variant="body2" color="text.secondary">
                  Expected output: {redeemQuote.output} base units
                  {redeemQuote.haircutBps > 0
                    ? ` (haircut ${redeemQuote.haircutBps} bps)`
                    : ""}
                  {redeemQuote.maxRedeemable > 0
                    ? ` · max ${redeemQuote.maxRedeemable} ${wrappedSymbol} from this pool`
                    : ""}
                </Typography>
              )}
              {redeemQuote && !redeemQuote.redeemAllowed && (
                <Alert severity="warning">Redemption is disabled for this asset pool.</Alert>
              )}
              {redeemQuote && redeemQuote.liabilityShortfall > 0 && (
                <Alert severity="warning">
                  Amount exceeds pool liability ({redeemQuote.liability}). Use another pool or reduce
                  the burn amount.
                </Alert>
              )}
              {redeemQuote && redeemQuote.liquidityShortfall > 0 && (
                <Alert severity="warning">
                  Free vault liquidity ({redeemQuote.freeLiquidity}) is below expected output. An
                  operator must withdraw from Kamino first.
                </Alert>
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color="secondary" disabled={redeemDisabled} onClick={submitRedeem}>
                  {busy === "redeem" ? publicCopy.signing : publicCopy.signAndSend}
                </Button>
                <Button variant="outlined" disabled={!publicKey || busy !== null} onClick={simulateRedeem}>
                  {busy === "sim-redeem" ? "…" : publicCopy.simulate}
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
