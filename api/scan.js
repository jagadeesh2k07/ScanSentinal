const { OpenAI } = require('openai');

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

module.exports = async function handler(req, res) {
  // 1. Handle CORS Preflight Requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, documentType, fileName } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image string parameter." });
    }

    // CLEANUP STEP: Strip out any duplicate prefix header if the frontend already included it
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

    const promptInstructions = `
      You are the ScanSentinel Vision Core Engine. Analyze images containing text that may be semi-blurred, unfocused, or dimly lit.
      Reconstruct obscured strings by examining layout structures and context.
      Run verification scans matching the target classification pattern: "${documentType || 'Standard Doc'}".
      
      Return ONLY a JSON payload matching this precise schema. Do not include markdown formatting:
      {
        "text": "Provide the full clean text recovered from the document layout...",
        "risk": 45,
        "anomalies": [
          {
            "type": "Name of Anomaly Identified",
            "detail": "Detailed explanation outlining why this was flagged.",
            "severity": "high" 
          }
        ]
      }
    `;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: promptInstructions },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze the file named ${fileName || 'Uploaded image'}.` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
          ]
        }
      ]
    });

    const rawContent = aiResponse.choices[0].message.content;
    
    // Safely parse the response with a structural fallback to catch any formatting hiccups
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(rawContent);
    } catch (parseErr) {
      console.warn("AI didn't provide standard JSON string, formatting manually:", rawContent);
      parsedOutput = {
        text: rawContent,
        risk: 50,
        anomalies: [{ type: "Parsing Warning", detail: "Data extraction completed with layout structure modifications.", severity: "low" }]
      };
    }
    
    return res.status(200).json(parsedOutput);

  } catch (error) {
    console.error("Vercel Function Error Details:", error);
    return res.status(500).json({ 
      error: "Internal processing sequence faulted.", 
      details: error.message 
    });
  }
};
