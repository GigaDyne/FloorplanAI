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

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
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

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.depth <= b.y ||
    b.y + b.depth <= a.y
  );
}

function area(room) {
  return room.width * room.depth;
}

function extractRequirements(prompt) {
  const text = String(prompt || "").toLowerCase();

  const totalSqftMatch = text.match(/(\d{3,5})\s*(sq\.?\s*ft|sqft|square feet)/i);
  const totalSqft = totalSqftMatch ? parseInt(totalSqftMatch[1], 10) : null;

  const floors =
    text.includes("two-story") ||
    text.includes("2-story") ||
    text.includes("2 story") ||
    text.includes("two story")
      ? 2
      : 1;

  const bedMatch = text.match(/(\d+)\s*bed(room)?s?/i);
  const bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : null;

  const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*bath(room)?s?/i);
  const bathValue = bathMatch ? parseFloat(bathMatch[1]) : null;

  let fullBathrooms = null;
  let halfBathrooms = 0;

  if (bathValue !== null) {
    fullBathrooms = Math.floor(bathValue);
    const fractional = bathValue - fullBathrooms;
    if (fractional >= 0.4) halfBathrooms = 1;
  }

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

  if (requirements.floors && floors !== requirements.floors) {
    issues.push(`Expected ${requirements.floors} floor(s), got ${floors}.`);
  }
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

  if (voidArea > Math.max(80, totalArea * 0.18)) {
    issues.push(`Too much unexplained empty interior area: about ${Math.round(voidArea)} sq ft.`);
  }

  if (requirements.totalSqft) {
    const roomArea = rooms.reduce((sum, r) => sum + area(r), 0);
    const diffRatio = Math.abs(roomArea - requirements.totalSqft) / requirements.totalSqft;
    if (diffRatio > 0.18) {
      issues.push(
        `Total room area (${Math.round(roomArea)} sq ft) is too far from requested size (${requirements.totalSqft} sq ft).`
      );
    }
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

function buildSystemPrompt(requirements) {
  return `
You are FloorPlanAI, an expert residential architect and space planner.

Return ONLY valid JSON. No markdown. No explanation.

Goal:
Generate a conceptual residential floor plan as axis-aligned rectangles.

Hard rules:
- Use one rectangular house footprint.
- All dimensions are in feet.
- Rooms must be rectangles.
- Rooms must not overlap.
- Rooms must stay inside the footprint.
- Do not leave large unexplained empty areas.
- Any significant leftover area must be labeled as hallway, foyer, circulation, or open area.
- Include all requested spaces.
- Match bedroom count exactly.
- Match full bathroom count exactly.
- Include half bath if requested.
- Include office if requested.
- Include pantry if requested.
- Include patio if requested.
- Include garage if requested.
- Master bedroom should be separated from the other bedrooms if requested.
- Pantry should be adjacent to kitchen.
- Public spaces should be logically grouped.
- Avoid long skinny unrealistic rooms.

Requirements:
${JSON.stringify(requirements, null, 2)}

Return JSON in this shape:
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
      "x": 0,
      "y": 0,
      "type": "living"
    }
  ],
  "doors": [],
  "windows": [],
  "notes": "Brief layout description"
}
`.trim();
}

function buildRepairPrompt(originalPrompt, failedPlan, issues, requirements) {
  return `
The previous floor plan failed validation.

Original user request:
${originalPrompt}

Validation issues:
${issues.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Previous invalid JSON:
${JSON.stringify(failedPlan, null, 2)}

Repair the plan and return ONLY valid JSON.
No markdown. No explanation.

Requirements:
${JSON.stringify(requirements, null, 2)}
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
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.output_text || "";
  return text;
}

async function generateAndValidate(prompt) {
  const requirements = extractRequirements(prompt);
  const system = buildSystemPrompt(requirements);

  const firstText = await callOpenAI({ system, user: prompt });
  const firstPlan = extractJson(firstText);
  const firstValidation = validatePlan(firstPlan, requirements);

  if (firstValidation.valid) {
    return {
      plan: firstValidation.normalizedPlan,
      validation: firstValidation,
      repaired: false,
    };
  }

  const repairedText = await callOpenAI({
    system,
    user: buildRepairPrompt(prompt, firstPlan, firstValidation.issues, requirements),
  });

  const repairedPlan = extractJson(repairedText);
  const repairedValidation = validatePlan(repairedPlan, requirements);

  const bestValidation =
    repairedValidation.issues.length <= firstValidation.issues.length
      ? repairedValidation
      : firstValidation;

  if (!bestValidation.valid) {
    return {
      plan: null,
      validation: bestValidation,
      repaired: true,
    };
  }

  return {
    plan: bestValidation.normalizedPlan,
    validation: bestValidation,
    repaired: true,
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
