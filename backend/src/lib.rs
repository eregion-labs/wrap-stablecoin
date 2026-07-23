use std::sync::Arc;

use axum::routing::post;
use axum::Router;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod admin_wallet;
pub mod app_state;
pub mod config;
pub mod jupiter;
pub mod metaplex;
pub mod routes;
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
        tx::compose_tx,
        admin::add_asset_tx,
        admin::update_asset_policy_tx,
        admin_ops::register_asset,
        admin_ops::update_asset_policy,
        admin_ops::admin_mint,
        admin_ops::admin_redeem,
        vault::vault_assets,
        vault::vault_meta,
        vault::redeem_quote_handler,
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
        tx::ComposeRequest,
        tx::TxResponse,
        tx::PreviewResponse,
        tx::ComposeStep,
        admin::AddAssetRequest,
        admin::UpdateAssetPolicyRequest,
        admin_ops::ExecuteResponse,
        admin_ops::RegisterAssetRequest,
        admin_ops::UpdateAssetPolicyBody,
        admin_ops::AdminMintRequest,
        admin_ops::AdminRedeemRequest,
        vault::VaultAssetsResponse,
        vault::VaultMetaResponse,
        vault::RedeemQuoteQuery,
        crate::wrap_stablecoin::VaultAssetView,
        crate::wrap_stablecoin::VaultMetaView,
        crate::wrap_stablecoin::RedeemQuoteView,
        crate::metaplex::MintMetadata,
    )),
    tags(
        (name = "health", description = "Health check"),
        (name = "transactions", description = "Unsigned Solana transactions"),
    ),
    info(
        title = "Florin API",
        version = "0.1.0",
        description = "Build unsigned wrap / unwrap (issue / redeem) transactions; optional Jupiter composition."
    )
)]
struct ApiDoc;

pub fn app(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::very_permissive();

    // Guarded routes: optional `x-solana-network` must match primary (or omit header).
    let tx_router: Router<Arc<AppState>> = Router::new()
        .route("/issue", post(tx::issue_tx))
        .route("/redeem", post(tx::redeem_tx))
        .route("/preview", post(tx::preview_tx))
        .route("/compose", post(tx::compose_tx))
        .route("/admin/add-asset", post(admin::add_asset_tx))
        .route("/admin/update-asset-policy", post(admin::update_asset_policy_tx))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let admin_router: Router<Arc<AppState>> = Router::new()
        .route("/register-asset", post(admin_ops::register_asset))
        .route("/update-asset-policy", post(admin_ops::update_asset_policy))
        .route("/mint", post(admin_ops::admin_mint))
        .route("/redeem", post(admin_ops::admin_redeem))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let vault_router: Router<Arc<AppState>> = Router::new()
        .route("/assets", axum::routing::get(vault::vault_assets))
        .route("/meta", axum::routing::get(vault::vault_meta))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let quote_router: Router<Arc<AppState>> = Router::new()
        .route("/redeem", axum::routing::get(vault::redeem_quote_handler))
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
        .route("/v1/tx/compose", post(tx::compose_tx))
        .route("/v1/vault/assets", axum::routing::get(vault::vault_assets))
        .route("/v1/vault/meta", axum::routing::get(vault::vault_meta))
        .route("/v1/quote/redeem", axum::routing::get(vault::redeem_quote_handler))
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
        .layer(cors)
}
