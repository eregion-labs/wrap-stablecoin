"use client";

import { useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import PageHeading from "@/components/layout/PageHeading";
import TokenHoldersPieChart from "@/components/TokenHoldersPieChart";
import TokenMetadataCard from "@/components/TokenMetadataCard";
import { selectVaultLoading } from "@/stores/selectors";
import { useTokenHoldersStore } from "@/stores/tokenHoldersStore";
import { useVaultStore } from "@/stores/vaultStore";
import { adminCopy } from "@/theme/copy";
import { wrappedTokenName, wrappedTokenSymbol } from "@/types/vault";

export default function TokenStatsPage() {
  const vaultStatus = useVaultStore((s) => s.status);
  const vaultError = useVaultStore((s) => s.error);
  const meta = useVaultStore((s) => s.meta);
  const summary = useVaultStore((s) => s.summary);
  const refreshVault = useVaultStore((s) => s.refresh);

  const holdersStatus = useTokenHoldersStore((s) => s.status);
  const holdersError = useTokenHoldersStore((s) => s.error);
  const holdersData = useTokenHoldersStore((s) => s.data);
  const hydrateHolders = useTokenHoldersStore((s) => s.hydrate);
  const refreshHolders = useTokenHoldersStore((s) => s.refresh);

  useEffect(() => {
    void hydrateHolders();
  }, [hydrateHolders]);

  const vaultLoading = selectVaultLoading(vaultStatus);
  const holdersLoading = holdersStatus === "idle" || holdersStatus === "loading";

  const source = meta ?? summary;
  const wrappedName = wrappedTokenName(source);
  const wrappedSymbol = wrappedTokenSymbol(source);

  if (vaultLoading && !source) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
        <CircularProgress size={32} />
      </Stack>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Box sx={{ maxWidth: 960, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 }, width: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 4, gap: 2 }}
        >
          <PageHeading
            label={adminCopy.tokenStatsSubtitle}
            title={adminCopy.tokenStatsPageTitle}
            description={adminCopy.tokenStatsPageDescription(wrappedName, wrappedSymbol)}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                void refreshVault();
                void refreshHolders();
              }}
              disabled={holdersLoading}
            >
              {adminCopy.refreshHolders}
            </Button>
          </Stack>
        </Stack>

        {vaultError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {vaultError}
          </Alert>
        )}

        {source && (
          <Box sx={{ mb: 3 }}>
            <TokenMetadataCard
              wrappedMint={source.wrappedMint}
              wrappedDecimals={source.wrappedDecimals}
              mintMetadata={source.mintMetadata}
              circulatingSupply={holdersData?.supply ?? source.circulatingSupply}
            />
          </Box>
        )}

        {holdersError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {holdersError}
          </Alert>
        )}

        {holdersLoading && !holdersData ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : holdersData ? (
          <TokenHoldersPieChart
            holders={holdersData.holders}
            decimals={holdersData.decimals}
            symbol={wrappedSymbol}
          />
        ) : null}
      </Box>
    </main>
  );
}
