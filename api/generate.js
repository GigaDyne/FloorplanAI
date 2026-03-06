export const config = {
  runtime: "edge",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function roundTo2(n) {
  return Math.round(n * 100) / 100;
}

function area(room) {
  return room.width * room.depth;
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.depth <= b.y ||
    b.y + b.depth <= a.y
  );
}

function extractJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const fencedMatch =
    text.match(/```json\s*([\s\S]*?)```/i) ||
    text.match(/```\s*([\s\S]*?)```/i);

  if (fencedMatch) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch {}
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

function inferRoomType(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("master")) return "master_bedroom";
  if (n.includes("bed")) return "bedroom";
  if (n.includes("kitchen")) return "kitchen";
  if (n.includes("living") || n.includes("family") || n.includes("great room")) return "living";
  if (n.includes("dining")) return "dining";
  if (n.includes("garage")) return "garage";
  if (n.includes("office") || n.includes("study")) return "office";
  if (n.includes("pantry")) return "pantry";
  if (n.includes("patio") || n.includes("porch")) return "patio";
  if (n.includes("mud")) return "mudroom";
  if (n.includes("laundry")) return "laundry";
  if (n.includes("hall")) return "hallway";
  if (n.includes("foyer") || n.includes("entry")) return "foyer";
  if (n.includes("powder") || n.includes("half")) return "half_bath";
  if (n.includes("bath")) return "bathroom";
  return "room";
}

function normalizeRoom(room, index = 0) {
  const width = Math.max(1, clampNumber(room.width, 0));
  const depth = Math.max(1, clampNumber(room.depth, 0));
  const x = Math.max(0, clampNumber(room.x, 0));
  const y = Math.max(0, clampNumber(room.y, 0));
  const name = String(room.name || room.id || `Room ${index + 1}`).trim();
  const id = String(room.id || name.toLowerCase().replace(/\s+/g, "_") || `room_${index + 1}`);
  const type = String(room.type || inferRoomType(name)).trim();

  return { id, name, width, depth, x, y, type };
}

function extractRequirements(prompt) {
  const text = String(prompt || "").toLowerCase();

  const totalSqftMatch = text.match(/(\d{3,5})\s*(sq\.?\s*ft|sqft|square feet)/i);
  const totalSqft = totalSqftMatch ? parseInt(totalSqftMatch[1], 10) : 2200;

  const floors =
    text.includes("two-story") ||
    text.includes("2-story") ||
    text.includes("2 story") ||
    text.includes("two story")
      ? 2
      : 1;

  const bedMatch = text.match(/(\d+)\s*bed(room)?s?/i);
  const bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : 3;

  const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*bath(room)?s?/i);
  const bathValue = bathMatch ? parseFloat(bathMatch[1]) : 2;

  let fullBathrooms = Math.floor(bathValue);
  let halfBathrooms = 0;
  const fractional = bathValue - fullBathrooms;
  if (fractional >= 0.4) halfBathrooms = 1;

  const garageMatch =
    text.match(/(\d)[-\s]*car garage/i) ||
    text.match(/garage for (\d) cars?/i);

  const garageCars = garageMatch ? parseInt(garageMatch[1], 10) : (text.includes("garage") ? 2 : 0);

  const hasOffice = /\b(home office|office|study)\b/i.test(text);
  const hasPantry = /\bpantry\b/i.test(text);
  const hasCoveredPatio = /\bcovered patio\b/i.test(text);
  const hasPatio = /\bpatio\b/i.test(text) || hasCoveredPatio;
  const openKitchenLiving =
    /\bopen kitchen\b/i.test(text) ||
    /\bopen living\b/i.test(text) ||
    /\bopen concept\b/i.test(text) ||
    /\bopen kitchen and living\b/i.test(text) ||
    /\bopen kitchen & living\b/i.test(text);

  const separatedMaster =
    /\bmaster bedroom separated\b/i.test(text) ||
    /\bmaster separated\b/i.test(text) ||
    /\bmaster suite separated\b/i.test(text) ||
    /\bmaster bedroom away from\b/i.test(text);

  return {
    totalSqft,
    floors,
    bedrooms,
    fullBathrooms,
    halfBathrooms,
    garageCars,
    hasOffice,
    hasPantry,
    hasPatio,
    hasCoveredPatio,
    openKitchenLiving,
    separatedMaster,
  };
}

