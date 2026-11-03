"use client";

export default function MobileBottomNav({ currentView, setCurrentView, onOpenSettings }) {
  const navItems = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "ingest", label: "Ingest", icon: "📥" },
    { id: "collections", label: "Collections", icon: "📁" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "activity", label: "Activity", icon: "🕒" },
  ];

  return (
    <nav className="mobileBottomNav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`mobileNavBtn ${currentView === item.id ? "active" : ""}`}
          onClick={() => setCurrentView(item.id)}
          title={item.label}
        >
          <span className="mobileNavIcon">{item.icon}</span>
          <span className="mobileNavLabel">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
