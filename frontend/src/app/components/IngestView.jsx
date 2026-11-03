"use client";

import { useRef, useState } from "react";
import { SOURCE_TABS } from "../lib/constants";

export default function IngestView({
  collectionName,
  sourceName,
  setSourceName,
  rawText,
  setRawText,
  url,
  setUrl,
  youtubeUrl,
  setYoutubeUrl,
  file,
  setFile,
  ingestLoading,
  handleIngest,
  activeTab,
  setActiveTab,
}) {
  const fileInputRef = useRef(null);

  const tabsConfig = [
    { id: "text", label: "Paste notes", icon: "📝" },
    { id: "file", label: "File Upload", icon: "📁" },
    { id: "url", label: "Web URL Extract", icon: "🌐" },
    { id: "youtube", label: "YouTube Transcript", icon: "▶️" },
  ];

  function handleFileDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setActiveTab("file");
    }
  }

  return (
    <div className="ingestViewContainer">
      <div>
        <h2 className="viewHeaderTitle">Ingest Knowledge Sources</h2>
        <p className="viewHeaderSubtitle">
          Extract, clean, chunk, and embed knowledge into workspace: <strong>{collectionName}</strong>
        </p>
      </div>

      {/* Drag & Drop Dropzone (From reference image) */}
      <div
        className="dragDropDropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => {
          setActiveTab("file");
          fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx,.pptx"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) setFile(e.target.files[0]);
          }}
        />

        <div className="dropzoneIconCloud">☁️</div>
        <div className="dropzoneMainText">
          {file ? `Selected: ${file.name}` : "Drag & drop files here, or browse"}
        </div>
        <div className="dropzoneHintText">
          Supports PDF, DOCX, PPTX, TXT, MD (Max 10 MB)
        </div>
      </div>

      {/* Quick Source Type Buttons (From reference image) */}
      <div className="quickSourceTypeTabs">
        {tabsConfig.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sourceTypeSelectButton ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sourceTypeIcon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Ingestion Form Body */}
      <div className="ingestFormCard">
        {(activeTab === "text" || activeTab === "file") && (
          <div className="inputFormField">
            <label className="inputFieldLabel">Source Title / Reference Name</label>
            <input
              type="text"
              className="standardInputText"
              placeholder={activeTab === "file" ? "Defaults to filename" : "e.g. dynamic_programming_lecture"}
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
          </div>
        )}

        {activeTab === "text" && (
          <div className="inputFormField">
            <label className="inputFieldLabel">Raw Text / Code / Notes</label>
            <textarea
              className="standardTextarea"
              rows={8}
              placeholder="Paste lecture notes, study guide, documentation or meeting summary here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>
        )}

        {activeTab === "url" && (
          <div className="inputFormField">
            <label className="inputFieldLabel">Website Article / Documentation URL</label>
            <input
              type="url"
              className="standardInputText"
              placeholder="https://en.wikipedia.org/wiki/Dynamic_programming"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}

        {activeTab === "youtube" && (
          <div className="inputFormField">
            <label className="inputFieldLabel">YouTube Video URL</label>
            <input
              type="url"
              className="standardInputText"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>
        )}

        <button
          className="primaryActionButton"
          onClick={handleIngest}
          disabled={ingestLoading}
        >
          {ingestLoading ? "Processing & Vectorizing..." : "⚡ Ingest & Vectorize Source"}
        </button>
      </div>
    </div>
  );
}
