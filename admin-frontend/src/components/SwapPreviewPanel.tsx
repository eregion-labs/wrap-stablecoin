"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatTokenAmount } from "@/lib/tokenAmount";
import {
  currentFigures,
  projectSwapFigures,
  type ProjectedFigures,
  type SwapSide,
} from "@/lib/projectSwap";
import { adminCopy, liabilityWrappedMetric, metricHints } from "@/theme/copy";
import { colorSuccess, florentineRed, hairline, textMuted } from "@/theme/tokens";
import type { VaultAsset } from "@/types/vault";

type Props = {
  side: SwapSide;
  asset: VaultAsset;
  wrappedDecimals: number;
  wrappedSymbol: string;
  collateralSymbol: string;
  input: number;
  output: number;
  adminCollateralAtoms: number;
  adminWrappedAtoms: number;
};

type Row = {
  key: string;
  label: string;
  current: number;
  projected: number;
  decimals: number;
};

function DeltaCell({
  current,
  projected,
  decimals,
}: {
  current: number;
  projected: number;
  decimals: number;
}) {
  const changed = current !== projected;
  const up = projected > current;
  const color = !changed ? textMuted : up ? colorSuccess : florentineRed;
  return (
    <Typography
      component="span"
      variant="body2"
      sx={{ fontVariantNumeric: "tabular-nums", color, whiteSpace: "nowrap" }}
    >
      {formatTokenAmount(current, decimals)}
      {" → "}
      {formatTokenAmount(projected, decimals)}
    </Typography>
  );
}

function buildRows(
  asset: VaultAsset,
  wrappedDecimals: number,
  wrappedSymbol: string,
  collateralSymbol: string,
  current: ProjectedFigures,
  projected: ProjectedFigures,
): Row[] {
  const d = asset.tokenDecimals;
  return [
    {
      key: "homeVault",
      label: metricHints.homeVault.label,
      current: current.freeLiquidity,
      projected: projected.freeLiquidity,
      decimals: d,
    },
    {
      key: "cushion",
      label: metricHints.cushion.label,
      current: current.cushion,
      projected: projected.cushion,
      decimals: d,
    },
    {
      key: "inKamino",
      label: metricHints.inKamino.label,
      current: current.deployedToKamino,
      projected: projected.deployedToKamino,
      decimals: d,
    },
    {
      key: "backing",
      label: metricHints.backing.label,
      current: current.backing,
      projected: projected.backing,
      decimals: d,
    },
    {
      key: "treasury",
      label: metricHints.treasury.label,
      current: current.treasuryBalance,
      projected: projected.treasuryBalance,
      decimals: d,
    },
    {
      key: "kaminoSurplus",
      label: metricHints.kaminoSurplus.label,
      current: current.kaminoSurplus,
      projected: projected.kaminoSurplus,
      decimals: d,
    },
    {
      key: "liabilityWrapped",
      label: liabilityWrappedMetric(wrappedSymbol).label,
      current: current.liability,
      projected: projected.liability,
      decimals: wrappedDecimals,
    },
    {
      key: "liabilityUnderlying",
      label: metricHints.liabilityUnderlying.label,
      current: current.liabilityUnderlying,
      projected: projected.liabilityUnderlying,
      decimals: d,
    },
    {
      key: "homeSurplus",
      label: metricHints.homeSurplus.label,
      current: current.homeSurplus,
      projected: projected.homeSurplus,
      decimals: d,
    },
    {
      key: "maxRedeemable",
      label: metricHints.maxRedeemable.label,
      current: current.maxRedeemable,
      projected: projected.maxRedeemable,
      decimals: wrappedDecimals,
    },
    {
      key: "adminCollateral",
      label: adminCopy.swapPreviewAdminCollateral(collateralSymbol),
      current: current.adminCollateral,
      projected: projected.adminCollateral,
      decimals: d,
    },
    {
      key: "adminWrapped",
      label: adminCopy.swapPreviewAdminWrapped(wrappedSymbol),
      current: current.adminWrapped,
      projected: projected.adminWrapped,
      decimals: wrappedDecimals,
    },
  ];
}

export default function SwapPreviewPanel({
  side,
  asset,
  wrappedDecimals,
  wrappedSymbol,
  collateralSymbol,
  input,
  output,
  adminCollateralAtoms,
  adminWrappedAtoms,
}: Props) {
  if (!Number.isFinite(input) || input <= 0 || !Number.isFinite(output) || output < 0) {
    return null;
  }

  const current = currentFigures(asset, adminCollateralAtoms, adminWrappedAtoms);
  const projected = projectSwapFigures({
    side,
    asset,
    wrappedDecimals,
    input,
    output,
    adminCollateralAtoms,
    adminWrappedAtoms,
  });
  const rows = buildRows(
    asset,
    wrappedDecimals,
    wrappedSymbol,
    collateralSymbol,
    current,
    projected,
  );

  return (
    <Box
      sx={{
        border: `1px solid ${hairline}`,
        borderRadius: "1px",
        p: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {adminCopy.swapPreviewTitle}
      </Typography>
      <Stack spacing={0.5}>
        {rows.map((row) => (
          <Stack
            key={row.key}
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            spacing={2}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {row.label}
            </Typography>
            <DeltaCell current={row.current} projected={row.projected} decimals={row.decimals} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
