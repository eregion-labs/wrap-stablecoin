"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";

export type ReserveCollateralOption = {
  value: string;
  label: string;
};

export type ReserveCollateralSelectProps = {
  label: string;
  value: string;
  onChange: (mint: string) => void;
  options: ReserveCollateralOption[];
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  /** Shown when `options` is empty (e.g. "No registered assets"). Falls back to `value`. */
  emptyLabel?: string;
  sx?: SxProps<Theme>;
};

/** Shared reserve / collateral mint picker for admin and public Florin UIs. */
export function ReserveCollateralSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  fullWidth = true,
  size = "medium",
  emptyLabel,
  sx,
}: ReserveCollateralSelectProps) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      sx={sx}
    >
      {options.length === 0 ? (
        <MenuItem value={value}>{emptyLabel ?? value}</MenuItem>
      ) : (
        options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))
      )}
    </TextField>
  );
}