function chooseFootprint(totalSqft, requirements) {
  let width = 64;
  let depth = 50;

  if (totalSqft <= 1800) {
    width = 56;
    depth = 42;
  } else if (totalSqft <= 2200) {
    width = 60;
    depth = 46;
  } else if (totalSqft <= 2600) {
    width = 64;
    depth = 50;
  } else if (totalSqft <= 3200) {
    width = 70;
    depth = 50;
  } else {
    width = 72;
    depth = 54;
  }

  if (requirements.hasPatio) depth += 4;
  if (requirements.hasOffice) width += 2;
  if (requirements.garageCars >= 2) width += 2;

  return { width, depth };
}

function buildProgramPrompt(requirements, prompt) {
  return `
You are extracting a residential room program from a user request.

Return ONLY valid JSON.
No markdown.
No explanation.

The layout itself will be generated by code.
You are only returning the room program and target areas.

Rules:
- Single-story only. If the prompt asks for multi-story, still return a single-story program.
- Include exact requested counts for bedrooms and bathrooms.
- If the request says 2.5 bathrooms, return 2 full baths and 1 half bath.
- Include pantry if requested.
- Include office if requested.
- Include patio if requested.
- Include garage if requested.
- Use realistic target areas in square feet.
- Return one master bedroom if bedrooms >= 1.
- Return remaining bedrooms as secondary bedrooms.
- Use concise names.

Requirements summary:
${JSON.stringify(requirements, null, 2)}

Return JSON in this exact shape:
{
  "rooms": [
    { "id": "living", "name": "Living Room", "type": "living", "target_area": 320 },
    { "id": "kitchen", "name": "Kitchen", "type": "kitchen", "target_area": 180 }
  ],
  "notes": "brief summary"
}

Allowed room types:
living, kitchen, dining, master_bedroom, bedroom, bathroom, half_bath, pantry, office, patio, garage, hallway, mudroom, laundry, foyer, closet

User prompt:
${prompt}
`.trim();
}

async function callOpenAI({ system, user }) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: user }],
        },
      ],
      text: {
        format: { type: "text" },
      },
      max_output_tokens: 1800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.output_text || "";
}

function fallbackProgram(requirements) {
  const rooms = [];

  rooms.push({ id: "living", name: "Living Room", type: "living", target_area: 360 });
  rooms.push({ id: "kitchen", name: "Kitchen", type: "kitchen", target_area: 190 });
  rooms.push({ id: "dining", name: "Dining Room", type: "dining", target_area: 150 });

  rooms.push({
    id: "master_bedroom",
    name: "Master Bedroom",
    type: "master_bedroom",
    target_area: 240,
  });

  if (requirements.fullBathrooms >= 1) {
    rooms.push({
      id: "master_bathroom",
      name: "Master Bath",
      type: "bathroom",
      target_area: 100,
    });
  }

  for (let i = 1; i < requirements.bedrooms; i += 1) {
    rooms.push({
      id: `bedroom_${i}`,
      name: `Bedroom ${i}`,
      type: "bedroom",
      target_area: 144,
    });
  }

  const sharedBathCount = Math.max(0, requirements.fullBathrooms - 1);
  for (let i = 1; i <= sharedBathCount; i += 1) {
    rooms.push({
      id: `bathroom_${i}`,
      name: `Bathroom ${i}`,
      type: "bathroom",
      target_area: 64,
    });
  }

  for (let i = 1; i <= requirements.halfBathrooms; i += 1) {
    rooms.push({
      id: `half_bath_${i}`,
      name: "Half Bath",
      type: "half_bath",
      target_area: 36,
    });
  }

  if (requirements.hasPantry) {
    rooms.push({
      id: "pantry",
      name: "Pantry",
      type: "pantry",
      target_area: 50,
    });
  }

  if (requirements.hasOffice) {
    rooms.push({
      id: "office",
      name: "Home Office",
      type: "office",
      target_area: 132,
    });
  }

  if (requirements.hasPatio) {
    rooms.push({
      id: "patio",
      name: requirements.hasCoveredPatio ? "Covered Patio" : "Patio",
      type: "patio",
      target_area: 220,
    });
  }

  if (requirements.garageCars > 0) {
    rooms.push({
      id: "garage",
      name: "Garage",
      type: "garage",
      target_area: requirements.garageCars >= 2 ? 400 : 240,
    });
  }

  return {
    rooms,
    notes: "Fallback room program generated by server.",
  };
}

