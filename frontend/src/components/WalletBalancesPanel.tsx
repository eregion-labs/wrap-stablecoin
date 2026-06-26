"use client";

import Box from "@mui/material/Box";
import { cardSx } from "@/theme/tokens";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { wrappedTokenSymbol, type VaultSummary } from "@/types/vault";

type Props = {
  summary: VaultSummary | null;
  walletBalances: Map<string, number>;
  connected: boolean;
};

export default function WalletBalancesPanel({ summary, walletBalances, connected }: Props) {
  if (!summary) {
    return null;
  }

  const rows = [
    ...summary.assets.map((a) => ({
      key: a.mint,
      label: mintLabel(a.mint),
      amount: connected ? (walletBalances.get(a.mint) ?? 0) : null,
      decimals: a.tokenDecimals,
    })),
    {
      key: summary.wrappedMint,
      label: wrappedTokenSymbol(summary),
      amount: connected ? (walletBalances.get(summary.wrappedMint) ?? 0) : null,
      decimals: summary.wrappedDecimals,
    },
  ];

  return (
    <Box sx={{ ...cardSx, overflowX: "visible" }}>
      <Typography variant="subtitle2" gutterBottom>
        Your wallet
      </Typography>
      <Table size="small" sx={{ "& td, & th": { border: 0, py: 0.75, px: 0 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Token</TableCell>
            <TableCell align="right">Balance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                {row.amount === null
                  ? "—"
                  : formatTokenAmount(row.amount, row.decimals)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
