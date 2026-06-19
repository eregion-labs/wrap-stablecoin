use std::sync::Arc;

use axum::routing::post;
use axum::Router;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod app_state;
pub mod jupiter;
pub mod routes;
pub mod wrap_stablecoin;

use crate::app_state::AppState;
use crate::routes::{guard, ping, tx, vault};

#[derive(OpenApi)]
#[openapi(
    paths(
        ping::ping_handler,
        tx::issue_tx,
        tx::redeem_tx,
        tx::preview_tx,
        tx::compose_tx,
        vault::vault_assets,
    ),
    components(schemas(
        tx::IssueRequest,
        tx::RedeemRequest,
        tx::PreviewRequest,
        tx::ComposeRequest,
        tx::TxResponse,
        tx::PreviewResponse,
        tx::ComposeStep,
        vault::VaultAssetsResponse,
        crate::wrap_stablecoin::VaultAssetView,
    )),
    tags(
        (name = "health", description = "Health check"),
        (name = "transactions", description = "Unsigned Solana transactions"),
    ),
    info(
        title = "Wrap stablecoin API",
        version = "0.1.0",
        description = "Build unsigned wrap / unwrap (issue / redeem) transactions; optional Jupiter composition."
    )
)]
struct ApiDoc;

pub fn app(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::very_permissive();

    // Guarded `/v1/tx/*` routes: every request must carry a matching
    // `x-solana-network` header so we never hand a client a transaction
    // built for a cluster it didn't ask for.
    let tx_router: Router<Arc<AppState>> = Router::new()
        .route("/issue", post(tx::issue_tx))
        .route("/redeem", post(tx::redeem_tx))
        .route("/preview", post(tx::preview_tx))
        .route("/compose", post(tx::compose_tx))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let vault_router: Router<Arc<AppState>> = Router::new()
        .route("/assets", axum::routing::get(vault::vault_assets))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            guard::network_guard,
        ));

    let (_, api) = OpenApiRouter::<Arc<AppState>>::with_openapi(ApiDoc::openapi())
        .route("/ping", axum::routing::get(ping::ping_handler))
        .route("/v1/tx/issue", post(tx::issue_tx))
        .route("/v1/tx/redeem", post(tx::redeem_tx))
        .route("/v1/tx/preview", post(tx::preview_tx))
        .route("/v1/tx/compose", post(tx::compose_tx))
        .route("/v1/vault/assets", axum::routing::get(vault::vault_assets))
        .split_for_parts();

    Router::new()
        .route("/ping", axum::routing::get(ping::ping_handler))
        .nest("/v1/tx", tx_router)
        .nest("/v1/vault", vault_router)
        .with_state(state)
        .merge(SwaggerUi::new("/doc").url("/api-docs/openapi.json", api))
        .layer(cors)
}
