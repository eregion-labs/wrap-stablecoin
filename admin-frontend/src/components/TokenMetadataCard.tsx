"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddressCell from "@/components/AddressCell";
import { BRANDING } from "@/branding";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { cardSx } from "@/theme/tokens";
import { adminCopy } from "@/theme/copy";
import type { MintMetadata } from "@/types/vault";
import { wrappedTokenName, wrappedTokenSymbol } from "@/types/vault";

type Props = {
  wrappedMint: string;
  wrappedDecimals: number;
  mintMetadata?: MintMetadata | null;
};

export default function TokenMetadataCard({
  wrappedMint,
  wrappedDecimals,
  mintMetadata,
}: Props) {
  const config = useClientConfig();
  const network = config.solana.network;
  const name = wrappedTokenName({ mintMetadata });
  const symbol = wrappedTokenSymbol({ mintMetadata });
  const imageUri = BRANDING.icon.trim() || undefined;

  return (
    <Box sx={{ ...cardSx, mb: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Avatar
          src={imageUri || undefined}
          alt={name}
          sx={{ width: 56, height: 56, bgcolor: "primary.main", fontWeight: 700 }}
        >
          {symbol.slice(0, 2)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6" component="h2">
              {name}
            </Typography>
            <Chip label={symbol} size="small" color="primary" variant="outlined" />
            <Chip label={network} size="small" variant="outlined" />
          </Stack>
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.5, sm: 2 }}
              alignItems={{ sm: "center" }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                {adminCopy.tokenContract}
              </Typography>
              <AddressCell address={wrappedMint} type="token" />
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.5, sm: 2 }}
              alignItems={{ sm: "center" }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                {adminCopy.decimals}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}>
                {wrappedDecimals}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
