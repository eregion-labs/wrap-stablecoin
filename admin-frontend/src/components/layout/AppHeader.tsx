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
import { florinGold } from "@/theme/tokens";

export default function AppHeader() {
  const pathname = usePathname();
  const config = useClientConfig();

  const subtitle = pathname.startsWith("/policy")
    ? adminCopy.reserveGovernanceSubtitle
    : adminCopy.treasuryOperations;

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
              {BRANDING.name} {adminCopy.officeTitle}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {subtitle}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${config.solana.network} · ${config.deploymentId}`}
            variant="outlined"
            sx={{ display: { xs: "none", md: "flex" } }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href="/"
              size="small"
              variant={pathname === "/" ? "contained" : "text"}
            >
              {adminCopy.treasury}
            </Button>
            <Button
              component={Link}
              href="/policy"
              size="small"
              variant={pathname.startsWith("/policy") ? "contained" : "text"}
            >
              {adminCopy.chamber}
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
