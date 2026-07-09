// api/scan.js
// ScanSentinel backend — real OCR + anomaly detection via Gemini vision.
// Runs as a Vercel Node.js serverless function.

const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-2.5-flash';

const DOC_TYPE_LABELS = {
  invoice: 'Invoice / bill',
  certificate: 'Certificate / degree',
  prescription: 'Medical prescription',
  form: 'Government / ID form',
  answer_sheet: 'Exam answer sheet / mark sheet',
  general: 'General document',
  auto: 'Unspecified — detect the type yourself',
};

function buildPrompt({ documentType, fileName, blurPct }) {
  const typeLabel = DOC_TYPE_LABELS[documentType] || DOC_TYPE_LABELS.auto;

  return `You are ScanSentinel, a forensic document-analysis AI. You will be given a scanned or photographed document (image or PDF). Perform OCR/ICR to extract all readable text, then analyze it for signs of tampering, fraud, or data-entry errors.

Context:
- File name: ${fileName || 'unknown'}
- Expected document type: ${typeLabel}
- Client-side blur estimate: ${blurPct || 0}% (0 = sharp, 100 = unreadable). Factor this into your confidence score, and if blur is high, note it may explain missing/garbled text rather than fraud.

Check specifically for:
- Invalid or impossible dates (e.g. day 32, month 13, year 9999)
- Arithmetic mismatches (totals that don't sum, tax percentages that don't match, marks exceeding the stated maximum)
- Duplicate identifiers that should be unique (invoice numbers, IDs, reference numbers appearing twice)
- Missing required fields (blank signature, blank name/ID, blank amount)
- Inconsistent or malformed values (negative amounts where impossible, phone numbers with wrong digit counts, formatting that doesn't match the document type)
- Anything else that looks internally inconsistent or suspicious

Respond with ONLY a single JSON object, no markdown fences, no preamble, matching exactly this shape:
{
  "ocrText": "the full extracted text, preserving line breaks",
  "documentType": "your best single-word/short-phrase classification of the actual document type",
  "confidence": <integer 0-100, your OCR confidence given image quality>,
  "risk": <integer 0-100, overall fraud/tampering risk score>,
  "anomalies": [
    { "title": "short anomaly name", "description": "one sentence explaining exactly what's wrong and why", "severity": "high" | "medium" | "low" }
  ],
  "summary": "3-4 plain-English sentences: what the document is, the key problems found and why they matter, and your recommendation (genuine / suspicious / likely fraudulent)."
}

If no anomalies are found, return an empty array for "anomalies" and a low risk score. Do not invent anomalies that aren't supported by the extracted text.`;
}

function safeParseJSON(text) {
  // Gemini sometimes wraps JSON in ```json fences even when told not to — strip defensively.
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
  return JSON.parse(cleaned);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  try {
    const { image, mediaType, documentType, fileName, blurPct } = req.body || {};

    if (!image || !mediaType) {
      res.status(400).json({ error: 'Missing required fields: image, mediaType' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt({ documentType, fileName, blurPct });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mediaType, data: image } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const rawText = response.text || '';
    if (!rawText) {
      throw new Error('Empty response from Gemini');
    }

    let data;
    try {
      data = safeParseJSON(rawText);
    } catch (parseErr) {
      console.error('[ScanSentinel] Failed to parse Gemini response:', rawText.slice(0, 500));
      throw new Error('Model returned non-JSON output');
    }

    res.status(200).json({
      ocrText: data.ocrText || '',
      documentType: data.documentType || documentType || 'general',
      confidence: Number(data.confidence) || 0,
      risk: Math.max(0, Math.min(100, Number(data.risk) || 0)),
      anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
      summary: data.summary || '',
    });
  } catch (err) {
    console.error('[ScanSentinel] /api/scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};