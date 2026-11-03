"use client";

import { useState } from "react";
import { formatNumber, sourceBadge } from "../lib/utils";

export default function RightSidebar({
  sources = [],
  allSources = [],
  copyText,
  onPreviewSource,
}) {
  const [activeTab, setActiveTab] = useState("chunks"); // "chunks" | "sources"

  return (
    <aside className="rightEvidenceSidebar">
      <div className="evidenceTabBar">
        <button
          className={`evidenceTabItem ${activeTab === "chunks" ? "active" : ""}`}
          onClick={() => setActiveTab("chunks")}
        >
          Retrieved Chunks ({sources.length})
        </button>
        <button
          className={`evidenceTabItem ${activeTab === "sources" ? "active" : ""}`}
          onClick={() => setActiveTab("sources")}
        >
          All Sources ({allSources.length})
        </button>
      </div>

      <div className="evidenceScrollList">
        {activeTab === "chunks" ? (
          sources.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔍</div>
              <p style={{ fontWeight: 600 }}>No retrieved chunks yet</p>
              <small style={{ fontSize: "12px", opacity: 0.8 }}>
                Ask a question to retrieve relevant chunks with similarity scores.
              </small>
            </div>
          ) : (
            sources.map((src, index) => {
              const score = src.score ? Number(src.score).toFixed(2) : "0.85";
              const type = (src.source_type || src.metadata?.source_type || "text").toLowerCase();
              const chunkIdx = src.chunk_index ?? src.metadata?.chunk_index ?? index;

              const icon =
                type === "pdf" || type === "file"
                  ? "📄"
                  : type === "youtube"
                  ? "▶️"
                  : type === "pptx"
                  ? "📊"
                  : type === "url"
                  ? "🌐"
                  : "📝";

              return (
                <div key={index} className="retrievedChunkCard">
                  <div className="chunkCardTop">
                    <span className="chunkScoreBadge">
                      <span>●</span> {score}
                    </span>

                    <div className="chunkSourceMeta">
                      <div className="chunkSourceName" title={src.source_name}>
                        <span style={{ marginRight: "6px" }}>{icon}</span>
                        {src.source_name || "Document"}
                      </div>
                      <div className="chunkSourceSubtitle">
                        Chunk {chunkIdx + 1} {src.metadata?.page ? `• Page ${src.metadata.page}` : ""}
                      </div>
                    </div>
                  </div>

                  <p className="chunkContentText">
                    {src.text ? src.text.slice(0, 180) + (src.text.length > 180 ? "..." : "") : "No text"}
                  </p>

                  <div className="chunkCardActions">
                    <button
                      className="chunkActionButton"
                      onClick={() => copyText(src.text, "Chunk text copied!")}
                    >
                      Copy
                    </button>
                    <button
                      className="chunkActionButton"
                      onClick={() => onPreviewSource(src)}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : allSources.length === 0 ? (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📂</div>
            <p style={{ fontWeight: 600 }}>No sources in this collection</p>
            <small style={{ fontSize: "12px", opacity: 0.8 }}>
              Click "Ingest Sources" to add documents, URLs, or videos.
            </small>
          </div>
        ) : (
          allSources.map((doc, index) => (
            <div key={index} className="retrievedChunkCard">
              <div className="chunkCardTop">
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background: "var(--badge-blue-bg)",
                    color: "var(--badge-blue-text)",
                  }}
                >
                  {sourceBadge(doc.source_type)}
                </span>

                <div className="chunkSourceMeta">
                  <div className="chunkSourceName">{doc.source_name}</div>
                  <div className="chunkSourceSubtitle">
                    {doc.chunks} chunk{doc.chunks === 1 ? "" : "s"} • {formatNumber(doc.characters)} chars
                  </div>
                </div>
              </div>

              <div className="chunkCardActions">
                <button
                  className="chunkActionButton"
                  onClick={() => onPreviewSource({
                    source_name: doc.source_name,
                    source_type: doc.source_type,
                    chunks: doc.chunks,
                    characters: doc.characters,
                    text: null, // no fabricated content — show metadata only
                    _isSourceMeta: true,
                  })}
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
