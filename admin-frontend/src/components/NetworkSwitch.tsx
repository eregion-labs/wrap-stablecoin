"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { appNetworkLabel, useNetworkStore, type AppNetwork } from "@/stores/networkStore";

export default function NetworkSwitch() {
  const network = useNetworkStore((s) => s.network);
  const setNetwork = useNetworkStore((s) => s.setNetwork);

  const handleChange = (_: React.MouseEvent<HTMLElement>, value: AppNetwork | null) => {
    if (value != null) setNetwork(value);
  };

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={network}
      onChange={handleChange}
      aria-label="Solana cluster"
      sx={{
        "& .MuiToggleButton-root": {
          px: 1.5,
          py: 0.25,
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "none",
        },
      }}
    >
      <ToggleButton value="localnet" aria-label="Localnet">
        {appNetworkLabel("localnet")}
      </ToggleButton>
      <ToggleButton value="devnet" aria-label="Devnet">
        {appNetworkLabel("devnet")}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
