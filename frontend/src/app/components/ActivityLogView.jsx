"use client";

import { useState } from "react";

export default function ActivityLogView({ activity = [], onClearActivity }) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? activity
      : activity.filter((item) => item.type === filter);

  function getActionBadge(type) {
    switch (type) {
      case "ingest":
        return { icon: "📥", bg: "var(--badge-green-bg)", color: "var(--badge-green-text)", label: "Ingested" };
      case "query":
        return { icon: "💬", bg: "var(--badge-blue-bg)", color: "var(--badge-blue-text)", label: "Query" };
      case "delete":
        return { icon: "🗑️", bg: "var(--badge-red-bg)", color: "var(--badge-red-text)", label: "Deleted" };
      case "info":
        return { icon: "⚠️", bg: "var(--badge-orange-bg)", color: "var(--badge-orange-text)", label: "Notice" };
      default:
        return { icon: "⚡", bg: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", label: "System" };
    }
  }

  return (
    <div className="activityLogContainer">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 className="viewHeaderTitle">Activity Log</h2>
          <p className="viewHeaderSubtitle">Recent actions, ingestion events, and query operations.</p>
        </div>

        {activity.length > 0 && (
          <button className="chunkActionButton" onClick={onClearActivity}>
            Clear Activity
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        {["all", "ingest", "query", "delete"].map((tab) => (
          <button
            key={tab}
            className={`suggestionChipButton ${filter === tab ? "active" : ""}`}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              background: filter === tab ? "var(--brand-blue)" : "var(--bg-input)",
              color: filter === tab ? "#ffffff" : "inherit",
              borderColor: filter === tab ? "var(--brand-blue)" : "var(--border-subtle)",
            }}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="activityTimelineList">
        {filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📜</div>
            <p style={{ fontWeight: 600 }}>No activity logged yet</p>
            <small>Actions like ingesting documents or asking questions will appear here.</small>
          </div>
        ) : (
          filtered.map((act) => {
            const badge = getActionBadge(act.type);

            return (
              <div key={act.id} className="activityTimelineItem">
                <div
                  className="activityIconBadge"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.icon}
                </div>

                <div className="activityDetails">
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{act.message}</div>
                  <div className="activityTimestamp">{act.time}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
