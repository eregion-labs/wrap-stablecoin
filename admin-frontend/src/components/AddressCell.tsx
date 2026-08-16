"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { createExplorerUrl, truncateAddrStandard } from "@/lib/address";
import { useClientConfig } from "@/providers/ClientConfigProvider";

type Props = {
  address: string;
  /** Explorer resource type; default account. */
  type?: "account" | "tx" | "token";
};

export default function AddressCell({ address, type = "account" }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const config = useClientConfig();
  const network = config.solana.network;
  const href = createExplorerUrl({
    address,
    network,
    type,
    explorerBaseUrl: config.links.explorerBaseUrl,
  });
  const label = truncateAddrStandard(address);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      enqueueSnackbar("Address copied", { variant: "success" });
    } catch {
      enqueueSnackbar("Could not copy address", { variant: "error" });
    }
  };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{
            fontFamily: 'var(--font-dm-mono), "DM Mono", monospace',
            fontSize: "0.875rem",
            wordBreak: "break-all",
          }}
        >
          {label}
        </Link>
      ) : (
        <Typography
          component="span"
          sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace', fontSize: "0.875rem", wordBreak: "break-all" }}
        >
          {label}
        </Typography>
      )}
      <Tooltip title="Copy address">
        <IconButton size="small" aria-label="Copy address" onClick={onCopy} sx={{ flexShrink: 0 }}>
          <ContentCopyIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
