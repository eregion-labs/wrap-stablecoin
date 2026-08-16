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
import { formatTokenAmount, haircutPercent, parseTokenAmount } from "@/lib/tokenAmount";
import PageHeading from "@/components/layout/PageHeading";
import { actionCardSx } from "@/theme/tokens";
import { publicCopy } from "@/theme/copy";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import {
  wrappedTokenName,
  wrappedTokenSymbol,
  type IssueQuote,
  type RedeemQuote,
  type VaultSummary,
} from "@/types/vault";

type TxResponse = { transactionB64: string };

export default function WrapRedeemPanel() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const config = useClientConfig();
  const deploymentKey = config.deploymentId;

  const [issueAmount, setIssueAmount] = useState("1");
  const [redeemAmount, setRedeemAmount] = useState("1");
  const [assetMint, setAssetMint] = useState(config.assets.defaultAssetMint);
  const [vaultSummary, setVaultSummary] = useState<VaultSummary | null>(null);
  const [walletBalances, setWalletBalances] = useState<Map<string, number>>(new Map());
  const [redeemQuote, setRedeemQuote] = useState<RedeemQuote | null>(null);
  const [issueQuote, setIssueQuote] = useState<IssueQuote | null>(null);
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

  const wrappedDecimals = vaultSummary?.wrappedDecimals ?? 6;
  const collateralDecimals = selectedAsset?.tokenDecimals ?? 6;
  const issueAtoms = parseTokenAmount(issueAmount, collateralDecimals);
  const redeemAtoms = parseTokenAmount(redeemAmount, wrappedDecimals);
  const onAllowlist = Boolean(
    address && (vaultSummary?.allowlist ?? []).includes(address),
  );
  const isAdmin = Boolean(address && vaultSummary?.admin === address);
  const wrapAccess =
    vaultSummary == null
      ? true
      : vaultSummary.wrapPublic || isAdmin || onAllowlist;
  const unwrapAccess =
    vaultSummary == null
      ? true
      : vaultSummary.unwrapPublic || isAdmin || onAllowlist;

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
  }, [loadVaultSummary, deploymentKey]);

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
    if (issueAtoms == null) {
      setIssueQuote(null);
      return;
    }
    const params = new URLSearchParams({
      amount: String(issueAtoms),
      assetMint,
    });
    if (address) params.set("user", address);
    apiGet<IssueQuote>(`/v1/quote/issue?${params.toString()}`)
      .then(setIssueQuote)
      .catch(() => setIssueQuote(null));
  }, [issueAtoms, assetMint, deploymentKey, address]);

  useEffect(() => {
    if (redeemAtoms == null) {
      setRedeemQuote(null);
      return;
    }
    const params = new URLSearchParams({
      amount: String(redeemAtoms),
      assetMint,
    });
    if (address) params.set("user", address);
    apiGet<RedeemQuote>(`/v1/quote/redeem?${params.toString()}`)
      .then(setRedeemQuote)
      .catch(() => setRedeemQuote(null));
  }, [redeemAtoms, assetMint, deploymentKey, address]);

  const afterTx = async (signature: string, label: string) => {
    enqueueSnackbar(`${label} — ${signature}`, { variant: "success" });
    await loadVaultSummary();
    await loadWalletBalances();
  };

  const submitIssue = async () => {
    if (!publicKey) return;
    const amount = issueAtoms;
    if (amount == null) {
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
    const amount = redeemAtoms;
    if (amount == null) {
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
      >("/v1/tx/issue", { user: address!, assetMint, amount: issueAtoms ?? 1 });
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
      >("/v1/tx/redeem", { user: address!, assetMint, amount: redeemAtoms ?? 1 });
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

  const redeemAmountNum = redeemAtoms ?? 0;
  const issueDisabled =
    !publicKey ||
    busy !== null ||
    issueAtoms == null ||
    vaultSummary?.paused === true ||
    vaultSummary?.mintAuthorityTransferred === true ||
    !wrapAccess ||
    (issueQuote != null && !issueQuote.canMint) ||
    (issueQuote?.accessAllowed === false) ||
    (selectedAsset != null && !selectedAsset.mintAllowed);
  const redeemDisabled =
    !publicKey ||
    busy !== null ||
    redeemAtoms == null ||
    vaultSummary?.paused === true ||
    !unwrapAccess ||
    !redeemQuote?.canRedeem ||
    redeemQuote.accessAllowed === false ||
    redeemAmountNum <= 0;

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4, gap: 2 }}>
        <PageHeading
          label={wrappedName}
          title={publicCopy.pageTitle}
          description={publicCopy.pageDescription.replace("Florin", wrappedName)}
        />
        <Button size="small" variant="outlined" onClick={refreshAll} disabled={busy !== null}>
          {publicCopy.refreshLedger}
        </Button>
      </Stack>

      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {vaultSummary?.paused && (
          <Alert severity="error">{publicCopy.pausedAlert}</Alert>
        )}
        {vaultSummary?.mintAuthorityTransferred && (
          <Alert severity="warning">{publicCopy.mintAuthorityTransferredAlert}</Alert>
        )}
        {vaultSummary && !vaultSummary.wrapPublic && (
          <Alert severity={address && wrapAccess ? "info" : "warning"}>
            {!address
              ? publicCopy.wrapPrivateDisconnected
              : wrapAccess
                ? publicCopy.wrapPrivateListed
                : publicCopy.wrapPrivateAlert}
          </Alert>
        )}
        {vaultSummary && !vaultSummary.unwrapPublic && (
          <Alert severity={address && unwrapAccess ? "info" : "warning"}>
            {!address
              ? publicCopy.unwrapPrivateDisconnected
              : unwrapAccess
                ? publicCopy.unwrapPrivateListed
                : publicCopy.unwrapPrivateAlert}
          </Alert>
        )}
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

        <Box sx={{ ...actionCardSx, mb: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            aria-label="Mint or redeem Florin"
            sx={{ mb: 2, minHeight: 40 }}
          >
            <Tab label={publicCopy.tabMint} />
            <Tab label={publicCopy.tabRedeem} />
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
                helperText={publicCopy.humanAmountHint}
              />
              {issueQuote && issueAtoms != null && (
                <Typography variant="body2" color="text.secondary">
                  Deposit {formatTokenAmount(issueQuote.input, collateralDecimals)}{" "}
                  {mintLabel(assetMint)} → receive{" "}
                  {formatTokenAmount(issueQuote.output, wrappedDecimals)} {wrappedSymbol}
                  {issueQuote.haircutBps > 0
                    ? ` (${haircutPercent(issueQuote.haircutBps)} mint haircut)`
                    : ""}
                </Typography>
              )}
              {issueQuote && issueQuote.mintCapRemaining != null && (
                <Typography variant="caption" color="text.secondary">
                  Mint cap remaining:{" "}
                  {formatTokenAmount(issueQuote.mintCapRemaining, wrappedDecimals)} {wrappedSymbol}
                </Typography>
              )}
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
                helperText={publicCopy.humanAmountHint}
              />
              {redeemQuote && redeemAtoms != null && (
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Burn {formatTokenAmount(redeemQuote.input, wrappedDecimals)} {wrappedSymbol} →
                  receive {formatTokenAmount(redeemQuote.output, collateralDecimals)}{" "}
                  {mintLabel(assetMint)}
                  {redeemQuote.haircutBps > 0
                    ? ` (${haircutPercent(redeemQuote.haircutBps)} redemption haircut)`
                    : ""}
                </Typography>
              )}
              {redeemQuote && redeemQuote.maxRedeemable > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Max redeemable from this pool:{" "}
                  {formatTokenAmount(redeemQuote.maxRedeemable, wrappedDecimals)} {wrappedSymbol}
                </Typography>
              )}
              {redeemQuote && !redeemQuote.redeemAllowed && (
                <Alert severity="warning">Redemption is disabled for this asset pool.</Alert>
              )}
              {redeemQuote && redeemQuote.liabilityShortfall > 0 && (
                <Alert severity="warning">
                  Amount exceeds pool liability (
                  {formatTokenAmount(redeemQuote.liability, wrappedDecimals)} {wrappedSymbol}). Use
                  another pool or reduce the burn amount.
                </Alert>
              )}
              {redeemQuote && redeemQuote.liquidityShortfall > 0 && (
                <Alert severity="warning">
                  Free vault liquidity (
                  {formatTokenAmount(redeemQuote.freeLiquidity, collateralDecimals)}{" "}
                  {mintLabel(assetMint)}) is below expected output. An operator must withdraw from
                  Kamino first.
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
