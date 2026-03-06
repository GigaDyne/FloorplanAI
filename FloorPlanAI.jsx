import { useState, useRef, useCallback, useEffect } from "react";

const SYSTEM_PROMPT = `You are FloorPlanAI, an expert residential architect. Convert natural language house descriptions into precise JSON floor plan layouts.

Return ONLY valid JSON. No markdown, no explanation, no backticks.

Rules:
- Coordinate system: x=0,y=0 is top-left. x increases right, y increases down.
- All dimensions in feet.
- Place rooms to fit within the house footprint with NO overlapping.
- Follow real residential architecture:
  * Public spaces (living, kitchen, dining) toward front (low y)
  * Master suite separated, often at rear or opposite wing
  * Other bedrooms grouped together
  * Bathrooms adjacent to bedrooms they serve
  * Garage at side or front, connected by mudroom/hallway
  * Pantry adjacent to kitchen
  * Office near front or hallway
  * Hallways connecting private zones
- Add doors (rectangles showing swing direction as a small arc) at logical connection points
- Add windows on exterior walls
- Hallways should be 4ft wide minimum

Output this exact structure:
{
  "house_size": "2400 sqft",
  "total_width": 60,
  "total_depth": 50,
  "floors": 1,
  "rooms": [
    {
      "id": "living",
      "name": "Living Room",
      "width": 20,
      "depth": 18,
      "x": 20,
      "y": 5,
      "type": "living",
      "color": "#f0ece4"
    }
  ],
  "doors": [
    {
      "x": 30,
      "y": 23,
      "width": 3,
      "wall": "bottom",
      "connects": ["living", "kitchen"]
    }
  ],
  "windows": [
    {
      "x": 22,
      "y": 5,
      "length": 6,
      "wall": "top",
      "room": "living"
    }
  ],
  "notes": "Brief layout description"
}

Room types and their suggested fill colors:
- living: "#f5f0e8"
- kitchen: "#eef2e8"
- bedroom: "#e8eef5"
- master_bedroom: "#e8e8f5"
- bathroom: "#e8f5f5"
- garage: "#ececec"
- office: "#f5ebe8"
- hallway: "#f8f8f8"
- pantry: "#f0ede8"
- dining: "#f5f0e8"
- patio: "#eaf0e8"
- mudroom: "#eeeeee"
- laundry: "#eef0f5"
- closet: "#f0f0f0"

Make the layout realistic and proportional. Total room areas should approximately match stated square footage.`;

const ROOM_COLORS = {
  living: "#f5f0e8",
  kitchen: "#eef2e8",
  bedroom: "#dde8f5",
  master_bedroom: "#e2dff5",
  bathroom: "#d8f0f0",
  garage: "#e8e8e8",
  office: "#f5ebe0",
  hallway: "#f5f5f5",
  pantry: "#f0ede0",
  dining: "#f5f0e0",
  patio: "#e0f0e0",
  mudroom: "#ebebeb",
  laundry: "#eef0f5",
  closet: "#f0f0f0",
};

const ROOM_LABEL_COLOR = "#2a2a2a";

