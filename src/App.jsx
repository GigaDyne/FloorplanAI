import { useState } from 'react'
import FloorPlanCanvas, { ROOM_COLORS } from './FloorPlanCanvas.jsx'

const EXAMPLES = [
  {
    label: '2,400 sf / 3BR',
    text: 'Design a 2400 sq ft single-story house with 3 bedrooms, 2.5 bathrooms, open kitchen and living room, large pantry, home office, covered patio, master bedroom separated from other bedrooms, and a 2-car garage.',
  },
  {
    label: '1,800 sf Cottage',
    text: 'Create a 1800 sq ft cottage with 2 bedrooms, 2 bathrooms, open-plan kitchen/dining/living area, mudroom entry, laundry room, and single car garage.',
  },
  {
    label: '3,200 sf Modern',
    text: 'Plan a 3200 sq ft modern home with 4 bedrooms, 3 full bathrooms, formal dining room, gourmet kitchen with island, butler\'s pantry, study, media room, master suite with walk-in closet, covered outdoor patio, and 2-car garage.',
  },
]

function computeScale(plan) {
  if (!plan) return 8
  const maxW = 820, maxH = 560
  const scaleX = maxW / (plan.total_width || 60)
  const scaleY = maxH / (plan.total_depth || 50)
  return Math.min(scaleX, scaleY, 14)
}

