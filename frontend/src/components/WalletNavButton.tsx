"use client";

import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useState } from "react";
import { useSnackbar } from "notistack";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function WalletNavButton() {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const openWalletModal = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    enqueueSnackbar("Address copied", { variant: "success" });
    setAnchorEl(null);
  }, [publicKey, enqueueSnackbar]);

  const handleDisconnect = useCallback(async () => {
    setAnchorEl(null);
    await disconnect();
  }, [disconnect]);

  const handleChangeWallet = useCallback(() => {
    setAnchorEl(null);
    openWalletModal();
  }, [openWalletModal]);

  if (connecting) {
    return (
      <Button
        variant="outlined"
        disabled
        startIcon={<CircularProgress size={16} color="inherit" />}
        sx={{ minWidth: 148, borderColor: "divider" }}
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
        onClick={openWalletModal}
        startIcon={<AccountBalanceWalletOutlinedIcon />}
        sx={{ minWidth: 148, px: 2.5, py: 1 }}
      >
        Connect wallet
      </Button>
    );
  }

  const address = publicKey.toBase58();

  return (
    <>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        sx={{
          minWidth: 148,
          borderColor: "divider",
          bgcolor: "action.hover",
          "&:hover": { bgcolor: "action.selected", borderColor: "primary.main" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
          {wallet?.adapter.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wallet.adapter.icon} alt="" width={20} height={20} style={{ borderRadius: 4 }} />
          )}
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
            {truncateAddress(address)}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              mt: 1,
              minWidth: 240,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, maxWidth: 280 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Connected wallet
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: "monospace", wordBreak: "break-all", mt: 0.5, fontWeight: 500 }}
          >
            {address}
          </Typography>
          {wallet?.adapter.name && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {wallet.adapter.name}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy address</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleChangeWallet}>
          <ListItemIcon>
            <SwapHorizOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change wallet</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDisconnect} sx={{ color: "error.light" }}>
          <ListItemIcon sx={{ color: "error.light" }}>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Disconnect</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
