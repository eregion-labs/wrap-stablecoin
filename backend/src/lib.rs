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
use crate::routes::{ping, tx};

#[derive(OpenApi)]
#[openapi(
    paths(
        ping::ping_handler,
        tx::issue_tx,
        tx::redeem_tx,
        tx::preview_tx,
        tx::compose_tx,
    ),
    components(schemas(
        tx::IssueRequest,
        tx::RedeemRequest,
        tx::PreviewRequest,
        tx::ComposeRequest,
        tx::TxResponse,
        tx::PreviewResponse,
        tx::ComposeStep,
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

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .route("/ping", axum::routing::get(ping::ping_handler))
        .route("/v1/tx/issue", post(tx::issue_tx))
        .route("/v1/tx/redeem", post(tx::redeem_tx))
        .route("/v1/tx/preview", post(tx::preview_tx))
        .route("/v1/tx/compose", post(tx::compose_tx))
        .split_for_parts();

    router
        .with_state(state)
        .merge(SwaggerUi::new("/doc").url("/api-docs/openapi.json", api))
        .layer(cors)
}
