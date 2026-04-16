use std::net::SocketAddr;
use std::sync::Arc;

use dotenvy::dotenv;
use tracing::info;
use tracing_subscriber::EnvFilter;

use wrap_stablecoin_api::{app, app_state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("wrap_stablecoin_api=info,tower_http=info")),
        )
        .init();

    let state = Arc::new(AppState::from_env()?);
    let app = app(state);

    let host = std::env::var("BIND_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("BIND_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    info!(%addr, "wrap-stablecoin API listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
