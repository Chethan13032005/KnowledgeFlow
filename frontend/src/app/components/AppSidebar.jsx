"use client";

export default function AppSidebar({
  currentView,
  setCurrentView,
  collectionName,
  setCollectionName,
  collections,
  stats,
  onOpenSettings,
}) {
  const navItems = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "ingest", label: "Ingest Sources", icon: "📥" },
    { id: "collections", label: "Collections", icon: "📁" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "activity", label: "Activity Log", icon: "🕒" },
  ];

  // Dynamic storage estimation based on chunks/characters
  const charCount = stats?.characters || 0;
  const simulatedMb = (charCount / (1024 * 1024)).toFixed(1);
  const displayMb = Math.max(0.1, Number(simulatedMb));
  const percentUsed = Math.min(100, Math.max(8, (displayMb / 10) * 100));

  return (
    <aside className="leftNavSidebar">
      <div className="sidebarTopSection">
        <div className="sidebarBrand">
          <div className="brandLogoIcon" style={{ width: "30px", height: "30px", fontSize: "14px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span className="sidebarBrandText">KnowledgeFlow</span>
        </div>

        <nav className="sidebarNavList">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`navItemButton ${currentView === item.id ? "active" : ""}`}
              onClick={() => setCurrentView(item.id)}
            >
              <span className="navIcon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebarBottomSection">
        <div className="workspaceSelectBox">
          <label className="workspaceLabel">Workspace</label>
          <select
            className="workspaceDropdown"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          >
            {collections.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
            {!collections.includes(collectionName) && (
              <option value={collectionName}>{collectionName}</option>
            )}
          </select>
        </div>

        <div className="storageIndicatorCard">
          <div className="storageHeader">
            <span>Storage</span>
            <span className="storageVal">{displayMb} MB / 10 GB</span>
          </div>
          <div className="storageProgressBar">
            <div className="storageProgressFill" style={{ width: `${percentUsed}%` }} />
          </div>
        </div>

        <button className="settingsButton" onClick={onOpenSettings}>
          <span>⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
