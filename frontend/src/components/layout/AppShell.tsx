"use client";

import AppHeader from "@/components/layout/AppHeader";
import Box from "@mui/material/Box";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader />
      <Box component="main" sx={{ flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