function Legend({ rooms }) {
  if (!rooms?.length) return null
  const seen = new Set()
  const types = rooms.filter((r) => {
    if (seen.has(r.type)) return false
    seen.add(r.type)
    return true
  })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {types.map((r) => (
        <div key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
          <div style={{ width: 10, height: 10, background: ROOM_COLORS[r.type] || '#eee', border: '1px solid #ccc', borderRadius: 2 }} />
          {r.name.replace(/\s*\d+$/, '')}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [input, setInput] = useState('')
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rawJson, setRawJson] = useState('')
  const [showJson, setShowJson] = useState(false)

  const scale = computeScale(plan)
  const offsetX = plan ? Math.max(20, (900 - plan.total_width * scale) / 2) : 40
  const offsetY = plan ? Math.max(55, (680 - plan.total_depth * scale) / 2 + 10) : 60

  const generate = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setPlan(null)
    setRawJson('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: input }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server error')
      }
      setRawJson(JSON.stringify(data.plan, null, 2))
      setPlan(data.plan)
    } catch (e) {
      setError(e.message || 'Failed to generate floor plan. Please try again.')
    }
    setLoading(false)
  }

  const downloadJson = () => {
    if (!rawJson) return
    const blob = new Blob([rawJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'floorplan.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPng = () => {
    const canvas = document.getElementById('floorplan-canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.download = 'floorplan.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: '#1a1a1a' }}>
      <style>{`
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        button:hover { opacity: 0.85; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        textarea { resize: vertical; font-family: inherit; }
        textarea:focus { outline: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .layout-grid { grid-template-columns: 1fr !important; }
          .side-panel { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: '1.5px solid #e0dbd2', background: '#fff', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="3" stroke="#1a1a1a" strokeWidth="2"/>
            <rect x="2" y="14" width="12" height="12" fill="#e0dbd2" stroke="#1a1a1a" strokeWidth="1.5"/>
            <rect x="14" y="2" width="12" height="8" fill="#d4e8d4" stroke="#1a1a1a" strokeWidth="1.5"/>
            <rect x="2" y="2" width="12" height="12" fill="#d4dce8" stroke="#1a1a1a" strokeWidth="1.5"/>
          </svg>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, letterSpacing: '-0.3px' }}>
            FloorPlan<span style={{ color: '#7a6af0' }}>AI</span>
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
          Conceptual Layout Generator
        </span>
      </header>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px' }}>

        {/* Input card */}
        <div style={{ background: '#fff', border: '1.5px solid #e0dbd2', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Describe Your House
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={4}
            placeholder="e.g. Design a 2400 sq ft house with 3 bedrooms, 2.5 bathrooms, open kitchen and living room, large pantry, home office, covered patio, master bedroom separated from other bedrooms, and a 2-car garage."
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e0dbd2', borderRadius: 8, fontSize: 14, color: '#1a1a1a', background: '#faf9f7', lineHeight: 1.6, marginBottom: 14 }}
          />

          {/* Example pills */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 10, color: '#bbb', marginRight: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Examples:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} onClick={() => setInput(ex.text)}
                style={{ background: '#f0ece4', border: '1px solid #e0dbd2', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#555', marginRight: 6, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {ex.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={generate}
              disabled={loading || !input.trim()}
              style={{ background: loading ? '#b8b0f0' : '#7a6af0', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 28px', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Generating…</>
                : <><span>⊞</span> Generate Floor Plan</>
              }
            </button>
            <span style={{ fontSize: 11, color: '#bbb', fontFamily: "'DM Mono', monospace" }}>⌘+Enter</span>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #f0c0c0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#c0392b', fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}

        {/* Output grid */}
        {plan && (
          <div className="layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: 20, alignItems: 'start' }}>

            {/* Canvas card */}
            <div style={{ background: '#fff', border: '1.5px solid #e0dbd2', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #e8e3dc', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Floor Plan Render
                </span>
                <button onClick={downloadPng} style={{ background: '#f0ece4', border: '1px solid #e0dbd2', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
                  ↓ PNG
                </button>
              </div>
              <FloorPlanCanvas plan={plan} scale={scale} offsetX={offsetX} offsetY={offsetY} />
              <div style={{ borderTop: '1px solid #e8e3dc', padding: '10px 16px' }}>
                <Legend rooms={plan.rooms} />
              </div>
            </div>

            {/* Side panel */}
            <div className="side-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Stats */}
              <div style={{ background: '#fff', border: '1.5px solid #e0dbd2', borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Layout Summary
                </div>
                {[
                  ['Total Size', plan.house_size],
                  ['Footprint', `${plan.total_width}' × ${plan.total_depth}'`],
                  ['Floors', plan.floors || 1],
                  ['Rooms', plan.rooms?.length || 0],
                  ['Windows', plan.windows?.length || 0],
                  ['Doors', plan.doors?.length || 0],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#999' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Room schedule */}
              <div style={{ background: '#fff', border: '1.5px solid #e0dbd2', borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Room Schedule
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {plan.rooms?.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0ece4', fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, flexShrink: 0, background: ROOM_COLORS[r.type] || '#eee', border: '1px solid #ccc', borderRadius: 2 }} />
                      <div style={{ flex: 1, color: '#333' }}>{r.name}</div>
                      <div style={{ color: '#aaa', fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.width * r.depth} sf</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Architect notes */}
              {plan.notes && (
                <div style={{ background: '#f5f2ec', border: '1.5px solid #e0dbd2', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Architect's Notes
                  </div>
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{plan.notes}</p>
                </div>
              )}

              {/* Export */}
              <div style={{ background: '#fff', border: '1.5px solid #e0dbd2', borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Export
                </div>
                <button onClick={downloadJson} style={{ width: '100%', background: '#f0ece4', border: '1px solid #e0dbd2', borderRadius: 7, padding: 9, fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", color: '#333', fontWeight: 500 }}>
                  ↓ Download JSON
                </button>
                <button onClick={downloadPng} style={{ width: '100%', background: '#f0ece4', border: '1px solid #e0dbd2', borderRadius: 7, padding: 9, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: '#333', fontWeight: 500 }}>
                  ↓ Download PNG
                </button>
                <button onClick={() => setShowJson(!showJson)} style={{ width: '100%', background: 'transparent', border: 'none', padding: 6, fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#bbb', marginTop: 4 }}>
                  {showJson ? '▲ Hide' : '▼ View'} raw JSON
                </button>
                {showJson && (
                  <pre style={{ background: '#1a1a1a', color: '#a8e6a8', borderRadius: 8, padding: 12, fontSize: 10, overflow: 'auto', maxHeight: 200, marginTop: 8, fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
                    {rawJson}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!plan && !loading && (
          <div style={{ background: '#fff', border: '1.5px dashed #d8d3cc', borderRadius: 12, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⊞</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#ccc', marginBottom: 8 }}>
              Your floor plan will appear here
            </div>
            <div style={{ fontSize: 13, color: '#ccc' }}>
              Describe your ideal home above and click Generate
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e8e3dc', padding: '20px 32px', textAlign: 'center', fontSize: 11, color: '#ccc', fontFamily: "'DM Mono', monospace", marginTop: 40 }}>
        FloorPlanAI — Conceptual layouts for builders & drafting artists
      </footer>
    </div>
  )
}
