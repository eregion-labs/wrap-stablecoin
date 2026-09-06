"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import AmountActionRow from "@/components/AmountActionRow";
import ExplorerLink from "@/components/ExplorerLink";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { actBlockSx, cardSx } from "@/theme/tokens";
import { adminCopy, metricHints, type MetricHint } from "@/theme/copy";
import HintLabel from "@/components/HintLabel";
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
  const drafts = useKlendStore((s) => s.drafts);
  const busy = useKlendStore((s) => s.busy);
  const busyMint = useKlendStore((s) => s.busyMint);
  const setDraft = useKlendStore((s) => s.setDraft);
  const submitDeploy = useKlendStore((s) => s.submitDeploy);
  const submitRecall = useKlendStore((s) => s.submitRecall);
  const submitRecallAll = useKlendStore((s) => s.submitRecallAll);
  const submitHarvest = useKlendStore((s) => s.submitHarvest);
  const submitSweep = useKlendStore((s) => s.submitSweep);
  const submitWithdrawTreasury = useKlendStore((s) => s.submitWithdrawTreasury);

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

  return (
    <Stack spacing={3}>
      {assets.map((asset) => {
        const d = asset.tokenDecimals;
        const symbol = mintLabel(asset.mint);
        const draft = drafts[asset.mint] ?? {
          deployAmount: "",
          recallAmount: "",
          harvestAmount: "",
          sweepAmount: "",
          treasuryAmount: "",
          destination: "",
        };
        const rowBusy = busyMint === asset.mint;
        const klendOff = !asset.klendEnabled;
        const locked = rowBusy;
        const deployLocked = paused || locked;
        const deployable = Math.max(0, asset.freeLiquidity - asset.cushion);
        const collateralKtokens = asset.collateralKtokens ?? 0;
        const maxRecallable = asset.maxRecallableKtokens ?? 0;
        const maxHarvestable = asset.maxHarvestableKtokens ?? 0;
        const kaminoAvailable = asset.kaminoAvailableLiquidity ?? 0;

        return (
          <Box key={asset.mint} sx={{ ...cardSx, ...actBlockSx }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
              <Typography variant="subtitle1">
                <ExplorerLink address={asset.mint} type="token">
                  {symbol}
                </ExplorerLink>
              </Typography>
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
                label={adminCopy.klendKtokensHeld}
                value={formatTokenAmount(collateralKtokens, d)}
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
              <Stat label="Deployable" value={formatTokenAmount(deployable, d)} />
              <Stat
                metric={metricHints.backing}
                label={metricHints.backing.label}
                value={formatTokenAmount(asset.backing, d)}
              />
              <Stat
                metric={metricHints.kaminoSurplus}
                label={adminCopy.klendHarvestable}
                value={formatTokenAmount(asset.kaminoSurplus, d)}
              />
              <Stat
                metric={metricHints.homeSurplus}
                label={metricHints.homeSurplus.label}
                value={formatTokenAmount(asset.homeSurplus, d)}
              />
              <Stat
                metric={metricHints.treasury}
                label={metricHints.treasury.label}
                value={formatTokenAmount(asset.treasuryBalance, d)}
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
                onChange={(v) => setDraft(asset.mint, { deployAmount: v })}
                availableAtoms={deployable}
                decimals={d}
                availableLabel={adminCopy.klendAvailableDeploy}
                symbol={symbol}
                fullWidth
                disabled={deployLocked || klendOff}
                executeLabel={adminCopy.klendDeploy}
                executeBusy={rowBusy && busy === "deploy"}
                onExecute={async () => notify(await submitDeploy(asset.mint), "Deployed")}
              />

              <AmountActionRow
                label={adminCopy.klendRecallAmount}
                value={draft.recallAmount}
                onChange={(v) => setDraft(asset.mint, { recallAmount: v })}
                availableAtoms={maxRecallable}
                decimals={d}
                availableLabel={adminCopy.klendAvailableRecall}
                symbol={adminCopy.klendKtokenUnit}
                fullWidth
                disabled={locked || klendOff}
                executeLabel={adminCopy.klendRecall}
                executeBusy={rowBusy && busy === "recall"}
                executeColor="secondary"
                onExecute={async () => notify(await submitRecall(asset.mint), "Recalled")}
                secondaryExecuteLabel={adminCopy.klendRecallAll}
                secondaryExecuteBusy={rowBusy && busy === "recallAll"}
                secondaryExecuteDisabled={collateralKtokens <= 0}
                onSecondaryExecute={async () =>
                  notify(await submitRecallAll(asset.mint), "Recalled all")
                }
              />

              <AmountActionRow
                label={adminCopy.klendHarvestAmount}
                value={draft.harvestAmount}
                onChange={(v) => setDraft(asset.mint, { harvestAmount: v })}
                availableAtoms={maxHarvestable}
                decimals={d}
                availableLabel={adminCopy.klendAvailableHarvest}
                symbol={adminCopy.klendKtokenUnit}
                helperExtra={adminCopy.klendHarvestHint}
                fullWidth
                disabled={deployLocked || klendOff}
                executeLabel={adminCopy.klendHarvest}
                executeBusy={rowBusy && busy === "harvest"}
                executeVariant="outlined"
                onExecute={async () => notify(await submitHarvest(asset.mint), "Harvested")}
              />

              <AmountActionRow
                label={adminCopy.klendSweepAmount}
                value={draft.sweepAmount}
                onChange={(v) => setDraft(asset.mint, { sweepAmount: v })}
                availableAtoms={asset.homeSurplus}
                decimals={d}
                availableMetric={metricHints.homeSurplus}
                symbol={symbol}
                fullWidth
                disabled={locked}
                executeLabel={adminCopy.klendSweep}
                executeBusy={rowBusy && busy === "sweep"}
                executeVariant="outlined"
                executeDisabled={asset.homeSurplus <= 0}
                onExecute={async () => notify(await submitSweep(asset.mint), "Swept surplus")}
              />

              <AmountActionRow
                label={adminCopy.klendTreasuryAmount}
                value={draft.treasuryAmount}
                onChange={(v) => setDraft(asset.mint, { treasuryAmount: v })}
                availableAtoms={asset.treasuryBalance}
                decimals={d}
                availableMetric={metricHints.treasury}
                symbol={symbol}
                fullWidth
                disabled={locked}
                executeLabel={adminCopy.klendWithdrawTreasury}
                executeBusy={rowBusy && busy === "withdrawTreasury"}
                executeVariant="outlined"
                executeDisabled={asset.treasuryBalance <= 0}
                minWidth={160}
                onExecute={async () =>
                  notify(await submitWithdrawTreasury(asset.mint), "Treasury withdrawn")
                }
                extraField={
                  <TextField
                    size="small"
                    label={adminCopy.klendDestination}
                    value={draft.destination}
                    onChange={(e) => setDraft(asset.mint, { destination: e.target.value })}
                    disabled={locked}
                    sx={{ minWidth: 280, flex: 1 }}
                  />
                }
              />
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
