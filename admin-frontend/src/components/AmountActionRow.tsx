"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { atomsToInputAmount, formatTokenAmount } from "@/lib/tokenAmount";
import { adminCopy, type MetricHint } from "@/theme/copy";
import HintLabel from "@/components/HintLabel";

type ButtonColor = "primary" | "secondary" | "inherit" | "success" | "error" | "info" | "warning";
type ButtonVariant = "text" | "outlined" | "contained";

/** Shared execute-column width so Yield (and similar) action rows line up. */
export const ACTION_EXECUTE_MIN_WIDTH = 200;

export type AmountActionRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Atoms available to Max; shown in helper when provided with decimals. */
  availableAtoms: number;
  decimals: number;
  /** Plain available-line label (used when availableMetric is omitted). */
  availableLabel?: string;
  /** Catalog metric for the available-line label — renders with a shared (?) hint. */
  availableMetric?: MetricHint;
  symbol?: string;
  /** Extra helper text after the available line (e.g. human-amount hint). */
  helperExtra?: string;
  /** Replace the whole helper line (skips Available formatting). */
  helperText?: string;
  disabled?: boolean;
  maxDisabled?: boolean;
  executeLabel: string;
  executeBusyLabel?: string;
  executeBusy?: boolean;
  executeDisabled?: boolean;
  onExecute: () => void;
  executeVariant?: ButtonVariant;
  executeColor?: ButtonColor;
  /** Optional field below the amount row (e.g. destination pubkey) — keeps execute column aligned. */
  extraField?: ReactNode;
  /** Content after the action row (alerts, captions). */
  children?: ReactNode;
};

export default function AmountActionRow({
  label,
  value,
  onChange,
  availableAtoms,
  decimals,
  availableLabel = "Available",
  availableMetric,
  symbol,
  helperExtra,
  helperText: helperTextOverride,
  disabled = false,
  maxDisabled,
  executeLabel,
  executeBusyLabel = adminCopy.submitting,
  executeBusy = false,
  executeDisabled = false,
  onExecute,
  executeVariant = "contained",
  executeColor = "primary",
  extraField,
  children,
}: AmountActionRowProps) {
  const maxOff = maxDisabled ?? (disabled || availableAtoms <= 0);
  const amountText =
    symbol != null
      ? `${formatTokenAmount(availableAtoms, decimals)} ${symbol}`
      : formatTokenAmount(availableAtoms, decimals);
  const availableNode: ReactNode = availableMetric ? (
    <>
      <HintLabel metric={availableMetric} variant="inherit" />: {amountText}
    </>
  ) : (
    `${availableLabel}: ${amountText}`
  );
  const helperNode: ReactNode = helperTextOverride ?? (
    <>
      {availableNode}
      {helperExtra ? ` · ${helperExtra}` : null}
    </>
  );

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          width: "100%",
          alignItems: "start",
          gridTemplateColumns: {
            xs: "1fr",
            md: `minmax(0, 1fr) ${ACTION_EXECUTE_MIN_WIDTH}px`,
          },
        }}
      >
        <TextField
          size="small"
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          fullWidth
          helperText={helperNode}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={() => onChange(atomsToInputAmount(availableAtoms, decimals))}
                    disabled={maxOff}
                    sx={{ minWidth: 0, px: 1, fontWeight: 600 }}
                  >
                    {adminCopy.max}
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          variant={executeVariant}
          color={executeColor}
          disabled={executeDisabled || disabled}
          onClick={onExecute}
          sx={{
            mt: { md: 0.5 },
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {executeBusy ? executeBusyLabel : executeLabel}
        </Button>
      </Box>
      {extraField}
      {children}
    </Stack>
  );
}
