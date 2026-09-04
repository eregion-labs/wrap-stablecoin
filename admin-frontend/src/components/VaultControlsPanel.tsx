"use client";

import { useRef, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import AddressCell from "@/components/AddressCell";
import { readKeypairFile } from "@/lib/signLocalTx";
import { useClientConfig } from "@/providers/ClientConfigProvider";
import { useGovernanceStore } from "@/stores/governanceStore";
import type { ActionResult } from "@/stores/types";
import { useVaultStore } from "@/stores/vaultStore";
import PageHeading from "@/components/layout/PageHeading";
import { adminCopy } from "@/theme/copy";
import { cardSx } from "@/theme/tokens";

const DISABLE_WRAP = adminCopy.disableWrapPhrase;

function notify(enqueueSnackbar: ReturnType<typeof useSnackbar>["enqueueSnackbar"]) {
  return (result: ActionResult<{ signature: string }>, okLabel: string) => {
    if (result.ok) {
      enqueueSnackbar(`${okLabel} — ${result.data.signature.slice(0, 8)}…`, {
        variant: "success",
      });
    } else {
      enqueueSnackbar(result.error, { variant: "error" });
    }
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ ...cardSx, mb: 0 }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function KeypairAccept({
  disabled,
  confirmPhrase,
  onAccept,
}: {
  disabled: boolean;
  confirmPhrase?: string;
  onAccept: (secretKey: Uint8Array) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [reading, setReading] = useState(false);
  const confirmOk = confirmPhrase == null || confirm === confirmPhrase;

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      {confirmPhrase != null && (
        <TextField
          size="small"
          label={adminCopy.disableWrapConfirmLabel}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
      )}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          component="label"
          disabled={disabled}
        >
          {adminCopy.keypairFile}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setFileName(next?.name ?? null);
            }}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          {fileName ?? "No file selected"}
        </Typography>
        <Button
          size="small"
          variant="contained"
          color={confirmPhrase ? "error" : "primary"}
          disabled={disabled || reading || !file || !confirmOk}
          onClick={async () => {
            if (!file) return;
            setReading(true);
            try {
              const secretKey = await readKeypairFile(file);
              await onAccept(secretKey);
              setFile(null);
              setFileName(null);
              setConfirm("");
              if (fileRef.current) fileRef.current.value = "";
            } finally {
              setReading(false);
            }
          }}
        >
          {confirmPhrase ? adminCopy.acceptMintAuthority : adminCopy.acceptAdmin}
        </Button>
      </Stack>
    </Stack>
  );
}

