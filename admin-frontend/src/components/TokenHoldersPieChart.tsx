"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { truncateAddrShort } from "@/lib/address";
import { formatTokenAmount } from "@/lib/tokenAmount";
import { cardSx, florinGold, florentineRed, merchantCopper, republicBronze, venetianGreen, deepIndigo } from "@/theme/tokens";
import { adminCopy } from "@/theme/copy";

const PIE_COLORS = [
  florinGold,
  venetianGreen,
  republicBronze,
  merchantCopper,
  deepIndigo,
  florentineRed,
];

type HolderSlice = {
  key: string;
  label: string;
  value: number;
  pct: string;
  isOthers: boolean;
};

type Props = {
  holders: Record<string, string>;
  decimals: number;
  symbol: string;
};

function buildSlices(holders: Record<string, string>): HolderSlice[] {
  const entries = Object.entries(holders)
    .map(([address, amount]) => ({
      address,
      value: Number(amount),
    }))
    .filter((e) => Number.isFinite(e.value) && e.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const top = entries.slice(0, 5);
  const rest = entries.slice(5);
  const othersValue = rest.reduce((sum, e) => sum + e.value, 0);

  const pctOf = (value: number) =>
    total === 0 ? "0" : ((value / total) * 100).toFixed(2);

  const slices: HolderSlice[] = top.map((e) => ({
    key: e.address,
    label: truncateAddrShort(e.address, 4, 4),
    value: e.value,
    pct: pctOf(e.value),
    isOthers: false,
  }));

  if (othersValue > 0) {
    slices.push({
      key: "others",
      label: adminCopy.holdersOthers,
      value: othersValue,
      pct: pctOf(othersValue),
      isOthers: true,
    });
  }

  return slices;
}

type TooltipPayload = {
  payload?: HolderSlice;
};

function HoldersTooltip({
  active,
  payload,
  symbol,
  decimals,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  symbol: string;
  decimals: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;
  const addrLabel = slice.isOthers
    ? adminCopy.holdersOthers
    : truncateAddrShort(slice.key, 6, 4);
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        px: 1.5,
        py: 1,
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <Typography variant="caption" display="block">
        {addrLabel}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
        {formatTokenAmount(slice.value, decimals)} {symbol} ({slice.pct}%)
      </Typography>
    </Box>
  );
}

export default function TokenHoldersPieChart({ holders, decimals, symbol }: Props) {
  const slices = useMemo(() => buildSlices(holders), [holders]);

  if (slices.length === 0) {
    return (
      <Box sx={{ ...cardSx, mb: 0 }}>
        <Typography variant="subtitle2" gutterBottom>
          {adminCopy.holdersBreakdown}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {adminCopy.holdersEmpty}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ...cardSx, mb: 0 }}>
      <Typography variant="subtitle2" gutterBottom>
        {adminCopy.holdersBreakdown}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {adminCopy.holdersCaption}
      </Typography>
      <Box sx={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={1}
              label={({ name }) => String(name ?? "")}
            >
              {slices.map((slice, i) => (
                <Cell key={slice.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={<HoldersTooltip symbol={symbol} decimals={decimals} />}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
