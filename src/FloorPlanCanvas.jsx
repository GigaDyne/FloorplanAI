import { useRef, useCallback, useEffect } from 'react'

const ROOM_COLORS = {
  living: '#f5f0e8',
  kitchen: '#eef2e8',
  bedroom: '#dde8f5',
  master_bedroom: '#e2dff5',
  bathroom: '#d8f0f0',
  half_bath: '#d8f0f0',
  garage: '#e8e8e8',
  office: '#f5ebe0',
  hallway: '#f5f5f5',
  pantry: '#f0ede0',
  dining: '#f5f0e0',
  patio: '#e0f0e0',
  mudroom: '#ebebeb',
  laundry: '#eef0f5',
  closet: '#f0f0f0',
  foyer: '#f7f2ea',
}

export { ROOM_COLORS }

function normalizeDoor(door) {
  if (!door || typeof door !== 'object') return null

  const axis = door.axis === 'x' || door.axis === 'y' ? door.axis : null
  const x = Number(door.x)
  const y = Number(door.y)
  const width = Number(door.width)

  if (!axis || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || width <= 0) {
    return null
  }

  return { x, y, width, axis }
}

function normalizeWindow(win) {
  if (!win || typeof win !== 'object') return null

  const axis = win.axis === 'h' || win.axis === 'v' ? win.axis : null
  const x = Number(win.x)
  const y = Number(win.y)
  const length = Number(win.length)

  if (!axis || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(length) || length <= 0) {
    return null
  }

  return { x, y, length, axis }
}

function drawDoor(ctx, door, toX, toY, toS) {
  const dw = toS(door.width)

  if (door.axis === 'y') {
    const dx = toX(door.x)
    const dy = toY(door.y)

    ctx.fillStyle = '#faf9f7'
    ctx.fillRect(dx, dy - 3, dw, 6)

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx + dw, dy)
    ctx.stroke()

    ctx.strokeStyle = '#aaa'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(dx, dy, dw, 0, Math.PI / 2)
    ctx.stroke()
  } else {
    const dx = toX(door.x)
    const dy = toY(door.y)

    ctx.fillStyle = '#faf9f7'
    ctx.fillRect(dx - 3, dy, 6, dw)

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(dx, dy)
    ctx.lineTo(dx, dy + dw)
    ctx.stroke()

    ctx.strokeStyle = '#aaa'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(dx, dy, dw, 0, Math.PI / 2)
    ctx.stroke()
  }
}

function drawWindow(ctx, win, toX, toY, toS, scale) {
  const wallThickness = Math.max(5, scale * 0.5)
  const wl = toS(win.length)

  let wx
  let wy
  let ww
  let wh

  if (win.axis === 'h') {
    wx = toX(win.x)
    wy = toY(win.y) - wallThickness / 2
    ww = wl
    wh = wallThickness
  } else {
    wx = toX(win.x) - wallThickness / 2
    wy = toY(win.y)
    ww = wallThickness
    wh = wl
  }

  ctx.fillStyle = '#faf9f7'
  ctx.fillRect(wx, wy, ww, wh)

  ctx.fillStyle = '#c8e8f5'
  ctx.fillRect(wx + 1, wy + 1, Math.max(0, ww - 2), Math.max(0, wh - 2))

  ctx.strokeStyle = '#2a7ab0'
  ctx.lineWidth = 1.5
  ctx.strokeRect(wx, wy, ww, wh)

  ctx.strokeStyle = '#5aadd4'
  ctx.lineWidth = 0.8
  ctx.beginPath()

  if (win.axis === 'h') {
    ctx.moveTo(wx, wy + wh / 2)
    ctx.lineTo(wx + ww, wy + wh / 2)
  } else {
    ctx.moveTo(wx + ww / 2, wy)
    ctx.lineTo(wx + ww / 2, wy + wh)
  }

  ctx.stroke()
}

