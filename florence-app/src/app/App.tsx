import { useState, useEffect } from "react";
import florenceSkyline from "@/imports/image.png";
import florentineLily from "@/imports/image-1.png";
import engravingSheet from "@/imports/image-2.png";
import architecturalIcons from "@/imports/image-3.png";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const RED    = "#C2192B";
const BLUE   = "#4A90B8";
const BROWN  = "#8A5E3A";
const BLACK  = "#0E0E0E";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B6B6B";
const BORDER = "#DEDEDE";
const OFFWH  = "#F7F6F4";

const serif = "'EB Garamond', Georgia, serif";
const mono  = "'DM Mono', 'Courier New', monospace";
const sans  = "'Inter', system-ui, sans-serif";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function RedRule({ my = "0px" }: { my?: string }) {
  return <div style={{ height: "1px", backgroundColor: RED, margin: `${my} 0` }} />;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.22em", color: RED, marginBottom: "18px", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function formatFlorin(raw: string): string {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return "0.00";
  return (n * 0.9995).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── SVG: Florentine Rosette (guilloché) ─────────────────────────────────────

function Rosette({ size = 80, color = RED, opacity = 0.18 }: { size?: number; color?: string; opacity?: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return `M${size / 2},${size / 2} Q${size / 2 + (size * 0.28) * Math.cos(a - 0.3)},${size / 2 + (size * 0.28) * Math.sin(a - 0.3)} ${size / 2 + (size * 0.38) * Math.cos(a)},${size / 2 + (size * 0.38) * Math.sin(a)} Q${size / 2 + (size * 0.28) * Math.cos(a + 0.3)},${size / 2 + (size * 0.28) * Math.sin(a + 0.3)} ${size / 2},${size / 2}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ opacity }}>
      <path d={petals} fill={color} />
      <circle cx={size / 2} cy={size / 2} r={size * 0.14} fill={color} />
      <circle cx={size / 2} cy={size / 2} r={size * 0.06} fill={WHITE} />
      <circle cx={size / 2} cy={size / 2} r={size * 0.38} stroke={color} strokeWidth="0.5" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={size * 0.46} stroke={color} strokeWidth="0.4" fill="none" />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TREASURY_ROWS = [
  { asset: "USDC",       amount: "$1,421,847,220", pct: 49.9, custodian: "Circle Financial" },
  { asset: "US T-Bills", amount: "$853,107,732",   pct: 29.9, custodian: "BNY Mellon" },
  { asset: "USDT",       amount: "$427,738,866",   pct: 15.0, custodian: "Tether Operations" },
  { asset: "DAI",        amount: "$144,698,623",   pct: 5.1,  custodian: "MakerDAO" },
];

const NAV_LINKS = ["Treasury", "Ledger", "Exchange", "Chamber"];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [scrolled, setScrolled]         = useState(false);
  const [mintAmount, setMintAmount]     = useState("10000");
  const [selectedAsset, setAsset]       = useState("USDC");
  const [activePillar, setActivePillar] = useState<number | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const florinOut = formatFlorin(mintAmount);

  return (
    <div style={{ fontFamily: sans, backgroundColor: WHITE, color: BLACK, minHeight: "100vh" }}>

      {/* ── Navigation ── */}
      <nav
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 50,
          backgroundColor: scrolled ? WHITE : WHITE,
          borderBottom: `1px solid ${scrolled ? BORDER : BORDER}`,
          transition: "all 0.4s ease",
        }}
      >
        <div
          className="max-w-7xl mx-auto px-6 lg:px-10"
          style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          {/* Logo + lily mark */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src={florentineLily}
              alt="Florentine lily"
              style={{ height: "28px", width: "auto", objectFit: "contain" }}
            />
            <span style={{ fontFamily: serif, fontSize: "1.35rem", letterSpacing: "0.18em", color: BLACK, fontWeight: 400 }}>
              FLORIN
            </span>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(item => (
              <a
                key={item}
                href="#"
                style={{ fontFamily: sans, fontSize: "11px", letterSpacing: "0.1em", color: GRAY, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = BLACK)}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = GRAY)}
              >
                {item.toUpperCase()}
              </a>
            ))}
          </div>

          {/* CTA */}
          <button
            style={{
              fontFamily: sans, fontSize: "10px", letterSpacing: "0.14em",
              backgroundColor: BLUE, color: WHITE,
              border: "none", padding: "8px 18px", cursor: "pointer",
              borderRadius: "1px", transition: "background 0.2s",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#3A7FA8")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BLUE)}
          >
            OPEN ACCOUNT
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="min-h-screen"
        style={{
          paddingTop: "60px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          backgroundColor: WHITE,
        }}
      >
        {/* Left: text */}
        <div
          className="flex flex-col justify-center px-10 lg:px-16"
          style={{ paddingTop: "60px", paddingBottom: "60px", borderRight: `1px solid ${BORDER}` }}
        >
          <Label>Florentiæ · Est. MMXXIV</Label>
          <RedRule />
          <h1
            style={{
              fontFamily: serif,
              fontSize: "clamp(3rem, 5.5vw, 5.5rem)",
              fontWeight: 400,
              lineHeight: 1.03,
              color: BLACK,
              marginTop: "28px",
              marginBottom: "28px",
            }}
          >
            The Reserve<br />
            Currency of<br />
            <em style={{ color: RED }}>Civilization</em>
          </h1>
          <RedRule />
          <p
            style={{
              fontFamily: serif,
              fontSize: "1.2rem",
              fontStyle: "italic",
              color: GRAY,
              lineHeight: 1.75,
              maxWidth: "520px",
              marginTop: "28px",
              marginBottom: "40px",
            }}
          >
            A dollar-denominated stablecoin issued by the Florin Merchant Treasury — backed 100% by auditable on-chain reserves, governed by the Republic's Charter.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              style={{
                fontFamily: sans, fontSize: "11px", letterSpacing: "0.18em",
                backgroundColor: BLUE, color: WHITE,
                border: "none", padding: "14px 32px", cursor: "pointer",
                borderRadius: "1px", transition: "background 0.2s",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#3A7FA8")}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BLUE)}
              onMouseDown={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")}
              onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            >
              MINT FLORIN
            </button>
            <button
              style={{
                fontFamily: sans, fontSize: "11px", letterSpacing: "0.18em",
                backgroundColor: "transparent", color: BLACK,
                border: `1px solid ${BLACK}`, padding: "14px 32px", cursor: "pointer",
                borderRadius: "1px", transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = BLACK;
                (e.currentTarget as HTMLButtonElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = BLACK;
              }}
            >
              VIEW LEDGER
            </button>
          </div>

          {/* Reserve attestation note */}
          <div style={{ marginTop: "52px", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2E9E5B" }} />
            <p style={{ fontFamily: mono, fontSize: "11px", color: GRAY, letterSpacing: "0.04em" }}>
              Reserve attested · 2026-06-26 14:32:07 UTC · Ratio 100.15%
            </p>
          </div>
        </div>

        {/* Right: lily */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 40px",
            backgroundColor: OFFWH,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background rosette watermark */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
            <Rosette size={480} color={RED} opacity={0.04} />
          </div>

          {/* The official Florentine lily */}
          <img
            src={florentineLily}
            alt="Giglio Fiorentino — the Florentine lily, heraldic mark of the Republic"
            style={{
              width: "min(380px, 72%)",
              height: "auto",
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
            }}
          />

          {/* Corner inscription */}
          <div style={{ position: "absolute", bottom: "28px", right: "32px" }}>
            <p style={{ fontFamily: serif, fontSize: "11px", fontStyle: "italic", color: "#BDBDBD", letterSpacing: "0.06em" }}>
              Giglio Fiorentino
            </p>
          </div>
        </div>
      </section>

      {/* ── Florence Photograph ── */}
      <section style={{ position: "relative", height: "420px", overflow: "hidden" }}>
        <img
          src={florenceSkyline}
          alt="Florence skyline — the Duomo, the Campanile, the Arno — seat of the original florin"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(14,14,14,0.72) 0%, rgba(14,14,14,0.35) 50%, rgba(14,14,14,0.1) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "0 64px",
          }}
        >
          <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.6)", marginBottom: "14px" }}>
            THE ORIGINAL REPUBLIC
          </p>
          <h2
            style={{
              fontFamily: serif, fontSize: "clamp(2rem, 4vw, 3.8rem)",
              fontWeight: 400, color: WHITE, lineHeight: 1.08, maxWidth: "560px",
            }}
          >
            Florence invented the florin.<br />
            <em style={{ color: "rgba(255,255,255,0.7)" }}>We continue the tradition.</em>
          </h2>
        </div>
      </section>

      {/* ── Reserve Statistics ── */}
      <section style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div
          className="max-w-7xl mx-auto"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {[
            { label: "Total Reserves",        value: "$2,847,392,441", sub: "USD equivalent · fully audited" },
            { label: "Florin in Circulation",  value: "2,842,991,032", sub: "FLR issued · Solana network" },
            { label: "Reserve Ratio",          value: "100.15%",        sub: "Proof of Reserve" },
            { label: "Merchant Accounts",      value: "14,831",          sub: "Active this quarter" },
          ].map(({ label, value, sub }, i) => (
            <div
              key={label}
              style={{
                padding: "40px 36px",
                borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
                borderLeft: i === 0 ? `3px solid ${RED}` : "none",
              }}
            >
              <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.14em", color: GRAY, marginBottom: "12px" }}>
                {label.toUpperCase()}
              </p>
              <p style={{ fontFamily: mono, fontSize: "1.55rem", color: BLACK, letterSpacing: "-0.02em", lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY, marginTop: "8px" }}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Mint Process ── */}
      <section style={{ backgroundColor: WHITE, padding: "96px 0 96px" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "80px", alignItems: "start" }}>
            {/* Section header */}
            <div>
              <Label>The Mint</Label>
              <h2 style={{ fontFamily: serif, fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 400, lineHeight: 1.1, color: BLACK }}>
                How Florin<br />is Issued
              </h2>
              <RedRule my="24px" />
              <p style={{ fontFamily: serif, fontSize: "1.1rem", fontStyle: "italic", color: GRAY, lineHeight: 1.75 }}>
                Three deliberate acts — deposit, attestation, and issuance — mirroring the discipline of the Florentine merchant bankers.
              </p>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                {
                  num: "I",
                  title: "Deposit Collateral",
                  body: "Submit USDC, USDT, or DAI to the Florin Treasury via your Merchant Account. Settlement is confirmed on-chain within one block and recorded permanently in the public Ledger.",
                },
                {
                  num: "II",
                  title: "Reserve Attestation",
                  body: "The Reserve Algorithm verifies 100%+ collateral coverage before any Florin is issued. Each mint event is immutably recorded and auditable by any party at any time.",
                },
                {
                  num: "III",
                  title: "Receive Florin",
                  body: "Florin is credited to your Merchant Account at 1:1 dollar parity, net of a 0.05% protocol fee. Redeemable in full at any time, at any volume, within one Solana epoch.",
                },
              ].map(({ num, title, body }, i) => (
                <div
                  key={num}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
                    gap: "24px",
                    padding: "36px 0",
                    borderBottom: i < 2 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <div style={{ textAlign: "center", paddingTop: "2px" }}>
                    <span
                      style={{
                        fontFamily: serif, fontSize: "2.2rem", fontStyle: "italic",
                        color: RED, fontWeight: 400, opacity: 0.85,
                      }}
                    >
                      {num}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: serif, fontSize: "1.4rem", fontWeight: 400, color: BLACK, marginBottom: "10px" }}>
                      {title}
                    </h3>
                    <p style={{ fontFamily: sans, fontSize: "0.9rem", color: GRAY, lineHeight: 1.85 }}>
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Architectural Icons ── */}
      <section style={{ backgroundColor: OFFWH, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10" style={{ padding: "56px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.18em", color: GRAY, marginBottom: "8px" }}>
                THE REPUBLIC
              </p>
              <p style={{ fontFamily: serif, fontSize: "1.1rem", fontStyle: "italic", color: BLACK, maxWidth: "200px", lineHeight: 1.6 }}>
                The architecture of a civilization
              </p>
            </div>
            <div style={{ flex: 1, borderLeft: `1px solid ${BORDER}`, paddingLeft: "40px" }}>
              <img
                src={architecturalIcons}
                alt="Florentine architectural landmarks — Palazzo Vecchio, Cathedral Duomo, Ponte Vecchio and more"
                style={{ width: "100%", height: "220px", objectFit: "cover", objectPosition: "center", filter: "contrast(1.1)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Treasury Ledger ── */}
      <section style={{ backgroundColor: WHITE, padding: "96px 0" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "40px", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <Label>Treasury Ledger</Label>
              <h2 style={{ fontFamily: serif, fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 400, lineHeight: 1.1, color: BLACK }}>
                Reserve Holdings
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY }}>Last Attested</p>
              <p style={{ fontFamily: mono, color: BLUE, fontSize: "0.8rem", marginTop: "4px" }}>2026-06-26 · 14:32:07 UTC</p>
            </div>
          </div>

          <RedRule />

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.2fr 180px 1.2fr",
              padding: "12px 0",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            {["Asset", "Reserve Amount", "% of Treasury", "Custodian"].map(h => (
              <p key={h} style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.12em", color: GRAY }}>
                {h.toUpperCase()}
              </p>
            ))}
          </div>

          {/* Rows */}
          {TREASURY_ROWS.map(({ asset, amount, pct, custodian }, i) => (
            <div
              key={asset}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr 180px 1.2fr",
                padding: "20px 0",
                borderBottom: `1px solid ${BORDER}`,
                backgroundColor: i % 2 === 1 ? OFFWH : WHITE,
                transition: "background 0.15s",
                cursor: "default",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#F0EFED")}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = i % 2 === 1 ? OFFWH : WHITE)}
            >
              <p style={{ fontFamily: serif, color: BLACK, fontSize: "1.05rem" }}>{asset}</p>
              <p style={{ fontFamily: mono, color: BLACK, fontSize: "0.9rem" }}>{amount}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ height: "2px", width: `${pct * 1.2}px`, backgroundColor: RED, opacity: 0.7, flexShrink: 0 }} />
                <p style={{ fontFamily: mono, color: RED, fontSize: "0.875rem" }}>{pct.toFixed(1)}%</p>
              </div>
              <p style={{ fontFamily: sans, color: GRAY, fontSize: "0.8125rem" }}>{custodian}</p>
            </div>
          ))}

          {/* Total row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.2fr 180px 1.2fr",
              padding: "20px 0",
              borderBottom: `2px solid ${BLACK}`,
            }}
          >
            <p style={{ fontFamily: serif, color: BLACK, fontSize: "1.05rem", fontStyle: "italic" }}>Total Reserve</p>
            <p style={{ fontFamily: mono, color: BLACK, fontSize: "0.9rem", fontWeight: 500 }}>$2,847,392,441</p>
            <p style={{ fontFamily: mono, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>100.15%</p>
            <p style={{ fontFamily: sans, color: GRAY, fontSize: "0.8125rem" }}>Triply audited</p>
          </div>

          <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY, marginTop: "16px" }}>
            Verified by Armanino LLP, Deloitte, and the Florin Republic Audit Committee. Full proof-of-reserve available on-chain.
          </p>
        </div>
      </section>

      {/* ── Three Pillars ── */}
      <section style={{ backgroundColor: OFFWH, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "96px 0" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <Label>The Charter</Label>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 400, lineHeight: 1.1, color: BLACK }}>
              Three Pillars of the Republic
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0" }}>
            {[
              {
                label: "RESERVE & AUDIT",
                title: "Proof of Reserve",
                body: "Every Florin in circulation is backed by 100%+ auditable collateral. Real-time attestations are published continuously, verified by three independent auditors.",
                accent: RED,
              },
              {
                label: "EXCHANGE & TRADE",
                title: "Merchant Settlement",
                body: "Exchange Florin across 140+ trading pairs with instant finality on the Solana network. Institutional-grade clearing with sub-second settlement for any volume.",
                accent: BLUE,
              },
              {
                label: "GOVERNANCE",
                title: "Charter Governance",
                body: "The Treasury operates under a multi-signature charter ratified by the Merchant Council. No single party holds unilateral authority over the Republic's reserves.",
                accent: BROWN,
              },
            ].map(({ label, title, body, accent }, i) => (
              <div
                key={title}
                style={{
                  padding: "48px 40px",
                  borderLeft: i > 0 ? `1px solid ${BORDER}` : "none",
                  borderTop: `3px solid ${activePillar === i ? accent : "transparent"}`,
                  transition: "border-color 0.3s",
                  cursor: "default",
                }}
                onMouseEnter={() => setActivePillar(i)}
                onMouseLeave={() => setActivePillar(null)}
              >
                <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.16em", color: accent, marginBottom: "24px" }}>
                  {label}
                </p>
                <h3 style={{ fontFamily: serif, fontSize: "1.6rem", fontWeight: 400, lineHeight: 1.15, color: BLACK, marginBottom: "18px" }}>
                  {title}
                </h3>
                <p style={{ fontFamily: sans, fontSize: "0.875rem", color: GRAY, lineHeight: 1.85 }}>
                  {body}
                </p>
                <a
                  href="#"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    fontFamily: sans, fontSize: "10px", letterSpacing: "0.12em",
                    color: accent, textDecoration: "none", marginTop: "28px",
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
                >
                  LEARN MORE →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Engraving Sheet ── */}
      <section style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <div style={{ maxWidth: "100%", position: "relative", height: "260px" }}>
          <img
            src={engravingSheet}
            alt="Copperplate engravings of Florentine architecture and civic life"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              opacity: 0.22,
              filter: "grayscale(1) contrast(1.2)",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.22em", color: RED, marginBottom: "16px" }}>
              FLORENTIÆ CIVITAS
            </p>
            <h2
              style={{
                fontFamily: serif, fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                fontWeight: 400, color: BLACK, lineHeight: 1.05, textAlign: "center",
              }}
            >
              The Medici Bank, rebuilt<br />
              <em style={{ color: RED }}>on modern cryptography</em>
            </h2>
          </div>
        </div>
      </section>

      {/* ── Mint Calculator ── */}
      <section style={{ backgroundColor: OFFWH, padding: "96px 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}>
            {/* Left */}
            <div>
              <Label>Mint Florin</Label>
              <h2 style={{ fontFamily: serif, fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 400, lineHeight: 1.1, color: BLACK, marginBottom: "24px" }}>
                Open Your<br />Merchant Account
              </h2>
              <RedRule />
              <p style={{ fontFamily: serif, fontSize: "1.1rem", fontStyle: "italic", color: GRAY, lineHeight: 1.75, marginTop: "24px", marginBottom: "32px" }}>
                Deposit USDC, USDT, or DAI and receive Florin at 1:1 parity. Your collateral is held in trust by the Republic's Treasury.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Instant on-chain minting — confirmed in one block",
                  "Redeemable at any time, at any volume",
                  "0.05% protocol fee — no hidden charges",
                  "Proof of Reserve published every 60 seconds",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ width: "16px", height: "1px", backgroundColor: RED, marginTop: "10px", flexShrink: 0 }} />
                    <p style={{ fontFamily: sans, fontSize: "0.875rem", color: GRAY, lineHeight: 1.6 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: calculator */}
            <div
              style={{
                backgroundColor: WHITE,
                border: `1px solid ${BORDER}`,
                borderTop: `3px solid ${RED}`,
                padding: "44px",
              }}
            >
              <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.18em", color: GRAY, marginBottom: "28px" }}>
                MINT CALCULATOR
              </p>

              {/* Asset selector */}
              <div style={{ display: "flex", border: `1px solid ${BORDER}`, marginBottom: "20px" }}>
                {["USDC", "USDT", "DAI"].map(a => (
                  <button
                    key={a}
                    onClick={() => setAsset(a)}
                    style={{
                      flex: 1, padding: "10px 0",
                      fontFamily: sans, fontSize: "11px", letterSpacing: "0.1em",
                      backgroundColor: selectedAsset === a ? BLACK : "transparent",
                      color: selectedAsset === a ? WHITE : GRAY,
                      border: "none", cursor: "pointer",
                      borderRight: a !== "DAI" ? `1px solid ${BORDER}` : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div style={{ marginBottom: "4px" }}>
                <label style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.1em", color: GRAY, display: "block", marginBottom: "8px" }}>
                  DEPOSIT AMOUNT ({selectedAsset})
                </label>
                <div style={{ position: "relative", border: `1px solid ${BORDER}` }}>
                  <input
                    type="text"
                    value={mintAmount}
                    onChange={e => setMintAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    style={{
                      width: "100%", padding: "16px",
                      fontFamily: mono, fontSize: "1.7rem", color: BLACK,
                      background: "transparent", border: "none", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
                      fontFamily: sans, fontSize: "11px", color: GRAY,
                    }}
                  >
                    {selectedAsset}
                  </span>
                </div>
              </div>

              {/* Output */}
              <div
                style={{
                  margin: "24px 0",
                  padding: "20px 0",
                  borderTop: `1px solid ${BORDER}`,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.1em", color: GRAY, marginBottom: "8px" }}>
                  YOU RECEIVE
                </p>
                <p style={{ fontFamily: mono, fontSize: "2.4rem", color: RED, letterSpacing: "-0.02em" }}>
                  {florinOut}
                </p>
                <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY, marginTop: "6px" }}>
                  FLR · 1:1 parity · net 0.05% protocol fee
                </p>
              </div>

              <button
                style={{
                  width: "100%", padding: "16px 0",
                  fontFamily: sans, fontSize: "11px", letterSpacing: "0.18em",
                  backgroundColor: BLUE, color: WHITE,
                  border: "none", cursor: "pointer", borderRadius: "1px",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#3A7FA8")}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BLUE)}
                onMouseDown={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)")}
                onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
              >
                MINT FLORIN
              </button>
              <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY, textAlign: "center", marginTop: "14px" }}>
                Requires a Merchant Account · KYC required above $50,000
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ backgroundColor: BLACK, padding: "120px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Background: very faint Florence photo */}
        <img
          src={florenceSkyline}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.12, filter: "grayscale(1)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
            <img
              src={florentineLily}
              alt=""
              aria-hidden="true"
              style={{
                height: "80px", width: "auto", objectFit: "contain",
                filter: "brightness(0) saturate(100%) invert(14%) sepia(95%) saturate(4000%) hue-rotate(340deg) brightness(90%)",
                opacity: 0.9,
              }}
            />
          </div>

          <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", marginBottom: "24px" }}>
            THE REPUBLIC AWAITS
          </p>
          <h2
            style={{
              fontFamily: serif, fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
              fontWeight: 400, lineHeight: 1.03, color: WHITE,
            }}
          >
            The Enduring Currency<br />
            <em style={{ color: "#E85F6B" }}>of Trade and Trust</em>
          </h2>
          <p
            style={{
              fontFamily: serif, fontSize: "1.2rem", fontStyle: "italic",
              color: "rgba(255,255,255,0.55)", lineHeight: 1.75,
              margin: "28px auto 48px", maxWidth: "540px",
            }}
          >
            Florin is not merely digital money. It is the continuation of a centuries-old tradition of merchant banking, civic trust, and the honest weight of gold.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              style={{
                fontFamily: sans, fontSize: "11px", letterSpacing: "0.18em",
                backgroundColor: BLUE, color: WHITE,
                border: "none", padding: "16px 40px", cursor: "pointer",
                borderRadius: "1px", transition: "background 0.2s",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#3A7FA8")}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = BLUE)}
            >
              OPEN MERCHANT ACCOUNT
            </button>
            <button
              style={{
                fontFamily: sans, fontSize: "11px", letterSpacing: "0.18em",
                backgroundColor: "transparent", color: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(255,255,255,0.25)", padding: "16px 40px", cursor: "pointer",
                borderRadius: "1px", transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.6)";
                (e.currentTarget as HTMLButtonElement).style.color = WHITE;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
              }}
            >
              READ THE CHARTER
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: WHITE, borderTop: `1px solid ${BORDER}`, padding: "60px 0 32px" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "48px", marginBottom: "56px" }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <img src={florentineLily} alt="Florentine lily" style={{ height: "22px", width: "auto" }} />
                <span style={{ fontFamily: serif, fontSize: "1.2rem", letterSpacing: "0.18em", color: BLACK }}>FLORIN</span>
              </div>
              <p style={{ fontFamily: sans, fontSize: "0.875rem", color: GRAY, lineHeight: 1.85, maxWidth: "280px" }}>
                The dollar-denominated stablecoin of the modern merchant republic. Issued by the Florin Treasury and governed by the Republic's Charter.
              </p>
              <p style={{ fontFamily: mono, fontSize: "11px", color: BLUE, marginTop: "20px" }}>
                FLR · Solana Network
              </p>
            </div>

            {/* Link columns */}
            {[
              { heading: "Treasury",  links: ["Mint Florin", "Redeem Florin", "Holdings", "Proof of Reserve"] },
              { heading: "Exchange",  links: ["Trading Pairs", "Settlement", "API Docs", "Market Data"] },
              { heading: "Republic",  links: ["Charter", "Governance", "Audit Reports", "Chamber"] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <p style={{ fontFamily: sans, fontSize: "10px", letterSpacing: "0.15em", color: RED, marginBottom: "16px" }}>
                  {heading.toUpperCase()}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {links.map(link => (
                    <a
                      key={link}
                      href="#"
                      style={{ fontFamily: sans, fontSize: "0.875rem", color: GRAY, textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = BLACK)}
                      onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = GRAY)}
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <p style={{ fontFamily: sans, fontSize: "11px", color: GRAY }}>
              © 2024 Florin Treasury, S.p.A. · All reserves fully audited. Florin is not a security.
            </p>
            <div style={{ display: "flex", gap: "24px" }}>
              {["Privacy", "Terms", "Risk Disclosure", "Compliance"].map(item => (
                <a
                  key={item}
                  href="#"
                  style={{ fontFamily: sans, fontSize: "11px", color: GRAY, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = BLACK)}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = GRAY)}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
