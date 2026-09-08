"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ReserveCollateralSelect } from "@florin/ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { useSnackbar } from "notistack";
import ExplorerLink from "@/components/ExplorerLink";
import { truncateAddrStandard } from "@/lib/address";
import { mintLabel } from "@/lib/mints";
import { requirePubkey } from "@/lib/pubkey";
import {
  atomsToInputAmount,
  formatTokenAmount,
  parseTokenAmount,
} from "@/lib/tokenAmount";
import {
  formatReceiveAmount,
  formatUsdApprox,
  isUsdPeggedSymbol,
  probeWithdrawDestination,
  withdrawReviewReason,
  type DestinationProbe,
} from "@/lib/treasuryWithdraw";
import { getApplicationServices } from "@/providers/ClientConfigProvider";
import { useKlendStore } from "@/stores/klendStore";
import { adminCopy } from "@/theme/copy";
import { actBlockSx, cardSx, monoSx } from "@/theme/tokens";
import type { VaultAsset } from "@/types/vault";

export type WithdrawHistoryRow = {
  signature: string;
  amount: number;
  destination: string;
  initiator: string;
  blockTime: number | null;
};

type Props = {
  assets: VaultAsset[];
  asset: VaultAsset;
  admin: string;
  onMintChange: (mint: string) => void;
  historyDestinations: string[];
  onHistoryRefresh: () => Promise<void>;
};

type ModalPhase = "review" | "submitting" | "confirmed" | "error";

let cachedConnection: Connection | null = null;
let cachedRpc: string | null = null;

function rpcConnection(): Connection {
  const rpcUrl = getApplicationServices().config.solana.rpcUrl;
  if (!cachedConnection || cachedRpc !== rpcUrl) {
    cachedRpc = rpcUrl;
    cachedConnection = new Connection(rpcUrl, "confirmed");
  }
  return cachedConnection;
}

