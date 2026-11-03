"use client";

import { useState } from "react";
import { PERSONAS } from "../lib/constants";

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  persona,
  setPersona,
  memoryEnabled,
  setMemoryEnabled,
  onClearMemory,
  chatHistoryLength,
}) {
  const [activeTab, setActiveTab] = useState("general");

  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalDialogCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "620px" }}>
        <div className="modalHeader">
          <span className="modalTitle">⚙️ Settings</span>
          <button className="modalCloseButton" onClick={onClose}>✕</button>
        </div>

        <div className="settingsTabsWrapper" style={{ border: "none", borderRadius: 0 }}>
          <div className="settingsSidebarNav">
            <button
              className={`settingsTabButton ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              General
            </button>
            <button
              className={`settingsTabButton ${activeTab === "appearance" ? "active" : ""}`}
              onClick={() => setActiveTab("appearance")}
            >
              Appearance
            </button>
            <button
              className={`settingsTabButton ${activeTab === "model" ? "active" : ""}`}
              onClick={() => setActiveTab("model")}
            >
              Model & RAG
            </button>
            <button
              className={`settingsTabButton ${activeTab === "data" ? "active" : ""}`}
              onClick={() => setActiveTab("data")}
            >
              Data & Storage
            </button>
            <button
              className={`settingsTabButton ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              About
            </button>
          </div>

          <div className="settingsTabContent">
            {activeTab === "general" && (
              <>
                <div className="inputFormField">
                  <label className="inputFieldLabel">Default Persona</label>
                  <select
                    className="standardInputText"
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                  >
                    {PERSONAS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Student: learning-oriented • Developer: technical • Interviewer: conceptual
                  </small>
                </div>

                <div className="inputFormField" style={{ marginTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px" }}>Conversation Memory</div>
                      <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        Use last 8 turns for follow-up context
                      </small>
                    </div>
                    <input
                      type="checkbox"
                      checked={memoryEnabled}
                      onChange={(e) => setMemoryEnabled(e.target.checked)}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <div>
                  <h4 style={{ fontSize: "15px", fontWeight: 800, marginBottom: "4px" }}>Theme Modes</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Switch between light and dark visual themes
                  </p>
                </div>

                {/* Theme Mode Cards (From reference image bottom right) */}
                <div className="themeModeCardsGrid">
                  <div
                    className={`themeSelectCard ${theme === "light" ? "active" : ""}`}
                    onClick={() => setTheme("light")}
                  >
                    <div className="themeCardInfo">
                      <div className="themeIconOrb light">☀️</div>
                      <div className="themeCardTexts">
                        <span className="themeName">Light Mode</span>
                        <span className="themeDesc">Clean and minimal interface</span>
                      </div>
                    </div>
                    <div className="themeRadioCheck">
                      {theme === "light" && "✓"}
                    </div>
                  </div>

                  <div
                    className={`themeSelectCard ${theme === "dark" ? "active" : ""}`}
                    onClick={() => setTheme("dark")}
                  >
                    <div className="themeCardInfo">
                      <div className="themeIconOrb dark">🌙</div>
                      <div className="themeCardTexts">
                        <span className="themeName">Dark Mode</span>
                        <span className="themeDesc">Eye-friendly for longer use</span>
                      </div>
                    </div>
                    <div className="themeRadioCheck">
                      {theme === "dark" && "✓"}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "model" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>LLM Provider</span>
                    <p style={{ fontWeight: 800 }}>Groq Cloud (Fast LPUs)</p>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>Active Model</span>
                    <p style={{ fontWeight: 800 }}>qwen/qwen3.8-27b</p>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>Embedding Model</span>
                    <p style={{ fontWeight: 800 }}>sentence-transformers/all-MiniLM-L6-v2 (384-dim)</p>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>Vector Database</span>
                    <p style={{ fontWeight: 800 }}>Supabase Postgres + pgvector with HNSW index</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === "data" && (
              <>
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>Conversation Turns</span>
                  <p style={{ fontWeight: 800 }}>{Math.floor((chatHistoryLength || 0) / 2)} turns cached locally</p>
                </div>
                <button
                  className="chunkActionButton"
                  style={{ alignSelf: "flex-start", color: "#ef4444", padding: "8px 16px" }}
                  onClick={onClearMemory}
                >
                  Clear Conversation Memory
                </button>
              </>
            )}

            {activeTab === "about" && (
              <>
                <div>
                  <h4 style={{ fontSize: "16px", fontWeight: 800 }}>KnowledgeFlow v2.0.0</h4>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Multi-source knowledge processing & grounded generative retrieval system.
                  </p>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Built with Next.js, FastAPI, SentenceTransformers, Supabase PostgreSQL with pgvector, and Groq ultra-low-latency LPU inference.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
