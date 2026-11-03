"use client";

import { useEffect, useState } from "react";

export default function SearchModal({
  isOpen,
  onClose,
  collections = [],
  onSelectCollection,
  onSelectPrompt,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Toggle or open handled by parent
      }
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filteredCols = collections.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickPrompts = [
    "Explain Dynamic Programming with a real-world example.",
    "What are the most important concepts in my sources?",
    "Summarize this workspace for an interview.",
    "List all algorithms discussed in the notes.",
  ].filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalDialogCard searchModalCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "540px" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>🔍</span>
          <input
            type="text"
            className="standardInputText"
            style={{ border: "none", background: "transparent", fontSize: "15px", padding: 0 }}
            placeholder="Search collections, questions, or sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <span className="kbdShortcut" onClick={onClose} style={{ cursor: "pointer" }}>ESC</span>
        </div>

        <div className="modalBody" style={{ padding: "16px", maxHeight: "360px" }}>
          <div>
            <div className="inputFieldLabel" style={{ marginBottom: "6px" }}>Collections</div>
            {filteredCols.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "6px 0" }}>No collections matching</div>
            ) : (
              filteredCols.map((c) => (
                <div
                  key={c}
                  className="activityTimelineItem"
                  style={{ padding: "8px 12px", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                  onClick={() => {
                    onSelectCollection(c);
                    onClose();
                  }}
                >
                  <span>📁</span>
                  <span style={{ fontWeight: 600 }}>{c}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <div className="inputFieldLabel" style={{ marginBottom: "6px" }}>Suggested Prompts</div>
            {quickPrompts.map((p, idx) => (
              <div
                key={idx}
                className="activityTimelineItem"
                style={{ padding: "8px 12px", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                onClick={() => {
                  onSelectPrompt(p);
                  onClose();
                }}
              >
                <span>💬</span>
                <span style={{ fontSize: "13px" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
