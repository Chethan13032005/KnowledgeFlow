"use client";

import { useState } from "react";

export default function CollectionsView({
  collections = [],
  activeCollection,
  onSelectCollection,
  onDeleteCollection,
  onCreateCollection,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState("");

  function handleCreate(e) {
    e.preventDefault();
    if (!newColName.trim()) return;
    onCreateCollection(newColName.trim());
    setNewColName("");
    setShowCreateModal(false);
  }

  return (
    <div className="collectionsGridContainer">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 className="viewHeaderTitle">Knowledge Collections</h2>
          <p className="viewHeaderSubtitle">Organize your knowledge sources into isolated workspaces.</p>
        </div>

        <button
          className="primaryActionButton"
          onClick={() => setShowCreateModal(true)}
          style={{ width: "auto" }}
        >
          <span>+</span> New Collection
        </button>
      </div>

      <div className="collectionsGrid">
        {collections.map((col) => {
          const isActive = col === activeCollection;

          return (
            <div
              key={col}
              className={`collectionCardItem ${isActive ? "active" : ""}`}
            >
              <div className="collectionCardHeader">
                <span className="collectionCardTitle">
                  <span style={{ fontSize: "20px" }}>📁</span>
                  <span>{col}</span>
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      background: "var(--badge-blue-bg)",
                      color: "var(--badge-blue-text)",
                      padding: "2px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              <div className="collectionMetrics">
                <span>⚡ Grounded RAG Workspace</span>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  className="chunkActionButton"
                  style={{
                    flex: 1,
                    background: isActive ? "var(--brand-blue)" : "var(--bg-input)",
                    color: isActive ? "#ffffff" : "inherit",
                    fontWeight: 700,
                  }}
                  onClick={() => onSelectCollection(col)}
                >
                  {isActive ? "Selected" : "Open Workspace"}
                </button>

                <button
                  className="chunkActionButton"
                  style={{ color: "#ef4444" }}
                  title="Delete collection"
                  onClick={() => onDeleteCollection(col)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="modalOverlay" onClick={() => setShowCreateModal(false)}>
          <div className="modalDialogCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modalHeader">
              <span className="modalTitle">Create New Collection</span>
              <button className="modalCloseButton" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="modalBody">
              <div className="inputFormField">
                <label className="inputFieldLabel">Collection Name</label>
                <input
                  type="text"
                  className="standardInputText"
                  placeholder="e.g. system-design-notes"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="primaryActionButton">
                Create Collection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
