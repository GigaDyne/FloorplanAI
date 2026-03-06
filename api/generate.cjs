// api/generate.cjs — CommonJS (explicit .cjs extension bypasses "type":"module")

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
    { "id": "living", "name": "Living Room", "width": 20, "depth": 18, "x": 0, "y": 0, "type": "living" }
  ],
  "doors": [
    { "x": 10, "y": 18, "width": 3, "wall": "bottom", "connects": ["living", "kitchen"] }
  ],
  "windows": [
    { "x": 4, "y": 0, "length": 6, "wall": "top", "room": "living" }
  ],
  "notes": "Brief layout description"
}

Valid room types: living, kitchen, bedroom, master_bedroom, bathroom, garage, office, hallway, pantry, dining, patio, mudroom, laundry, closet
Make the layout realistic and proportional. Total room areas should approximately match stated square footage.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const { description } = req.body || {};
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a house description.' });
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: description.trim() }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return res.status(502).json({ error: `Anthropic API error ${anthropicRes.status}`, detail: errText });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((c) => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return res.status(422).json({ error: 'AI returned invalid layout. Please rephrase and try again.' });
    }

    return res.status(200).json({ plan: parsed });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
