"use client";

function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} style={{ color: "inherit", fontWeight: 750 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function AnswerBlocks({ answer }) {
  const lines = String(answer || "").split("\n");

  let inCallout = false;
  let calloutLines = [];
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line starts a real world example or callout
    if (trimmed.toLowerCase().includes("real-world example") || trimmed.toLowerCase().includes("example:")) {
      inCallout = true;
      calloutLines = [trimmed];
      continue;
    }

    if (inCallout) {
      if (!trimmed && calloutLines.length > 2) {
        blocks.push({ type: "callout", content: calloutLines.join("\n") });
        inCallout = false;
        calloutLines = [];
      } else {
        calloutLines.push(trimmed);
      }
      continue;
    }

    if (!trimmed) {
      blocks.push({ type: "spacer" });
      continue;
    }

    const markdownHeading = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (markdownHeading) {
      blocks.push({ type: "heading", content: markdownHeading[1].replace(/:$/, "") });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "heading", content: trimmed.replace(/^###\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading", content: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading", content: trimmed.replace(/^#\s+/, "") });
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      blocks.push({ type: "bullet", content: bullet[1] });
      continue;
    }

    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({ type: "numbered", num: numbered[1], content: numbered[2] });
      continue;
    }

    blocks.push({ type: "paragraph", content: trimmed });
  }

  if (inCallout && calloutLines.length > 0) {
    blocks.push({ type: "callout", content: calloutLines.join("\n") });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {blocks.map((block, index) => {
        if (block.type === "spacer") {
          return <div key={index} style={{ height: "4px" }} />;
        }
        if (block.type === "heading") {
          return (
            <h4
              key={index}
              style={{
                fontSize: "15px",
                fontWeight: 800,
                marginTop: "10px",
                marginBottom: "2px",
                color: "var(--brand-blue)",
              }}
            >
              {renderInline(block.content)}
            </h4>
          );
        }
        if (block.type === "callout") {
          return (
            <div key={index} className="realWorldCalloutBox">
              <div className="calloutTitle">💡 Real-world Example</div>
              <p>{renderInline(block.content.replace(/^[#*-]*\s*(real-world example:?|example:?)/i, "").trim())}</p>
            </div>
          );
        }
        if (block.type === "bullet") {
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginLeft: "4px" }}
            >
              <span style={{ color: "var(--brand-blue)", fontWeight: "bold" }}>•</span>
              <p style={{ margin: 0 }}>{renderInline(block.content)}</p>
            </div>
          );
        }
        if (block.type === "numbered") {
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginLeft: "4px" }}
            >
              <span style={{ color: "var(--brand-blue)", fontWeight: "bold", fontSize: "12px", minWidth: "16px" }}>
                {block.num}.
              </span>
              <p style={{ margin: 0 }}>{renderInline(block.content)}</p>
            </div>
          );
        }
        return (
          <p key={index} style={{ margin: 0 }}>
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}
