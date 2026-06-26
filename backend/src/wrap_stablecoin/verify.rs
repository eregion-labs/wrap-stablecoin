use anyhow::{anyhow, Result};
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;

/// Returns `true` if any instruction in `vtx` targets `program_id`.
///
/// ALT-resolved keys are not inspected — program accounts must appear in the
/// static account key list, which is the case for all well-formed Solana
/// transactions (programs cannot be referenced via lookup tables).
pub fn tx_targets_program(vtx: &VersionedTransaction, program_id: &Pubkey) -> bool {
    let (keys, ix_program_indexes): (&[Pubkey], Vec<u8>) = match &vtx.message {
        VersionedMessage::Legacy(m) => (
            &m.account_keys,
            m.instructions
                .iter()
                .map(|ix| ix.program_id_index)
                .collect(),
        ),
        VersionedMessage::V0(m) => (
            &m.account_keys,
            m.instructions
                .iter()
                .map(|ix| ix.program_id_index)
                .collect(),
        ),
    };

    ix_program_indexes
        .into_iter()
        .any(|i| keys.get(i as usize) == Some(program_id))
}

/// Reject a transaction that does not invoke the wrap-stablecoin program. Every tx the
/// backend builds, previews, or returns must route through our program so a
/// client can never coerce the API into endorsing an unrelated transaction.
pub fn ensure_tx_targets_program(vtx: &VersionedTransaction, program_id: &Pubkey) -> Result<()> {
    if tx_targets_program(vtx, program_id) {
        Ok(())
    } else {
        Err(anyhow!(
            "transaction does not invoke wrap-stablecoin program {program_id}"
        ))
    }
}
