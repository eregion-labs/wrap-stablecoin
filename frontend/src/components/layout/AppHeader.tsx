"use client";

import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import WalletNavButton from "@/components/WalletNavButton";
import NetworkSwitch from "@/components/NetworkSwitch";
import { BRANDING } from "@/branding";
import { appNetworkLabel, useNetworkStore } from "@/stores/networkStore";
import { publicCopy } from "@/theme/copy";
import { florinGold } from "@/theme/tokens";

export default function AppHeader() {
  const network = useNetworkStore((s) => s.network);

  return (
    <AppBar position="sticky" color="transparent" elevation={0}>
      <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
        <Toolbar disableGutters sx={{ minHeight: 64, gap: 2 }}>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              variant="h6"
              component={Link}
              href="/"
              sx={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontWeight: 700,
                letterSpacing: "0.02em",
                fontSize: "1.375rem",
                color: florinGold,
                textDecoration: "none",
              }}
            >
              {BRANDING.name}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {publicCopy.headerTagline} · {appNetworkLabel(network)}
            </Typography>
          </Box>
          <NetworkSwitch />
          <WalletNavButton />
        </Toolbar>
      </Container>
    </AppBar>
  );
}