function normalizeProgram(program, requirements) {
  const rooms = Array.isArray(program?.rooms) ? program.rooms : [];
  const clean = [];

  for (let i = 0; i < rooms.length; i += 1) {
    const r = rooms[i];
    const type = String(r?.type || inferRoomType(r?.name || "")).trim();
    const name = String(r?.name || r?.id || `Room ${i + 1}`).trim();
    const id = String(r?.id || name.toLowerCase().replace(/\s+/g, "_")).trim();
    const target_area = Math.max(30, clampNumber(r?.target_area, 100));

    clean.push({ id, name, type, target_area });
  }

  if (!clean.length) return fallbackProgram(requirements);

  return {
    rooms: clean,
    notes: String(program?.notes || ""),
  };
}

function findRoom(program, predicate) {
  return program.rooms.find(predicate) || null;
}

function findRooms(program, predicate) {
  return program.rooms.filter(predicate);
}

function makeRoom(name, type, width, depth, x, y, id = null) {
  return {
    id: id || name.toLowerCase().replace(/\s+/g, "_"),
    name,
    type,
    width,
    depth,
    x,
    y,
  };
}

function dedupeAndNormalizeRooms(rooms) {
  const out = [];
  const seen = new Set();

  for (let i = 0; i < rooms.length; i += 1) {
    const r = normalizeRoom(rooms[i], i);
    let id = r.id;
    let n = 2;

    while (seen.has(id)) {
      id = `${r.id}_${n}`;
      n += 1;
    }

    seen.add(id);
    out.push({ ...r, id });
  }

  return out;
}

