import { useRef, useCallback, useEffect } from 'react'

const ROOM_COLORS = {
  living: '#f5f0e8',
  kitchen: '#eef2e8',
  bedroom: '#dde8f5',
  master_bedroom: '#e2dff5',
  bathroom: '#d8f0f0',
  garage: '#e8e8e8',
  office: '#f5ebe0',
  hallway: '#f5f5f5',
  pantry: '#f0ede0',
  dining: '#f5f0e0',
  patio: '#e0f0e0',
  mudroom: '#ebebeb',
  laundry: '#eef0f5',
  closet: '#f0f0f0',
}

export { ROOM_COLORS }

export default function FloorPlanCanvas({ plan, scale, offsetX, offsetY }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !plan) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#faf9f7'
    ctx.fillRect(0, 0, W, H)

    const toX = (ft) => offsetX + ft * scale
    const toY = (ft) => offsetY + ft * scale
    const toS = (ft) => ft * scale

    // House outline
    if (plan.total_width && plan.total_depth) {
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.5
      ctx.strokeRect(toX(0), toY(0), toS(plan.total_width), toS(plan.total_depth))
    }

    // Rooms
    plan.rooms?.forEach((room) => {
      const rx = toX(room.x)
      const ry = toY(room.y)
      const rw = toS(room.width)
      const rd = toS(room.depth)

      ctx.fillStyle = ROOM_COLORS[room.type] || '#f5f0e8'
      ctx.fillRect(rx, ry, rw, rd)

      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 1.8
      ctx.strokeRect(rx, ry, rw, rd)

      const fontSize = Math.max(9, Math.min(13, toS(1.8)))
      ctx.fillStyle = '#2a2a2a'
      ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const maxW = rw - 8
      const words = room.name.split(' ')
      const lines = []
      let cur = ''
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur)
          cur = w
        } else {
          cur = test
        }
      }
      lines.push(cur)

      const lineH = fontSize + 2
      const totalH = lines.length * lineH + lineH + lineH
      const startY = ry + rd / 2 - totalH / 2 + lineH / 2

      lines.forEach((line, i) => {
        ctx.fillText(line, rx + rw / 2, startY + i * lineH)
      })

      ctx.font = `400 ${Math.max(7, fontSize - 3)}px 'DM Sans', sans-serif`
      ctx.fillStyle = '#666'
      ctx.fillText(`${room.width}' × ${room.depth}'`, rx + rw / 2, startY + lines.length * lineH)
      ctx.fillText(`${room.width * room.depth} sf`, rx + rw / 2, startY + lines.length * lineH + lineH - 1)
    })

    // Windows
    plan.windows?.forEach((win) => {
      const wlen = toS(win.length || 4)
      const thick = Math.max(4, scale * 0.4)
      ctx.fillStyle = '#a8d4e8'
      ctx.strokeStyle = '#3a8ab0'
      ctx.lineWidth = 1

      let wx, wy, ww, wh
      if (win.wall === 'top' || win.wall === 'bottom') {
        wx = toX(win.x)
        wy = toY(win.y) - thick / 2
        ww = wlen
        wh = thick
      } else {
        wx = toX(win.x) - thick / 2
        wy = toY(win.y)
        ww = thick
        wh = wlen
      }
      ctx.fillRect(wx, wy, ww, wh)
      ctx.strokeRect(wx, wy, ww, wh)
    })

    // Doors
    plan.doors?.forEach((door) => {
      const dw = toS(door.width || 3)
      const dx = toX(door.x)
      const dy = toY(door.y)

      ctx.fillStyle = '#faf9f7'
      if (door.wall === 'bottom' || door.wall === 'top') {
        ctx.fillRect(dx, dy - 2, dw, 4)
        ctx.strokeStyle = '#888'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(dx, dy, dw, 0, Math.PI / 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(dx, dy)
        ctx.lineTo(dx + dw, dy)
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2
        ctx.stroke()
      } else {
        ctx.fillRect(dx - 2, dy, 4, dw)
        ctx.strokeStyle = '#888'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(dx, dy, dw, 0, Math.PI / 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(dx, dy)
        ctx.lineTo(dx, dy + dw)
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Compass
    const cx = W - 50, cy = 50, cr = 20
    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx, cy, cr + 4, 0, Math.PI * 2)
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

    // Scale bar
    const sbX = 20, sbY = H - 30
    const sbFt = 10
    const sbLen = toS(sbFt)
    ctx.fillStyle = '#1a1a1a'
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
    ctx.font = "10px 'DM Sans', sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText(`${sbFt}'`, sbX + sbLen / 2, sbY - 8)

    // Title
    ctx.fillStyle = '#1a1a1a'
    ctx.font = "bold 13px 'DM Mono', monospace"
    ctx.textAlign = 'left'
    ctx.fillText(`FLOOR PLAN  ·  ${plan.house_size || ''}`, 20, 22)
    if (plan.notes) {
      ctx.font = "10px 'DM Sans', sans-serif"
      ctx.fillStyle = '#888'
      ctx.fillText(plan.notes.slice(0, 90), 20, 38)
    }
  }, [plan, scale, offsetX, offsetY])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      id="floorplan-canvas"
      width={900}
      height={680}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  )
}
