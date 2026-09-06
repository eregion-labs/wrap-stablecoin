"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import PageHeading from "@/components/layout/PageHeading";
import KlendOpsTable from "@/components/KlendOpsTable";
import YieldEarnedSummary from "@/components/YieldEarnedSummary";
import { adminCopy } from "@/theme/copy";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";

export default function YieldPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
  const refresh = useVaultStore((s) => s.refresh);
  const refreshing = useVaultStore((s) => s.refreshing);
  const loading = selectVaultLoading(status, summary);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Box sx={{ width: "100%", maxWidth: 1800, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 2, gap: 2 }}
        >
          <PageHeading
            label={adminCopy.klendSubtitle}
            title={adminCopy.klendPageTitle}
            description={adminCopy.klendPageDescription}
          />
          <Button size="small" variant="outlined" onClick={() => refresh()} disabled={refreshing}>
            {adminCopy.refreshLedger}
          </Button>
        </Stack>

        <Box sx={{ mb: 4, maxWidth: 720 }}>
          {adminCopy.klendHarvestSweepBlurb.map((paragraph) => (
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
