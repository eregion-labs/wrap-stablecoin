use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signer;
use std::str::FromStr;
use utoipa::ToSchema;
use wrap_stablecoin::UpdateAssetPolicyArgs;

use crate::app_state::AppState;
use crate::routes::network::RequestNetwork;
use crate::tx_submit::sign_and_send_versioned_tx;
use crate::routes::tx::TxResponse;
use crate::wrap_stablecoin::{
    parse_asset_status, unsigned_accept_authority_tx_bytes, unsigned_accept_mint_authority_tx_bytes,
    unsigned_add_asset_tx_bytes, unsigned_add_to_allowlist_tx_bytes,
    unsigned_cancel_propose_mint_authority_tx_bytes, unsigned_cancel_transfer_authority_tx_bytes,
    unsigned_deposit_all_to_klend_tx_bytes, unsigned_deposit_to_klend_tx_bytes,
    unsigned_enable_klend_tx_bytes, unsigned_harvest_yield_tx_bytes,
    unsigned_init_allowlist_tx_bytes, unsigned_propose_mint_authority_tx_bytes,
    unsigned_remove_from_allowlist_tx_bytes, unsigned_set_paused_tx_bytes,
    unsigned_set_unwrap_public_tx_bytes, unsigned_set_wrap_public_tx_bytes,
    unsigned_sweep_home_surplus_tx_bytes, unsigned_transfer_authority_tx_bytes,
    unsigned_unwrap_tx_bytes, unsigned_update_asset_policy_tx_bytes,
    unsigned_withdraw_all_from_klend_tx_bytes, unsigned_withdraw_from_klend_tx_bytes,
    unsigned_withdraw_treasury_tx_bytes, unsigned_wrap_tx_bytes,
};

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    pub signature: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterAssetRequest {
    pub asset_mint: String,
    #[serde(default = "default_true")]
    pub mint_enabled: bool,
    #[serde(default = "default_true")]
    pub redeem_enabled: bool,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetPolicyBody {
    pub asset_mint: String,
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    pub mint_haircut_bps: u16,
    pub redemption_haircut_bps: u16,
    pub mint_cap: u64,
    pub exposure_cap: u64,
    pub min_liquidity_target: u64,
    pub asset_status: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminMintRequest {
    pub amount: u64,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminRedeemRequest {
    pub amount: u64,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssetMintBody {
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AmountAssetBody {
    pub amount: u64,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollateralAmountBody {
    pub collateral_amount: u64,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawTreasuryBody {
    pub amount: u64,
    pub destination: String,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoolFlagBody {
    pub value: bool,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PubkeyBody {
    pub pubkey: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddToAllowlistBody {
    #[serde(default)]
    pub pubkey: Option<String>,
    #[serde(default)]
    pub pubkeys: Option<Vec<String>>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddAllowlistResponse {
    pub signature: String,
    pub count: u32,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransferAuthorityBody {
    pub new_admin: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposeMintAuthorityBody {
    pub new_mint_authority: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnableKlendBody {
    pub asset_mint: Option<String>,
    pub lending_market: String,
    pub reserve: String,
    pub reserve_liquidity_supply: String,
    pub collateral_mint: String,
}

fn default_true() -> bool {
    true
}

fn b64_encode_tx(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn execute_raw(
    ctx: &crate::app_state::NetworkContext,
    kp: &solana_sdk::signature::Keypair,
    raw: Result<Vec<u8>, anyhow::Error>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let raw = raw.map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

fn unsigned_tx_response(
    raw: Result<Vec<u8>, anyhow::Error>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let raw = raw.map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}

fn require_admin_keypair(
    state: &AppState,
    network: crate::app_state::SolanaNetwork,
) -> Result<(Arc<solana_sdk::signature::Keypair>, &crate::app_state::NetworkContext), (axum::http::StatusCode, String)>
{
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let kp = ctx.admin_keypair.clone().ok_or_else(|| {
        (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            format!(
                "admin keypair not configured for `{network}` — set ADMIN_KEYPAIR_PATH"
            ),
        )
    })?;
    Ok((kp, ctx))
}

fn parse_mint(s: &str, field: &str) -> Result<Pubkey, (axum::http::StatusCode, String)> {
    Pubkey::from_str(s).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid {field}: {e}"),
        )
    })
}

/// Register collateral using the server-held vault admin keypair.
#[utoipa::path(
    post,
    path = "/v1/admin/register-asset",
    request_body = RegisterAssetRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn register_asset(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<RegisterAssetRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = parse_mint(&body.asset_mint, "assetMint")?;

    let raw = unsigned_add_asset_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.mint_enabled,
        body.redeem_enabled,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Update on-chain asset policy using the server-held vault admin keypair.
#[utoipa::path(
    post,
    path = "/v1/admin/update-asset-policy",
    request_body = UpdateAssetPolicyBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn update_asset_policy(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<UpdateAssetPolicyBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = parse_mint(&body.asset_mint, "assetMint")?;
    let asset_status = parse_asset_status(&body.asset_status)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let args = UpdateAssetPolicyArgs {
        mint_enabled: body.mint_enabled,
        redeem_enabled: body.redeem_enabled,
        mint_haircut_bps: body.mint_haircut_bps,
        redemption_haircut_bps: body.redemption_haircut_bps,
        mint_cap: body.mint_cap,
        exposure_cap: body.exposure_cap,
        min_liquidity_target: body.min_liquidity_target,
        asset_status,
    };

    let raw = unsigned_update_asset_policy_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        &args,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Wrap collateral from the admin wallet into the wrapped token (issue).
#[utoipa::path(
    post,
    path = "/v1/admin/mint",
    request_body = AdminMintRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn admin_mint(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AdminMintRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;

    let raw = unsigned_wrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Burn wrapped token from the admin wallet and receive underlying (redeem).
#[utoipa::path(
    post,
    path = "/v1/admin/redeem",
    request_body = AdminRedeemRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn admin_redeem(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AdminRedeemRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;

    let raw = unsigned_unwrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

fn resolve_mint(
    ctx: &crate::app_state::NetworkContext,
    asset_mint: Option<&str>,
) -> Result<Pubkey, (axum::http::StatusCode, String)> {
    ctx.resolve_asset_mint(asset_mint)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

/// Deploy `amount` of home-vault liquidity into Kamino for the asset.
#[utoipa::path(
    post,
    path = "/v1/admin/deposit-to-klend",
    request_body = AmountAssetBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn deposit_to_klend(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AmountAssetBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_deposit_to_klend_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        body.amount,
        &state.klend_scope_prices,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Deploy `token_vault − cushion` into Kamino.
#[utoipa::path(
    post,
    path = "/v1/admin/deposit-all-to-klend",
    request_body = AssetMintBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn deposit_all_to_klend(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AssetMintBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_deposit_all_to_klend_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        &state.klend_scope_prices,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Recall `collateralAmount` kTokens from Kamino into the home vault.
#[utoipa::path(
    post,
    path = "/v1/admin/withdraw-from-klend",
    request_body = CollateralAmountBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn withdraw_from_klend(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<CollateralAmountBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_withdraw_from_klend_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        body.collateral_amount,
        &state.klend_scope_prices,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Recall the full Kamino position into the home vault.
#[utoipa::path(
    post,
    path = "/v1/admin/withdraw-all-from-klend",
    request_body = AssetMintBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn withdraw_all_from_klend(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AssetMintBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_withdraw_all_from_klend_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        &state.klend_scope_prices,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Harvest Kamino surplus into `treasury_vault`. Amount is kToken collateral atoms; on-chain caps it.
#[utoipa::path(
    post,
    path = "/v1/admin/harvest-yield",
    request_body = CollateralAmountBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn harvest_yield(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<CollateralAmountBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_harvest_yield_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        body.collateral_amount,
        &state.klend_scope_prices,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Move home-vault surplus above liability + cushion into `treasury_vault`.
#[utoipa::path(
    post,
    path = "/v1/admin/sweep-home-surplus",
    request_body = AmountAssetBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn sweep_home_surplus(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AmountAssetBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let raw = unsigned_sweep_home_surplus_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Send treasury tokens to `destination` (wallet; ATA is created if missing).
#[utoipa::path(
    post,
    path = "/v1/admin/withdraw-treasury",
    request_body = WithdrawTreasuryBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn withdraw_treasury(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<WithdrawTreasuryBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let destination = parse_mint(&body.destination, "destination")?;
    let raw = unsigned_withdraw_treasury_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &kp.pubkey(),
        &asset_mint,
        body.amount,
        &destination,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Set the global vault pause flag.
#[utoipa::path(
    post,
    path = "/v1/admin/set-paused",
    request_body = BoolFlagBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn set_paused(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<BoolFlagBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_set_paused_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            body.value,
        ),
    )
}

/// Set whether wrap is public (false requires allowlist).
#[utoipa::path(
    post,
    path = "/v1/admin/set-wrap-public",
    request_body = BoolFlagBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn set_wrap_public(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<BoolFlagBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_set_wrap_public_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            body.value,
        ),
    )
}

/// Set whether unwrap is public (false requires allowlist).
#[utoipa::path(
    post,
    path = "/v1/admin/set-unwrap-public",
    request_body = BoolFlagBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn set_unwrap_public(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<BoolFlagBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_set_unwrap_public_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            body.value,
        ),
    )
}

/// Initialize the vault allowlist PDA (once).
#[utoipa::path(
    post,
    path = "/v1/admin/init-allowlist",
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn init_allowlist(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_init_allowlist_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
        ),
    )
}

/// Add one or more wallets to the wrap/unwrap allowlist (max 64 on-chain).
#[utoipa::path(
    post,
    path = "/v1/admin/add-to-allowlist",
    request_body = AddToAllowlistBody,
    responses((status = 200, body = AddAllowlistResponse), (status = 400), (status = 503))
)]
pub async fn add_to_allowlist(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AddToAllowlistBody>,
) -> Result<Json<AddAllowlistResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let mut members: Vec<Pubkey> = Vec::new();
    if let Some(pk) = body.pubkey.as_deref().filter(|s| !s.trim().is_empty()) {
        members.push(parse_mint(pk, "pubkey")?);
    }
    if let Some(list) = body.pubkeys {
        for (i, pk) in list.iter().enumerate() {
            if pk.trim().is_empty() {
                continue;
            }
            members.push(parse_mint(pk, &format!("pubkeys[{i}]"))?);
        }
    }
    if members.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "pubkey or pubkeys is required".to_string(),
        ));
    }
    let mut seen = std::collections::HashSet::new();
    members.retain(|pk| seen.insert(*pk));
    if members.len() > wrap_stablecoin::state::MAX_ALLOWED {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            format!(
                "allowlist max is {} wallets",
                wrap_stablecoin::state::MAX_ALLOWED
            ),
        ));
    }

    let mut last_sig = String::new();
    let mut count = 0u32;
    for member in &members {
        let raw = unsigned_add_to_allowlist_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            member,
        );
        match execute_raw(ctx, kp.as_ref(), raw) {
            Ok(Json(resp)) => {
                last_sig = resp.signature;
                count += 1;
            }
            Err(e) => {
                if count == 0 {
                    return Err(e);
                }
                return Err((
                    e.0,
                    format!("added {count} then failed on {member}: {}", e.1),
                ));
            }
        }
    }
    Ok(Json(AddAllowlistResponse {
        signature: last_sig,
        count,
    }))
}

/// Remove a wallet from the wrap/unwrap allowlist.
#[utoipa::path(
    post,
    path = "/v1/admin/remove-from-allowlist",
    request_body = PubkeyBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn remove_from_allowlist(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<PubkeyBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let member = parse_mint(&body.pubkey, "pubkey")?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_remove_from_allowlist_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            &member,
        ),
    )
}

/// Propose a two-step admin transfer (`pending_admin`).
#[utoipa::path(
    post,
    path = "/v1/admin/transfer-authority",
    request_body = TransferAuthorityBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn transfer_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<TransferAuthorityBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let new_admin = parse_mint(&body.new_admin, "newAdmin")?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_transfer_authority_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            &new_admin,
        ),
    )
}

/// Cancel a pending admin transfer.
#[utoipa::path(
    post,
    path = "/v1/admin/cancel-transfer-authority",
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn cancel_transfer_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_cancel_transfer_authority_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
        ),
    )
}

