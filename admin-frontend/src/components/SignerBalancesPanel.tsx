"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ExplorerLink from "@/components/ExplorerLink";
import { mintLabel } from "@/lib/mints";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { adminCopy } from "@/theme/copy";
import { selectVaultLoading } from "@/stores/selectors";
import { useSignerBalancesStore } from "@/stores/signerBalancesStore";
import { wrappedTokenSymbol, type VaultSummary } from "@/types/vault";

type Props = {
  summary: VaultSummary;
};

export default function SignerBalancesPanel({ summary }: Props) {
  const owner = useSignerBalancesStore((s) => s.owner);
  const balances = useSignerBalancesStore((s) => s.balances);
  const status = useSignerBalancesStore((s) => s.status);
  const error = useSignerBalancesStore((s) => s.error);
  const loading = selectVaultLoading(status);
  const wrappedSymbol = wrappedTokenSymbol(summary);

  const rows = [
    ...summary.assets.map((a) => ({
      key: a.mint,
      label: mintLabel(a.mint),
      amount: balances[a.mint] ?? 0,
      decimals: a.tokenDecimals,
    })),
    {
      key: summary.wrappedMint,
      label: wrappedSymbol,
      amount: balances[summary.wrappedMint] ?? 0,
      decimals: summary.wrappedDecimals,
    },
  ];

  return (
    <Stack spacing={1}>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2">{adminCopy.signerHoldings}</Typography>
        <Typography variant="caption" color="text.secondary">
          {adminCopy.signerHoldingsCaption}
        </Typography>
        {owner && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
          >
            <ExplorerLink address={owner}>{owner}</ExplorerLink>
          </Typography>
        )}
      </Stack>
      {error && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          {adminCopy.signerBalanceUnavailable}
        </Alert>
      )}
      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {adminCopy.loadingSignerBalance}
          </Typography>
        </Stack>
      ) : (
        <Table size="small" sx={{ "& td, & th": { py: 0.75, px: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{adminCopy.signerHoldingsToken}</TableCell>
              <TableCell align="right">{adminCopy.signerHoldingsColumn}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <ExplorerLink address={row.key} type="token">
                    {row.label}
                  </ExplorerLink>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
                >
                  {status === "ready" ? formatTokenAmount(row.amount, row.decimals) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
