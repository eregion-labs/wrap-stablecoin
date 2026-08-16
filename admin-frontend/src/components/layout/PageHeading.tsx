"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { redRuleSx, sectionLabelSx } from "@/theme/tokens";

type Props = {
  label?: string;
  title: string;
  description?: string;
};

export default function PageHeading({ label, title, description }: Props) {
  return (
    <Box>
      {label ? (
        <Typography component="p" sx={sectionLabelSx}>
          {label}
        </Typography>
      ) : null}
      <Box sx={redRuleSx} />
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            maxWidth: 640,
            fontFamily: 'var(--font-eb-garamond), "EB Garamond", Georgia, serif',
            fontStyle: "italic",
            fontSize: "1.05rem",
            lineHeight: 1.7,
          }}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}
