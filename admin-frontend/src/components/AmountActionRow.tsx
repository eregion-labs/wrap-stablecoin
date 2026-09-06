"use client";

import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { atomsToInputAmount, formatTokenAmount } from "@/lib/tokenAmount";
import { adminCopy, type MetricHint } from "@/theme/copy";
import HintLabel from "@/components/HintLabel";

type ButtonColor = "primary" | "secondary" | "inherit" | "success" | "error" | "info" | "warning";
type ButtonVariant = "text" | "outlined" | "contained";

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
  /** Optional second button after execute (e.g. Recall all). */
  secondaryExecuteLabel?: string;
  secondaryExecuteBusy?: boolean;
  secondaryExecuteDisabled?: boolean;
  onSecondaryExecute?: () => void;
  secondaryExecuteVariant?: ButtonVariant;
  /** Optional field rendered between amount and execute (e.g. destination pubkey). */
  extraField?: ReactNode;
  /** Content after the action row (alerts, captions). */
  children?: ReactNode;
  fullWidth?: boolean;
  minWidth?: number;
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
  secondaryExecuteLabel,
  secondaryExecuteBusy = false,
  secondaryExecuteDisabled = false,
  onSecondaryExecute,
  secondaryExecuteVariant = "outlined",
  extraField,
  children,
  fullWidth = false,
  minWidth = 200,
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
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "flex-start" }}>
        <TextField
          size="small"
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          fullWidth={fullWidth}
          sx={{ minWidth, ...(fullWidth ? { flex: 1 } : {}) }}
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
        {extraField}
        <Button
          variant={executeVariant}
          color={executeColor}
          disabled={executeDisabled || disabled}
          onClick={onExecute}
          sx={{ mt: { md: 0.5 }, flexShrink: 0 }}
        >
          {executeBusy ? executeBusyLabel : executeLabel}
        </Button>
        {secondaryExecuteLabel && onSecondaryExecute && (
          <Button
            variant={secondaryExecuteVariant}
            color={executeColor}
            disabled={secondaryExecuteDisabled || disabled}
            onClick={onSecondaryExecute}
            sx={{ mt: { md: 0.5 }, flexShrink: 0 }}
          >
            {secondaryExecuteBusy ? executeBusyLabel : secondaryExecuteLabel}
          </Button>
        )}
      </Stack>
      {children}
    </Stack>
  );
}
