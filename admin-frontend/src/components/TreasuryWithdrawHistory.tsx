"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ExplorerLink from "@/components/ExplorerLink";
import { truncateAddrStandard } from "@/lib/address";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import type { WithdrawHistoryRow } from "@/components/TreasuryWithdrawPanel";
import { adminCopy } from "@/theme/copy";
import { actBlockSx, cardSx, monoSx } from "@/theme/tokens";

type Props = {
  mint: string;
  decimals: number;
  rows: WithdrawHistoryRow[];
  loading?: boolean;
};

function formatTime(blockTime: number | null): string {
  if (blockTime == null || blockTime <= 0) return "—";
  try {
    return new Date(blockTime * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

export default function TreasuryWithdrawHistory({ mint, decimals, rows, loading }: Props) {
  const symbol = mintLabel(mint);
  return (
    <Box sx={{ ...cardSx, ...actBlockSx }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        {adminCopy.klendHistoryTitle}
      </Typography>
      {loading && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {adminCopy.klendHistoryEmpty}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Amount</TableCell>
              <TableCell>Destination</TableCell>
              <TableCell>Initiator</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Tx</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.signature}>
                <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatTokenAmount(r.amount, decimals)} {symbol}
                </TableCell>
                <TableCell sx={monoSx}>
                  <ExplorerLink address={r.destination}>
                    {truncateAddrStandard(r.destination)}
                  </ExplorerLink>
                </TableCell>
                <TableCell sx={monoSx}>
                  {r.initiator ? (
                    <ExplorerLink address={r.initiator}>
                      {truncateAddrStandard(r.initiator)}
                    </ExplorerLink>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{formatTime(r.blockTime)}</TableCell>
                <TableCell sx={monoSx}>
                  <ExplorerLink address={r.signature} type="tx">
                    {truncateAddrStandard(r.signature)}
                  </ExplorerLink>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {loading && rows.length > 0 ? (
        <Stack sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Refreshing…
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}
