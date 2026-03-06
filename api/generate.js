// api/generate.js
// Vercel Serverless Function - runs on the server, keeps ANTHROPIC_API_KEY secret

export const config = {
  runtime: 'edge', // Use edge runtime for fastest cold starts
}

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
- Add doors at logical connection points between rooms
- Add windows on exterior walls
- Hallways should be 4ft wide minimum

Output this exact JSON structure:
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
  "doors": [
    {
      "x": 10,
      "y": 18,
      "width": 3,
      "wall": "bottom",
      "connects": ["living", "kitchen"]
    }
  ],
  "windows": [
    {
      "x": 4,
      "y": 0,
      "length": 6,
      "wall": "top",
      "room": "living"
    }
  ],
  "notes": "Brief layout description"
}

Valid room types: living, kitchen, bedroom, master_bedroom, bathroom, garage, office, hallway, pantry, dining, patio, mudroom, laundry, closet

Make the layout realistic and proportional. Total room areas should approximately match stated square footage.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { description } = body
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Please provide a house description.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: description.trim() }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', errText)
      return new Response(JSON.stringify({ error: 'AI service error. Please try again.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await anthropicRes.json()
    const text = data.content?.map((c) => c.text || '').join('') || ''

    // Clean and validate JSON
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid layout. Please rephrase and try again.', raw: text }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ plan: parsed }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Handler error:', err)
    return new Response(JSON.stringify({ error: 'Server error. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
