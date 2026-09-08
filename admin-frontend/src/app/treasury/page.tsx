"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import PageHeading from "@/components/layout/PageHeading";
import TreasuryWithdrawHistory from "@/components/TreasuryWithdrawHistory";
import TreasuryWithdrawPanel, {
  type WithdrawHistoryRow,
} from "@/components/TreasuryWithdrawPanel";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";
import { apiGet } from "@/lib/api";
import { adminCopy } from "@/theme/copy";
import { layout, pageColumnSx } from "@/theme/tokens";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";
import { wrappedTokenSymbol } from "@/types/vault";

export default function TreasuryPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const refresh = useVaultStore((s) => s.refresh);
  const refreshing = useVaultStore((s) => s.refreshing);
  const loading = selectVaultLoading(status, summary);

  const [selectedMint, setSelectedMint] = useState("");
  const [history, setHistory] = useState<WithdrawHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const assets = summary?.assets ?? [];
  const mint =
    assets.find((a) => a.mint === selectedMint)?.mint ?? assets[0]?.mint ?? "";
  const selectedAsset = assets.find((a) => a.mint === mint) ?? assets[0];

  useEffect(() => {
    if (!selectedMint && assets[0]) setSelectedMint(assets[0].mint);
  }, [assets, selectedMint]);

  const loadHistory = useCallback(async (assetMint: string) => {
    if (!assetMint) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await apiGet<{
        withdrawals: Array<{
          signature: string;
          amount: number;
          destination: string;
          initiator: string;
          blockTime: number | null;
        }>;
      }>(`/v1/admin/withdraw-treasury/history?assetMint=${encodeURIComponent(assetMint)}`);
      setHistory(
        (res.withdrawals ?? []).map((w) => ({
          signature: w.signature,
          amount: w.amount,
          destination: w.destination,
          initiator: w.initiator,
          blockTime: w.blockTime,
        })),
      );
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mint) void loadHistory(mint);
  }, [mint, loadHistory]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Box sx={{ ...pageColumnSx, py: { xs: 3, md: 5 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 2, gap: 2 }}
        >
          <PageHeading
            label={adminCopy.treasuryVaultSubtitle}
            title={adminCopy.treasuryVaultPageTitle}
            description={adminCopy.treasuryVaultPageDescription}
          />
          <Button size="small" variant="outlined" onClick={() => refresh()} disabled={refreshing}>
            {adminCopy.refreshLedger}
          </Button>
        </Stack>

        <Box sx={{ mb: 4, maxWidth: layout.explainLong }}>
          {adminCopy.klendTreasuryBlurb.map((paragraph) => (
            <Typography
              key={paragraph}
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1.5, lineHeight: 1.7, "&:last-child": { mb: 0 } }}
            >
              {paragraph}
            </Typography>
          ))}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {summary?.paused && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {adminCopy.pausedVaultAlert}
          </Alert>
        )}

        {summary && summary.assets.length > 0 && (
          <VaultAccountingPanel
            assets={summary.assets}
            wrappedDecimals={summary.wrappedDecimals}
            wrappedSymbol={wrappedTokenSymbol(summary)}
          />
        )}

        {selectedAsset ? (
          <>
            <TreasuryWithdrawPanel
              assets={assets}
              asset={selectedAsset}
              admin={summary?.admin ?? ""}
              onMintChange={setSelectedMint}
              historyDestinations={history.map((h) => h.destination)}
              onHistoryRefresh={async () => {
                await loadHistory(mint);
              }}
            />
            <TreasuryWithdrawHistory
              mint={mint}
              decimals={selectedAsset.tokenDecimals}
              rows={history}
              loading={historyLoading}
            />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {adminCopy.klendNoAssets}
          </Typography>
        )}
      </Box>
    </main>
  );
}
