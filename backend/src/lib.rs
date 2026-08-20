use std::sync::Arc;

use axum::http::{header, Method};
use axum::middleware;
use axum::routing::post;
use axum::Router;
use tower_http::cors::{AllowOrigin, CorsLayer};
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod admin_wallet;
pub mod app_state;
pub mod config;
pub mod metaplex;
pub mod routes;
pub mod swagger_theme;
pub mod tx_submit;
pub mod wrap_stablecoin;

use crate::app_state::AppState;
use crate::routes::{admin, admin_ops, client_config, guard, ping, tx, vault};

#[derive(OpenApi)]
#[openapi(
    paths(
        ping::ping_handler,
        client_config::client_config_handler,
        tx::issue_tx,
        tx::redeem_tx,
        tx::preview_tx,
        admin::add_asset_tx,
        admin::update_asset_policy_tx,
        admin_ops::register_asset,
        admin_ops::update_asset_policy,
        admin_ops::admin_mint,
        admin_ops::admin_redeem,
        admin_ops::deposit_to_klend,
        admin_ops::deposit_all_to_klend,
        admin_ops::withdraw_from_klend,
        admin_ops::withdraw_all_from_klend,
        admin_ops::harvest_yield,
        admin_ops::sweep_home_surplus,
        admin_ops::withdraw_treasury,
        admin_ops::set_paused,
        admin_ops::set_wrap_public,
        admin_ops::set_unwrap_public,
        admin_ops::init_allowlist,
        admin_ops::add_to_allowlist,
        admin_ops::remove_from_allowlist,
        admin_ops::transfer_authority,
        admin_ops::cancel_transfer_authority,
        admin_ops::accept_authority_tx,
        admin_ops::accept_authority,
        admin_ops::enable_klend,
        admin_ops::propose_mint_authority,
        admin_ops::cancel_propose_mint_authority,
        admin_ops::accept_mint_authority_tx,
        admin_ops::accept_mint_authority,
        vault::vault_assets,
        vault::vault_meta,
        vault::token_holders,
        vault::redeem_quote_handler,
        vault::issue_quote_handler,
    ),
    components(schemas(
        crate::config::PublicClientConfig,
        crate::config::public_client_config::PublicSolanaConfig,
        crate::config::public_client_config::PublicProgramIds,
        crate::config::public_client_config::PublicAssetsConfig,
        crate::config::public_client_config::PublicFeaturesConfig,
        crate::config::public_client_config::PublicCapabilities,
        crate::config::public_client_config::PublicLinksConfig,
        tx::IssueRequest,
        tx::RedeemRequest,
        tx::PreviewRequest,
        tx::TxResponse,
        tx::PreviewResponse,
        admin::AddAssetRequest,
        admin::UpdateAssetPolicyRequest,
        admin_ops::ExecuteResponse,
        admin_ops::RegisterAssetRequest,
        admin_ops::UpdateAssetPolicyBody,
        admin_ops::AdminMintRequest,
        admin_ops::AdminRedeemRequest,
        admin_ops::AssetMintBody,
        admin_ops::AmountAssetBody,
        admin_ops::CollateralAmountBody,
        admin_ops::WithdrawTreasuryBody,
        admin_ops::BoolFlagBody,
        admin_ops::PubkeyBody,
        admin_ops::AddToAllowlistBody,
        admin_ops::AddAllowlistResponse,
        admin_ops::TransferAuthorityBody,
        admin_ops::ProposeMintAuthorityBody,
        admin_ops::EnableKlendBody,
        vault::VaultAssetsResponse,
        vault::VaultMetaResponse,
        vault::TokenHoldersResponse,
        vault::RedeemQuoteQuery,
        vault::IssueQuoteQuery,
        crate::wrap_stablecoin::VaultAssetView,
        crate::wrap_stablecoin::VaultMetaView,
        crate::wrap_stablecoin::TokenHoldersView,
        crate::wrap_stablecoin::RedeemQuoteView,
        crate::wrap_stablecoin::IssueQuoteView,
        crate::metaplex::MintMetadata,
    )),
    tags(
        (name = "health", description = "Health check"),
        (name = "transactions", description = "Unsigned Solana transactions"),
    ),
    info(
        title = "Florin API",
        version = "0.1.0",
        description = "Issue and redeem Florin against reserve collateral, and execute treasury vault operations."
    )
)]
struct ApiDoc;

