"use client";

import Box from "@mui/material/Box";
import { cardSx } from "@/theme/tokens";
import Chip from "@mui/material/Chip";
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
import { adminCopy } from "@/theme/copy";
import ExplorerLink from "@/components/ExplorerLink";
import type { VaultAsset } from "@/types/vault";

type Props = {
  assets: VaultAsset[];
  wrappedDecimals: number;
  wrappedSymbol?: string;
};

function AmountCell({ amount, decimals }: { amount: number; decimals: number }) {
  return (
    <TableCell align="right" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace', whiteSpace: "nowrap" }}>
      {formatTokenAmount(amount, decimals)}
    </TableCell>
  );
}

function KaminoMarketCell({ asset }: { asset: VaultAsset }) {
  if (!asset.klendEnabled) {
    return (
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          —
        </Typography>
      </TableCell>
    );
  }
  const market = asset.lendingMarket;
  return (
    <TableCell>
      <Stack spacing={0.25}>
        <Typography variant="body2" fontWeight={600}>
          {adminCopy.kaminoMarketLive}
        </Typography>
        {market ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
          >
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
      <TableCell>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">
            <ExplorerLink address={asset.mint} type="token">
              {mintLabel(asset.mint)}
            </ExplorerLink>
          </Typography>
          {!asset.mintAllowed && <Chip label="mint off" size="small" />}
          {!asset.redeemAllowed && <Chip label="redeem off" size="small" color="warning" />}
        </Stack>
      </TableCell>
      <KaminoMarketCell asset={asset} />
      <AmountCell amount={asset.freeLiquidity} decimals={d} />
      <AmountCell amount={asset.cushion} decimals={d} />
      <AmountCell amount={asset.deployedToKamino} decimals={d} />
      <AmountCell amount={asset.backing} decimals={d} />
      <AmountCell amount={asset.treasuryBalance} decimals={d} />
      <AmountCell amount={asset.kaminoSurplus} decimals={d} />
      <TableCell align="right" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
        {formatTokenAmount(asset.liability, wrappedDecimals)}
      </TableCell>
      <AmountCell amount={asset.liabilityUnderlying} decimals={d} />
      <AmountCell amount={asset.homeSurplus} decimals={d} />
      <TableCell align="right" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
        {formatTokenAmount(asset.maxRedeemable, wrappedDecimals)}
      </TableCell>
    </TableRow>
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

  return (
    <Box sx={cardSx}>
      <Typography variant="subtitle2" gutterBottom>
        {adminCopy.accounts}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {adminCopy.accountsCaption}
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell>{adminCopy.kaminoMarket}</TableCell>
              <TableCell align="right">Home vault</TableCell>
              <TableCell align="right">Cushion</TableCell>
              <TableCell align="right">In Kamino</TableCell>
              <TableCell align="right">Backing</TableCell>
              <TableCell align="right">Treasury</TableCell>
              <TableCell align="right">Kamino surplus</TableCell>
              <TableCell align="right">Liability ({wrappedSymbol})</TableCell>
              <TableCell align="right">Liability (underlying)</TableCell>
              <TableCell align="right">Home surplus</TableCell>
              <TableCell align="right">Max redeemable</TableCell>
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
