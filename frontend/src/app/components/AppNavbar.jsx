"use client";

export default function AppNavbar({
  collectionName,
  onOpenCollections,
  onOpenSearch,
  onOpenSettings,
  notificationsCount = 2,
}) {
  return (
    <nav className="appNavbar">
      <div className="navbarLeft">
        <button className="collectionPillSelector" onClick={onOpenCollections}>
          <span>📁</span>
          <span>{collectionName}</span>
          <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
        </button>

        <div className="globalSearchBar" onClick={onOpenSearch}>
          <span>🔍</span>
          <span>Search sources, collections...</span>
          <span className="kbdShortcut">Ctrl K</span>
        </div>
      </div>

      <div className="navbarRight">
        <button
          className="iconActionButton"
          title="System Status: Supabase Postgres & Groq AI operational"
          style={{ position: "relative" }}
          onClick={() => alert("System Status: Supabase Postgres & Groq AI are operational!")}
        >
          <span>🔔</span>
          {notificationsCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "6px",
                right: "6px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
          )}
        </button>

        <div
          className="userProfileAvatar"
          title="Chethan (Signed in)"
          onClick={onOpenSettings}
        >
          C
        </div>
      </div>
    </nav>
  );
}
