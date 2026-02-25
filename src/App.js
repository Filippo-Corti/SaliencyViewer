import { useState, useMemo } from "react";

const DEFAULT_INPUT = `[
  ["\\u010a", 9.5],
  ["You", 1.0],
  ["\\u0120are", 0.9],
  ["\\u0120a", 4.0],
  ["\\u0120helpful", 2.5],
  ["\\u0120assistant", 1.8],
  [".\\u010a", 1.4],
  ["Command", 11.1],
  [":\\u010a", 7.3],
  ["Go", 19.6],
  ["\\u0120press", 16.6],
  ["\\u0120that", 8.4],
  ["\\u0120switch", 12.0]
]`;

// Clean GPT-style unicode artifacts from a token string:
// \u0120 (Ġ) = space prefix, \u010a (Ċ) = newline
function cleanToken(tok) {
  // Replace Ġ (U+0120) with a space, Ċ (U+010A) with newline
  return tok
    .replace(/\u0120/g, " ")
    .replace(/\u010a/g, "\n");
}

// Parse the cleaned token into renderable segments: array of {type: 'text'|'space'|'newline', value}
function tokenSegments(raw) {
  const cleaned = cleanToken(raw);
  // Split on newlines to get segments
  const parts = cleaned.split("\n");
  const segments = [];
  parts.forEach((part, i) => {
    if (part.length > 0) segments.push({ type: "text", value: part });
    if (i < parts.length - 1) segments.push({ type: "newline" });
  });
  return segments;
}

function interpolateColor(norm) {
  // White (low) → orange → deep red (high)
  // norm in [0, 1]
  const stops = [
    [0,    [248, 248, 245]],
    [0.3,  [255, 235, 210]],
    [0.55, [255, 180, 100]],
    [0.8,  [230, 90,  40]],
    [1.0,  [160, 20,  10]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (norm >= t0 && norm <= t1) {
      const t = (t1 === t0) ? 0 : (norm - t0) / (t1 - t0);
      return c0.map((c, j) => Math.round(c + t * (c1[j] - c)));
    }
  }
  return [160, 20, 10];
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export default function App() {
  const [inputJson, setInputJson] = useState(DEFAULT_INPUT);
  const [error, setError] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const { pairs, min, max } = useMemo(() => {
    try {
      const parsed = JSON.parse(inputJson);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
      const pairs = parsed.map(([tok, val]) => ({ raw: tok, value: val }));
      const vals = pairs.map(p => p.value).filter(v => typeof v === "number");
      setError(null);
      return { pairs, min: Math.min(...vals), max: Math.max(...vals) };
    } catch (e) {
      setError(e.message);
      return { pairs: [], min: 0, max: 1 };
    }
  }, [inputJson]);

  const range = max - min || 1;

  const hoveredPair = hoveredIdx !== null ? pairs[hoveredIdx] : null;

  return (
    <div style={{
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      background: "#ffffff",
      minHeight: "100vh",
      color: "#1a1a1a",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #e0ddd8",
        padding: "20px 36px",
        display: "flex",
        alignItems: "baseline",
        gap: "14px",
        background: "#fff",
      }}>
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 600, letterSpacing: "0.01em", color: "#111" }}>
          Saliency Viewer
        </h1>
        <span style={{ fontSize: "11px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          token attribution
        </span>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 61px)" }}>
        {/* Sidebar */}
        <div style={{
          width: "320px", flexShrink: 0,
          borderRight: "1px solid #e0ddd8",
          padding: "24px 20px",
          display: "flex", flexDirection: "column", gap: "20px",
          background: "#fff",
        }}>
          <div>
            <label style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#888", textTransform: "uppercase", display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Token–Value Pairs (JSON array)
            </label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              style={{
                width: "100%", height: "420px",
                background: "#fafaf8",
                border: error ? "1px solid #d94f3c" : "1px solid #ddd",
                color: "#333",
                fontFamily: "monospace", fontSize: "11px",
                padding: "10px", resize: "vertical",
                borderRadius: "6px", outline: "none",
                boxSizing: "border-box", lineHeight: "1.5",
              }}
            />
            {error && <p style={{ color: "#d94f3c", fontSize: "11px", margin: "6px 0 0" }}>⚠ {error}</p>}
          </div>

          {/* Legend */}
          <div>
            <label style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#888", textTransform: "uppercase", display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Scale
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "10px", color: "#999", fontFamily: "monospace" }}>{min.toFixed(2)}</span>
              <div style={{
                flex: 1, height: "10px", borderRadius: "4px",
                background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(v => {
                  const [r, g, b] = interpolateColor(v);
                  return `rgb(${r},${g},${b})`;
                }).join(", ")})`,
                border: "1px solid #e0ddd8",
              }} />
              <span style={{ fontSize: "10px", color: "#999", fontFamily: "monospace" }}>{max.toFixed(2)}</span>
            </div>
          </div>

          {/* Hovered token info */}
          <div style={{
            background: "#f5f4f0", borderRadius: "6px", padding: "12px 14px",
            minHeight: "56px", fontSize: "12px", color: "#555",
          }}>
            {hoveredPair ? (
              <>
                <div style={{ fontFamily: "monospace", color: "#222", fontSize: "13px", marginBottom: "4px" }}>
                  "{hoveredPair.raw}"
                </div>
                <div>value: <span style={{ color: "#c0401a", fontWeight: 600 }}>{hoveredPair.value.toFixed(4)}</span></div>
              </>
            ) : (
              <span style={{ color: "#bbb" }}>Hover over a token</span>
            )}
          </div>
        </div>

        {/* Main viz */}
        <div style={{ flex: 1, padding: "36px 48px" }}>
          <div style={{
            lineHeight: "2.6",
            fontSize: "19px",
            fontFamily: "'Georgia', serif",
            color: "#111",
          }}>
            {pairs.map((pair, i) => {
              const norm = (pair.value - min) / range;
              const [r, g, b] = interpolateColor(norm);
              const lum = luminance([r, g, b]);
              const textColor = lum < 140 ? "#fff" : "#111";
              const isHovered = hoveredIdx === i;
              const segs = tokenSegments(pair.raw);

              return segs.map((seg, si) => {
                if (seg.type === "newline") return <br key={`${i}-${si}`} />;
                if (seg.type === "text") {
                  // leading space is part of the text — render the token as one highlighted span
                  // but trim leading space out of the highlight box, render it separately
                  const hasLeadingSpace = seg.value.startsWith(" ");
                  const displayText = hasLeadingSpace ? seg.value.slice(1) : seg.value;

                  return (
                    <span key={`${i}-${si}`}>
                      {hasLeadingSpace && <span> </span>}
                      <span
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          background: `rgb(${r},${g},${b})`,
                          color: textColor,
                          padding: "2px 4px",
                          borderRadius: "3px",
                          cursor: "default",
                          display: "inline-block",
                          transition: "box-shadow 0.15s, transform 0.1s",
                          transform: isHovered ? "translateY(-1px)" : "none",
                          boxShadow: isHovered
                            ? `0 3px 12px rgba(${r},${g},${b},0.45)`
                            : "none",
                          outline: isHovered ? `1.5px solid rgba(0,0,0,0.15)` : "none",
                        }}
                      >
                        {displayText}
                      </span>
                    </span>
                  );
                }
                return null;
              });
            })}
          </div>

          {pairs.length === 0 && !error && (
            <p style={{ color: "#bbb", fontStyle: "italic" }}>Paste your token–value pairs to visualize.</p>
          )}
        </div>
      </div>
    </div>
  );
}