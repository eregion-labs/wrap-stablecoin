"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useEffect } from "react";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { useGovernanceStore } from "@/stores/governanceStore";
import {
  matchToEnableDraft,
  useKlendLookupStore,
} from "@/stores/klendLookupStore";
import { adminCopy } from "@/theme/copy";

const LOCALNET_KLEND_PLACEHOLDERS = {
  lendingMarket: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
  reserve: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
  reserveLiquiditySupply: "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
  collateralMint: "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
};

type Props = {
  mint: string;
  enableBusy: boolean;
  onEnable: () => void;
};

export default function EnableKlendExpander({ mint, enableBusy, onEnable }: Props) {
  const config = useClientConfig();
  const localnet = config.solana.network === "localnet";
  const enableDraft = useGovernanceStore((s) => s.enableKlendDrafts[mint]);
  const setEnableKlendDraft = useGovernanceStore((s) => s.setEnableKlendDraft);
  const prefillEnableKlendIfEmpty = useGovernanceStore((s) => s.prefillEnableKlendIfEmpty);
  const ensureLookup = useKlendLookupStore((s) => s.ensureLookup);
  const lookup = useKlendLookupStore((s) => s.lookups[mint]);

  const draft = enableDraft ?? {
    lendingMarket: "",
    reserve: "",
    reserveLiquiditySupply: "",
    collateralMint: "",
  };
  const placeholders = localnet ? LOCALNET_KLEND_PLACEHOLDERS : undefined;

  useEffect(() => {
    ensureLookup(mint);
  }, [mint, ensureLookup]);

  useEffect(() => {
    if (lookup?.status !== "ready" || lookup.data.reserves.length === 0) return;
    prefillEnableKlendIfEmpty(mint, matchToEnableDraft(lookup.data.reserves[0]));
  }, [mint, lookup, prefillEnableKlendIfEmpty]);

  const lookupNone = lookup?.status === "ready" && lookup.data.mintExists && lookup.data.reserves.length === 0;
  const lookupLoading = lookup?.status === "loading";

  return (
    <TableRow>
      <TableCell colSpan={10} sx={{ bgcolor: "action.hover" }}>
        <Stack spacing={1} sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {adminCopy.enableKlend}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {adminCopy.enableKlendHint}
          </Typography>
          {lookupLoading && (
            <Alert severity="info">{adminCopy.klendLookupChecking}</Alert>
          )}
          {lookup?.status === "error" && (
            <Alert severity="warning">
              {adminCopy.klendLookupError}: {lookup.error}
            </Alert>
          )}
          {lookupNone && <Alert severity="warning">{adminCopy.klendLookupNone}</Alert>}
          {lookup?.status === "ready" && lookup.data.reserves.length > 0 && (
            <Alert severity="success">{adminCopy.klendLookupFound}</Alert>
          )}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
            <TextField
              size="small"
              label={adminCopy.lendingMarket}
              placeholder={placeholders?.lendingMarket}
              value={draft.lendingMarket}
              onChange={(e) => setEnableKlendDraft(mint, { lendingMarket: e.target.value })}
              disabled={enableBusy}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <TextField
              size="small"
              label={adminCopy.klendReserve}
              placeholder={placeholders?.reserve}
              value={draft.reserve}
              onChange={(e) => setEnableKlendDraft(mint, { reserve: e.target.value })}
              disabled={enableBusy}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <TextField
              size="small"
              label={adminCopy.reserveLiquiditySupply}
              placeholder={placeholders?.reserveLiquiditySupply}
              value={draft.reserveLiquiditySupply}
              onChange={(e) =>
                setEnableKlendDraft(mint, { reserveLiquiditySupply: e.target.value })
              }
              disabled={enableBusy}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <TextField
              size="small"
              label={adminCopy.collateralMint}
              placeholder={placeholders?.collateralMint}
              value={draft.collateralMint}
              onChange={(e) => setEnableKlendDraft(mint, { collateralMint: e.target.value })}
              disabled={enableBusy}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <Button
              size="small"
              variant="contained"
              disabled={enableBusy}
              onClick={onEnable}
            >
              {enableBusy ? "…" : adminCopy.enableKlend}
            </Button>
          </Stack>
        </Stack>
      </TableCell>
    </TableRow>
  );
}
