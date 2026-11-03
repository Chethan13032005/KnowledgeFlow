"use client";

export default function BrandHeader({ theme, onToggleTheme }) {
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
            <span style={{ fontWeight: 400, opacity: 0.85 }}>– Multi-source RAG</span>
          </div>
          <div className="brandSubtitleTagline">
            Ingest • Retrieve • Understand • Generate
          </div>
        </div>
      </div>

      {/* Feature capability badges — informational only, no duplicate nav actions */}
      <div className="brandFeaturePills">
        <div className="featurePillCard">
          <span>📄</span> Multi-source Ingestion
        </div>
        <div className="featurePillCard">
          <span>🔍</span> Source-Grounded
        </div>
        <div className="featurePillCard">
          <span>⚡</span> Groq + pgvector
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
