"use client";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { alpha, useTheme } from "@mui/material/styles";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const { setVisible } = useWalletModal();
  const { publicKey, disconnect, connecting, connected } = useWallet();

  if (connecting) {
    return (
      <Button
        variant="outlined"
        disabled
        size={compact ? "small" : "medium"}
        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
      >
        Connecting…
      </Button>
    );
  }

  if (!connected || !publicKey) {
    return (
      <Button
        variant="contained"
        color="primary"
        size={compact ? "medium" : "large"}
        onClick={() => setVisible(true)}
        startIcon={<AccountBalanceWalletOutlinedIcon />}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          letterSpacing: "0.02em",
          borderRadius: 2.5,
          px: compact ? 2 : 2.75,
          py: compact ? 1 : 1.25,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        }}
      >
        Connect wallet
      </Button>
    );
  }

  const addr = publicKey.toBase58();

  return (
    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip
        label={truncateAddress(addr)}
        title={addr}
        variant="outlined"
        sx={{
          fontFamily: theme.typography.fontFamily,
          fontWeight: 600,
          letterSpacing: "0.04em",
          borderColor: alpha(theme.palette.primary.main, 0.45),
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          maxWidth: compact ? 160 : "none",
          "& .MuiChip-label": { px: 1.25 },
        }}
      />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setVisible(true)}
          startIcon={<SwapHorizOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Change
        </Button>
        <Button
          variant="text"
          size="small"
          color="inherit"
          onClick={() => disconnect()}
          startIcon={<LogoutOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            color: "text.secondary",
            "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.06) },
          }}
        >
          Disconnect
        </Button>
      </Box>
    </Stack>
  );
}
