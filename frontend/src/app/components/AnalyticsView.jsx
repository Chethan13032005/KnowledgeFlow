"use client";

import { formatNumber } from "../lib/utils";

export default function AnalyticsView({ analyticsData, stats, collectionName }) {
  const totalSources = analyticsData?.documents || stats?.documents || 0;
  const totalChunks = analyticsData?.chunks || stats?.chunks || 0;
  const totalCharacters = analyticsData?.characters || stats?.characters || 0;
  const totalCollections = analyticsData?.collections || 1;

  // Derive source type distribution from real analytics data if available
  const sourceBreakdown = analyticsData?.source_breakdown || null;

  // Build distribution bars from real data or show "no data" state
  const distributionItems = sourceBreakdown
    ? Object.entries(sourceBreakdown).map(([type, count], i) => {
        const colors = ["#ef4444", "#f97316", "#3b82f6", "#a855f7", "#22c55e"];
        const total = Object.values(sourceBreakdown).reduce((a, b) => a + b, 0) || 1;
        const labelMap = { text: "Raw Text & Notes", file: "File Documents", pdf: "PDF Documents", url: "Website URLs", youtube: "YouTube Transcripts" };
        return {
          label: labelMap[type] || type.toUpperCase(),
          count,
          pct: Math.round((count / total) * 100),
          color: colors[i % colors.length],
        };
      })
    : null;

  return (
    <div className="analyticsViewContainer">
      <div>
        <h2 className="viewHeaderTitle">Analytics & Usage</h2>
        <p className="viewHeaderSubtitle">
          Performance, query throughput, and source distribution across your workspaces.
        </p>
      </div>

      {/* 4 Metric Cards — uses real API data */}
      <div className="metricsFourGrid">
        <div className="metricStatCard">
          <span className="metricStatTitle">Total Sources</span>
          <span className="metricStatValue">{formatNumber(totalSources)}</span>
        </div>

        <div className="metricStatCard">
          <span className="metricStatTitle">Total Chunks</span>
          <span className="metricStatValue">{formatNumber(totalChunks)}</span>
        </div>

        <div className="metricStatCard">
          <span className="metricStatTitle">Indexed Characters</span>
          <span className="metricStatValue">{formatNumber(totalCharacters)}</span>
        </div>

        <div className="metricStatCard">
          <span className="metricStatTitle">Active Workspaces</span>
          <span className="metricStatValue">{totalCollections}</span>
        </div>
      </div>

      {/* Query Activity Chart — placeholder (time-series data not available from API) */}
      <div className="chartCardContainer">
        <div className="chartHeader">
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "800" }}>Query Activity</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Retrieval & answer generation volume over time
            </p>
          </div>
        </div>

        <div style={{
          padding: "32px 20px",
          textAlign: "center",
          color: "var(--text-muted)",
          background: "var(--bg-input)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border-strong)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
        }}>
          <span style={{ fontSize: "28px" }}>📈</span>
          <p style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Time-series data not yet available</p>
          <small style={{ fontSize: "12px" }}>
            Query history tracking will appear here once the backend supports time-series logging.
          </small>
        </div>
      </div>

      {/* Source Type Distribution — real data if available, honest placeholder otherwise */}
      <div className="chartCardContainer">
        <h3 style={{ fontSize: "16px", fontWeight: "800" }}>Source Type Distribution</h3>

        {distributionItems && distributionItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {distributionItems.map((item, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700" }}>
                  <span>{item.label}</span>
                  <span>{item.count} source{item.count !== 1 ? "s" : ""} ({item.pct}%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--border-subtle)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: "999px" }} />
                </div>
              </div>
            ))}
          </div>
        ) : totalSources === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📂</div>
            <p style={{ fontWeight: 600 }}>No sources ingested yet</p>
            <small>Ingest documents, URLs, or videos to see distribution data here.</small>
          </div>
        ) : (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📊</div>
            <p style={{ fontWeight: 600 }}>Distribution data not available</p>
            <small>The backend does not yet return per-type breakdown. {formatNumber(totalSources)} total source(s) indexed.</small>
          </div>
        )}
      </div>
    </div>
  );
}
