use anchor_lang::prelude::*;

declare_id!("5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT");

#[program]
pub mod kamino_tester {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
