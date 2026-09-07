"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AssetPolicyTable from "@/components/AssetPolicyTable";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";

export default function ReservesPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const summary = useVaultStore((s) => s.summary);
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
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      )}
      <AssetPolicyTable />
    </main>
  );
}
