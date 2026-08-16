"use client";

import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import WalletNavButton from "@/components/WalletNavButton";
import { BRANDING } from "@/branding";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { publicCopy } from "@/theme/copy";
import { ledgerInk } from "@/theme/tokens";

export default function AppHeader() {
  const config = useClientConfig();

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
              {publicCopy.headerTagline}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${config.solana.network} · ${config.deploymentId}`}
            variant="outlined"
            sx={{ display: { xs: "none", md: "flex" }, borderRadius: "1px" }}
          />
          <WalletNavButton />
        </Toolbar>
      </Container>
    </AppBar>
  );
}
