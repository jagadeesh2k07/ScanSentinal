import { OpenAI } from 'openai';

// Your API Key remains hidden in cloud configuration environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req, res) {
  try {
    const { image, documentType, fileName } = await req.json();

    // System prompt giving the model strict instructions on handling blur and layout checks
    const promptInstructions = `
      You are the ScanSentinel Vision Core Engine. You will analyze images containing text that may be semi-blurred, unfocused, compressed, or dimly lit.
      
      CRITICAL INSTRUCTIONS:
      1. Reconstruct obscured and blurred strings by examining layout structures, surrounding tokens, and context.
      2. Run verification scans matching the target classification pattern: "${documentType}".
      3. Document-specific audits to conduct:
         - INVOICES: Check for empty signature lines, missing computational balance tallies, or impossible due dates.
         - CERTIFICATES/ANSWER SHEETS: Flag academic or percentage scores exceeding absolute boundaries (e.g., >100%).
         - PRESCRIPTIONS: Identify omissions of absolute units (such as 'mg', 'ml', or 'capsules') from drug names.
      
      Return ONLY a JSON payload following this precise schema. Do not output markdown text or wrapped code formatting blocks:
      {
        "text": "Provide the full clean text recovered from the document layout...",
        "risk": 65,
        "docType": "${documentType}",
        "fileName": "${fileName}",
        "scannedAt": "${new Date().toLocaleString()}",
        "anomalies": [
          {
            "type": "Name of Anomaly Identified",
            "detail": "Detailed explanation outlining why this was flagged and how the blurred context was deciphered.",
            "severity": "high" 
          }
        ]
      }
      
      Note: severity keys must evaluate exactly to 'high', 'medium', or 'low'. If the layout is completely clean, supply an empty array.
    `;

    // Process using a multimodal vision model
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Blazing fast processing speed with advanced layout vision
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: promptInstructions },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze the following file for potential processing anomalies: ${fileName}` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
          ]
        }
      ]
    });

    const parsedOutput = JSON.parse(aiResponse.choices[0].message.content);
    return res.status(200).json(parsedOutput);

  } catch (serverError) {
    console.error("Worker Execution Error:", serverError);
    return res.status(500).json({ error: "Internal processing sequence faulted." });
  }
}