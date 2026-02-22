import { useState, useMemo } from "react";

const DEFAULT_TEXT = "The quick brown fox jumps over the lazy dog near the river bank";

const DEFAULT_SALIENCY = {
  "The": 0.1, "quick": 0.85, "brown": 0.6, "fox": 0.95,
  "jumps": 0.75, "over": 0.2, "the": 0.05, "lazy": 0.8,
  "dog": 0.9, "near": 0.3, "river": 0.55, "bank": 0.45
};

function interpolateColor(value, colormap) {
  if (colormap === "fire") {
    const stops = [
      [0, [15, 15, 30]],
      [0.25, [180, 20, 20]],
      [0.5, [230, 100, 10]],
      [0.75, [255, 210, 50]],
      [1, [255, 255, 220]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i];
      const [t1, c1] = stops[i + 1];
      if (value >= t0 && value <= t1) {
        const t = (value - t0) / (t1 - t0);
        return c0.map((c, j) => Math.round(c + t * (c1[j] - c)));
      }
    }
    return [255, 255, 220];
  }
  if (colormap === "cool") {
    const stops = [
      [0, [10, 15, 50]],
      [0.33, [20, 80, 150]],
      [0.66, [30, 180, 200]],
      [1, [220, 250, 255]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i];
      const [t1, c1] = stops[i + 1];
      if (value >= t0 && value <= t1) {
        const t = (value - t0) / (t1 - t0);
        return c0.map((c, j) => Math.round(c + t * (c1[j] - c)));
      }
    }
    return [220, 250, 255];
  }
  if (colormap === "diverging") {
    if (value < 0.5) {
      const t = value / 0.5;
      return [Math.round(30 + t * 225), Math.round(100 + t * 155), Math.round(200 + t * 55)];
    } else {
      const t = (value - 0.5) / 0.5;
      return [255, Math.round(255 - t * 200), Math.round(255 - t * 230)];
    }
  }
  // green
  const stops = [
    [0, [20, 20, 20]],
    [0.4, [30, 100, 60]],
    [0.7, [50, 190, 100]],
    [1, [200, 255, 180]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (value >= t0 && value <= t1) {
      const t = (value - t0) / (t1 - t0);
      return c0.map((c, j) => Math.round(c + t * (c1[j] - c)));
    }
  }
  return [200, 255, 180];
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export default function App() {
  const [inputText, setInputText] = useState(DEFAULT_TEXT);
  const [inputSaliency, setInputSaliency] = useState(JSON.stringify(DEFAULT_SALIENCY, null, 2));
  const [colormap, setColormap] = useState("fire");
  const [error, setError] = useState(null);
  const [hoveredToken, setHoveredToken] = useState(null);

  const { tokens, saliencyMap, min, max } = useMemo(() => {
    try {
      const rawMap = JSON.parse(inputSaliency);
      // Strip keys that are purely control/non-printable characters (e.g. \u010a newline artifacts)
      const map = Object.fromEntries(
        Object.entries(rawMap).filter(([k]) =>
          k.trim().length > 0 && !/^[\u0000-\u001f\u007f-\u00ff]+$/.test(k)
        )
      );
      setError(null);
      const vals = Object.values(map).filter((v) => typeof v === "number");
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      // Tokenize: split into newlines, spaces, and words — preserving all whitespace
      const toks = inputText.match(/\n|[^\S\n]+|\S+/g) || [];
      return { tokens: toks, saliencyMap: map, min: mn, max: mx };
    } catch (e) {
      setError("Invalid JSON in saliency dictionary");
      return { tokens: [], saliencyMap: {}, min: 0, max: 1 };
    }
  }, [inputText, inputSaliency]);

  const range = max - min || 1;
  const colormaps = ["fire", "cool", "green", "diverging"];

  return (
    <div style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      background: "#0d0d0f",
      minHeight: "100vh",
      color: "#e8e4dc",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #2a2a30",
        padding: "24px 40px 20px",
        display: "flex",
        alignItems: "baseline",
        gap: "16px",
      }}>
        <h1 style={{
          margin: 0, fontSize: "22px", fontWeight: 400,
          letterSpacing: "0.08em", color: "#f0ebe0", fontFamily: "'Georgia', serif",
        }}>
          SALIENCY VIEWER
        </h1>
        <span style={{ fontSize: "11px", color: "#555", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          token attribution heatmap
        </span>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 65px)" }}>
        {/* Sidebar */}
        <div style={{
          width: "300px", flexShrink: 0, borderRight: "1px solid #1e1e24",
          padding: "28px 24px", display: "flex", flexDirection: "column", gap: "24px",
        }}>
          {/* Colormap */}
          <div>
            <label style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
              Colormap
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {colormaps.map((cm) => {
                const swatch = [0, 0.33, 0.66, 1].map((v) => {
                  const [r, g, b] = interpolateColor(v, cm);
                  return `rgb(${r},${g},${b})`;
                });
                return (
                  <button key={cm} onClick={() => setColormap(cm)} title={cm} style={{
                    border: colormap === cm ? "1px solid #aaa" : "1px solid #333",
                    borderRadius: "4px", overflow: "hidden", cursor: "pointer",
                    padding: 0, width: "56px", height: "28px",
                    background: `linear-gradient(to right, ${swatch.join(", ")})`,
                    opacity: colormap === cm ? 1 : 0.5, transition: "opacity 0.2s",
                  }} />
                );
              })}
            </div>
          </div>

          {/* Input text */}
          <div>
            <label style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
              Input Text
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{
                width: "100%", height: "120px", background: "#111115",
                border: "1px solid #252530", color: "#c8c4bc",
                fontFamily: "monospace", fontSize: "12px", padding: "10px",
                resize: "vertical", borderRadius: "4px", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Saliency dict */}
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
              Saliency Dictionary (JSON)
            </label>
            <textarea
              value={inputSaliency}
              onChange={(e) => setInputSaliency(e.target.value)}
              style={{
                width: "100%", height: "200px", background: "#111115",
                border: error ? "1px solid #c04040" : "1px solid #252530",
                color: "#c8c4bc", fontFamily: "monospace", fontSize: "11px",
                padding: "10px", resize: "vertical", borderRadius: "4px",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {error && <p style={{ color: "#c04040", fontSize: "11px", margin: "6px 0 0" }}>{error}</p>}
          </div>

          {/* Legend */}
          <div>
            <label style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
              Scale
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>{min.toFixed(2)}</span>
              <div style={{
                flex: 1, height: "10px", borderRadius: "3px",
                background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(v => {
                  const [r, g, b] = interpolateColor(v, colormap);
                  return `rgb(${r},${g},${b})`;
                }).join(", ")})`,
              }} />
              <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>{max.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Main viz */}
        <div style={{ flex: 1, padding: "40px 48px" }}>
          <div style={{ marginBottom: "20px", fontFamily: "monospace", fontSize: "12px", color: "#888", height: "18px" }}>
            {hoveredToken ? (
              <>
                <span style={{ color: "#ccc" }}>{hoveredToken.token}</span>
                {hoveredToken.value !== null && hoveredToken.value !== undefined
                  ? <span> → <span style={{ color: "#f0d080" }}>{hoveredToken.value.toFixed(4)}</span></span>
                  : <span style={{ color: "#555" }}> → not in dictionary</span>
                }
              </>
            ) : null}
          </div>

          <div style={{ lineHeight: "2.4", fontSize: "20px", letterSpacing: "0.02em", fontFamily: "'Georgia', serif" }}>
            {tokens.map((tok, i) => {
              // Newline → line break
              if (tok === "\n") return <br key={i} />;
              // Spaces/tabs (not newline) → preserve as-is
              if (/^[^\S\n]+$/.test(tok)) return <span key={i} style={{ whiteSpace: "pre" }}>{tok}</span>;

              // Word token: look up in saliency map, also try stripping punctuation
              const clean = tok.replace(/[^a-zA-Z0-9']/g, "");
              const raw = saliencyMap[tok] ?? saliencyMap[clean] ?? null;
              const norm = raw !== null ? (raw - min) / range : null;
              const [r, g, b] = norm !== null ? interpolateColor(norm, colormap) : [40, 40, 45];
              const lum = luminance([r, g, b]);
              const textColor = lum > 140 ? "#0d0d0f" : "#f0ebe0";
              const isHovered = hoveredToken?.index === i;

              return (
                <span
                  key={i}
                  onMouseEnter={() => setHoveredToken({ token: tok, value: raw, index: i })}
                  onMouseLeave={() => setHoveredToken(null)}
                  style={{
                    background: `rgb(${r},${g},${b})`,
                    color: textColor,
                    padding: "2px 5px",
                    borderRadius: "3px",
                    cursor: "default",
                    display: "inline-block",
                    transition: "transform 0.1s, box-shadow 0.1s",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    boxShadow: isHovered ? `0 4px 16px rgba(${r},${g},${b},0.5)` : "none",
                  }}
                >
                  {tok}
                </span>
              );
            })}
          </div>

          {tokens.length === 0 && !error && (
            <p style={{ color: "#444", fontStyle: "italic" }}>Enter text and saliency values to visualize.</p>
          )}
        </div>
      </div>
    </div>
  );
}
