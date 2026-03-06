import { useMemo, useState } from 'react'
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
    text: "Plan a 3200 sq ft modern home with 4 bedrooms, 3 full bathrooms, formal dining room, gourmet kitchen with island, butler's pantry, study, media room, master suite with walk-in closet, covered outdoor patio, and 2-car garage.",
  },
]

function computeScale(plan) {
  if (!plan) return 8

  const maxW = 820
  const maxH = 560
  const scaleX = maxW / (plan.total_width || 60)
  const scaleY = maxH / (plan.total_depth || 50)

  return Math.min(scaleX, scaleY, 14)
}

function Legend({ rooms }) {
  if (!rooms?.length) return null

  const seen = new Set()
  const types = rooms.filter((room) => {
    if (seen.has(room.type)) return false
    seen.add(room.type)
    return true
  })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {types.map((room) => (
        <div
          key={room.type}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#666',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              border: '1px solid #cfc7bc',
              background: ROOM_COLORS[room.type] || '#eee',
            }}
          />
          <span>{room.name.replace(/\s*\d+$/, '')}</span>
        </div>
      ))}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8,
        fontSize: 13,
      }}
    >
      <span style={{ color: '#999' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#333' }}>{value}</span>
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
  const [validationIssues, setValidationIssues] = useState([])
  const [wasRepaired, setWasRepaired] = useState(false)

  const scale = useMemo(() => computeScale(plan), [plan])
  const offsetX = plan ? Math.max(20, (900 - plan.total_width * scale) / 2) : 40
  const offsetY = plan ? Math.max(55, (680 - plan.total_depth * scale) / 2 + 10) : 60

  const generate = async () => {
    if (!input.trim()) return

    setLoading(true)
    setError('')
    setPlan(null)
    setRawJson('')
    setValidationIssues([])
    setWasRepaired(false)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      })

      const text = await res.text()
      let data

      try {
        data = JSON.parse(text)
      } catch {
        console.error('Non-JSON response:', text.slice(0, 300))
        throw new Error(
          res.status === 504
            ? 'Request timed out — please try again.'
            : `Server error (${res.status}). Please try again.`
        )
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server error')
      }

      if (!data.plan) {
        throw new Error('No plan was returned from the server.')
      }

      setPlan(data.plan)
      setRawJson(JSON.stringify(data.plan, null, 2))
      setValidationIssues(Array.isArray(data.validationIssues) ? data.validationIssues : [])
      setWasRepaired(Boolean(data.repaired))
    } catch (e) {
      setError(e.message || 'Failed to generate floor plan. Please try again.')
    } finally {
      setLoading(false)
    }
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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      generate()
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f4ef',
        color: '#1a1a1a',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: '1px solid #e8e3dc',
          background: '#fbfaf8',
          padding: '18px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 26,
              height: 26,
              border: '2px solid #444',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
            }}
          >
            <div style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444' }} />
            <div style={{ borderBottom: '1px solid #444' }} />
            <div style={{ borderRight: '1px solid #444' }} />
            <div />
          </div>
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            FloorPlan<span style={{ color: '#7a6af0' }}>AI</span>
          </div>
        </div>

        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: '#b2aba1',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Conceptual Layout Generator
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 28 }}>
        <div
          style={{
            background: '#fff',
            border: '1.5px solid #e0dbd2',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: '#aaa',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Describe Your House
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={4}
            placeholder="e.g. Design a 2400 sq ft house with 3 bedrooms, 2.5 bathrooms, open kitchen and living room, large pantry, home office, covered patio, master bedroom separated from other bedrooms, and a 2-car garage."
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #e0dbd2',
              borderRadius: 8,
              fontSize: 14,
              color: '#1a1a1a',
              background: '#faf9f7',
              lineHeight: 1.6,
              marginBottom: 14,
              resize: 'vertical',
            }}
          />

          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                fontSize: 10,
                color: '#bbb',
                marginRight: 8,
                fontFamily: "'DM Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Examples:
            </span>

            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setInput(ex.text)}
                style={{
                  background: '#f0ece4',
                  border: '1px solid #e0dbd2',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 12,
                  color: '#555',
                  marginRight: 6,
                  marginBottom: 4,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={generate}
              disabled={loading || !input.trim()}
              style={{
                background: loading ? '#b8b0f0' : '#7a6af0',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '11px 28px',
                fontWeight: 600,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  Generating…
                </>
              ) : (
                <>
                  <span>⊞</span>
                  Generate Floor Plan
                </>
              )}
            </button>

            <span
              style={{
                fontSize: 11,
                color: '#bbb',
                fontFamily: "'DM Mono', monospace",
              }}
            >
              ⌘+Enter
            </span>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fff5f5',
              border: '1px solid #f0c0c0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#c0392b',
              fontSize: 14,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {plan && (
          <div
            className="layout-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 300px',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                background: '#fff',
                border: '1.5px solid #e0dbd2',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  borderBottom: '1px solid #e8e3dc',
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: '#aaa',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Floor Plan Render
                </span>

                <button
                  onClick={downloadPng}
                  style={{
                    background: '#f0ece4',
                    border: '1px solid #e0dbd2',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: 12,
                    color: '#444',
                    cursor: 'pointer',
                  }}
                >
                  ↓ PNG
                </button>
              </div>

              <FloorPlanCanvas
                plan={plan}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
              />

              <div style={{ borderTop: '1px solid #e8e3dc', padding: '10px 16px' }}>
                <Legend rooms={plan.rooms} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: '#fff',
                  border: '1.5px solid #e0dbd2',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: '#aaa',
                    marginBottom: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Layout Summary
                </div>

                <StatRow label="Total Size" value={plan.house_size || '—'} />
                <StatRow label="Footprint" value={`${plan.total_width}' × ${plan.total_depth}'`} />
                <StatRow label="Floors" value={plan.floors || 1} />
                <StatRow label="Rooms" value={plan.rooms?.length || 0} />
                <StatRow label="Windows" value={plan.windows?.length || 0} />
                <StatRow label="Doors" value={plan.doors?.length || 0} />
                <StatRow label="Repair Pass" value={wasRepaired ? 'Yes' : 'No'} />
              </div>

              {!!validationIssues.length && (
                <div
                  style={{
                    background: '#fff8ec',
                    border: '1.5px solid #ecd8ae',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: '#b38a2f',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Validation Notes
                  </div>

                  <ul style={{ margin: 0, paddingLeft: 18, color: '#7a5a14', fontSize: 12, lineHeight: 1.55 }}>
                    {validationIssues.map((issue, idx) => (
                      <li key={`${issue}-${idx}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                style={{
                  background: '#fff',
                  border: '1.5px solid #e0dbd2',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: '#aaa',
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Room Schedule
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {plan.rooms?.map((room) => (
                    <div
                      key={room.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 0',
                        borderBottom: '1px solid #f0ece4',
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          flexShrink: 0,
                          background: ROOM_COLORS[room.type] || '#eee',
                          border: '1px solid #ccc',
                          borderRadius: 2,
                        }}
                      />
                      <div style={{ flex: 1, color: '#333' }}>{room.name}</div>
                      <div
                        style={{
                          color: '#aaa',
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        {room.width * room.depth} sf
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {plan.notes && (
                <div
                  style={{
                    background: '#f5f2ec',
                    border: '1.5px solid #e0dbd2',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: '#aaa',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Architect&apos;s Notes
                  </div>

                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, margin: 0 }}>
                    {plan.notes}
                  </p>
                </div>
              )}

              <div
                style={{
                  background: '#fff',
                  border: '1.5px solid #e0dbd2',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: '#aaa',
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Export
                </div>

                <button
                  onClick={downloadJson}
                  style={{
                    width: '100%',
                    background: '#f0ece4',
                    border: '1px solid #e0dbd2',
                    borderRadius: 7,
                    padding: 9,
                    fontSize: 13,
                    marginBottom: 8,
                    color: '#333',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ↓ Download JSON
                </button>

                <button
                  onClick={downloadPng}
                  style={{
                    width: '100%',
                    background: '#f0ece4',
                    border: '1px solid #e0dbd2',
                    borderRadius: 7,
                    padding: 9,
                    fontSize: 13,
                    color: '#333',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ↓ Download PNG
                </button>

                <button
                  onClick={() => setShowJson((v) => !v)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: 6,
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    color: '#bbb',
                    marginTop: 4,
                    cursor: 'pointer',
                  }}
                >
                  {showJson ? '▲ Hide' : '▼ View'} raw JSON
                </button>

                {showJson && (
                  <pre
                    style={{
                      background: '#1a1a1a',
                      color: '#a8e6a8',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 10,
                      overflow: 'auto',
                      maxHeight: 220,
                      marginTop: 8,
                      fontFamily: "'DM Mono', monospace",
                      lineHeight: 1.5,
                    }}
                  >
                    {rawJson}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {!plan && !loading && (
          <div
            style={{
              background: '#fff',
              border: '1.5px dashed #d8d3cc',
              borderRadius: 12,
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⊞</div>
            <div
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 22,
                color: '#ccc',
                marginBottom: 8,
              }}
            >
              Your floor plan will appear here
            </div>
            <div style={{ fontSize: 13, color: '#ccc' }}>
              Describe your ideal home above and click Generate
            </div>
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #e8e3dc',
          padding: '20px 32px',
          textAlign: 'center',
          fontSize: 11,
          color: '#ccc',
          fontFamily: "'DM Mono', monospace",
          marginTop: 40,
        }}
      >
        FloorPlanAI — Conceptual layouts for builders & drafting artists
      </footer>
    </div>
  )
}