pub fn app(state: Arc<AppState>) -> Router {
    // Exact-origin allowlist, not a wildcard: `/v1/admin/*` signs with the vault admin key,
    // and a permissive policy would let any page a browser visits drive a backend bound to
    // localhost or a private network. `Authorization` must be allowed for the admin console's
    // bearer token to survive preflight.
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(state.allowed_origins.clone()))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    // Guarded routes: optional `x-solana-network` must match primary (or omit header).
    let tx_router: Router<Arc<AppState>> = Router::new()
        .route("/issue", post(tx::issue_tx))
        .route("/redeem", post(tx::redeem_tx))
        .route("/preview", post(tx::preview_tx))
        .route("/admin/add-asset", post(admin::add_asset_tx))
        .route(
            "/admin/update-asset-policy",
            post(admin::update_asset_policy_tx),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let admin_router: Router<Arc<AppState>> = Router::new()
        .route("/register-asset", post(admin_ops::register_asset))
        .route("/update-asset-policy", post(admin_ops::update_asset_policy))
        .route("/mint", post(admin_ops::admin_mint))
        .route("/redeem", post(admin_ops::admin_redeem))
        .route("/deposit-to-klend", post(admin_ops::deposit_to_klend))
        .route(
            "/deposit-all-to-klend",
            post(admin_ops::deposit_all_to_klend),
        )
        .route("/withdraw-from-klend", post(admin_ops::withdraw_from_klend))
        .route(
            "/withdraw-all-from-klend",
            post(admin_ops::withdraw_all_from_klend),
        )
        .route("/harvest-yield", post(admin_ops::harvest_yield))
        .route("/sweep-home-surplus", post(admin_ops::sweep_home_surplus))
        .route("/withdraw-treasury", post(admin_ops::withdraw_treasury))
        .route("/set-paused", post(admin_ops::set_paused))
        .route("/set-wrap-public", post(admin_ops::set_wrap_public))
        .route("/set-unwrap-public", post(admin_ops::set_unwrap_public))
        .route("/init-allowlist", post(admin_ops::init_allowlist))
        .route("/add-to-allowlist", post(admin_ops::add_to_allowlist))
        .route(
            "/remove-from-allowlist",
            post(admin_ops::remove_from_allowlist),
        )
        .route("/transfer-authority", post(admin_ops::transfer_authority))
        .route(
            "/cancel-transfer-authority",
            post(admin_ops::cancel_transfer_authority),
        )
        .route("/accept-authority/tx", post(admin_ops::accept_authority_tx))
        .route("/accept-authority", post(admin_ops::accept_authority))
        .route("/enable-klend", post(admin_ops::enable_klend))
        .route(
            "/propose-mint-authority",
            post(admin_ops::propose_mint_authority),
        )
        .route(
            "/cancel-propose-mint-authority",
            post(admin_ops::cancel_propose_mint_authority),
        )
        .route(
            "/accept-mint-authority/tx",
            post(admin_ops::accept_mint_authority_tx),
        )
        .route(
            "/accept-mint-authority",
            post(admin_ops::accept_mint_authority),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ))
        // Outermost: reject unauthenticated callers before any RPC work happens. Every
        // route above is signed with the vault admin keypair.
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::admin_auth_guard,
        ));

    let vault_router: Router<Arc<AppState>> = Router::new()
        .route("/assets", axum::routing::get(vault::vault_assets))
        .route("/meta", axum::routing::get(vault::vault_meta))
        .route("/token-holders", axum::routing::get(vault::token_holders))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let quote_router: Router<Arc<AppState>> = Router::new()
        .route("/redeem", axum::routing::get(vault::redeem_quote_handler))
        .route("/issue", axum::routing::get(vault::issue_quote_handler))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let (_, api) = OpenApiRouter::<Arc<AppState>>::with_openapi(ApiDoc::openapi())
        .route("/ping", axum::routing::get(ping::ping_handler))
        .route(
            "/v1/client-config",
            axum::routing::get(client_config::client_config_handler),
        )
        .route("/v1/tx/issue", post(tx::issue_tx))
        .route("/v1/tx/redeem", post(tx::redeem_tx))
        .route("/v1/tx/preview", post(tx::preview_tx))
        .route("/v1/vault/assets", axum::routing::get(vault::vault_assets))
        .route("/v1/vault/meta", axum::routing::get(vault::vault_meta))
        .route(
            "/v1/vault/token-holders",
            axum::routing::get(vault::token_holders),
        )
        .route(
            "/v1/quote/redeem",
            axum::routing::get(vault::redeem_quote_handler),
        )
        .route(
            "/v1/quote/issue",
            axum::routing::get(vault::issue_quote_handler),
        )
        .split_for_parts();

    Router::new()
        .route("/ping", axum::routing::get(ping::ping_handler))
        .route(
            "/v1/client-config",
            axum::routing::get(client_config::client_config_handler),
        )
        .nest("/v1/tx", tx_router)
        .nest("/v1/admin", admin_router)
        .nest("/v1/vault", vault_router)
        .nest("/v1/quote", quote_router)
        .with_state(state)
        .merge(SwaggerUi::new("/doc").url("/api-docs/openapi.json", api))
        .layer(middleware::from_fn(swagger_theme::inject_florin_theme))
        .layer(cors)
}