function buildDeterministicPlan(requirements, program) {
  const { width: W, depth: D } = chooseFootprint(requirements.totalSqft, requirements);
  const rooms = [];

  const livingProg = findRoom(program, (r) => r.type === "living");
  const kitchenProg = findRoom(program, (r) => r.type === "kitchen");
  const diningProg = findRoom(program, (r) => r.type === "dining");
  const pantryProg = findRoom(program, (r) => r.type === "pantry");
  const officeProg = findRoom(program, (r) => r.type === "office");
  const patioProg = findRoom(program, (r) => r.type === "patio");
  const garageProg = findRoom(program, (r) => r.type === "garage");
  const masterProg = findRoom(program, (r) => r.type === "master_bedroom");
  const bedroomProgs = findRooms(program, (r) => r.type === "bedroom");
  const fullBathProgs = findRooms(program, (r) => r.type === "bathroom");
  const halfBathProg = findRoom(program, (r) => r.type === "half_bath");

  const masterBathProg =
    fullBathProgs.find((r) => r.id.includes("master") || r.name.toLowerCase().includes("master")) ||
    fullBathProgs[0] ||
    null;

  const sharedBaths = fullBathProgs.filter((r) => !masterBathProg || r.id !== masterBathProg.id);

  const leftW = 18;
  const centerW = 18;
  const rightW = W - leftW - centerW;

  const topD = 18;
  const middleD = 16;
  const bottomD = D - topD - middleD;

  rooms.push(makeRoom(
    livingProg?.name || "Living Room",
    "living",
    leftW,
    topD,
    0,
    0,
    livingProg?.id || "living"
  ));

  rooms.push(makeRoom(
    kitchenProg?.name || "Kitchen",
    "kitchen",
    centerW,
    topD,
    leftW,
    0,
    kitchenProg?.id || "kitchen"
  ));

  rooms.push(makeRoom(
    diningProg?.name || "Dining Room",
    "dining",
    rightW,
    topD,
    leftW + centerW,
    0,
    diningProg?.id || "dining"
  ));

  const masterBathH = masterBathProg ? 8 : 0;
  const masterBedH = middleD - masterBathH;

  rooms.push(makeRoom(
    masterProg?.name || "Master Bedroom",
    "master_bedroom",
    leftW,
    masterBedH,
    0,
    topD,
    masterProg?.id || "master_bedroom"
  ));

  if (masterBathProg) {
    rooms.push(makeRoom(
      masterBathProg.name || "Master Bath",
      "bathroom",
      leftW,
      masterBathH,
      0,
      topD + masterBedH,
      masterBathProg.id || "master_bathroom"
    ));
  }

  const pantryH = pantryProg ? 6 : 0;
  const officeH = officeProg ? 6 : 0;
  const hallH = middleD - pantryH - officeH;

  if (pantryProg) {
    rooms.push(makeRoom(
      pantryProg.name || "Pantry",
      "pantry",
      centerW,
      pantryH,
      leftW,
      topD,
      pantryProg.id || "pantry"
    ));
  }

  rooms.push(makeRoom(
    "Hallway",
    "hallway",
    centerW,
    hallH,
    leftW,
    topD + pantryH,
    "hallway"
  ));

  if (officeProg) {
    rooms.push(makeRoom(
      officeProg.name || "Home Office",
      "office",
      centerW,
      officeH,
      leftW,
      topD + pantryH + hallH,
      officeProg.id || "office"
    ));
  }

  const secondaryCount = bedroomProgs.length;
  const bedAreaW = Math.max(12, rightW - 8);
  const bathColW = rightW - bedAreaW;

  if (secondaryCount >= 1) {
    const eachBedH = Math.floor(middleD / secondaryCount);
    let y = topD;

    for (let i = 0; i < secondaryCount; i += 1) {
      const h = i === secondaryCount - 1 ? (topD + middleD - y) : eachBedH;
      rooms.push(makeRoom(
        bedroomProgs[i].name || `Bedroom ${i + 1}`,
        "bedroom",
        bedAreaW,
        h,
        leftW + centerW,
        y,
        bedroomProgs[i].id || `bedroom_${i + 1}`
      ));
      y += h;
    }
  }

  if (sharedBaths[0] && bathColW >= 6) {
    rooms.push(makeRoom(
      sharedBaths[0].name || "Bathroom 1",
      "bathroom",
      bathColW,
      8,
      leftW + centerW + bedAreaW,
      topD,
      sharedBaths[0].id || "bathroom_1"
    ));
  }

  if (halfBathProg && bathColW >= 6) {
    rooms.push(makeRoom(
      halfBathProg.name || "Half Bath",
      "half_bath",
      bathColW,
      6,
      leftW + centerW + bedAreaW,
      topD + 8,
      halfBathProg.id || "half_bath_1"
    ));
  }

  const garageW = garageProg ? Math.min(20, rightW) : 0;
  const garageX = W - garageW;

  if (patioProg) {
    rooms.push(makeRoom(
      patioProg.name || "Covered Patio",
      "patio",
      W - garageW,
      bottomD,
      0,
      topD + middleD,
      patioProg.id || "patio"
    ));
  } else {
    rooms.push(makeRoom(
      "Open Area",
      "hallway",
      W - garageW,
      bottomD,
      0,
      topD + middleD,
      "open_area"
    ));
  }

  if (garageProg) {
    rooms.push(makeRoom(
      garageProg.name || "Garage",
      "garage",
      garageW,
      bottomD,
      garageX,
      topD + middleD,
      garageProg.id || "garage"
    ));
  }

  const normalizedRooms = dedupeAndNormalizeRooms(rooms);

  return {
    house_size: `${requirements.totalSqft} sqft`,
    total_width: W,
    total_depth: D,
    floors: 1,
    rooms: normalizedRooms,
    doors: buildDoorsFromRooms(normalizedRooms),
    windows: buildWindowsFromRooms(normalizedRooms, W, D),
    notes:
      program.notes ||
      "Single-story conceptual layout with public spaces at the front, private rooms in the middle, and patio/garage at the rear.",
  };
}

function sharedWall(a, b) {
  if (a.x + a.width === b.x || b.x + b.width === a.x) {
    const y1 = Math.max(a.y, b.y);
    const y2 = Math.min(a.y + a.depth, b.y + b.depth);
    if (y2 - y1 >= 3) {
      return {
        orientation: "vertical",
        x: a.x + a.width === b.x ? b.x : a.x,
        start: y1,
        length: y2 - y1,
      };
    }
  }

  if (a.y + a.depth === b.y || b.y + b.depth === a.y) {
    const x1 = Math.max(a.x, b.x);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    if (x2 - x1 >= 3) {
      return {
        orientation: "horizontal",
        y: a.y + a.depth === b.y ? b.y : a.y,
        start: x1,
        length: x2 - x1,
      };
    }
  }

  return null;
}

function shouldConnect(roomA, roomB) {
  const a = roomA.type;
  const b = roomB.type;
  const pair = [a, b].sort().join("|");

  const allowed = new Set([
    "bathroom|bedroom",
    "bathroom|master_bedroom",
    "dining|kitchen",
    "dining|living",
    "garage|hallway",
    "hallway|bathroom",
    "hallway|bedroom",
    "hallway|dining",
    "hallway|garage",
    "hallway|half_bath",
    "hallway|kitchen",
    "hallway|living",
    "hallway|master_bedroom",
    "hallway|office",
    "hallway|pantry",
    "kitchen|living",
    "kitchen|pantry",
  ]);

  return allowed.has(pair);
}

