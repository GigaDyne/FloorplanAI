import { useRef, useCallback, useEffect } from 'react'

const ROOM_COLORS = {
  living: '#f5f0e8', kitchen: '#eef2e8', bedroom: '#dde8f5',
  master_bedroom: '#e2dff5', bathroom: '#d8f0f0', garage: '#e8e8e8',
  office: '#f5ebe0', hallway: '#f5f5f5', pantry: '#f0ede0',
  dining: '#f5f0e0', patio: '#e0f0e0', mudroom: '#ebebeb',
  laundry: '#eef0f5', closet: '#f0f0f0',
}
export { ROOM_COLORS }

const WINDOWED_TYPES = new Set(['living','bedroom','master_bedroom','office','dining','kitchen','patio'])

function getSharedWall(a, b) {
  const ax2 = a.x + a.width, ay2 = a.y + a.depth
  const bx2 = b.x + b.width, by2 = b.y + b.depth
  if (Math.abs(ax2 - b.x) < 1) {
    const s = Math.max(a.y, b.y), e = Math.min(ay2, by2)
    if (e - s >= 3) return { axis: 'x', pos: ax2, start: s, end: e, wall: 'right' }
  }
  if (Math.abs(bx2 - a.x) < 1) {
    const s = Math.max(a.y, b.y), e = Math.min(ay2, by2)
    if (e - s >= 3) return { axis: 'x', pos: a.x, start: s, end: e, wall: 'left' }
  }
  if (Math.abs(ay2 - b.y) < 1) {
    const s = Math.max(a.x, b.x), e = Math.min(ax2, bx2)
    if (e - s >= 3) return { axis: 'y', pos: ay2, start: s, end: e, wall: 'bottom' }
  }
  if (Math.abs(by2 - a.y) < 1) {
    const s = Math.max(a.x, b.x), e = Math.min(ax2, bx2)
    if (e - s >= 3) return { axis: 'y', pos: a.y, start: s, end: e, wall: 'top' }
  }
  return null
}

function buildDoors(rooms) {
  const doors = [], seen = new Set(), DW = 3
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const key = `${i}-${j}`
      if (seen.has(key)) continue
      const shared = getSharedWall(rooms[i], rooms[j])
      if (!shared) continue
      seen.add(key)
      const segLen = shared.end - shared.start
      if (segLen < DW + 1) continue
      const mid = shared.start + segLen / 2
      if (shared.axis === 'y') doors.push({ x: mid - DW/2, y: shared.pos, width: DW, axis: 'y' })
      else doors.push({ x: shared.pos, y: mid - DW/2, width: DW, axis: 'x' })
    }
  }
  return doors
}

