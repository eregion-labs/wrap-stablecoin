"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AssetPolicyTable from "@/components/AssetPolicyTable";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";
import { wrappedTokenSymbol } from "@/types/vault";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";
import { adminCopy } from "@/theme/copy";

export default function ReservesPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const loading = selectVaultLoading(status);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      )}
      <AssetPolicyTable />
      {summary && summary.assets.length > 0 && (
        <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, pb: 5 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {adminCopy.accounts}
          </Typography>
          <VaultAccountingPanel
            assets={summary.assets}
            wrappedDecimals={summary.wrappedDecimals}
            wrappedSymbol={wrappedTokenSymbol(summary)}
          />
        </Box>
      )}
    </main>
  );
}
