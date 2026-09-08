"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { shortMint } from "@/lib/mints";
import ExplorerLink from "@/components/ExplorerLink";
import HintLabel from "@/components/HintLabel";
import { metricHints, type MetricHint } from "@/theme/copy";
import type { VaultAsset } from "@/types/vault";

/**
 * Portfolio yield view. Per pool it answers: how much has been earned, how much can be
 * taken right now (harvestable), and the yield rate so far as a percent of the deployed
 * principal. "Harvestable now" is unharvested Kamino yield you can pull into the treasury
 * with Harvest; "Harvested" already sits in the treasury.
 */
function pct(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(4)}%`;
}

function Figure({
  label,
  value,
  sub,
  accent,
  metric,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  metric?: MetricHint;
}) {
  return (
    <Stack spacing={0.15} sx={{ minWidth: 104 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }} component="div">
        {metric ? <HintLabel metric={metric} label={label} variant="inherit" /> : label}
      </Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", color: accent ? "primary.main" : "text.primary" }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function YieldEarnedSummary({ assets }: { assets: VaultAsset[] }) {
  if (!assets.length) return null;

  let totalDeployed = 0;
  let totalHarvestable = 0;
  let totalHome = 0;
  let totalHarvested = 0;
  for (const a of assets) {
    totalDeployed += a.deployedToKamino;
    totalHarvestable += a.kaminoSurplus;
    totalHome += a.homeSurplus;
    totalHarvested += a.treasuryBalance;
  }
  const d0 = assets[0].tokenDecimals;
  const totalEarned = totalHarvestable + totalHome + totalHarvested;
  const anyHarvestable = totalHarvestable > 0;

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Yield earned
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={anyHarvestable ? "primary" : "default"}
            label={anyHarvestable ? `${formatTokenAmount(totalHarvestable, d0)} harvestable now` : "nothing to harvest yet"}
          />
        </Stack>

        <Stack spacing={1.5}>
          {assets.map((a) => {
            const earned = a.kaminoSurplus + a.homeSurplus + a.treasuryBalance;
            return (
              <Box
                key={a.mint}
                sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", py: 1, borderTop: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="body2" sx={{ minWidth: 104, fontWeight: 600 }}>
                  <ExplorerLink address={a.mint} type="token">
                    {shortMint(a.mint)}
                  </ExplorerLink>
                </Typography>
                <Figure
                  metric={metricHints.inKamino}
                  label="Deployed"
                  value={formatTokenAmount(a.deployedToKamino, a.tokenDecimals)}
                />
                <Figure
                  metric={metricHints.kaminoSurplus}
                  label="Harvestable now"
                  value={formatTokenAmount(a.kaminoSurplus, a.tokenDecimals)}
                  sub={`${pct(a.kaminoSurplus, a.deployedToKamino)} of deployed`}
                  accent
                />
                <Figure
                  metric={metricHints.homeSurplus}
                  label={metricHints.homeSurplus.label}
                  value={formatTokenAmount(a.homeSurplus, a.tokenDecimals)}
                />
                <Figure
                  metric={metricHints.treasury}
                  label="Harvested"
                  value={formatTokenAmount(a.treasuryBalance, a.tokenDecimals)}
                />
                <Box sx={{ flex: 1 }} />
                <Figure label="Total earned" value={formatTokenAmount(earned, a.tokenDecimals)} accent />
              </Box>
            );
          })}

          <Box
            sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", pt: 1.5, borderTop: "2px solid", borderColor: "primary.main" }}
          >
            <Typography variant="body2" sx={{ minWidth: 104, fontWeight: 700 }}>
              All pools
            </Typography>
            <Figure
              metric={metricHints.inKamino}
              label="Deployed"
              value={formatTokenAmount(totalDeployed, d0)}
            />
            <Figure
              metric={metricHints.kaminoSurplus}
              label="Harvestable now"
              value={formatTokenAmount(totalHarvestable, d0)}
              sub={`${pct(totalHarvestable, totalDeployed)} of deployed`}
              accent
            />
            <Figure
              metric={metricHints.homeSurplus}
              label={metricHints.homeSurplus.label}
              value={formatTokenAmount(totalHome, d0)}
            />
            <Figure
              metric={metricHints.treasury}
              label="Harvested"
              value={formatTokenAmount(totalHarvested, d0)}
            />
            <Box sx={{ flex: 1 }} />
            <Figure label="Total earned" value={formatTokenAmount(totalEarned, d0)} accent />
          </Box>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Harvestable = live unharvested Kamino yield (press Harvest to move it to the treasury). Percent is
          yield so far against the deployed principal; the assets API simulates a Kamino reserve refresh so the
          figure does not wait for a deploy/recall.
        </Typography>
      </CardContent>
    </Card>
  );
}
