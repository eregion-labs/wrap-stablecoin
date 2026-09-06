"use client";

import Box from "@mui/material/Box";
import { cardSx, monoSx } from "@/theme/tokens";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { mintLabel, shortMint } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { BRANDING } from "@/branding";
import { adminCopy, mintedByReserveMetric, metricHints } from "@/theme/copy";
import ExplorerLink from "@/components/ExplorerLink";
import HintLabel from "@/components/HintLabel";
import type { VaultAsset } from "@/types/vault";

type Props = {
  assets: VaultAsset[];
  wrappedDecimals: number;
  wrappedSymbol?: string;
};

const denseCellSx = {
  px: 0.6,
  py: 0.35,
  fontSize: "0.75rem",
  lineHeight: 1.25,
  whiteSpace: "nowrap" as const,
};

function AmountCell({ amount, decimals }: { amount: number; decimals: number }) {
  return (
    <TableCell align="right" sx={denseCellSx}>
      {formatTokenAmount(amount, decimals)}
    </TableCell>
  );
}

/** Cap atoms: 0 = unlimited. Caps are in wrapped-token units. */
function CapCell({ amount, decimals }: { amount: number; decimals: number }) {
  return (
    <TableCell align="right" sx={denseCellSx}>
      {amount === 0 ? "∞" : formatTokenAmount(amount, decimals)}
    </TableCell>
  );
}

function OnOffCell({ on }: { on: boolean }) {
  return (
    <TableCell
      align="center"
      sx={{
        ...denseCellSx,
        color: on ? "success.main" : "text.secondary",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontSize: "0.65rem",
      }}
    >
      {on ? "on" : "off"}
    </TableCell>
  );
}

function KaminoMarketCell({ asset }: { asset: VaultAsset }) {
  if (!asset.klendEnabled) {
    return (
      <TableCell sx={{ ...denseCellSx, color: "text.secondary" }}>—</TableCell>
    );
  }
  const market = asset.lendingMarket;
  return (
    <TableCell sx={denseCellSx}>
      <Stack direction="row" spacing={0.5} alignItems="baseline">
        <Typography component="span" sx={{ fontSize: "inherit", fontWeight: 600 }}>
          {adminCopy.kaminoMarketLive}
        </Typography>
        {market ? (
          <Typography component="span" color="text.secondary" sx={{ ...monoSx, fontSize: "0.65rem" }}>
            <ExplorerLink address={market}>{shortMint(market)}</ExplorerLink>
          </Typography>
        ) : null}
      </Stack>
    </TableCell>
  );
}

function AssetRow({
  asset,
  wrappedDecimals,
}: {
  asset: VaultAsset;
  wrappedDecimals: number;
}) {
  const d = asset.tokenDecimals;
  return (
    <TableRow>
      <TableCell sx={denseCellSx}>
        <ExplorerLink address={asset.mint} type="token">
          {mintLabel(asset.mint)}
        </ExplorerLink>
      </TableCell>
      <TableCell align="right" sx={{ ...denseCellSx, fontWeight: 600 }}>
        {formatTokenAmount(asset.liability, wrappedDecimals)}
      </TableCell>
      <KaminoMarketCell asset={asset} />
      <OnOffCell on={asset.mintEnabled} />
      <OnOffCell on={asset.redeemEnabled} />
      <TableCell sx={denseCellSx}>{asset.assetStatus}</TableCell>
      <TableCell align="right" sx={denseCellSx}>
        {asset.mintHaircutBps}
      </TableCell>
      <TableCell align="right" sx={denseCellSx}>
        {asset.redemptionHaircutBps}
      </TableCell>
      <CapCell amount={asset.mintCap} decimals={wrappedDecimals} />
      <CapCell amount={asset.exposureCap} decimals={wrappedDecimals} />
      <AmountCell amount={asset.cushion} decimals={d} />
      <AmountCell amount={asset.freeLiquidity} decimals={d} />
      <AmountCell amount={asset.deployedToKamino} decimals={d} />
      <AmountCell amount={asset.backing} decimals={d} />
      <AmountCell amount={asset.treasuryBalance} decimals={d} />
      <AmountCell amount={asset.kaminoSurplus} decimals={d} />
      <AmountCell amount={asset.liabilityUnderlying} decimals={d} />
      <AmountCell amount={asset.homeSurplus} decimals={d} />
      <TableCell align="right" sx={denseCellSx}>
        {formatTokenAmount(asset.maxRedeemable, wrappedDecimals)}
      </TableCell>
    </TableRow>
  );
}

function HeaderCell({
  metric,
  align = "left",
  label,
}: {
  metric: { label: string; hint: string };
  align?: "left" | "right" | "center";
  label?: string;
}) {
  return (
    <TableCell
      align={align}
      sx={{
        px: 0.75,
        py: 0.5,
        fontSize: "0.75rem",
        letterSpacing: "0.06em",
        lineHeight: 1.2,
        verticalAlign: "bottom",
        whiteSpace: "normal",
        // Let full titles fold; don't crush columns to fit the viewport.
        minWidth: "6.5rem",
      }}
    >
      <HintLabel metric={metric} label={label} align={align} variant="inherit" wrap />
    </TableCell>
  );
}

export default function VaultAccountingPanel({
  assets,
  wrappedDecimals,
  wrappedSymbol = BRANDING.symbol,
}: Props) {
  if (assets.length === 0) {
    return null;
  }

  const minted = mintedByReserveMetric(wrappedSymbol);

  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" gutterBottom>
        {adminCopy.accounts}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {adminCopy.accountsCaption}
      </Typography>
      <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <Table
          size="small"
          sx={{
            // Size to content so titles stay readable; scroll when wider than the card.
            width: "max-content",
            minWidth: "100%",
            borderCollapse: "collapse",
            tableLayout: "auto",
            "& .MuiTableCell-root": { borderRight: "none" },
          }}
        >
          <TableHead>
            <TableRow>
              <HeaderCell metric={metricHints.asset} />
              <HeaderCell metric={minted} align="right" />
              <HeaderCell metric={metricHints.kaminoMarket} />
              <HeaderCell metric={metricHints.mintEnabled} align="center" />
              <HeaderCell metric={metricHints.redeemEnabled} align="center" />
              <HeaderCell metric={metricHints.assetStatus} />
              <HeaderCell metric={metricHints.mintHaircutBps} align="right" />
              <HeaderCell metric={metricHints.redeemHaircutBps} align="right" />
              <HeaderCell metric={metricHints.mintCap} align="right" />
              <HeaderCell metric={metricHints.exposureCap} align="right" />
              <HeaderCell metric={metricHints.cushion} align="right" />
              <HeaderCell metric={metricHints.homeVault} align="right" />
              <HeaderCell metric={metricHints.inKamino} align="right" />
              <HeaderCell metric={metricHints.backing} align="right" />
              <HeaderCell metric={metricHints.treasury} align="right" />
              <HeaderCell metric={metricHints.kaminoSurplus} align="right" />
              <HeaderCell metric={metricHints.liabilityUnderlying} align="right" />
              <HeaderCell metric={metricHints.homeSurplus} align="right" />
              <HeaderCell metric={metricHints.maxRedeemable} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset) => (
              <AssetRow key={asset.mint} asset={asset} wrappedDecimals={wrappedDecimals} />
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
