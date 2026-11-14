export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://multisource-rag-backend-ikyw.onrender.com";

export const SOURCE_TABS = [
  { id: "text", label: "Text", hint: "Paste notes, docs, snippets" },
  { id: "file", label: "File", hint: "PDF, TXT, DOCX, PPTX" },
  { id: "url", label: "Website", hint: "Extract readable page text" },
  { id: "youtube", label: "YouTube", hint: "Use video transcript" },
];

export const RAG_MODES = [
  { value: "standard", label: "Standard", desc: "Balanced & grounded" },
  { value: "deep_research", label: "Deep Research", desc: "Analytical synthesis" },
  { value: "concise", label: "Concise", desc: "Crisp bullet points" },
  { value: "code_focused", label: "Code-Focused", desc: "Syntax & architecture" },
];

export const PERSONAS = [
  { value: "standard", label: "⚡ Standard" },
  { value: "deep_research", label: "🔬 Deep Research" },
  { value: "concise", label: "✂️ Concise" },
  { value: "code_focused", label: "💻 Code-Focused" },
  { value: "student", label: "🎓 Student" },
  { value: "interviewer", label: "💼 Interviewer" },
];

export const EXAMPLE_QUESTIONS = [
  "Summarize the key idea from this collection.",
  "Explain this like I am preparing for an interview.",
  "What are the most important points from the sources?",
  "Give me possible interview questions from this content.",
];
