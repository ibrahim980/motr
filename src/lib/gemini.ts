import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface OdometerScanResult {
  mileage: number;
  make?: string;
  model?: string;
  confidence: number;
}

export async function scanOdometer(base64Image: string): Promise<OdometerScanResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: "Extract the odometer reading (mileage) from this dashboard image. Also try to identify the car make and model if possible. Return the data in JSON format.",
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mileage: { type: Type.NUMBER, description: "The number shown on the odometer" },
          make: { type: Type.STRING, description: "Detected car brand" },
          model: { type: Type.STRING, description: "Detected car model" },
          confidence: { type: Type.NUMBER, description: "Confidence score between 0 and 1" },
        },
        required: ["mileage", "confidence"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
}
