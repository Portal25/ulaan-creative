export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get and sanitize API key - remove any non-ASCII characters
  const rawKey = process.env.ANTHROPIC_API_KEY || '';
  const apiKey = rawKey.replace(/[^\x20-\x7E]/g, '').trim();
  
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ 
      error: 'API key not configured. Set ANTHROPIC_API_KEY in Vercel Environment Variables.',
      debug: 'key_length:' + apiKey.length
    });
  }

  try {
    const body = req.body;
    
    const anthropicBody = {
      model: body.model || 'claude-haiku-4-5-20251001',
      max_tokens: body.max_tokens || 2000,
      messages: body.messages,
    };
    if (body.system) anthropicBody.system = body.system;
    if (body.stream) anthropicBody.stream = body.stream;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errData;
      try { errData = JSON.parse(responseText); } catch(e) { errData = { message: responseText }; }
      return res.status(response.status).json({ 
        error: errData.error?.message || 'Anthropic API error',
        status: response.status
      });
    }

    // Handle streaming
    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(responseText);
      return res.end();
    }

    let data;
    try { data = JSON.parse(responseText); } catch(e) { data = { error: 'Invalid JSON from Anthropic' }; }
    return res.status(200).json(data);

  } catch (error) {
    console.error('Generate error:', error.message);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