function buildDoorsFromRooms(rooms) {
  const doors = [];

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i];
      const b = rooms[j];
      if (!shouldConnect(a, b)) continue;

      const wall = sharedWall(a, b);
      if (!wall) continue;

      if (wall.orientation === "vertical") {
        doors.push({
          x: wall.x,
          y: roundTo2(wall.start + Math.max(1, wall.length / 2 - 1.5)),
          width: 3,
          axis: "x",
        });
      } else {
        doors.push({
          x: roundTo2(wall.start + Math.max(1, wall.length / 2 - 1.5)),
          y: wall.y,
          width: 3,
          axis: "y",
        });
      }
    }
  }

  return doors.slice(0, 24);
}

function buildWindowsFromRooms(rooms, totalWidth, totalDepth) {
  const windows = [];

  for (const room of rooms) {
    if (!["living", "kitchen", "bedroom", "master_bedroom", "office", "dining", "patio"].includes(room.type)) {
      continue;
    }

    const exteriorTop = room.y === 0;
    const exteriorBottom = room.y + room.depth === totalDepth;
    const exteriorLeft = room.x === 0;
    const exteriorRight = room.x + room.width === totalWidth;

    if (exteriorTop && room.width >= 6) {
      windows.push({
        x: roundTo2(room.x + Math.max(1, room.width / 2 - 2)),
        y: room.y,
        length: 4,
        axis: "h",
      });
    }

    if (exteriorBottom && room.width >= 6) {
      windows.push({
        x: roundTo2(room.x + Math.max(1, room.width / 2 - 2)),
        y: room.y + room.depth,
        length: 4,
        axis: "h",
      });
    }

    if (exteriorLeft && room.depth >= 6) {
      windows.push({
        x: room.x,
        y: roundTo2(room.y + Math.max(1, room.depth / 2 - 2)),
        length: 4,
        axis: "v",
      });
    }

    if (exteriorRight && room.depth >= 6) {
      windows.push({
        x: room.x + room.width,
        y: roundTo2(room.y + Math.max(1, room.depth / 2 - 2)),
        length: 4,
        axis: "v",
      });
    }
  }

  return windows.slice(0, 20);
}

function countPlanFeatures(rooms) {
  let bedrooms = 0;
  let masterBedrooms = 0;
  let fullBathrooms = 0;
  let halfBathrooms = 0;
  let offices = 0;
  let pantries = 0;
  let patios = 0;
  let garages = 0;

  for (const r of rooms) {
    const type = String(r.type || "").toLowerCase();
    const name = String(r.name || "").toLowerCase();

    if (type === "master_bedroom" || name.includes("master bedroom")) {
      masterBedrooms += 1;
      bedrooms += 1;
      continue;
    }

    if (type === "bedroom" || /\bbed(room)?\b/.test(name)) {
      bedrooms += 1;
      continue;
    }

    if (type === "half_bath" || name.includes("powder") || name.includes("half bath")) {
      halfBathrooms += 1;
      continue;
    }

    if (type === "bathroom" || /\bbath(room)?\b/.test(name)) {
      fullBathrooms += 1;
      continue;
    }

    if (type === "office" || name.includes("office") || name.includes("study")) {
      offices += 1;
      continue;
    }

    if (type === "pantry" || name.includes("pantry")) {
      pantries += 1;
      continue;
    }

    if (type === "patio" || name.includes("patio") || name.includes("porch")) {
      patios += 1;
      continue;
    }

    if (type === "garage" || name.includes("garage")) {
      garages += 1;
    }
  }

  return {
    bedrooms,
    masterBedrooms,
    fullBathrooms,
    halfBathrooms,
    offices,
    pantries,
    patios,
    garages,
  };
}

function estimateVoidArea(plan, rooms) {
  const totalWidth = clampNumber(plan.total_width, 0);
  const totalDepth = clampNumber(plan.total_depth, 0);
  const shellArea = totalWidth * totalDepth;
  const usedArea = rooms.reduce((sum, r) => sum + area(r), 0);
  return Math.max(0, shellArea - usedArea);
}

