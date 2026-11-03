"use client";

import { useState } from "react";

export default function SourcePreviewModal({ source, isOpen, onClose }) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!isOpen || !source) return null;

  const title = source.source_name || "Document Preview";
  const type = source.source_type || source.metadata?.source_type || "document";
  const isMetaOnly = source._isSourceMeta === true;

  // For metadata-only sources (from "All Sources" tab) show a structured info view
  if (isMetaOnly) {
    return (
      <div className="modalOverlay" onClick={onClose}>
        <div className="modalDialogCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
          <div className="modalHeader">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>📂</span>
              <span className="modalTitle">Source Details — {title}</span>
            </div>
            <button className="modalCloseButton" onClick={onClose}>✕</button>
          </div>

          <div className="modalBody" style={{ gap: "12px" }}>
            <div style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              {[
                { label: "Source Name", value: source.source_name || "—" },
                { label: "Type", value: (source.source_type || "—").toUpperCase() },
                { label: "Total Chunks", value: source.chunks != null ? String(source.chunks) : "—" },
                { label: "Total Characters", value: source.characters != null ? new Intl.NumberFormat("en-IN").format(source.characters) : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              To inspect chunk content, ask a question in Chat and click a retrieved chunk.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // For retrieved chunks — show real stored text content
  const text = source.text || source.content || "";
  const hasContent = text.trim().length > 0;

  // Break text into pseudo-pages or chunks for pagination
  const paragraphs = text.split("\n\n").filter(Boolean);
  const totalPages = Math.max(1, Math.min(12, paragraphs.length));
  const activeContent = paragraphs[currentPage - 1] || text;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalDialogCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px" }}>
        <div className="modalHeader">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📄</span>
            <span className="modalTitle">Source Preview — {title}</span>
          </div>
          <button className="modalCloseButton" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-input)" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
            Type: {type.toUpperCase()}
            {source.chunk_index != null && ` • Chunk ${source.chunk_index + 1}`}
          </span>

          {/* Pagination */}
          {hasContent && totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="chunkActionButton"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ◀
              </button>
              <span style={{ fontSize: "12px", fontWeight: 700 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="chunkActionButton"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                ▶
              </button>
            </div>
          )}
        </div>

        <div className="modalBody">
          <div
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              fontSize: "14px",
              lineHeight: 1.7,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: "380px",
              overflowY: "auto",
            }}
          >
            {hasContent ? activeContent : (
              <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                No text content available for this source.
              </span>
            )}
          </div>

          {source.score && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "12px" }}>
              <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Similarity Score:</span>
              <span className="sourceScoreTag">{Number(source.score).toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