export default function FloorPlanCanvas({ plan, scale, offsetX, offsetY }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !plan) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#faf9f7'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const toX = (ft) => offsetX + ft * scale
    const toY = (ft) => offsetY + ft * scale
    const toS = (ft) => ft * scale

    const tw = Number(plan.total_width || 60)
    const td = Number(plan.total_depth || 50)
    const rooms = Array.isArray(plan.rooms) ? plan.rooms : []
    const doors = Array.isArray(plan.doors) ? plan.doors.map(normalizeDoor).filter(Boolean) : []
    const windows = Array.isArray(plan.windows) ? plan.windows.map(normalizeWindow).filter(Boolean) : []

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 3
    ctx.strokeRect(toX(0), toY(0), toS(tw), toS(td))

    rooms.forEach((room) => {
      const rx = toX(room.x)
      const ry = toY(room.y)
      const rw = toS(room.width)
      const rd = toS(room.depth)

      ctx.fillStyle = ROOM_COLORS[room.type] || '#f5f0e8'
      ctx.fillRect(rx, ry, rw, rd)

      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rx, ry, rw, rd)

      const fontSize = Math.max(8, Math.min(13, toS(1.8)))
      const maxW = rw - 8

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const words = String(room.name || '').split(' ')
      const lines = []
      let current = ''

      for (const word of words) {
        const test = current ? `${current} ${word}` : word
        ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`

        if (ctx.measureText(test).width > maxW && current) {
          lines.push(current)
          current = word
        } else {
          current = test
        }
      }

      if (current) lines.push(current)

      const lineH = fontSize + 2
      const metaLines = 2
      const totalTextHeight = (lines.length + metaLines) * lineH
      const startY = ry + rd / 2 - totalTextHeight / 2 + lineH / 2

      ctx.fillStyle = '#2a2a2a'
      ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`
      lines.forEach((line, i) => {
        ctx.fillText(line, rx + rw / 2, startY + i * lineH)
      })

      ctx.font = `400 ${Math.max(7, fontSize - 3)}px 'DM Sans', sans-serif`
      ctx.fillStyle = '#777'
      ctx.fillText(`${room.width}' × ${room.depth}'`, rx + rw / 2, startY + lines.length * lineH)
      ctx.fillText(
        `${room.width * room.depth} sf`,
        rx + rw / 2,
        startY + (lines.length + 1) * lineH
      )
    })

    windows.forEach((win) => drawWindow(ctx, win, toX, toY, toS, scale))
    doors.forEach((door) => drawDoor(ctx, door, toX, toY, toS))

    const cx = canvas.width - 50
    const cy = 50
    const cr = 20

    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx, cy, cr + 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.moveTo(cx, cy - cr)
    ctx.lineTo(cx - 6, cy + cr * 0.3)
    ctx.lineTo(cx + 6, cy + cr * 0.3)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ccc'
    ctx.beginPath()
    ctx.moveTo(cx, cy + cr)
    ctx.lineTo(cx - 6, cy - cr * 0.3)
    ctx.lineTo(cx + 6, cy - cr * 0.3)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#1a1a1a'
    ctx.font = "bold 11px 'DM Sans', sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('N', cx, cy - cr - 10)
    ctx.restore()

    const sbX = 20
    const sbY = canvas.height - 30
    const sbLen = toS(10)

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sbX, sbY)
    ctx.lineTo(sbX + sbLen, sbY)
    ctx.stroke()

    ;[sbX, sbX + sbLen].forEach((x) => {
      ctx.beginPath()
      ctx.moveTo(x, sbY - 4)
      ctx.lineTo(x, sbY + 4)
      ctx.stroke()
    })

    ctx.fillStyle = '#1a1a1a'
    ctx.font = "10px 'DM Sans', sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText("10'", sbX + sbLen / 2, sbY - 8)

    ctx.fillStyle = '#1a1a1a'
    ctx.font = "bold 13px 'DM Mono', monospace"
    ctx.textAlign = 'left'
    ctx.fillText(`FLOOR PLAN · ${plan.house_size || ''}`, 20, 22)

    if (plan.notes) {
      ctx.font = "10px 'DM Sans', sans-serif"
      ctx.fillStyle = '#888'
      ctx.fillText(String(plan.notes).slice(0, 100), 20, 38)
    }
  }, [plan, scale, offsetX, offsetY])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      id="floorplan-canvas"
      ref={canvasRef}
      width={940}
      height={700}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        background: '#faf9f7',
      }}
    />
  )
}
