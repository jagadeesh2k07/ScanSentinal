require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

module.exports = async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {

    const {
      image,
      mediaType,
      documentType,
      fileName,
      blurPct
    } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Image missing."
      });
    }

    const cleanBase64 =
      image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
You are ScanSentinel AI, an expert forensic document analyst.

Analyze the uploaded document carefully.

Return ONLY valid JSON.

{
  "documentType": "",
  "confidence": 95,
  "risk": 25,
  "ocrText": "",
  "anomalies": [
    {
      "severity": "high | medium | low",
      "title": "",
      "description": ""
    }
  ],
  "summary": ""
}

Instructions:

- Extract ALL readable text.
- Preserve line breaks.
- Identify document type.
- Detect invalid dates.
- Detect invalid phone numbers.
- Detect invalid email addresses.
- Detect duplicate IDs.
- Detect impossible values.
- Detect missing mandatory fields.
- Detect suspicious edits if visible.
- If text is blurred, infer only when highly confident.
- Confidence is from 0 to 100.
- Risk is from 0 to 100.
- Return ONLY JSON.
`;

    const result = await ai.models.generateContent({

      model: "gemini-2.5-flash",

      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mediaType || "image/jpeg",
                data: cleanBase64
              }
            },
            {
              text: prompt
            }
          ]
        }
      ]

    });

    let text = (result.text || "").trim();

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let output;

    try {

      output = JSON.parse(text);

    } catch {

      output = {

        documentType: documentType || "Unknown",

        confidence: 70,

        risk: 40,

        ocrText: text,

        anomalies: [],

        summary: "Gemini returned a non JSON response."

      };

    }

    return res.status(200).json(output);

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      error: err.message

    });

  }

}