export default function VaultControlsPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const config = useClientConfig();
  const report = notify(enqueueSnackbar);

  const meta = useVaultStore((s) => s.meta);
  const busy = useGovernanceStore((s) => s.busy);
  const allowlistMember = useGovernanceStore((s) => s.allowlistMember);
  const newAdmin = useGovernanceStore((s) => s.newAdmin);
  const newMintAuthority = useGovernanceStore((s) => s.newMintAuthority);
  const setAllowlistMember = useGovernanceStore((s) => s.setAllowlistMember);
  const setNewAdmin = useGovernanceStore((s) => s.setNewAdmin);
  const setNewMintAuthority = useGovernanceStore((s) => s.setNewMintAuthority);

  if (!meta) return null;

  const locked = busy != null;
  const allowlistReady = meta.allowlist != null;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: 2 }}>
        <PageHeading
          label={adminCopy.vaultNav}
          title={adminCopy.vaultControls}
          description={adminCopy.vaultControlsSubtitle}
        />
      </Box>

      {meta.mintAuthorityTransferred && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {adminCopy.wrapPermanentlyDisabled}
        </Alert>
      )}

      <Stack spacing={2}>
        <Section title="Access">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
            <FormControlLabel
              control={
                <Switch
                  checked={meta.paused}
                  disabled={locked}
                  onChange={async (e) => {
                    report(
                      await useGovernanceStore.getState().setPaused(e.target.checked),
                      e.target.checked ? "Paused" : "Unpaused",
                    );
                  }}
                />
              }
              label={adminCopy.pauseLabel}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={meta.wrapPublic}
                  disabled={locked}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    if (!next) {
                      const empty =
                        meta.allowlist == null || meta.allowlist.length === 0;
                      if (empty && !window.confirm(adminCopy.privateFlagConfirm)) {
                        return;
                      }
                    }
                    report(
                      await useGovernanceStore.getState().setWrapPublic(next),
                      next ? "Wrap public" : "Wrap allowlist-only",
                    );
                  }}
                />
              }
              label={adminCopy.wrapPublicLabel}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={meta.unwrapPublic}
                  disabled={locked}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    if (!next) {
                      const empty =
                        meta.allowlist == null || meta.allowlist.length === 0;
                      if (empty && !window.confirm(adminCopy.privateFlagConfirm)) {
                        return;
                      }
                    }
                    report(
                      await useGovernanceStore.getState().setUnwrapPublic(next),
                      next ? "Unwrap public" : "Unwrap allowlist-only",
                    );
                  }}
                />
              }
              label={adminCopy.unwrapPublicLabel}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 0.5 }}>
            Admin
          </Typography>
          <AddressCell address={meta.admin} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 0.5 }}>
            {adminCopy.vaultConfig}
          </Typography>
          <AddressCell address={meta.vaultConfig} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, mb: 0.5 }}>
            {adminCopy.programId}
          </Typography>
          <AddressCell address={meta.programId} />
        </Section>

        <Section title={adminCopy.allowlistTitle}>
          {!allowlistReady ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {adminCopy.allowlistMissing}
              </Typography>
              <Box>
                <Button
                  size="small"
                  variant="contained"
                  disabled={locked}
                  onClick={async () => {
                    report(
                      await useGovernanceStore.getState().initAllowlist(),
                      "Allowlist initialized",
                    );
                  }}
                >
                  {busy === "initAllowlist" ? "…" : adminCopy.initAllowlist}
                </Button>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {adminCopy.allowlistCount((meta.allowlist ?? []).length, 64)} — {adminCopy.allowlistCapHint}
              </Typography>
              {(meta.allowlist ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {adminCopy.allowlistEmpty}
                </Typography>
              ) : (
                (meta.allowlist ?? []).map((member) => (
                  <Stack
                    key={member}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <AddressCell address={member} />
                    <Button
                      size="small"
                      color="warning"
                      disabled={locked}
                      onClick={async () => {
                        report(
                          await useGovernanceStore.getState().removeFromAllowlist(member),
                          "Removed from allowlist",
                        );
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                ))
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                <TextField
                  size="small"
                  label={adminCopy.allowlistPubkey}
                  value={allowlistMember}
                  onChange={(e) => setAllowlistMember(e.target.value)}
                  disabled={locked || (meta.allowlist ?? []).length >= 64}
                  fullWidth
                  multiline
                  minRows={3}
                  sx={{ fontFamily: 'var(--font-dm-mono), "DM Mono", monospace' }}
                />
                <Button
                  size="small"
                  variant="contained"
                  disabled={locked || (meta.allowlist ?? []).length >= 64}
                  onClick={async () => {
                    const result = await useGovernanceStore.getState().addToAllowlist();
                    if (result.ok) {
                      enqueueSnackbar(
                        `Added ${result.data.count} — ${result.data.signature.slice(0, 8)}…`,
                        { variant: "success" },
                      );
                    } else {
                      enqueueSnackbar(result.error, { variant: "error" });
                    }
                  }}
                >
                  {adminCopy.addAllowlistMember}
                </Button>
              </Stack>
            </Stack>
          )}
        </Section>

        <Section title={adminCopy.adminTransferTitle}>
          {meta.pendingAdmin ? (
            <Stack spacing={1}>
              <Typography variant="body2" component="div">
                {adminCopy.pendingAdmin}
              </Typography>
              <AddressCell address={meta.pendingAdmin} />
              <Box>
                <Button
                  size="small"
                  color="warning"
                  disabled={locked}
                  onClick={async () => {
                    report(
                      await useGovernanceStore.getState().cancelTransferAuthority(),
                      "Admin transfer cancelled",
                    );
                  }}
                >
                  {adminCopy.cancelAdminTransfer}
                </Button>
              </Box>
              <KeypairAccept
                disabled={locked}
                onAccept={async (secretKey) => {
                  report(
                    await useGovernanceStore.getState().acceptAuthority({
                      secretKey,
                      rpcUrl: config.solana.rpcUrl,
                    }),
                    "Admin transfer accepted",
                  );
                }}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label={adminCopy.newAdminPubkey}
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                disabled={locked}
                fullWidth
              />
              <Button
                size="small"
                variant="contained"
                disabled={locked}
                onClick={async () => {
                  report(
                    await useGovernanceStore.getState().transferAuthority(),
                    "Admin transfer proposed",
                  );
                }}
              >
                {adminCopy.proposeAdmin}
              </Button>
            </Stack>
          )}
        </Section>

        <Section title={adminCopy.mintAuthorityTitle}>
          {meta.mintAuthorityTransferred ? (
            <Typography variant="body2" color="text.secondary">
              {adminCopy.wrapPermanentlyDisabled}
            </Typography>
          ) : meta.pendingMintAuthority ? (
            <Stack spacing={1}>
              <Alert severity="warning">{adminCopy.mintAuthorityAcceptWarning}</Alert>
              <Typography variant="body2" component="div">
                {adminCopy.pendingMintAuthority}
              </Typography>
              <AddressCell address={meta.pendingMintAuthority} />
              <Box>
                <Button
                  size="small"
                  color="warning"
                  disabled={locked}
                  onClick={async () => {
                    report(
                      await useGovernanceStore.getState().cancelProposeMintAuthority(),
                      "Mint authority proposal cancelled",
                    );
                  }}
                >
                  {adminCopy.cancelMintAuthority}
                </Button>
              </Box>
              <KeypairAccept
                disabled={locked}
                confirmPhrase={DISABLE_WRAP}
                onAccept={async (secretKey) => {
                  report(
                    await useGovernanceStore.getState().acceptMintAuthority({
                      secretKey,
                      rpcUrl: config.solana.rpcUrl,
                    }),
                    "Mint authority accepted — wrap disabled",
                  );
                }}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label={adminCopy.newMintAuthorityPubkey}
                value={newMintAuthority}
                onChange={(e) => setNewMintAuthority(e.target.value)}
                disabled={locked || meta.mintAuthorityTransferred}
                fullWidth
              />
              <Button
                size="small"
                variant="contained"
                disabled={locked || meta.mintAuthorityTransferred}
                onClick={async () => {
                  report(
                    await useGovernanceStore.getState().proposeMintAuthority(),
                    "Mint authority proposed",
                  );
                }}
              >
                {adminCopy.proposeMintAuthority}
              </Button>
            </Stack>
          )}
        </Section>
      </Stack>
    </Box>
  );
}
