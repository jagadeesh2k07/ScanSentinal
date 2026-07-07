
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type':         'application/json',
    'x-api-key':            process.env.ANTHROPIC_API_KEY,
    'anthropic-version':    '2023-06-01',
  },
  body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, ... })
});

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { image, mediaType, documentType, fileName, blurPct } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Missing required field: image (base64 string).' });
    }

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');

    if (cleanBase64.length > 13_500_000) {
      return res.status(413).json({ error: 'Image too large. Max 10 MB.' });
    }

    const imgMediaType = mediaType || 'image/jpeg';
    const validTypes   = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(imgMediaType)) {
      return res.status(400).json({ error: `Unsupported media type: ${imgMediaType}. Use jpeg, png, gif, or webp.` });
    }

    const blurContext = blurPct > 0
      ? `NOTE: The image has ${blurPct}% blur detected by the client-side Laplacian variance analysis. Attempt to reconstruct obscured or unclear text using document layout context, surrounding characters, and field type inference.`
      : '';

    const systemPrompt = `You are the ScanSentinel Vision Core Engine — an expert AI forensic document analyst.

Your job is to:
1. Extract ALL visible text from the document image, preserving its structure and layout
2. If the image is blurry or degraded, reconstruct obscured text using context, document type patterns, and field structure inference
3. Detect anomalies: missing fields, invalid formats (dates, phone numbers, emails), impossible values (negative age, marks > max), duplicate entries, suspicious alterations, and tampered content
4. Calculate a risk score (0–100) based on severity and count of anomalies found
5. Return a strict JSON payload — NO markdown, NO extra text, ONLY the JSON object

Anomaly severity levels:
- "high": clearly fraudulent, impossible values, critical missing data
- "medium": suspicious, format errors, unusual values
- "low": minor issues, style inconsistencies

Document classification target: "${documentType || 'auto'}"
File: "${fileName || 'uploaded-document'}"
${blurContext}

IMPORTANT: Always return valid JSON matching the exact schema below. No markdown fences.`;

    const userPrompt = `Analyse this document image thoroughly. Extract all text, detect every anomaly, and return ONLY a JSON object in this exact schema:

{
  "text": "Full extracted text from the document, preserving layout with line breaks",
  "risk": 45,
  "blurLevel": "sharp | moderate | heavy",
  "documentTitle": "What type of document this appears to be",
  "anomalies": [
    {
      "type": "Short anomaly name",
      "detail": "Detailed explanation of why this was flagged and what it means",
      "severity": "high | medium | low"
    }
  ],
  "summary": "2–3 sentence plain English verdict on the document's authenticity and what action to take"
}

Return ONLY the JSON. No markdown. No explanation outside the JSON.`;

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      system:     systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type:       'base64',
                media_type: imgMediaType,
                data:       cleanBase64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const rawContent = response.content
      ?.map(block => (block.type === 'text' ? block.text : ''))
      .join('') || '';

    const cleaned = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/,  '')
      .trim();

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('[ScanSentinel] JSON parse failed, using fallback:', parseErr.message);
      parsedOutput = {
        text:          cleaned || 'Text extraction completed — display raw output.',
        risk:          50,
        blurLevel:     blurPct > 60 ? 'heavy' : blurPct > 30 ? 'moderate' : 'sharp',
        documentTitle: documentType || 'Unknown document',
        anomalies: [
          {
            type:     'Parsing Warning',
            detail:   'AI returned data in an unexpected format. Extracted text is shown in raw form.',
            severity: 'low',
          },
        ],
        summary: 'Analysis completed but the response format was non-standard. Review the extracted text manually.',
      };
    }

    const safeOutput = {
      text:          parsedOutput.text          || '',
      risk:          clamp(Number(parsedOutput.risk) || 0, 0, 100),
      blurLevel:     parsedOutput.blurLevel     || 'sharp',
      documentTitle: parsedOutput.documentTitle || documentType || 'Document',
      anomalies:     Array.isArray(parsedOutput.anomalies) ? parsedOutput.anomalies : [],
      summary:       parsedOutput.summary       || '',
    };

    safeOutput.anomalies = safeOutput.anomalies.map(a => ({
      type:     String(a.type     || 'Unknown issue'),
      detail:   String(a.detail   || ''),
      severity: ['high','medium','low'].includes(a.severity) ? a.severity : 'medium',
    }));

    return res.status(200).json(safeOutput);

  } catch (error) {
    console.error('[ScanSentinel] Handler error:', error);

    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY env variable.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit reached. Please wait a moment and try again.' });
    }
    if (error.status === 413 || error.message?.includes('too large')) {
      return res.status(413).json({ error: 'Image too large for the AI model. Try a smaller file.' });
    }

    return res.status(500).json({
      error:   'Internal processing error.',
      details: error.message || 'Unknown error',
    });
  }
};

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}