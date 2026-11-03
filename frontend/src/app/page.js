"use client";

import { useEffect, useRef, useState } from "react";
import { request } from "./lib/api";

import BrandHeader from "./components/BrandHeader";
import AppSidebar from "./components/AppSidebar";
import AppNavbar from "./components/AppNavbar";
import ChatView from "./components/ChatView";
import RightSidebar from "./components/RightSidebar";
import IngestView from "./components/IngestView";
import CollectionsView from "./components/CollectionsView";
import AnalyticsView from "./components/AnalyticsView";
import ActivityLogView from "./components/ActivityLogView";
import SettingsModal from "./components/SettingsModal";
import SourcePreviewModal from "./components/SourcePreviewModal";
import SearchModal from "./components/SearchModal";
import MobileBottomNav from "./components/MobileBottomNav";

export default function Home() {
  // Theme State ("light" | "dark")
  const [theme, setTheme] = useState("dark");

  // Navigation State ("chat" | "ingest" | "collections" | "analytics" | "activity")
  const [currentView, setCurrentView] = useState("chat");

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState(null);

  // Workspace / Collection
  const [collectionName, setCollectionName] = useState("dsa-placement-master");
  const [collections, setCollections] = useState(["dsa-placement-master"]);
  const [stats, setStats] = useState(null);
  const [allSources, setAllSources] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Ingestion Inputs
  const [activeTab, setActiveTab] = useState("text");
  const [sourceName, setSourceName] = useState("dsa_notes");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  // Chat & Q&A
  const [question, setQuestion] = useState("");
  const [persona, setPersona] = useState("student");
  const [topK, setTopK] = useState(3);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Toast & Activity
  const [toast, setToast] = useState(null);
  const [activity, setActivity] = useState([
    {
      id: "1",
      type: "ingest",
      message: "Ingested DP_Notes.pdf into dsa-placement-master",
      time: "10 mins ago",
    },
    {
      id: "2",
      type: "query",
      message: 'Asked "Explain Dynamic Programming with real-world example"',
      time: "5 mins ago",
    },
  ]);

  // Load Theme Preference on Mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("knowledgeflow-theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  function handleThemeChange(newTheme) {
    const target = (typeof newTheme === "string" && (newTheme === "light" || newTheme === "dark"))
      ? newTheme
      : (theme === "dark" ? "light" : "dark");
    console.log("[KnowledgeFlow ThemeChange]", { newTheme, target, currentTheme: theme });
    setTheme(target);
    try {
      localStorage.setItem("knowledgeflow-theme", target);
    } catch (e) {}
    document.documentElement.setAttribute("data-theme", target);
  }

  function toggleTheme() {
    handleThemeChange(theme === "dark" ? "light" : "dark");
  }

  function pushActivity(type, message) {
    setActivity((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        message,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ].slice(0, 20));
  }

  function showToast(type, message) {
    setToast({ type, message });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 4000);
  }

  async function copyText(text, successMessage = "Copied!") {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast("success", successMessage);
    } catch {
      showToast("error", "Failed to copy");
    }
  }

  // Load Collections from Backend
  async function loadCollections() {
    try {
      const data = await request("/collections");
      if (Array.isArray(data.collections) && data.collections.length > 0) {
        setCollections(data.collections);
      }
    } catch {
      // keep default
    }
  }

  // Load Collection Stats
  async function loadStats(name = collectionName) {
    if (!name?.trim()) return;
    try {
      const data = await request(`/collections/${encodeURIComponent(name.trim())}/stats`);
      setStats(data);
    } catch {
      setStats(null);
    }
  }

  // Load Collection Sources (for "All Sources" tab)
  async function loadCollectionSources(name = collectionName) {
    if (!name?.trim()) return;
    try {
      const data = await request(`/collections/${encodeURIComponent(name.trim())}/sources`);
      setAllSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setAllSources([]);
    }
  }

  // Load Global Analytics
  async function loadAnalytics() {
    try {
      const data = await request("/analytics");
      setAnalyticsData(data);
    } catch {
      // keep fallback
    }
  }

  // Initial Load
  useEffect(() => {
    loadCollections();
    loadAnalytics();
  }, []);

  // When collection changes
  useEffect(() => {
    loadStats(collectionName);
    loadCollectionSources(collectionName);

    try {
      const stored = localStorage.getItem(`knowledgeflow-memory:${collectionName.trim()}`);
      setChatHistory(stored ? JSON.parse(stored) : []);
    } catch {
      setChatHistory([]);
    }
  }, [collectionName]);

  // Persist chat history
  useEffect(() => {
    if (!collectionName?.trim() || !memoryEnabled) return;
    try {
      localStorage.setItem(
        `knowledgeflow-memory:${collectionName.trim()}`,
        JSON.stringify(chatHistory.slice(-8))
      );
    } catch {}
  }, [chatHistory, collectionName, memoryEnabled]);

  // Handle Ingest
  async function handleIngest() {
    const col = collectionName.trim();
    if (!col) {
      showToast("error", "Collection name is required.");
      return;
    }

    setIngestLoading(true);

    try {
      let data;
      if (activeTab === "text") {
        if (!rawText.trim()) throw new Error("Please enter some text or notes.");
        data = await request("/ingest/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_name: col,
            source_name: sourceName.trim() || "pasted_notes",
            text: rawText,
          }),
        });
      } else if (activeTab === "file") {
        if (!file) throw new Error("Please select a document file first.");
        const form = new FormData();
        form.append("collection_name", col);
        form.append("source_name", sourceName.trim() || file.name);
        form.append("file", file);
        data = await request("/ingest/file", {
          method: "POST",
          body: form,
        });
      } else if (activeTab === "url") {
        if (!url.trim()) throw new Error("Please enter a valid website URL.");
        data = await request("/ingest/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_name: col,
            url: url.trim(),
          }),
        });
      } else if (activeTab === "youtube") {
        if (!youtubeUrl.trim()) throw new Error("Please enter a YouTube video URL.");
        data = await request("/ingest/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_name: col,
            url: youtubeUrl.trim(),
          }),
        });
      }

      const added = data?.chunks_added ?? 0;
      const msg = added === 0 ? "Duplicate source skipped." : `Successfully ingested ${added} chunks!`;
      showToast(added === 0 ? "info" : "success", msg);
      pushActivity("ingest", `${msg} (${data?.source_name || col})`);

      await loadCollections();
      await loadStats(col);
      await loadCollectionSources(col);
      await loadAnalytics();

      // Clear input fields
      setRawText("");
      setUrl("");
      setYoutubeUrl("");
      setFile(null);
    } catch (err) {
      showToast("error", err.message);
      pushActivity("error", err.message);
    } finally {
      setIngestLoading(false);
    }
  }

  // Handle Ask / Query as clean conversational chatbot
  async function handleAsk(promptOverride) {
    const col = collectionName.trim();
    if (!col) {
      showToast("error", "Collection name is required.");
      return;
    }

    const q = (typeof promptOverride === "string" ? promptOverride : question).trim();
    if (!q) return;

    // Immediately clear the typing area so the user can see it sent!
    setQuestion("");

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = "user-" + Date.now();
    const assistantMsgId = "asst-" + (Date.now() + 1);

    const userMessage = {
      id: userMsgId,
      role: "user",
      content: q,
      time: timeString,
    };

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      sources: [],
      loading: true,
      time: timeString,
      persona,
    };

    // Append both to chatbot message history immediately
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setQueryLoading(true);

    try {
      const data = await request("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: col,
          question: q,
          top_k: Number(topK),
          persona,
          chat_history: memoryEnabled ? chatHistory.slice(-6) : [],
        }),
      });

      const ans = data.answer || "";
      const srcs = Array.isArray(data.sources) ? data.sources : [];

      // Update assistant message with grounded answer and retrieved sources
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: ans, sources: srcs, loading: false }
            : msg
        )
      );

      setAnswer(ans);
      setSources(srcs);

      if (memoryEnabled) {
        setChatHistory((prev) => [
          ...prev,
          { role: "user", content: q },
          { role: "assistant", content: ans },
        ].slice(-8));
      }

      pushActivity("query", `Asked: ${q.slice(0, 50)}...`);
      setCurrentView("chat");
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `Error: ${err.message}`,
                sources: [],
                loading: false,
                isError: true,
              }
            : msg
        )
      );
      showToast("error", err.message);
      pushActivity("error", err.message);
    } finally {
      setQueryLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setQuestion("");
    setAnswer("");
    setSources([]);
    showToast("info", "Started fresh chat conversation.");
  }

  function handleClearQuestion() {
    setQuestion("");
    setAnswer("");
    setSources([]);
  }

  function handleClearMemory() {
    setChatHistory([]);
    localStorage.removeItem(`knowledgeflow-memory:${collectionName.trim()}`);
    showToast("success", "Conversation memory cleared.");
    pushActivity("delete", "Cleared conversation memory");
  }

  async function handleDeleteCollection(colToDelete) {
    const target = colToDelete || collectionName;
    if (!window.confirm(`Delete workspace "${target}" and all its vector chunks?`)) return;

    try {
      await request(`/collections/${encodeURIComponent(target)}`, { method: "DELETE" });
      showToast("success", `Workspace "${target}" deleted.`);
      pushActivity("delete", `Deleted workspace ${target}`);

      const remaining = collections.filter((c) => c !== target);
      setCollections(remaining);
      if (collectionName === target) {
        setCollectionName(remaining[0] || "default");
      }
      await loadCollections();
      await loadAnalytics();
    } catch (err) {
      showToast("error", err.message);
    }
  }

  function handleCreateCollection(newName) {
    if (!newName) return;
    const clean = newName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (!collections.includes(clean)) {
      setCollections((prev) => [clean, ...prev]);
    }
    setCollectionName(clean);
    showToast("success", `Switched to workspace "${clean}"`);
    pushActivity("ingest", `Created new workspace: ${clean}`);
  }

  return (
    <div className="appContainer">
      {/* Top Banner */}
      <BrandHeader
        theme={theme}
        onToggleTheme={handleThemeChange}
      />

      {/* Main Workspace (3-Column Layout) */}
      <div className="mainLayoutWrapper">
        {/* Left Navigation Sidebar */}
        <AppSidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          collectionName={collectionName}
          setCollectionName={setCollectionName}
          collections={collections}
          stats={stats}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Center View Area */}
        <div className="centerContentArea">
          {/* Top Bar with Collection Selector & Search */}
          <AppNavbar
            collectionName={collectionName}
            onOpenCollections={() => setCurrentView("collections")}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {/* Dynamic Sub-View Switcher */}
          {currentView === "chat" && (
            <ChatView
              question={question}
              setQuestion={setQuestion}
              persona={persona}
              setPersona={setPersona}
              answer={answer}
              sources={sources}
              messages={messages}
              allSources={allSources}
              collectionName={collectionName}
              queryLoading={queryLoading}
              handleAsk={handleAsk}
              handleClearQuestion={handleClearQuestion}
              onNewChat={handleNewChat}
              copyText={copyText}
              onOpenIngest={() => setCurrentView("ingest")}
              onPreviewSource={(src) => setPreviewSource(src)}
            />
          )}

          {currentView === "ingest" && (
            <IngestView
              collectionName={collectionName}
              sourceName={sourceName}
              setSourceName={setSourceName}
              rawText={rawText}
              setRawText={setRawText}
              url={url}
              setUrl={setUrl}
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              file={file}
              setFile={setFile}
              ingestLoading={ingestLoading}
              handleIngest={handleIngest}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}

          {currentView === "collections" && (
            <CollectionsView
              collections={collections}
              activeCollection={collectionName}
              onSelectCollection={(c) => {
                setCollectionName(c);
                setCurrentView("chat");
              }}
              onDeleteCollection={handleDeleteCollection}
              onCreateCollection={handleCreateCollection}
            />
          )}

          {currentView === "analytics" && (
            <AnalyticsView
              analyticsData={analyticsData}
              stats={stats}
              collectionName={collectionName}
            />
          )}

          {currentView === "activity" && (
            <ActivityLogView
              activity={activity}
              onClearActivity={() => setActivity([])}
            />
          )}
        </div>

        {/* Right Evidence Sidebar (Retrieved Chunks & All Sources) */}
        <RightSidebar
          sources={sources}
          allSources={allSources}
          copyText={copyText}
          onPreviewSource={(src) => setPreviewSource(src)}
        />
      </div>

      {/* Settings Modal (with Light/Dark Mode switch cards) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={handleThemeChange}
        persona={persona}
        setPersona={setPersona}
        memoryEnabled={memoryEnabled}
        setMemoryEnabled={setMemoryEnabled}
        onClearMemory={handleClearMemory}
        chatHistoryLength={chatHistory.length}
      />

      {/* Source Preview Modal */}
      <SourcePreviewModal
        isOpen={Boolean(previewSource)}
        source={previewSource}
        onClose={() => setPreviewSource(null)}
      />

      {/* Ctrl+K Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        collections={collections}
        onSelectCollection={(c) => {
          setCollectionName(c);
          setCurrentView("chat");
        }}
        onSelectPrompt={(p) => {
          setQuestion(p);
          setCurrentView("chat");
        }}
      />

      {/* Toast Notifications */}
      {toast && (
        <div className="toastOverlay">
          <div className={`toastPill ${toast.type}`}>
            <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation — only visible on ≤768px */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );
}