/// Unsigned `accept_authority` tx. Signer must be `pending_admin`. Secret never hits this server.
#[utoipa::path(
    post,
    path = "/v1/admin/accept-authority/tx",
    responses((status = 200, body = TxResponse), (status = 400))
)]
pub async fn accept_authority_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    unsigned_tx_response(unsigned_accept_authority_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    ))
}

/// Execute `accept_authority` when `ADMIN_KEYPAIR` is the pending destination.
#[utoipa::path(
    post,
    path = "/v1/admin/accept-authority",
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn accept_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let raw = unsigned_accept_authority_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let vtx: solana_sdk::transaction::VersionedTransaction = bincode::deserialize(&raw)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let payer = vtx
        .message
        .static_account_keys()
        .first()
        .copied()
        .ok_or_else(|| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                "accept_authority tx has no fee payer".to_string(),
            )
        })?;
    if payer != kp.pubkey() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            format!(
                "admin keypair is not the pending destination ({payer}); use POST /v1/admin/accept-authority/tx"
            ),
        ));
    }
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Enable Kamino for a registered asset (one-shot).
#[utoipa::path(
    post,
    path = "/v1/admin/enable-klend",
    request_body = EnableKlendBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn enable_klend(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<EnableKlendBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let asset_mint = resolve_mint(ctx, body.asset_mint.as_deref())?;
    let lending_market = parse_mint(&body.lending_market, "lendingMarket")?;
    let reserve = parse_mint(&body.reserve, "reserve")?;
    let reserve_liquidity_supply =
        parse_mint(&body.reserve_liquidity_supply, "reserveLiquiditySupply")?;
    let collateral_mint = parse_mint(&body.collateral_mint, "collateralMint")?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_enable_klend_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            &asset_mint,
            &lending_market,
            &reserve,
            &reserve_liquidity_supply,
            &collateral_mint,
        ),
    )
}

