"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ReserveCollateralSelect } from "@florin/ui";
import { useSnackbar } from "notistack";
import AmountActionRow from "@/components/AmountActionRow";
import HintLabel from "@/components/HintLabel";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { actBlockSx, cardSx } from "@/theme/tokens";
import { adminCopy, metricHints, type MetricHint } from "@/theme/copy";
import type { VaultAsset } from "@/types/vault";
import { useKlendStore } from "@/stores/klendStore";
import type { ActionResult } from "@/stores/types";

type Props = {
  assets: VaultAsset[];
  paused: boolean;
};

function Stat({
  label,
  value,
  metric,
}: {
  label: string;
  value: string;
  metric?: MetricHint;
}) {
  return (
    <Box>
      {metric ? (
        <Typography variant="caption" color="text.secondary" display="block" component="div">
          <HintLabel metric={metric} label={label} variant="inherit" />
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
      )}
      <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function KlendOpsTable({ assets, paused }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedMint, setSelectedMint] = useState("");
  const drafts = useKlendStore((s) => s.drafts);
  const busy = useKlendStore((s) => s.busy);
  const busyMint = useKlendStore((s) => s.busyMint);
  const setDraft = useKlendStore((s) => s.setDraft);
  const submitDeploy = useKlendStore((s) => s.submitDeploy);
  const submitRecall = useKlendStore((s) => s.submitRecall);
  const submitHarvest = useKlendStore((s) => s.submitHarvest);
  const submitSweep = useKlendStore((s) => s.submitSweep);

  const notify = (result: ActionResult<{ signature: string }>, okLabel: string) => {
    if (result.ok) {
      enqueueSnackbar(`${okLabel} — ${result.data.signature.slice(0, 8)}…`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };

  if (assets.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {adminCopy.klendNoAssets}
      </Typography>
    );
  }

  const asset = assets.find((a) => a.mint === selectedMint) ?? assets[0];
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
  const rowBusy = busyMint === mint;
  const klendOff = !asset.klendEnabled;
  const locked = rowBusy;
  const deployLocked = paused || locked;
  const deployable = Math.max(0, asset.freeLiquidity - asset.cushion);
  const maxRecallable = Math.min(
    asset.deployedToKamino + asset.kaminoSurplus,
    asset.kaminoAvailableLiquidity ?? 0,
  );
  const maxHarvestable = Math.min(
    asset.kaminoSurplus,
    asset.kaminoAvailableLiquidity ?? 0,
  );
  const kaminoAvailable = asset.kaminoAvailableLiquidity ?? 0;

  return (
    <Box sx={{ ...cardSx, ...actBlockSx }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <ReserveCollateralSelect
            label={adminCopy.reserveCollateral}
            value={mint}
            onChange={setSelectedMint}
            options={assets.map((a) => ({ value: a.mint, label: mintLabel(a.mint) }))}
          />
        </Box>
        {asset.klendEnabled ? (
          <Chip label="Kamino" size="small" variant="outlined" />
        ) : (
          <Chip label="vault only" size="small" />
        )}
      </Stack>

      <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mb: 2, rowGap: 1 }}>
        <Stat
          metric={metricHints.homeVault}
          label={metricHints.homeVault.label}
          value={formatTokenAmount(asset.freeLiquidity, d)}
        />
        <Stat
          metric={metricHints.inKamino}
          label={adminCopy.klendPrincipalInKamino}
          value={formatTokenAmount(asset.deployedToKamino, d)}
        />
        <Stat
          label={adminCopy.klendKaminoAvailable}
          value={formatTokenAmount(kaminoAvailable, d)}
        />
        <Stat
          metric={metricHints.cushion}
          label={metricHints.cushion.label}
          value={formatTokenAmount(asset.cushion, d)}
        />
        <Stat
          metric={metricHints.backing}
          label={metricHints.backing.label}
          value={formatTokenAmount(asset.backing, d)}
        />
      </Stack>

      {klendOff && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {adminCopy.klendNotEnabled}
        </Typography>
      )}

      <Stack spacing={1.5}>
        <AmountActionRow
          label={adminCopy.klendDeployAmount}
          value={draft.deployAmount}
          onChange={(v) => setDraft(mint, { deployAmount: v })}
          availableAtoms={deployable}
          decimals={d}
          availableLabel={adminCopy.klendAvailableDeploy}
          symbol={symbol}
          disabled={deployLocked || klendOff}
          executeLabel={adminCopy.klendDeploy}
          executeBusy={rowBusy && busy === "deploy"}
          onExecute={async () => notify(await submitDeploy(mint), "Deployed")}
        />

        <AmountActionRow
          label={adminCopy.klendRecallAmount}
          value={draft.recallAmount}
          onChange={(v) => setDraft(mint, { recallAmount: v })}
          availableAtoms={maxRecallable}
          decimals={d}
          availableLabel={adminCopy.klendAvailableRecall}
          symbol={symbol}
          disabled={locked || klendOff}
          executeLabel={adminCopy.klendRecall}
          executeBusy={rowBusy && busy === "recall"}
          executeColor="secondary"
          onExecute={async () => notify(await submitRecall(mint), "Recalled")}
        />

        <AmountActionRow
          label={adminCopy.klendHarvestAmount}
          value={draft.harvestAmount}
          onChange={(v) => setDraft(mint, { harvestAmount: v })}
          availableAtoms={maxHarvestable}
          decimals={d}
          availableLabel={adminCopy.klendAvailableHarvest}
          symbol={symbol}
          helperExtra={adminCopy.klendHarvestHint}
          disabled={deployLocked || klendOff}
          executeLabel={adminCopy.klendHarvest}
          executeBusy={rowBusy && busy === "harvest"}
          executeVariant="outlined"
          onExecute={async () => notify(await submitHarvest(mint), "Harvested")}
        />

        <AmountActionRow
          label={adminCopy.klendSweepAmount}
          value={draft.sweepAmount}
          onChange={(v) => setDraft(mint, { sweepAmount: v })}
          availableAtoms={asset.homeSurplus}
          decimals={d}
          availableMetric={metricHints.homeSurplus}
          symbol={symbol}
          disabled={locked}
          executeLabel={adminCopy.klendSweep}
          executeBusy={rowBusy && busy === "sweep"}
          executeVariant="outlined"
          executeDisabled={asset.homeSurplus <= 0}
          onExecute={async () => notify(await submitSweep(mint), "Swept surplus")}
        />
      </Stack>
    </Box>
  );
}
