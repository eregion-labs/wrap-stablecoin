"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { VersionedTransaction } from "@solana/web3.js";
import { useSnackbar } from "notistack";
import { apiGet, apiPost } from "@/lib/api";
import { sendWithBlockhashRefresh } from "@/lib/sendWithRefresh";

type TxResponse = { transactionB64: string };

type VaultAsset = {
  mint: string;
  freeLiquidity: number;
  deployedToKamino: number;
  mintEnabled: boolean;
  redeemEnabled: boolean;
  mintHaircutBps: number;
  redemptionHaircutBps: number;
  netLiability: number;
  assetStatus: string;
};

type RedeemQuote = {
  input: number;
  output: number;
  haircutBps: number;
  assetMint: string;
  freeLiquidity: number;
  deployedToKamino: number;
  redeemEnabled: boolean;
};

const DEFAULT_ASSET_MINT =
  process.env.NEXT_PUBLIC_DEFAULT_ASSET_MINT ||
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function WrapRedeemPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, connecting } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [issueAmount, setIssueAmount] = useState("1000000");
  const [redeemAmount, setRedeemAmount] = useState("1000000");
  const [assetMint, setAssetMint] = useState(DEFAULT_ASSET_MINT);
  const [vaultAssets, setVaultAssets] = useState<VaultAsset[]>([]);
  const [redeemQuote, setRedeemQuote] = useState<RedeemQuote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const address = publicKey?.toBase58();

  useEffect(() => {
    apiGet<{ assets: VaultAsset[] }>("/v1/vault/assets")
      .then((r) => setVaultAssets(r.assets))
      .catch(() => setVaultAssets([]));
  }, []);

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
  }, [redeemAmount, assetMint]);

  const submitIssue = async () => {
    if (!publicKey) {
      enqueueSnackbar("Connect a Solana wallet", { variant: "warning" });
      return;
    }
    const amount = Number(issueAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      enqueueSnackbar("Invalid amount", { variant: "error" });
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
        sendTransaction,
        buildTx,
        onBlockhashExpired: () =>
          enqueueSnackbar("Blockhash expired — please re-approve the refreshed transaction", {
            variant: "warning",
          }),
      });
      enqueueSnackbar(`Issued — ${signature}`, { variant: "success" });
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const submitRedeem = async () => {
    if (!publicKey) {
      enqueueSnackbar("Connect a Solana wallet", { variant: "warning" });
      return;
    }
    const amount = Number(redeemAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      enqueueSnackbar("Invalid amount", { variant: "error" });
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
        sendTransaction,
        buildTx,
        onBlockhashExpired: () =>
          enqueueSnackbar("Blockhash expired — please re-approve the refreshed transaction", {
            variant: "warning",
          }),
      });
      enqueueSnackbar(`Redeemed — ${signature}`, { variant: "success" });
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const simulate = async () => {
    if (!publicKey) return;
    setBusy("sim");
    try {
      const { transactionB64 } = await apiPost<
        { user: string; assetMint: string; amount: number },
        TxResponse
      >("/v1/tx/issue", { user: address!, assetMint, amount: Number(issueAmount) || 1 });
      const sim = await connection.simulateTransaction(
        VersionedTransaction.deserialize(Buffer.from(transactionB64, "base64")),
      );
      enqueueSnackbar(
        sim.value.err ? `Sim err: ${JSON.stringify(sim.value.err)}` : "Simulation ok",
        { variant: sim.value.err ? "warning" : "success" },
      );
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const liquidityShortfall =
    redeemQuote && redeemQuote.output > redeemQuote.freeLiquidity;

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" gutterBottom>
        Wrap stablecoin
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Issue (wrap) and redeem (unwrap) wStable against a registered collateral asset. Amounts
        are in smallest token units.
      </Typography>

      {vaultAssets.length > 0 && (
        <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Available redemption liquidity
          </Typography>
          {vaultAssets.map((a) => (
            <Typography key={a.mint} variant="body2" sx={{ fontFamily: "monospace" }}>
              {a.mint.slice(0, 4)}…{a.mint.slice(-4)}: free {a.freeLiquidity}
              {a.deployedToKamino > 0 ? ` (${a.deployedToKamino} in Kamino)` : ""}
              {a.redeemEnabled ? "" : " (redeem off)"}
            </Typography>
          ))}
        </Box>
      )}

      {connecting ? (
        <Typography>Connecting wallet…</Typography>
      ) : !connected ? (
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="body2" color="text.secondary">
            Connect with Phantom to sign wrap and redeem transactions.
          </Typography>
          <ConnectWalletButton />
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Connected
            </Typography>
            <ConnectWalletButton compact />
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all", display: "block", mt: 0.5 }}>
              {address}
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <TextField
              label="Collateral mint (asset)"
              value={assetMint}
              onChange={(e) => setAssetMint(e.target.value)}
              fullWidth
            />
            <Typography variant="subtitle1">Issue (wrap)</Typography>
            <TextField
              label="Amount (base units)"
              value={issueAmount}
              onChange={(e) => setIssueAmount(e.target.value)}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!publicKey || busy !== null}
                onClick={submitIssue}
              >
                {busy === "issue" ? "Signing…" : "Sign & send"}
              </Button>
              <Button variant="outlined" disabled={!publicKey || busy !== null} onClick={simulate}>
                {busy === "sim" ? "…" : "Simulate"}
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle1">Redeem (unwrap)</Typography>
            <TextField
              label="Wrapped amount to burn"
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
              </Typography>
            )}
            {liquidityShortfall && (
              <Alert severity="warning">
                Free vault liquidity ({redeemQuote!.freeLiquidity}) is below expected output (
                {redeemQuote!.output}). Redeem may fail until an operator withdraws from Kamino.
              </Alert>
            )}
            <Button
              variant="contained"
              color="secondary"
              disabled={!publicKey || busy !== null}
              onClick={submitRedeem}
            >
              {busy === "redeem" ? "Signing…" : "Sign & send redeem"}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