function validatePlan(plan, requirements) {
  const issues = [];

  if (!plan || typeof plan !== "object") {
    issues.push("Plan is missing or not an object.");
    return { valid: false, issues };
  }

  const totalWidth = clampNumber(plan.total_width, 0);
  const totalDepth = clampNumber(plan.total_depth, 0);
  const floors = clampNumber(plan.floors, 1);
  const roomsRaw = Array.isArray(plan.rooms) ? plan.rooms : [];

  if (!totalWidth || !totalDepth) issues.push("Plan must include total_width and total_depth.");
  if (!roomsRaw.length) issues.push("Plan must include at least one room.");

  const rooms = roomsRaw.map(normalizeRoom);

  for (const r of rooms) {
    if (r.x + r.width > totalWidth) issues.push(`${r.name} extends beyond house width.`);
    if (r.y + r.depth > totalDepth) issues.push(`${r.name} extends beyond house depth.`);
  }

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (rectsOverlap(rooms[i], rooms[j])) {
        issues.push(`Rooms overlap: ${rooms[i].name} and ${rooms[j].name}.`);
      }
    }
  }

  const counts = countPlanFeatures(rooms);

  if (requirements.bedrooms !== null && counts.bedrooms !== requirements.bedrooms) {
    issues.push(`Expected ${requirements.bedrooms} bedrooms, got ${counts.bedrooms}.`);
  }

  if (requirements.fullBathrooms !== null && counts.fullBathrooms !== requirements.fullBathrooms) {
    issues.push(`Expected ${requirements.fullBathrooms} full bathrooms, got ${counts.fullBathrooms}.`);
  }

  if (requirements.halfBathrooms > 0 && counts.halfBathrooms < requirements.halfBathrooms) {
    issues.push(`Expected at least ${requirements.halfBathrooms} half bath, got ${counts.halfBathrooms}.`);
  }

  if (requirements.hasOffice && counts.offices < 1) issues.push("Office requested but not included.");
  if (requirements.hasPantry && counts.pantries < 1) issues.push("Pantry requested but not included.");
  if (requirements.hasPatio && counts.patios < 1) issues.push("Patio requested but not included.");
  if (requirements.garageCars > 0 && counts.garages < 1) issues.push("Garage requested but not included.");
  if (requirements.separatedMaster && counts.masterBedrooms < 1) {
    issues.push("Separated master bedroom requested but no master bedroom is labeled.");
  }

  const voidArea = estimateVoidArea(plan, rooms);
  const totalArea = totalWidth * totalDepth;

  if (voidArea > Math.max(120, totalArea * 0.22)) {
    issues.push(`Too much unexplained empty interior area: about ${Math.round(voidArea)} sq ft.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    normalizedPlan: {
      ...plan,
      total_width: totalWidth,
      total_depth: totalDepth,
      floors,
      rooms,
      doors: Array.isArray(plan.doors) ? plan.doors : [],
      windows: Array.isArray(plan.windows) ? plan.windows : [],
      notes: String(plan.notes || ""),
    },
  };
}

async function generateProgram(prompt, requirements) {
  try {
    const system = buildProgramPrompt(requirements, prompt);
    const text = await callOpenAI({ system, user: prompt });
    const parsed = extractJson(text);
    return normalizeProgram(parsed, requirements);
  } catch {
    return fallbackProgram(requirements);
  }
}

async function generateAndValidate(prompt) {
  const requirements = extractRequirements(prompt);

  if (requirements.floors !== 1) {
    return {
      plan: null,
      validation: {
        valid: false,
        issues: ["This version only supports single-story plans right now."],
      },
      repaired: false,
    };
  }

  const program = await generateProgram(prompt, requirements);
  const plan = buildDeterministicPlan(requirements, program);
  const validation = validatePlan(plan, requirements);

  if (!validation.valid) {
    return {
      plan: null,
      validation,
      repaired: false,
    };
  }

  return {
    plan: validation.normalizedPlan,
    validation,
    repaired: false,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return jsonResponse({}, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY environment variable" }, 500);
  }

  try {
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();

    if (!prompt) return jsonResponse({ error: "Missing prompt" }, 400);

    const result = await generateAndValidate(prompt);

    if (!result?.plan) {
      return jsonResponse(
        {
          success: false,
          repaired: result?.repaired || false,
          validationIssues: result?.validation?.issues || ["Model returned no usable plan."],
          plan: null,
        },
        200
      );
    }

    return jsonResponse({
      success: result.validation.valid,
      repaired: result.repaired,
      validationIssues: result.validation.issues,
      plan: result.plan,
    });
  } catch (error) {
    return jsonResponse(
      { error: error?.message || "Unexpected server error" },
      500
    );
  }
}