export default function TreasuryWithdrawPanel({
  assets,
  asset,
  admin,
  onMintChange,
  historyDestinations,
  onHistoryRefresh,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const drafts = useKlendStore((s) => s.drafts);
  const setDraft = useKlendStore((s) => s.setDraft);
  const submitWithdrawTreasury = useKlendStore((s) => s.submitWithdrawTreasury);
  const busy = useKlendStore((s) => s.busy);
  const busyMint = useKlendStore((s) => s.busyMint);

  const mint = asset.mint;
  const d = asset.tokenDecimals;
  const symbol = mintLabel(mint);
  const draft = drafts[mint] ?? {
    deployAmount: "",
    recallAmount: "",
    harvestAmount: "",
    sweepAmount: "",
    treasuryAmount: "",
    destination: "",
  };

  // Default destination to vault admin when empty.
  useEffect(() => {
    if (!draft.destination.trim() && admin) {
      setDraft(mint, { destination: admin });
    }
  }, [admin, draft.destination, mint, setDraft]);

  const [probe, setProbe] = useState<DestinationProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState<ModalPhase>("review");
  const [unfamiliarOk, setUnfamiliarOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const destination = draft.destination.trim() || admin;
  const amountAtoms = parseTokenAmount(draft.treasuryAmount, d);
  const remaining =
    amountAtoms != null ? Math.max(0, asset.treasuryBalance - amountAtoms) : asset.treasuryBalance;

  useEffect(() => {
    let cancelled = false;
    const dest = draft.destination.trim();
    if (!dest || !requirePubkey(dest, "destination").ok) {
      setProbe(null);
      return;
    }
    setProbing(true);
    const t = window.setTimeout(() => {
      void probeWithdrawDestination(rpcConnection(), dest, mint)
        .then((p) => {
          if (!cancelled) setProbe(p);
        })
        .catch(() => {
          if (!cancelled) setProbe(null);
        })
        .finally(() => {
          if (!cancelled) setProbing(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [draft.destination, mint]);

  const reason = withdrawReviewReason({
    amountRaw: draft.treasuryAmount,
    decimals: d,
    treasuryBalance: asset.treasuryBalance,
    destination: draft.destination.trim() || admin,
    probe,
  });

  const destPkOk = requirePubkey(destination, "destination");
  const unfamiliar =
    destPkOk.ok &&
    destPkOk.data !== admin &&
    !historyDestinations.includes(destPkOk.data);

  const setPct = useCallback(
    (pct: number) => {
      const atoms = Math.floor((asset.treasuryBalance * pct) / 100);
      setDraft(mint, { treasuryAmount: atomsToInputAmount(atoms, d) });
    },
    [asset.treasuryBalance, d, mint, setDraft],
  );

  const openReview = () => {
    if (reason) return;
    setUnfamiliarOk(false);
    setErrorMsg(null);
    setSignature(null);
    setPhase("review");
    setModalOpen(true);
  };

  const confirm = async () => {
    if (unfamiliar && !unfamiliarOk) return;
    setPhase("submitting");
    setErrorMsg(null);
    const result = await submitWithdrawTreasury(mint);
    if (result.ok) {
      setSignature(result.data.signature);
      setPhase("confirmed");
      setDraft(mint, { treasuryAmount: "" });
      await onHistoryRefresh();
      enqueueSnackbar(`Treasury withdrawn — ${result.data.signature.slice(0, 8)}…`, {
        variant: "success",
      });
    } else {
      setErrorMsg(result.error);
      setPhase("error");
    }
  };

  const usdLine = useMemo(() => {
    if (!isUsdPeggedSymbol(symbol)) return null;
    return `≈ ${formatUsdApprox(asset.treasuryBalance, d)}`;
  }, [asset.treasuryBalance, d, symbol]);

  const rowBusy = busyMint === mint && busy === "withdrawTreasury";
  let destLabel = destination;
  try {
    destLabel = truncateAddrStandard(new PublicKey(destination).toBase58());
  } catch {
    /* keep raw */
  }

  return (
    <Box sx={{ ...cardSx, ...actBlockSx }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <ReserveCollateralSelect
            label={adminCopy.reserveCollateral}
            value={mint}
            onChange={onMintChange}
            options={assets.map((a) => ({ value: a.mint, label: mintLabel(a.mint) }))}
          />
        </Box>
        {asset.klendEnabled ? (
          <Chip label="Kamino" size="small" variant="outlined" />
        ) : (
          <Chip label="vault only" size="small" />
        )}
      </Stack>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {adminCopy.klendAvailableTreasury}
      </Typography>
      <Typography variant="h6" sx={{ fontVariantNumeric: "tabular-nums", mb: 0.5 }}>
        {formatTokenAmount(asset.treasuryBalance, d)} {symbol}
      </Typography>
      {usdLine ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {usdLine}
        </Typography>
      ) : (
        <Box sx={{ mb: 2 }} />
      )}

      <TextField
        size="small"
        label={adminCopy.klendTreasuryAmount}
        value={draft.treasuryAmount}
        onChange={(e) => setDraft(mint, { treasuryAmount: e.target.value })}
        disabled={rowBusy}
        fullWidth
        sx={{ mb: 1 }}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {[25, 50, 75].map((p) => (
          <Chip
            key={p}
            size="small"
            label={`${p}%`}
            onClick={() => setPct(p)}
            disabled={rowBusy || asset.treasuryBalance <= 0}
            variant="outlined"
          />
        ))}
        <Chip
          size="small"
          label="Max"
          onClick={() => setPct(100)}
          disabled={rowBusy || asset.treasuryBalance <= 0}
          color="primary"
          variant="outlined"
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        {adminCopy.klendTreasuryMaxRentCaption}
      </Typography>

      <TextField
        size="small"
        label={adminCopy.klendDestination}
        value={draft.destination}
        onChange={(e) => setDraft(mint, { destination: e.target.value })}
        disabled={rowBusy}
        fullWidth
        sx={{ mb: 0.5 }}
      />
      {destPkOk.ok ? (
        <Typography variant="caption" color="text.secondary" sx={{ ...monoSx, display: "block", mb: 2 }}>
          <ExplorerLink address={destPkOk.data}>{destLabel}</ExplorerLink>
          {probing ? " · checking…" : null}
        </Typography>
      ) : (
        <Box sx={{ mb: 2 }} />
      )}

      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {adminCopy.klendYouWillReceive}
        </Typography>
        <Tooltip
          title={
            amountAtoms != null
              ? `${amountAtoms} atoms`
              : "Enter a valid amount"
          }
        >
          <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {amountAtoms != null
              ? `${formatReceiveAmount(amountAtoms, d, symbol)} ${symbol}`
              : "—"}
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {adminCopy.klendRemainingTreasury}
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {formatTokenAmount(remaining, d)} {symbol}
        </Typography>
      </Stack>

      <Button
        variant="contained"
        fullWidth
        disabled={reason != null || rowBusy}
        onClick={openReview}
      >
        {reason ?? adminCopy.klendReviewWithdrawal}
      </Button>

      <Dialog open={modalOpen} onClose={() => phase !== "submitting" && setModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          {phase === "confirmed"
            ? adminCopy.klendConfirmed
            : `Withdraw ${
                amountAtoms != null ? formatReceiveAmount(amountAtoms, d, symbol) : "—"
              } ${symbol}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2">From: Treasury</Typography>
            <Typography variant="body2" sx={monoSx}>
              To:{" "}
              {destPkOk.ok ? (
                <ExplorerLink address={destPkOk.data}>{destLabel}</ExplorerLink>
              ) : (
                destination
              )}
            </Typography>
            <Typography variant="body2">
              Remaining: {formatTokenAmount(remaining, d)} {symbol}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {adminCopy.klendNetworkFee}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {adminCopy.klendIrreversible}
            </Typography>
            {unfamiliar && phase === "review" ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={unfamiliarOk}
                    onChange={(e) => setUnfamiliarOk(e.target.checked)}
                  />
                }
                label={adminCopy.klendUnfamiliarConfirm}
              />
            ) : null}
            {phase === "submitting" ? (
              <Typography variant="body2">{adminCopy.klendSubmitting}</Typography>
            ) : null}
            {phase === "confirmed" && signature ? (
              <Typography variant="body2">
                Tx: <ExplorerLink address={signature} type="tx" />
              </Typography>
            ) : null}
            {phase === "error" && errorMsg ? (
              <Typography variant="body2" color="error">
                {errorMsg}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          {phase === "confirmed" ? (
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          ) : (
            <>
              <Button onClick={() => setModalOpen(false)} disabled={phase === "submitting"}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => void confirm()}
                disabled={
                  phase === "submitting" || (unfamiliar && !unfamiliarOk && phase === "review")
                }
              >
                {phase === "error" ? "Retry" : adminCopy.klendConfirmWithdrawal}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
