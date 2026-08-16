use axum::body::{to_bytes, Body};
use axum::http::{header, Request};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

const CSS: &str = include_str!("../static/swagger-florin.css");

const FONT_LINKS: &str = concat!(
    r#"<link rel="preconnect" href="https://fonts.googleapis.com">"#,
    r#"<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>"#,
    r#"<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">"#,
);

/// Inject Florence editorial CSS into Swagger UI HTML at `/doc`.
pub async fn inject_florin_theme(req: Request<Body>, next: Next) -> Response {
    let path = req.uri().path().to_owned();
    let res = next.run(req).await;
    if !path.starts_with("/doc") {
        return res;
    }

    let content_type = res
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_owned();
    if !content_type.contains("text/html") {
        return res;
    }

    let (parts, body) = res.into_parts();
    let Ok(bytes) = to_bytes(body, 2 * 1024 * 1024).await else {
        return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let html = String::from_utf8_lossy(&bytes);
    let inject = format!("{FONT_LINKS}<style>{CSS}</style></head>");
    let patched = html.replacen("</head>", &inject, 1);
    let mut response = Response::from_parts(parts, Body::from(patched));
    response.headers_mut().remove(header::CONTENT_LENGTH);
    response
}
