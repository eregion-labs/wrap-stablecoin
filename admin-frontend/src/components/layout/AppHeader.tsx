"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { BRANDING } from "@/branding";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { adminCopy } from "@/theme/copy";
import { ledgerInk, textMuted } from "@/theme/tokens";

const navSx = (active: boolean) => ({
  color: active ? ledgerInk : textMuted,
  minWidth: 0,
  px: 1,
});

export default function AppHeader() {
  const pathname = usePathname();
  const config = useClientConfig();

  const subtitle = pathname.startsWith("/reserves") || pathname.startsWith("/policy")
    ? adminCopy.reserveGovernanceSubtitle
    : pathname.startsWith("/vault")
      ? adminCopy.vaultNav
      : pathname.startsWith("/stats")
        ? adminCopy.tokenStatsSubtitle
        : pathname.startsWith("/klend")
          ? adminCopy.klendSubtitle
          : adminCopy.treasuryOperations;

  return (
    <AppBar position="sticky" color="transparent" elevation={0}>
      <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
        <Toolbar disableGutters sx={{ minHeight: 60, gap: 2 }}>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              component={Link}
              href="/"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                textDecoration: "none",
                color: ledgerInk,
              }}
            >
              <Box
                component="img"
                src="/florentine-lily.png"
                alt=""
                sx={{ height: 28, width: "auto" }}
              />
              <Typography
                variant="h6"
                component="span"
                sx={{
                  fontFamily: 'var(--font-eb-garamond), "EB Garamond", Georgia, serif',
                  fontWeight: 400,
                  letterSpacing: "0.18em",
                  fontSize: "1.35rem",
                  color: ledgerInk,
                }}
              >
                {BRANDING.name.toUpperCase()}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: { xs: "none", sm: "block" },
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${config.solana.network} · ${config.deploymentId}`}
            variant="outlined"
            sx={{ display: { xs: "none", md: "flex" }, borderRadius: "1px" }}
          />
          <Stack direction="row" spacing={0.5}>
            <Button component={Link} href="/" size="small" variant="text" sx={navSx(pathname === "/")}>
              {adminCopy.treasury}
            </Button>
            <Button
              component={Link}
              href="/reserves"
              size="small"
              variant="text"
              sx={navSx(pathname.startsWith("/reserves") || pathname.startsWith("/policy"))}
            >
              {adminCopy.reserves}
            </Button>
            <Button
              component={Link}
              href="/vault"
              size="small"
              variant="text"
              sx={navSx(pathname.startsWith("/vault"))}
            >
              {adminCopy.vaultNav}
            </Button>
            <Button
              component={Link}
              href="/klend"
              size="small"
              variant="text"
              sx={navSx(pathname.startsWith("/klend"))}
            >
              {adminCopy.klendNav}
            </Button>
            <Button
              component={Link}
              href="/stats"
              size="small"
              variant="text"
              sx={navSx(pathname.startsWith("/stats"))}
            >
              {adminCopy.tokenStats}
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
