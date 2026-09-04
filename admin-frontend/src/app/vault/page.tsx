"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VaultControlsPanel from "@/components/VaultControlsPanel";
import { selectVaultLoading } from "@/stores/selectors";
import { useVaultStore } from "@/stores/vaultStore";

export default function VaultPage() {
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
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
      <VaultControlsPanel />
    </main>
  );
}
