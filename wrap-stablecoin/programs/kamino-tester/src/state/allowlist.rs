use anchor_lang::prelude::*;

pub const MAX_ALLOWED: usize = 64;

#[account]
#[derive(InitSpace)]
pub struct Allowlist {
    pub bump: u8,
    #[max_len(MAX_ALLOWED)]
    pub allowed: Vec<Pubkey>,
}

impl Allowlist {
    pub fn contains(&self, key: &Pubkey) -> bool {
        self.allowed.iter().any(|k| k == key)
    }
}
