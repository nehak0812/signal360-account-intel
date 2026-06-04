import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("Warning: GEMINI_API_KEY is not set in environment variables.");
}

export const ai = new GoogleGenAI({
  apiKey: apiKey || "dummy-key",
});

// Default recommended model for classification and fast reasoning
export const DEFAULT_MODEL = "gemini-2.5-flash";
