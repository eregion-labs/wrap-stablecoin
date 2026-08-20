use std::net::SocketAddr;
use std::sync::Arc;

use tracing::info;
use tracing_subscriber::EnvFilter;

use wrap_stablecoin_api::app;
use wrap_stablecoin_api::app_state::AppState;
use wrap_stablecoin_api::config::{load_dotenv, merge_optional_secret};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    load_dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("wrap_stablecoin_api=info,tower_http=info")),
        )
        .init();

    merge_optional_secret();

    let state = Arc::new(AppState::from_env()?);
    info!(
        network = %state.primary_solana_network,
        deployment_id = %state.public_client_config.deployment_id,
        environment = %state.public_client_config.environment,
        "Florin API ready (single-network deployment; public config at /v1/client-config)"
    );
    let app = app(state);

    // Loopback by default: this process holds the vault admin key. Binding every interface is
    // an explicit choice (containers, LAN testing), made by setting BIND_HOST=0.0.0.0.
    let host = std::env::var("BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("BIND_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    info!(%addr, "Florin API listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
