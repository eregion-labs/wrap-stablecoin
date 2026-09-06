"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { MetricHint } from "@/theme/copy";

type Props = {
  metric: MetricHint;
  /** Optional display label override (same hint, different surface name). */
  label?: string;
  /** Typography variant for the label text. */
  variant?: "body2" | "caption" | "overline" | "inherit";
  align?: "left" | "right" | "center";
  component?: "span" | "div";
};

/**
 * Label + compact (?) control. Hover or keyboard-focus the (?) to see the metric hint.
 * Always pass a catalog metric — never a one-off tooltip string.
 */
export default function HintLabel({
  metric,
  label,
  variant = "inherit",
  align = "left",
  component = "span",
}: Props) {
  const display = label ?? metric.label;
  return (
    <Box
      component={component}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.35,
        justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
        whiteSpace: "nowrap",
      }}
    >
      <Typography component="span" variant={variant} sx={{ lineHeight: 1.3 }}>
        {display}
      </Typography>
      <Tooltip title={metric.hint} enterDelay={200} leaveDelay={100}>
        <Box
          component="span"
          tabIndex={0}
          aria-label={`About ${display}`}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
            fontSize: "0.7em",
            lineHeight: 1,
            cursor: "help",
            userSelect: "none",
            outline: "none",
            borderRadius: "2px",
            px: 0.15,
            "&:hover, &:focus-visible": {
              color: "text.primary",
            },
            "&:focus-visible": {
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}44`,
            },
          }}
        >
          (?)
        </Box>
      </Tooltip>
    </Box>
  );
}