function buildWindows(rooms, tw, td) {
  const windows = [], WL = 5
  rooms.forEach(room => {
    if (!WINDOWED_TYPES.has(room.type)) return
    const walls = []
    if (room.y <= 0.5) walls.push('top')
    if (room.y + room.depth >= td - 0.5) walls.push('bottom')
    if (room.x <= 0.5) walls.push('left')
    if (room.x + room.width >= tw - 0.5) walls.push('right')
    walls.forEach(wall => {
      if (wall === 'top' || wall === 'bottom') {
        if (room.width < WL + 2) return
        windows.push({ x: room.x + (room.width - WL)/2, y: wall === 'top' ? room.y : room.y + room.depth, length: WL, axis: 'h' })
      } else {
        if (room.depth < WL + 2) return
        windows.push({ x: wall === 'left' ? room.x : room.x + room.width, y: room.y + (room.depth - WL)/2, length: WL, axis: 'v' })
      }
    })
  })
  return windows
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

    const toX = ft => offsetX + ft * scale
    const toY = ft => offsetY + ft * scale
    const toS = ft => ft * scale
    const tw = plan.total_width || 60
    const td = plan.total_depth || 50
    const rooms = plan.rooms || []

    const smartDoors = buildDoors(rooms)
    const smartWindows = buildWindows(rooms, tw, td)

    // House outline
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3
    ctx.strokeRect(toX(0), toY(0), toS(tw), toS(td))

    // Rooms
    rooms.forEach(room => {
      const rx = toX(room.x), ry = toY(room.y), rw = toS(room.width), rd = toS(room.depth)
      ctx.fillStyle = ROOM_COLORS[room.type] || '#f5f0e8'
      ctx.fillRect(rx, ry, rw, rd)
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5
      ctx.strokeRect(rx, ry, rw, rd)

      const fontSize = Math.max(8, Math.min(13, toS(1.8)))
      ctx.fillStyle = '#2a2a2a'
      ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const maxW = rw - 8
      const words = room.name.split(' ')
      const lines = []
      let cur = ''
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w } else cur = test
      }
      lines.push(cur)
      const lineH = fontSize + 2
      const startY = ry + rd/2 - (lines.length * lineH + lineH + lineH)/2 + lineH/2
      lines.forEach((line, i) => ctx.fillText(line, rx + rw/2, startY + i * lineH))
      ctx.font = `400 ${Math.max(7, fontSize-3)}px 'DM Sans', sans-serif`
      ctx.fillStyle = '#777'
      ctx.fillText(`${room.width}' × ${room.depth}'`, rx + rw/2, startY + lines.length * lineH)
      ctx.fillText(`${room.width * room.depth} sf`, rx + rw/2, startY + lines.length * lineH + lineH - 1)
    })

    // Windows
    const wt = Math.max(5, scale * 0.5)
    smartWindows.forEach(win => {
      const wl = toS(win.length)
      let wx, wy, ww, wh
      if (win.axis === 'h') { wx = toX(win.x); wy = toY(win.y) - wt/2; ww = wl; wh = wt }
      else { wx = toX(win.x) - wt/2; wy = toY(win.y); ww = wt; wh = wl }
      // Erase wall segment
      ctx.fillStyle = '#faf9f7'; ctx.fillRect(wx, wy, ww, wh)
      // Blue fill
      ctx.fillStyle = '#c8e8f5'; ctx.fillRect(wx+1, wy+1, ww-2, wh-2)
      // Border lines
      ctx.strokeStyle = '#2a7ab0'; ctx.lineWidth = 1.5
      ctx.strokeRect(wx, wy, ww, wh)
      // Center line
      ctx.strokeStyle = '#5aadd4'; ctx.lineWidth = 0.8
      ctx.beginPath()
      if (win.axis === 'h') { ctx.moveTo(wx, wy+wh/2); ctx.lineTo(wx+ww, wy+wh/2) }
      else { ctx.moveTo(wx+ww/2, wy); ctx.lineTo(wx+ww/2, wy+wh) }
      ctx.stroke()
    })

    // Doors
    smartDoors.forEach(door => {
      const dw = toS(door.width)
      if (door.axis === 'y') {
        const dx = toX(door.x), dy = toY(door.y)
        ctx.fillStyle = '#faf9f7'; ctx.fillRect(dx, dy-3, dw, 6)
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx+dw, dy); ctx.stroke()
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(dx, dy, dw, 0, Math.PI/2); ctx.stroke()
      } else {
        const dx = toX(door.x), dy = toY(door.y)
        ctx.fillStyle = '#faf9f7'; ctx.fillRect(dx-3, dy, 6, dw)
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx, dy+dw); ctx.stroke()
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(dx, dy, dw, 0, Math.PI/2); ctx.stroke()
      }
    })

    // Compass
    const cx = canvas.width-50, cy = 50, cr = 20
    ctx.save()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, cr+5, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath(); ctx.moveTo(cx, cy-cr); ctx.lineTo(cx-6, cy+cr*0.3); ctx.lineTo(cx+6, cy+cr*0.3); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#ccc'
    ctx.beginPath(); ctx.moveTo(cx, cy+cr); ctx.lineTo(cx-6, cy-cr*0.3); ctx.lineTo(cx+6, cy-cr*0.3); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#1a1a1a'; ctx.font = "bold 11px 'DM Sans', sans-serif"
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', cx, cy-cr-10)
    ctx.restore()

    // Scale bar
    const sbX = 20, sbY = canvas.height-30, sbLen = toS(10)
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX+sbLen, sbY); ctx.stroke()
    ;[sbX, sbX+sbLen].forEach(x => { ctx.beginPath(); ctx.moveTo(x, sbY-4); ctx.lineTo(x, sbY+4); ctx.stroke() })
    ctx.fillStyle = '#1a1a1a'; ctx.font = "10px 'DM Sans', sans-serif"; ctx.textAlign = 'center'
    ctx.fillText("10'", sbX+sbLen/2, sbY-8)

    // Title
    ctx.fillStyle = '#1a1a1a'; ctx.font = "bold 13px 'DM Mono', monospace"; ctx.textAlign = 'left'
    ctx.fillText(`FLOOR PLAN  ·  ${plan.house_size || ''}`, 20, 22)
    if (plan.notes) { ctx.font = "10px 'DM Sans', sans-serif"; ctx.fillStyle = '#888'; ctx.fillText(plan.notes.slice(0,100), 20, 38) }
  }, [plan, scale, offsetX, offsetY])

  useEffect(() => { draw() }, [draw])

  return <canvas ref={canvasRef} id="floorplan-canvas" width={900} height={680} style={{ width:'100%', height:'auto', display:'block' }} />
}
