"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import ExplorerLink from "@/components/ExplorerLink";
import { mintLabel, shortMint } from "@/lib/mints";
import { requirePubkey } from "@/lib/pubkey";
import { useGovernanceStore } from "@/stores/governanceStore";
import {
  matchToEnableDraft,
  useKlendLookupStore,
  type KlendReserveMatch,
} from "@/stores/klendLookupStore";
import { usePolicyStore } from "@/stores/policyStore";
import { adminCopy } from "@/theme/copy";

const LOOKUP_DEBOUNCE_MS = 400;

function KaminoFoundBody({
  reserves,
  selected,
  onSelect,
}: {
  reserves: KlendReserveMatch[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const match = reserves[selected] ?? reserves[0];
  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        {reserves.length === 1
          ? adminCopy.klendLookupFound
          : adminCopy.klendLookupFoundMany(reserves.length)}
      </Typography>
      {reserves.length > 1 && (
        <TextField
          select
          size="small"
          label={adminCopy.lendingMarket}
          value={String(selected)}
          onChange={(e) => onSelect(Number(e.target.value))}
          sx={{ maxWidth: 480 }}
        >
          {reserves.map((r, i) => (
            <MenuItem key={r.reserve} value={String(i)}>
              {shortMint(r.lendingMarket)} · {shortMint(r.reserve)}
            </MenuItem>
          ))}
        </TextField>
      )}
      {match && (
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
          {adminCopy.lendingMarket}:{" "}
          <ExplorerLink address={match.lendingMarket}>{shortMint(match.lendingMarket)}</ExplorerLink>
          {" · "}
          {adminCopy.klendReserve}:{" "}
          <ExplorerLink address={match.reserve}>{shortMint(match.reserve)}</ExplorerLink>
        </Typography>
      )}
    </Stack>
  );
}

export default function AddCollateralPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const busyMint = usePolicyStore((s) => s.busyMint);
  const registerAsset = usePolicyStore((s) => s.registerAsset);
  const setEnableKlendDraft = useGovernanceStore((s) => s.setEnableKlendDraft);
  const ensureLookup = useKlendLookupStore((s) => s.ensureLookup);
  const lookups = useKlendLookupStore((s) => s.lookups);

  const [newMint, setNewMint] = useState("");
  const [newMintEnabled, setNewMintEnabled] = useState(true);
  const [newRedeemEnabled, setNewRedeemEnabled] = useState(true);
  const [selectedReserve, setSelectedReserve] = useState(0);

  const parsed = useMemo(() => {
    const trimmed = newMint.trim();
    if (!trimmed) return null;
    return requirePubkey(trimmed, "asset mint");
  }, [newMint]);

  const lookupMint = parsed?.ok ? parsed.data : null;
  const lookup = lookupMint ? lookups[lookupMint] : undefined;
  const pasteBusy = busyMint != null && lookupMint != null && busyMint === lookupMint;

  useEffect(() => {
    if (!lookupMint) return;
    const handle = window.setTimeout(() => ensureLookup(lookupMint), LOOKUP_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [lookupMint, ensureLookup]);

  useEffect(() => {
    setSelectedReserve(0);
  }, [lookupMint]);

  const chosenMatch =
    lookup?.status === "ready" ? (lookup.data.reserves[selectedReserve] ?? lookup.data.reserves[0]) : undefined;

  const lookupPending = lookupMint != null && (lookup == null || lookup.status === "loading");
  const mintMissing = lookup?.status === "ready" && !lookup.data.mintExists;
  const registerDisabled =
    busyMint != null ||
    !newMint.trim() ||
    parsed == null ||
    !parsed.ok ||
    lookupPending ||
    mintMissing;

  const onRegisterPasted = async () => {
    const result = await registerAsset(newMint, {
      mintEnabled: newMintEnabled,
      redeemEnabled: newRedeemEnabled,
    });
    if (result.ok) {
      const mint = lookupMint ?? newMint.trim();
      if (chosenMatch) {
        setEnableKlendDraft(mint, matchToEnableDraft(chosenMatch));
      }
      enqueueSnackbar(
        `Registered ${mintLabel(mint)} (${result.data.signature.slice(0, 8)}…)`,
        { variant: "success" },
      );
      setNewMint("");
      setNewMintEnabled(true);
      setNewRedeemEnabled(true);
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" fontWeight={600}>
          {adminCopy.addCollateral}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {adminCopy.addCollateralHint}
        </Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          flexWrap="wrap"
        >
          <TextField
            size="small"
            label={adminCopy.assetMintPubkey}
            value={newMint}
            onChange={(e) => setNewMint(e.target.value)}
            disabled={busyMint != null}
            error={parsed != null && !parsed.ok}
            helperText={parsed != null && !parsed.ok ? parsed.error : undefined}
            fullWidth
            sx={{ flex: 1, minWidth: 240 }}
            inputProps={{
              style: { fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' },
            }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newMintEnabled}
                onChange={(e) => setNewMintEnabled(e.target.checked)}
                disabled={busyMint != null}
              />
            }
            label={adminCopy.mintEnabledLabel}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newRedeemEnabled}
                onChange={(e) => setNewRedeemEnabled(e.target.checked)}
                disabled={busyMint != null}
              />
            }
            label={adminCopy.redeemEnabledLabel}
          />
          <Button
            size="small"
            variant="contained"
            color="secondary"
            disabled={registerDisabled}
            onClick={() => void onRegisterPasted()}
          >
            {pasteBusy || lookupPending ? "…" : adminCopy.registerMint}
          </Button>
        </Stack>
        {lookupPending && (
          <Alert severity="info">{adminCopy.klendLookupChecking}</Alert>
        )}
        {lookup?.status === "error" && (
          <Alert severity="warning">
            {adminCopy.klendLookupError}: {lookup.error}
          </Alert>
        )}
        {lookup?.status === "ready" && !lookup.data.mintExists && (
          <Alert severity="error">{adminCopy.klendLookupMintMissing}</Alert>
        )}
        {lookup?.status === "ready" && lookup.data.mintExists && lookup.data.reserves.length === 0 && (
          <Alert severity="warning">{adminCopy.klendLookupNone}</Alert>
        )}
        {lookup?.status === "ready" && lookup.data.reserves.length > 0 && (
          <Alert severity="success">
            <KaminoFoundBody
              reserves={lookup.data.reserves}
              selected={selectedReserve}
              onSelect={setSelectedReserve}
            />
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
