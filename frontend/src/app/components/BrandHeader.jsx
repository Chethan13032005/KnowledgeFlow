"use client";

export default function BrandHeader({ theme, onToggleTheme, isWakingUp = false }) {
  return (
    <header className="brandHeaderBanner">
      <div className="brandLeft">
        <div className="brandLogoIcon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
        <div className="brandTitles">
          <div className="brandNameMain">
            KnowledgeFlow
            <span style={{ fontWeight: 400, opacity: 0.85, fontSize: "14px", marginLeft: "6px" }}>• Spatial Multi-Source RAG</span>
          </div>
          <div className="brandSubtitleTagline">
            Ingest • Semantic Cache • Zero-Overhead Guardrails • Real-Time Telemetry
          </div>
        </div>
      </div>

      {/* Feature capability badges */}
      <div className="brandFeaturePills">
        {isWakingUp ? (
          <div className="featurePillCard" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>✦</span> Waking up Render backend...
          </div>
        ) : (
          <div className="featurePillCard" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
            <span>●</span> Backend Connected
          </div>
        )}

        <div className="featurePillCard">
          <span>⚡</span> pgvector Cache
        </div>
        <div className="featurePillCard">
          <span>🛡️</span> Guardrails
        </div>

        <div className="segmentedThemeSwitch" title="Select Theme Mode">
          <button
            type="button"
            className={`themeSegmentBtn ${theme === "light" ? "active" : ""}`}
            onClick={() => onToggleTheme("light")}
          >
            <span>☀️</span>
            <span>Light</span>
          </button>
          <button
            type="button"
            className={`themeSegmentBtn ${theme === "dark" ? "active" : ""}`}
            onClick={() => onToggleTheme("dark")}
          >
            <span>🌙</span>
            <span>Dark</span>
          </button>
        </div>
      </div>
    </header>
  );
}
