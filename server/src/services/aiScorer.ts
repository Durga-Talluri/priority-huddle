// server/src/services/aiScorer.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { INote } from "../models/Note";

interface ScoringResult {
  ai_content_score: number;
  ai_rationale: string;
}

// Hardcoded board context for demo reproducibility
const BOARD_CONTEXT = {
  title: "Priority Huddle Board",
  objective: "Reduce customer churn by improving onboarding conversion and decreasing time-to-value for new customers.",
};

/**
 * Fallback rule-based scorer (deterministic)
 * Used when LLM call fails or returns invalid JSON
 */
function fallbackRuleBasedScorer(note: INote): ScoringResult {
  let base = 0.4;
  const content = note.content.toLowerCase();
  const rationaleParts: string[] = [];

  // Check for high-impact keywords
  const highImpactKeywords = ["payment", "checkout", "outage", "error", "fail", "crash"];
  const hasHighImpactKeywords = highImpactKeywords.some((keyword) =>
    content.includes(keyword)
  );
  if (hasHighImpactKeywords) {
    base += 0.3;
    rationaleParts.push("contains high-impact keywords");
  }

  // Check content length
  if (content.length > 180) {
    base += 0.2;
    rationaleParts.push("long content");
  }

  // Note: Tags are not in the current Note model, so we skip tag-based scoring
  // In a real implementation, you'd check note.tags if available

  // Clamp to [0, 1]
  const score = Math.max(0.0, Math.min(1.0, base));

  const rationale =
    rationaleParts.length > 0
      ? `fallback: ${rationaleParts.join(", ")}`
      : "fallback: base score";

  return {
    ai_content_score: score,
    ai_rationale: rationale,
  };
}

/**
 * Builds the deterministic prompt for LLM scoring
 */
function buildPrompt(note: INote): string {
  const title = note.content.split("\n")[0].substring(0, 100) || "Untitled";
  const content = note.content;
  const upvotes = note.upvotes || 0;
  const tags = "[]"; // Placeholder - tags not in current model
  const role = "user"; // Placeholder - role not in current model
  const date = new Date().toISOString().split("T")[0];

  return `SYSTEM:

You are a product-prioritization assistant. Rate a single idea/note on a scale from 0.00 (lowest) to 1.00 (highest). Use the following rubric with weights: Business impact 40%, User urgency 25%, Feasibility 20%, Strategic alignment 15%. The board objective is: "${BOARD_CONTEXT.objective}"

HUMAN EXAMPLES (few-shot):

Example HIGH:

Title: "Checkout failing for many users"

Content: "Payment API returns 502 on checkout for many customers. Revenue-impacting."

Meta: upvotes=32, tags=[bug]

Label: 0.98

Example LOW:

Title: "Change footer color"

Content: "Footer color appears slightly light; change to a darker shade."

Meta: upvotes=0, tags=[ui]

Label: 0.12

NEW_NOTE:

Title: "${title}"

Content: "${content}"

Meta: upvotes=${upvotes}, tags=${tags}, creatorRole=${role}, createdAt=${date}

INSTRUCTIONS:

Return EXACTLY a JSON object and nothing else with fields:

{
"score": 0.00,        // float between 0.00 and 1.00
"rationale": "..."    // 1-2 sentence explanation referencing signals used
}`;
}

/**
 * Calls Gemini LLM with deterministic settings
 */
async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0, // Deterministic
        maxOutputTokens: 200,
        responseMimeType: "application/json", // Request JSON response
      },
    });

    const response = result.response;
    const text = response.text();
    return text.trim();
  } catch (error) {
    console.error("LLM call failed:", error);
    throw error;
  }
}

/**
 * Parses and validates LLM JSON response
 */
function parseLLMResponse(response: string): ScoringResult | null {
  try {
    // Try to extract JSON from response (in case LLM adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (
      typeof parsed.score !== "number" ||
      typeof parsed.rationale !== "string" ||
      parsed.rationale.trim().length === 0
    ) {
      return null;
    }

    // Validate score range
    const score = Math.max(0.0, Math.min(1.0, parsed.score));
    
    return {
      ai_content_score: score,
      ai_rationale: parsed.rationale.trim(),
    };
  } catch (error) {
    console.error("Failed to parse LLM response:", error);
    return null;
  }
}

/**
 * Main function to score note content using LLM with fallback
 */
export async function scoreNoteContent(
  note: INote
): Promise<ScoringResult> {
  try {
    const prompt = buildPrompt(note);
    
    // Try LLM call with one retry
    let response: string;
    try {
      response = await callLLM(prompt);
    } catch (error) {
      console.warn("LLM call failed, retrying once...", error);
      try {
        response = await callLLM(prompt);
      } catch (retryError) {
        console.warn("LLM retry failed, using fallback", retryError);
        return fallbackRuleBasedScorer(note);
      }
    }

    // Parse and validate response
    const result = parseLLMResponse(response);
    if (result) {
      return result;
    }

    // If parsing failed, use fallback
    console.warn("Invalid LLM response format, using fallback");
    return fallbackRuleBasedScorer(note);
  } catch (error) {
    console.error("Unexpected error in scoreNoteContent:", error);
    return fallbackRuleBasedScorer(note);
  }
}

/**
 * Calculates vote score normalized across board
 * For demo: vote_score = note.upvotes / maxBoardUpvotes (if max==0, vote_score=0)
 */
export function calculateVoteScore(
  noteUpvotes: number,
  maxBoardUpvotes: number
): number {
  if (maxBoardUpvotes === 0) {
    return 0;
  }
  return Math.min(1.0, noteUpvotes / maxBoardUpvotes);
}

/**
 * Calculates combined priority score
 * combined_score = 0.7 * ai_content_score + 0.3 * vote_score
 */
export function calculateCombinedScore(
  aiContentScore: number,
  voteScore: number
): number {
  return 0.7 * aiContentScore + 0.3 * voteScore;
}

