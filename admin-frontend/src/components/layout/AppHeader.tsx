"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NetworkSwitch from "@/components/NetworkSwitch";
import { appNetworkLabel, useNetworkStore } from "@/stores/networkStore";
import { solPurple } from "@/theme/tokens";

export default function AppHeader() {
  const pathname = usePathname();
  const network = useNetworkStore((s) => s.network);

  return (
    <AppBar position="sticky" color="transparent">
      <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
        <Toolbar disableGutters sx={{ minHeight: 64, gap: 2 }}>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              variant="h6"
              component={Link}
              href="/"
              sx={{
                fontWeight: 700,
                letterSpacing: "-0.03em",
                fontSize: "1.125rem",
                color: solPurple,
                textDecoration: "none",
              }}
            >
              wStable Admin
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {pathname.startsWith("/policy")
                ? "Collateral policy"
                : `Mint operations · ${appNetworkLabel(network)}`}
            </Typography>
          </Box>
          <NetworkSwitch />
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href="/"
              size="small"
              variant={pathname === "/" ? "contained" : "text"}
            >
              Mint
            </Button>
            <Button
              component={Link}
              href="/policy"
              size="small"
              variant={pathname.startsWith("/policy") ? "contained" : "text"}
            >
              Policy
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