/// Propose transferring SPL mint authority (permanently disables wrap on accept).
#[utoipa::path(
    post,
    path = "/v1/admin/propose-mint-authority",
    request_body = ProposeMintAuthorityBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn propose_mint_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<ProposeMintAuthorityBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let new_mint_authority = parse_mint(&body.new_mint_authority, "newMintAuthority")?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_propose_mint_authority_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
            &new_mint_authority,
        ),
    )
}

/// Cancel a pending mint-authority proposal.
#[utoipa::path(
    post,
    path = "/v1/admin/cancel-propose-mint-authority",
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn cancel_propose_mint_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    execute_raw(
        ctx,
        kp.as_ref(),
        unsigned_cancel_propose_mint_authority_tx_bytes(
            ctx.rpc.as_ref(),
            &ctx.program_id,
            &ctx.vault_authority_seed,
            &kp.pubkey(),
        ),
    )
}

/// Unsigned `accept_mint_authority` tx. Signer must be `pending_mint_authority`. Permanently disables wrap.
#[utoipa::path(
    post,
    path = "/v1/admin/accept-mint-authority/tx",
    responses((status = 200, body = TxResponse), (status = 400))
)]
pub async fn accept_mint_authority_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    unsigned_tx_response(unsigned_accept_mint_authority_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    ))
}

/// Execute `accept_mint_authority` when `ADMIN_KEYPAIR` is the pending destination. Permanently disables wrap.
#[utoipa::path(
    post,
    path = "/v1/admin/accept-mint-authority",
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn accept_mint_authority(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let raw = unsigned_accept_mint_authority_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let vtx: solana_sdk::transaction::VersionedTransaction = bincode::deserialize(&raw)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let payer = vtx
        .message
        .static_account_keys()
        .first()
        .copied()
        .ok_or_else(|| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                "accept_mint_authority tx has no fee payer".to_string(),
            )
        })?;
    if payer != kp.pubkey() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            format!(
                "admin keypair is not the pending mint authority ({payer}); use POST /v1/admin/accept-mint-authority/tx"
            ),
        ));
    }
    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}
