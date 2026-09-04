"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { mintLabel } from "@/lib/mints";
import { atomsToInputAmount, formatTokenAmount } from "@/lib/tokenAmount";
import { cardSx } from "@/theme/tokens";
import { adminCopy } from "@/theme/copy";
import ExplorerLink from "@/components/ExplorerLink";
import type { VaultAsset } from "@/types/vault";
import { useKlendStore } from "@/stores/klendStore";
import type { ActionResult } from "@/stores/types";

type Props = {
  assets: VaultAsset[];
  paused: boolean;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
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
  const submitDeployAll = useKlendStore((s) => s.submitDeployAll);
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
        const draft = drafts[asset.mint] ?? {
          deployAmount: "",
          recallAmount: "",
          harvestAmount: "",
          sweepAmount: asset.homeSurplus > 0 ? atomsToInputAmount(asset.homeSurplus, d) : "",
          treasuryAmount: "",
          destination: "",
        };
        const rowBusy = busyMint === asset.mint;
        const klendOff = !asset.klendEnabled;
        const locked = rowBusy;
        const deployLocked = paused || locked;
        const deployable = Math.max(0, asset.freeLiquidity - asset.cushion);

        return (
          <Box key={asset.mint} sx={cardSx}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
              <Typography variant="subtitle1">
                <ExplorerLink address={asset.mint} type="token">
                  {mintLabel(asset.mint)}
                </ExplorerLink>
              </Typography>
              {asset.klendEnabled ? (
                <Chip label="Kamino" size="small" variant="outlined" />
              ) : (
                <Chip label="vault only" size="small" />
              )}
            </Stack>

            <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mb: 2, rowGap: 1 }}>
              <Stat label="Home vault" value={formatTokenAmount(asset.freeLiquidity, d)} />
              <Stat label="In Kamino" value={formatTokenAmount(asset.deployedToKamino, d)} />
              <Stat label="Cushion" value={formatTokenAmount(asset.cushion, d)} />
              <Stat label="Deployable" value={formatTokenAmount(deployable, d)} />
              <Stat label="Backing" value={formatTokenAmount(asset.backing, d)} />
              <Stat label="Home surplus" value={formatTokenAmount(asset.homeSurplus, d)} />
              <Stat label="Treasury" value={formatTokenAmount(asset.treasuryBalance, d)} />
            </Stack>

            {klendOff && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {adminCopy.klendNotEnabled}
              </Typography>
            )}

            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <TextField
                  size="small"
                  label={adminCopy.klendDeployAmount}
                  value={draft.deployAmount}
                  onChange={(e) => setDraft(asset.mint, { deployAmount: e.target.value })}
                  disabled={deployLocked || klendOff}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  disabled={deployLocked || klendOff}
                  onClick={async () => notify(await submitDeploy(asset.mint), "Deployed")}
                >
                  {rowBusy && busy === "deploy" ? adminCopy.submitting : adminCopy.klendDeploy}
                </Button>
                <Button
                  variant="outlined"
                  disabled={deployLocked || klendOff}
                  onClick={async () => notify(await submitDeployAll(asset.mint), "Deployed all")}
                >
                  {rowBusy && busy === "deployAll" ? adminCopy.submitting : adminCopy.klendDeployAll}
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <TextField
                  size="small"
                  label={adminCopy.klendRecallAmount}
                  value={draft.recallAmount}
                  onChange={(e) => setDraft(asset.mint, { recallAmount: e.target.value })}
                  disabled={locked || klendOff}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  color="secondary"
                  disabled={locked || klendOff}
                  onClick={async () => notify(await submitRecall(asset.mint), "Recalled")}
                >
                  {rowBusy && busy === "recall" ? adminCopy.submitting : adminCopy.klendRecall}
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  disabled={locked || klendOff}
                  onClick={async () => notify(await submitRecallAll(asset.mint), "Recalled all")}
                >
                  {rowBusy && busy === "recallAll" ? adminCopy.submitting : adminCopy.klendRecallAll}
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <TextField
                  size="small"
                  label={adminCopy.klendHarvestAmount}
                  value={draft.harvestAmount}
                  onChange={(e) => setDraft(asset.mint, { harvestAmount: e.target.value })}
                  disabled={deployLocked || klendOff}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="outlined"
                  disabled={deployLocked || klendOff}
                  onClick={async () => notify(await submitHarvest(asset.mint), "Harvested")}
                >
                  {rowBusy && busy === "harvest" ? adminCopy.submitting : adminCopy.klendHarvest}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>
                  {adminCopy.klendHarvestHint}
                </Typography>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <TextField
                  size="small"
                  label={adminCopy.klendSweepAmount}
                  value={draft.sweepAmount}
                  onChange={(e) => setDraft(asset.mint, { sweepAmount: e.target.value })}
                  disabled={locked}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="outlined"
                  disabled={locked || asset.homeSurplus <= 0}
                  onClick={async () => notify(await submitSweep(asset.mint), "Swept surplus")}
                >
                  {rowBusy && busy === "sweep" ? adminCopy.submitting : adminCopy.klendSweep}
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <TextField
                  size="small"
                  label={adminCopy.klendTreasuryAmount}
                  value={draft.treasuryAmount}
                  onChange={(e) => setDraft(asset.mint, { treasuryAmount: e.target.value })}
                  disabled={locked}
                  sx={{ minWidth: 160 }}
                />
                <TextField
                  size="small"
                  label={adminCopy.klendDestination}
                  value={draft.destination}
                  onChange={(e) => setDraft(asset.mint, { destination: e.target.value })}
                  disabled={locked}
                  sx={{ minWidth: 280, flex: 1 }}
                />
                <Button
                  variant="outlined"
                  disabled={locked || asset.treasuryBalance <= 0}
                  onClick={async () =>
                    notify(await submitWithdrawTreasury(asset.mint), "Treasury withdrawn")
                  }
                >
                  {rowBusy && busy === "withdrawTreasury"
                    ? adminCopy.submitting
                    : adminCopy.klendWithdrawTreasury}
                </Button>
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
