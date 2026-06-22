pub fn flash_mint_start(ctx: Context<FlashMintStart>, args: FlashMintStartArgs) -> Result<()> {
    require!(args.amount > 0, ErrorCode::InvalidAmount);

    let vault_config = &ctx.accounts.vault_config;
    let vault_config_key = vault_config.key();

    if vault_config.flash_mint_max_amount > 0 {
        require!(
            args.amount <= vault_config.flash_mint_max_amount,
            ErrorCode::FlashMintAmountExceeded
        );
    }

    verify_flash_mint_end_exists(
        &ctx.accounts.instruction_sysvar,
        &ctx.accounts.borrower.key(),
        &vault_config_key,
        &ctx.accounts.flash_loan_state.key(),
        &ctx.accounts.wrapped_mint.key(),
        ctx.program_id,
    )?;

    let fee = args
        .amount
        .checked_mul(vault_config.flash_mint_fee_bps as u64)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)?;

    if fee > 0 {
        require!(
            vault_config.flash_mint_fee_receiver != Pubkey::default(),
            ErrorCode::FlashMintFeeReceiverUnset
        );
    }

    let flash_loan_state = &mut ctx.accounts.flash_loan_state;
    flash_loan_state.bump = ctx.bumps.flash_loan_state;
    flash_loan_state.borrower = ctx.accounts.borrower.key();
    flash_loan_state.vault_config = vault_config_key;
    flash_loan_state.amount = args.amount;
    flash_loan_state.fee = fee;

    let authority_seeds: &[&[u8]] = &[
        crate::pda_seeds::VAULT_AUTHORITY_SEED,
        vault_config_key.as_ref(),
        &[vault_config.vault_authority_bump],
    ];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wrapped_mint.to_account_info(),
                to: ctx.accounts.borrower_wrapped.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[authority_seeds],
        ),
        args.amount,
    )?;

    emit!(FlashMintStarted {
        borrower: ctx.accounts.borrower.key(),
        amount: args.amount,
        fee,
    });
    Ok(())
}

pub fn flash_mint_end(ctx: Context<FlashMintEnd>) -> Result<()> {
    let flash_loan_state = &ctx.accounts.flash_loan_state;
    let amount = flash_loan_state.amount;
    let fee = flash_loan_state.fee;

    let total_repayment = amount.checked_add(fee).ok_or(ErrorCode::MathOverflow)?;

    require!(
        ctx.accounts.borrower_wrapped.amount >= total_repayment,
        ErrorCode::InsufficientRepayment
    );

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.wrapped_mint.to_account_info(),
                from: ctx.accounts.borrower_wrapped.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        ),
        amount,
    )?;

    if fee > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.borrower_wrapped.to_account_info(),
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.fee_receiver.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            ),
            fee,
            ctx.accounts.wrapped_mint.decimals,
        )?;
    }

    emit!(FlashMintEnded {
        borrower: ctx.accounts.borrower.key(),
        amount,
        fee,
    });
    Ok(())
}

pub fn set_flash_mint_fee(ctx: Context<SetFlashMintFee>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 10000, ErrorCode::InvalidFlashMintFee);

    let old_fee = ctx.accounts.vault_config.flash_mint_fee_bps;
    ctx.accounts.vault_config.flash_mint_fee_bps = fee_bps;

    msg!("Flash mint fee updated from {} to {} bps", old_fee, fee_bps);
    Ok(())
}

pub fn set_flash_mint_enabled(ctx: Context<SetFlashMintEnabled>, enabled: bool) -> Result<()> {
    ctx.accounts.vault_config.flash_mint_enabled = enabled;
    msg!("Flash mint enabled set to: {}", enabled);
    Ok(())
}

pub fn set_flash_mint_max_amount(
    ctx: Context<SetFlashMintMaxAmount>,
    max_amount: u64,
) -> Result<()> {
    let old = ctx.accounts.vault_config.flash_mint_max_amount;
    ctx.accounts.vault_config.flash_mint_max_amount = max_amount;
    msg!(
        "Flash mint max amount updated from {} to {} (0 = no limit)",
        old,
        max_amount
    );
    Ok(())
}

pub fn set_flash_mint_fee_receiver(ctx: Context<SetFlashMintFeeReceiver>) -> Result<()> {
    let new_receiver = ctx.accounts.fee_receiver.key();
    let old = ctx.accounts.vault_config.flash_mint_fee_receiver;
    ctx.accounts.vault_config.flash_mint_fee_receiver = new_receiver;
    msg!(
        "Flash mint fee receiver updated from {} to {}",
        old,
        new_receiver
    );
    Ok(())
}
