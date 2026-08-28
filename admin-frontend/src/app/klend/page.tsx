"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import PageHeading from "@/components/layout/PageHeading";
import KlendOpsTable from "@/components/KlendOpsTable";
import YieldEarnedSummary from "@/components/YieldEarnedSummary";
import { adminCopy } from "@/theme/copy";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";

export default function KlendPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const refresh = useVaultStore((s) => s.refresh);
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
      <Box sx={{ maxWidth: 1100, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 }, width: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 4, gap: 2 }}
        >
          <PageHeading
            label={adminCopy.klendSubtitle}
            title={adminCopy.klendPageTitle}
            description={adminCopy.klendPageDescription}
          />
          <Button size="small" variant="outlined" onClick={() => refresh()}>
            {adminCopy.refreshLedger}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {summary?.paused && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {adminCopy.pausedVaultAlert}
          </Alert>
        )}

        <YieldEarnedSummary assets={summary?.assets ?? []} />

        <KlendOpsTable assets={summary?.assets ?? []} paused={summary?.paused ?? false} />
      </Box>
    </main>
  );
}
