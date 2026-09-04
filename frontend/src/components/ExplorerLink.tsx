"use client";

import type { ReactNode } from "react";
import Link from "@mui/material/Link";
import { createExplorerUrl, truncateAddrStandard, type ExplorerAccountType } from "@/lib/address";
import { useClientConfig } from "@/providers/ClientConfigProvider";

type Props = {
  address: string;
  type?: ExplorerAccountType;
  children?: ReactNode;
};

/** Inline Solscan (or configured explorer) hyperlink. No link on localnet. */
export default function ExplorerLink({ address, type = "account", children }: Props) {
  const config = useClientConfig();
  const href = createExplorerUrl({
    address,
    network: config.solana.network,
    type,
    explorerBaseUrl: config.links.explorerBaseUrl,
  });
  const label = children ?? truncateAddrStandard(address);
  if (!href) {
    return <>{label}</>;
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      onClick={(e) => e.stopPropagation()}
      sx={{ fontFamily: children ? "inherit" : 'var(--font-dm-mono), "DM Mono", monospace' }}
    >
      {label}
    </Link>
  );
}
