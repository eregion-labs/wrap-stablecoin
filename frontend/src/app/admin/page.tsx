"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AssetPolicyTable from "@/components/admin/AssetPolicyTable";
import VaultAccountingPanel from "@/components/VaultAccountingPanel";
import { useVaultAdmin } from "@/hooks/useVaultAdmin";

export default function AdminPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { isAdmin, loading, summary, meta, error, refresh } = useVaultAdmin();

  useEffect(() => {
    if (!loading && (!connected || !isAdmin)) {
      router.replace("/");
    }
  }, [loading, connected, isAdmin, router]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  if (!isAdmin) {
    return null;
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
      <AssetPolicyTable
        summary={summary}
        paused={meta?.paused ?? false}
        onRefresh={refresh}
      />
      {summary && summary.assets.length > 0 && (
        <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, pb: 5 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Pool accounting
          </Typography>
          <VaultAccountingPanel
            assets={summary.assets}
            wrappedDecimals={summary.wrappedDecimals}
          />
        </Box>
      )}
    </main>
  );
}
