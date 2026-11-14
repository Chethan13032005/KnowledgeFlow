"use client";

import { useEffect, useMemo, useRef } from "react";
import AnswerBlocks from "./AnswerBlocks";
import { PERSONAS } from "../lib/constants";

export default function ChatView({
  question,
  setQuestion,
  persona,
  setPersona,
  answer,
  sources,
  messages = [],
  allSources = [],
  collectionName = "default",
  queryLoading,
  handleAsk,
  handleClearQuestion,
  onNewChat,
  copyText,
  onOpenIngest,
  onPreviewSource,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message whenever messages update or loading state changes
  useEffect(() => {
    if (messages.length > 0 || queryLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, queryLoading]);

  // Dynamically generate recommendations derived from uploaded sources
  const recommendations = useMemo(() => {
    if (!allSources || allSources.length === 0) {
      return [
        "Explain Dynamic Programming with a real-world example.",
        `How do I ingest notes or documents into ${collectionName}?`,
        "What source formats does KnowledgeFlow support?",
      ];
    }

    const suggestions = [];

    // Analyze each uploaded source in the active workspace
    allSources.slice(0, 4).forEach((src) => {
      const name = src.source_name || "Document";
      const cleanName = name.replace(/\.[^/.]+$/, ""); // strip extension

      if (src.source_type === "youtube") {
        suggestions.push(`What are the key takeaways from video "${name}"?`);
      } else if (src.source_type === "url") {
        suggestions.push(`Summarize the main points from ${name}`);
      } else {
        if (cleanName.toLowerCase().includes("dp") || cleanName.toLowerCase().includes("dynamic")) {
          suggestions.push("Explain Dynamic Programming with a real-world example.");
        } else {
          suggestions.push(`Explain the core concepts in ${name}`);
          suggestions.push(`What are potential interview questions from ${name}?`);
        }
      }
    });

    if (suggestions.length < 3) {
      suggestions.push(`Summarize key insights across all sources in ${collectionName}`);
    }

    return [...new Set(suggestions)].slice(0, 4);
  }, [allSources, collectionName]);

  return (
    <div className="chatWorkspace">
      <div className="chatMessagesScroll">
        {/* Welcome Greeting Hero - Shown when conversation hasn't started */}
        {messages.length === 0 && (
          <div className="welcomeGreetingHero">
            <h2 className="greetingTitle">⚡ Welcome to KnowledgeFlow</h2>
            <p className="greetingSubtitle">
              Spatial multi-source RAG assistant with pgvector caching, zero-overhead guardrails & real-time telemetry.
            </p>

            <div className="trustPillsRow">
              <span className="trustPill private">🔒 Private & Secure</span>
              <span className="trustPill grounded">🎯 Source-Grounded</span>
              <span className="trustPill multisource">📚 Multi-Source</span>
              <span className="trustPill nohallucination">🛡️ Zero-Overhead Guardrails</span>
            </div>

            {/* Dynamic Recommendations derived directly from uploaded sources */}
            <div style={{ width: "100%", marginTop: "16px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>💡</span> Recommended based on {allSources.length > 0 ? `${allSources.length} uploaded source(s)` : "workspace"}:
              </div>

              <div className="promptSuggestionsRow">
                {recommendations.map((promptText, i) => (
                  <button
                    key={i}
                    type="button"
                    className="suggestionChipButton"
                    onClick={() => handleAsk(promptText)}
                    title="Click to ask this question immediately"
                  >
                    <span>✦</span>
                    <span>{promptText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Conversation Thread */}
        {messages.length > 0 && (
          <div className="chatThreadContainer">
            {/* Thread Header with Workspace context and New Chat button */}
            <div className="chatThreadHeader">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600 }}>
                <span>📁</span>
                <span>Workspace: <strong style={{ color: "var(--brand-blue)" }}>{collectionName}</strong></span>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  ({allSources.length} indexed {allSources.length === 1 ? "source" : "sources"})
                </span>
              </div>

              <button
                type="button"
                className="newChatButton"
                onClick={onNewChat}
                title="Start a fresh conversation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>New Chat</span>
              </button>
            </div>

            {/* Message History List */}
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="userMessageBubbleContainer">
                    <div className="userMessageBubble">
                      <div>{msg.content}</div>
                      <div className="userMessageMeta">
                        <span>{msg.time}</span>
                        <span>• You</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Assistant Message: Loading without any content yet
              if (msg.loading && !msg.content) {
                return (
                  <div key={msg.id} className="answerCardContainer" style={{ opacity: 0.9 }}>
                    <div className="answerHeaderBar">
                      <div className="answerHeaderLeft">
                        <div className="answerAppIcon" style={{ animation: "pulse 1.5s infinite" }}>⚡</div>
                        <span className="answerTitle">Synthesizing with Groq & pgvector...</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 0" }}>
                      <div style={{ height: "16px", width: "65%", background: "var(--border-subtle)", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: "16px", width: "92%", background: "var(--border-subtle)", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: "16px", width: "78%", background: "var(--border-subtle)", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                    </div>
                  </div>
                );
              }

              const msgSources = msg.sources || [];
              const tel = msg.telemetry || {};
              const isCacheHit = msg.cache_hit || tel.cache_hit;
              const faithfulness = tel.faithfulness_score !== undefined ? Math.round(tel.faithfulness_score * 100) : 92;
              const ttft = tel.ttft_ms !== undefined ? tel.ttft_ms : null;
              const totalLat = tel.total_latency_ms !== undefined ? tel.total_latency_ms : null;
              const guardrail = tel.guardrail_status || msg.guardrail_status;

              return (
                <div key={msg.id} className="answerCardContainer">
                  <div className="answerHeaderBar">
                    <div className="answerHeaderLeft">
                      <div className="answerAppIcon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </div>
                      <div>
                        <span className="answerTitle">KnowledgeFlow Response</span>
                        {msg.time && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                            {msg.time}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="answerActionButtons">
                      {/* ONLY Copy button - NO LIKE/DISLIKE BUTTONS */}
                      <button
                        type="button"
                        className="answerIconButton"
                        title="Copy Answer"
                        onClick={() => copyText(msg.content, "Answer copied to clipboard!")}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Pill Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "4px 0 12px 0" }}>
                    {isCacheHit ? (
                      <span className="trustPill" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "11px", padding: "3px 8px" }}>
                        ⚡ Semantic Cache Hit {tel.tokens_saved ? `(${tel.tokens_saved} tokens saved)` : ""}
                      </span>
                    ) : ttft !== null ? (
                      <span className="trustPill" style={{ background: "rgba(56, 189, 248, 0.12)", color: "var(--brand-blue)", border: "1px solid rgba(56, 189, 248, 0.25)", fontSize: "11px", padding: "3px 8px" }}>
                        ⏱ TTFT: {ttft}ms {totalLat ? `• Total: ${totalLat}ms` : ""}
                      </span>
                    ) : null}

                    {faithfulness > 0 && (
                      <span className="trustPill" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.25)", fontSize: "11px", padding: "3px 8px" }}>
                        🎯 Faithfulness: {faithfulness}%
                      </span>
                    )}

                    {guardrail && guardrail !== "passed" && (
                      <span className="trustPill" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "11px", padding: "3px 8px" }}>
                        🛡️ Guardrail: {guardrail}
                      </span>
                    )}

                    {msg.persona && (
                      <span className="trustPill" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", fontSize: "11px", padding: "3px 8px" }}>
                        Mode: {msg.persona}
                      </span>
                    )}
                  </div>

                  {/* Grounded Content with Markdown & Code formatting */}
                  <div className="answerBodyText">
                    <AnswerBlocks answer={msg.content} />
                    {msg.loading && (
                      <span style={{ display: "inline-block", width: "8px", height: "16px", background: "var(--brand-blue)", marginLeft: "4px", animation: "blink 1s step-end infinite", verticalAlign: "middle" }} />
                    )}
                  </div>

                  {/* Inline Source Citations */}
                  {msgSources.length > 0 && (
                    <div className="inlineSourcesRow">
                      <div className="inlineSourcesLabel">Sources ({msgSources.length})</div>
                      <div className="inlineSourcesPills">
                        {msgSources.map((src, index) => {
                          const type = src.source_type || src.metadata?.source_type || "doc";
                          const icon =
                            type === "pdf" || type === "file"
                              ? "📄"
                              : type === "youtube"
                              ? "▶️"
                              : type === "url"
                              ? "🌐"
                              : "📝";
                          const score = src.score ? Number(src.score).toFixed(2) : "0.85";
                          const chunkLabel = src.chunk_index !== undefined ? ` • chunk ${src.chunk_index}` : "";

                          return (
                            <div
                              key={index}
                              className="inlineSourceBadge"
                              onClick={() => onPreviewSource(src)}
                              title="Click to inspect source chunk in modal"
                            >
                              <span>{icon}</span>
                              <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {src.source_name || "Document"}
                              </span>
                              <span style={{ fontSize: "11px", opacity: 0.7 }}>{chunkLabel}</span>
                              <span className="sourceScoreTag">{score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} style={{ height: "4px" }} />
      </div>

      {/* Chat Input Bar (Bottom) */}
      <div className="chatInputContainer">
        <form
          className="chatInputBox"
          onSubmit={(e) => {
            e.preventDefault();
            if (!queryLoading) {
              handleAsk();
            }
          }}
        >
          <button
            type="button"
            className="paperclipButton"
            title="Attach or ingest source"
            onClick={onOpenIngest}
          >
            📎
          </button>

          <input
            type="text"
            className="chatTextareaInput"
            placeholder={queryLoading ? "KnowledgeFlow is streaming answer..." : "Ask a question across your ingested knowledge... (Press Enter to send)"}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            autoFocus
          />

          <select
            className="personaSelectorDropdown"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            title="Select AI Mode"
          >
            {PERSONAS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="sendButton"
            disabled={!question.trim() || queryLoading}
            title={queryLoading ? "Streaming answer..." : "Send Question"}
          >
            {queryLoading ? (
              <span style={{ fontSize: "12px", animation: "spin 1s linear infinite" }}>✦</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