function FloorPlanCanvas({ plan, scale, offsetX, offsetY }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#faf9f7";
    ctx.fillRect(0, 0, W, H);

    const toX = (ft) => offsetX + ft * scale;
    const toY = (ft) => offsetY + ft * scale;
    const toS = (ft) => ft * scale;

    // Draw house outline
    if (plan.total_width && plan.total_depth) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(toX(0), toY(0), toS(plan.total_width), toS(plan.total_depth));
    }

    // Draw rooms
    plan.rooms?.forEach((room) => {
      const rx = toX(room.x);
      const ry = toY(room.y);
      const rw = toS(room.width);
      const rd = toS(room.depth);

      // Fill
      ctx.fillStyle = ROOM_COLORS[room.type] || "#f5f0e8";
      ctx.fillRect(rx, ry, rw, rd);

      // Border (wall)
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(rx, ry, rw, rd);

      // Room label
      const fontSize = Math.max(9, Math.min(13, toS(1.8)));
      ctx.fillStyle = ROOM_LABEL_COLOR;
      ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const label = room.name;
      const dimLabel = `${room.width}' × ${room.depth}'`;
      const sqft = room.width * room.depth;

      // Word wrap room name
      const maxW = rw - 8;
      const words = label.split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      lines.push(cur);

      const lineH = fontSize + 2;
      const totalH = lines.length * lineH + lineH + lineH;
      const startY = ry + rd / 2 - totalH / 2 + lineH / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, rx + rw / 2, startY + i * lineH);
      });

      // Dimensions
      ctx.font = `400 ${Math.max(7, fontSize - 3)}px 'DM Sans', sans-serif`;
      ctx.fillStyle = "#666";
      ctx.fillText(dimLabel, rx + rw / 2, startY + lines.length * lineH);

      // Sqft
      ctx.fillText(`${sqft} sf`, rx + rw / 2, startY + lines.length * lineH + lineH - 1);
    });

    // Draw windows
    plan.windows?.forEach((win) => {
      const wlen = toS(win.length || 4);
      const thick = Math.max(4, scale * 0.4);
      ctx.fillStyle = "#a8d4e8";
      ctx.strokeStyle = "#3a8ab0";
      ctx.lineWidth = 1;

      let wx, wy, ww, wh;
      if (win.wall === "top" || win.wall === "bottom") {
        wx = toX(win.x);
        wy = win.wall === "top" ? toY(win.y) - thick / 2 : toY(win.y) - thick / 2;
        ww = wlen;
        wh = thick;
      } else {
        wx = win.wall === "left" ? toX(win.x) - thick / 2 : toX(win.x) - thick / 2;
        wy = toY(win.y);
        ww = thick;
        wh = wlen;
      }
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeRect(wx, wy, ww, wh);
    });

    // Draw doors
    plan.doors?.forEach((door) => {
      const dw = toS(door.width || 3);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.5;

      const dx = toX(door.x);
      const dy = toY(door.y);

      // Door opening gap (white out the wall)
      ctx.fillStyle = "#faf9f7";
      if (door.wall === "bottom" || door.wall === "top") {
        ctx.fillRect(dx, dy - 2, dw, 4);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        // Arc swing
        ctx.beginPath();
        ctx.arc(dx, dy, dw, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + dw, dy);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillRect(dx - 2, dy, 4, dw);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dx, dy, dw, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx, dy + dw);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Compass
    const cx = W - 50, cy = 50, cr = 20;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, cr + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.stroke();

    // N arrow
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.moveTo(cx, cy - cr);
    ctx.lineTo(cx - 6, cy + cr * 0.3);
    ctx.lineTo(cx + 6, cy + cr * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(cx, cy + cr);
    ctx.lineTo(cx - 6, cy - cr * 0.3);
    ctx.lineTo(cx + 6, cy - cr * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 11px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", cx, cy - cr - 10);
    ctx.restore();

    // Scale bar
    const sbX = 20, sbY = H - 30;
    const sbFt = 10;
    const sbLen = toS(sbFt);
    ctx.fillStyle = "#1a1a1a";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY);
    ctx.lineTo(sbX + sbLen, sbY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sbX, sbY - 4);
    ctx.lineTo(sbX, sbY + 4);
    ctx.moveTo(sbX + sbLen, sbY - 4);
    ctx.lineTo(sbX + sbLen, sbY + 4);
    ctx.stroke();
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${sbFt}'`, sbX + sbLen / 2, sbY - 8);

    // Title
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 13px 'DM Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`FLOOR PLAN  ·  ${plan.house_size || ""}`, 20, 22);
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillStyle = "#888";
    ctx.fillText(plan.notes || "", 20, 38);
  }, [plan, scale, offsetX, offsetY]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={680}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

function Legend({ rooms }) {
  if (!rooms?.length) return null;
  const seen = new Set();
  const types = rooms.filter((r) => {
    if (seen.has(r.type)) return false;
    seen.add(r.type);
    return true;
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
      {types.map((r) => (
        <div key={r.type} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#555" }}>
          <div style={{ width: 12, height: 12, background: ROOM_COLORS[r.type] || "#eee", border: "1px solid #ccc", borderRadius: 2 }} />
          {r.name.replace(/\s*\d+$/, "")}
        </div>
      ))}
    </div>
  );
}

const EXAMPLES = [
  "Design a 2400 sq ft single-story house with 3 bedrooms, 2.5 bathrooms, open kitchen and living room, large pantry, home office, covered patio, master bedroom separated from others, and a 2-car garage.",
  "Create a 1800 sq ft cottage with 2 bedrooms, 2 bathrooms, open-plan kitchen/dining/living area, mudroom entry, laundry room, and single car garage.",
  "Plan a 3200 sq ft modern home with 4 bedrooms, 3 full bathrooms, formal dining room, gourmet kitchen with island, butler's pantry, study, media room, master suite with walk-in closet, covered outdoor patio, and 2-car garage.",
];

export default function FloorPlanAI() {
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [showJson, setShowJson] = useState(false);
  const canvasRef = useRef(null);

  const computeScale = (plan) => {
    if (!plan) return 8;
    const maxW = 820, maxH = 580;
    const scaleX = maxW / (plan.total_width || 60);
    const scaleY = maxH / (plan.total_depth || 50);
    return Math.min(scaleX, scaleY, 14);
  };

  const scale = computeScale(plan);
  const offsetX = plan ? Math.max(20, (900 - plan.total_width * scale) / 2) : 40;
  const offsetY = plan ? Math.max(55, (680 - plan.total_depth * scale) / 2 + 10) : 60;

  const generate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setPlan(null);
    setRawJson("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: input }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map((c) => c.text || "").join("") || "";
      setRawJson(text);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlan(parsed);
    } catch (e) {
      setError("Failed to generate floor plan. Please try again or rephrase your description.");
      console.error(e);
    }
    setLoading(false);
  };

  const downloadJson = () => {
    if (!rawJson) return;
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "floorplan.json";
    a.click();
  };

  const downloadPng = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "floorplan.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f7f5f0",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      color: "#1a1a1a",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&family=DM+Serif+Display&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f5f0; }
        textarea { resize: vertical; }
        textarea:focus { outline: none; }
        button:hover { opacity: 0.88; }
        .pill-btn:hover { background: #e8e3dc !important; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1.5px solid #e0dbd2",
        background: "#fff",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 58,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="3" stroke="#1a1a1a" strokeWidth="2"/>
            <rect x="2" y="14" width="12" height="12" fill="#e0dbd2" stroke="#1a1a1a" strokeWidth="1.5"/>
            <rect x="14" y="2" width="12" height="8" fill="#d4e8d4" stroke="#1a1a1a" strokeWidth="1.5"/>
            <rect x="2" y="2" width="12" height="12" fill="#d4dce8" stroke="#1a1a1a" strokeWidth="1.5"/>
          </svg>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, letterSpacing: "-0.3px" }}>
            FloorPlan<span style={{ color: "#7a6af0" }}>AI</span>
          </span>
        </div>
        <span style={{ fontSize: 12, color: "#999", fontFamily: "'DM Mono', monospace" }}>
          Conceptual Layout Generator
        </span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Input Panel */}
        <div style={{
          background: "#fff",
          border: "1.5px solid #e0dbd2",
          borderRadius: 12,
          padding: "24px",
          marginBottom: 24,
        }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Describe Your House
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Design a 2400 sq ft house with 3 bedrooms, 2.5 bathrooms, open kitchen and living room, large pantry, home office, covered patio, master bedroom separated from other bedrooms, and a 2-car garage."
              rows={4}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid #e0dbd2",
                borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: "#1a1a1a",
                background: "#faf9f7",
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Example pills */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: "#aaa", marginRight: 8, fontFamily: "'DM Mono', monospace" }}>EXAMPLES:</span>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                className="pill-btn"
                onClick={() => setInput(ex)}
                style={{
                  background: "#f0ece4",
                  border: "1px solid #e0dbd2",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: "#555",
                  cursor: "pointer",
                  marginRight: 6,
                  marginBottom: 4,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "background 0.15s",
                }}
              >
                {i === 0 ? "2,400 sf / 3BR" : i === 1 ? "1,800 sf Cottage" : "3,200 sf Modern"}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading || !input.trim()}
            style={{
              background: loading ? "#c5bfe8" : "#7a6af0",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "11px 28px",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                Generating Floor Plan...
              </>
            ) : (
              <>
                <span>⊞</span> Generate Floor Plan
              </>
            )}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>

        {error && (
          <div style={{ background: "#fff5f5", border: "1px solid #f0c0c0", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "#c0392b", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Floor Plan Output */}
        {plan && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

            {/* Canvas */}
            <div style={{
              background: "#fff",
              border: "1.5px solid #e0dbd2",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              <div style={{
                borderBottom: "1px solid #e8e3dc",
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Floor Plan Render
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={downloadPng} style={{
                    background: "#f0ece4", border: "1px solid #e0dbd2", borderRadius: 6,
                    padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#444"
                  }}>
                    ↓ PNG
                  </button>
                </div>
              </div>
              <FloorPlanCanvas plan={plan} scale={scale} offsetX={offsetX} offsetY={offsetY} />
              <div style={{ borderTop: "1px solid #e8e3dc", padding: "10px 16px" }}>
                <Legend rooms={plan.rooms} />
              </div>
            </div>

            {/* Side Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Stats */}
              <div style={{ background: "#fff", border: "1.5px solid #e0dbd2", borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#aaa", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Layout Summary
                </div>
                {[
                  ["Total Size", plan.house_size],
                  ["Footprint", `${plan.total_width}' × ${plan.total_depth}'`],
                  ["Floors", plan.floors || 1],
                  ["Rooms", plan.rooms?.length || 0],
                  ["Windows", plan.windows?.length || 0],
                  ["Doors", plan.doors?.length || 0],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: "#888" }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Room List */}
              <div style={{ background: "#fff", border: "1.5px solid #e0dbd2", borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#aaa", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Room Schedule
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {plan.rooms?.map((r) => (
                    <div key={r.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px solid #f0ece4",
                      fontSize: 12,
                    }}>
                      <div style={{
                        width: 10, height: 10, flexShrink: 0,
                        background: ROOM_COLORS[r.type] || "#eee",
                        border: "1px solid #ccc",
                        borderRadius: 2,
                      }} />
                      <div style={{ flex: 1, color: "#333" }}>{r.name}</div>
                      <div style={{ color: "#999", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        {r.width * r.depth} sf
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {plan.notes && (
                <div style={{ background: "#f5f2ec", border: "1.5px solid #e0dbd2", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#aaa", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Architect's Notes
                  </div>
                  <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{plan.notes}</p>
                </div>
              )}

              {/* Export */}
              <div style={{ background: "#fff", border: "1.5px solid #e0dbd2", borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#aaa", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Export
                </div>
                <button onClick={downloadJson} style={{
                  width: "100%",
                  background: "#f0ece4",
                  border: "1px solid #e0dbd2",
                  borderRadius: 7,
                  padding: "9px",
                  fontSize: 13,
                  cursor: "pointer",
                  marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#333",
                  fontWeight: 500,
                }}>
                  ↓ Download JSON
                </button>
                <button onClick={downloadPng} style={{
                  width: "100%",
                  background: "#f0ece4",
                  border: "1px solid #e0dbd2",
                  borderRadius: 7,
                  padding: "9px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#333",
                  fontWeight: 500,
                }}>
                  ↓ Download PNG
                </button>
                <button onClick={() => setShowJson(!showJson)} style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "6px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  color: "#aaa",
                  marginTop: 4,
                }}>
                  {showJson ? "▲ Hide" : "▼ View"} raw JSON
                </button>
                {showJson && (
                  <pre style={{
                    background: "#1a1a1a",
                    color: "#a8e6a8",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 10,
                    overflow: "auto",
                    maxHeight: 200,
                    marginTop: 8,
                    fontFamily: "'DM Mono', monospace",
                    lineHeight: 1.5,
                  }}>
                    {rawJson}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {!plan && !loading && (
          <div style={{
            background: "#fff",
            border: "1.5px dashed #d8d3cc",
            borderRadius: 12,
            padding: "60px 24px",
            textAlign: "center",
            color: "#bbb",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⊞</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#ccc", marginBottom: 8 }}>
              Your floor plan will appear here
            </div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              Describe your ideal home above and click Generate
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
