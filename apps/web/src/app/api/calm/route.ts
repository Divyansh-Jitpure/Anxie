import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { GROUNDING_STEPS } from '@anxie/shared';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { logs, userDistressBefore, userDistressAfter } = body;

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Returning comforting mock response.");
      return Response.json({
        message: "You did an amazing job grounding yourself. You identified your surroundings, showing real strength. Let's rest and focus on your breathing now. (Note: Configure GEMINI_API_KEY to activate full AI feedback)",
        suggestedAction: "do breathing"
      });
    }

    // Format logs into a readable summary for the AI
    const formattedLogs = logs.map((log: any) => {
      const step = GROUNDING_STEPS.find(s => s.stepNumber === log.stepNumber);
      const label = step ? step.sensoryLabel : `Step ${log.stepNumber}`;
      return `${label}: ${log.items.join(', ')}`;
    }).join('\n');

    const prompt = `
      You are Anxie AI, an empathetic and supportive assistant specialized in calming people down during panic or anxiety attacks.
      
      The user has just completed a 5-4-3-2-1 grounding exercise.
      
      User's initial distress level: ${userDistressBefore}/10
      ${userDistressAfter !== undefined ? `User's distress level after the exercise: ${userDistressAfter}/10` : ''}
      
      Here is what they noticed during their grounding exercise:
      ${formattedLogs}
      
      Analyze their inputs and provide a comforting, highly validating response.
      Guidelines:
      1. Be extremely gentle, warm, and grounding. Speak in short, digestible sentences.
      2. Affirm their effort and validate the specific sensory items they observed (e.g., if they saw a "soft blue sky" or felt a "cold wooden table", reference the soothing aspects gently).
      3. Recommend a next step action. The action MUST be one of: "do breathing" (suggest box breathing), "journal" (suggest checking in on how they feel), or "rest" (suggest resting and closing eyes).
    `;

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        message: z.string().describe("A soothing, warm, and validating message to calm the user down. Mention some of the items they noticed to prove you are listening."),
        suggestedAction: z.enum(['do breathing', 'journal', 'rest']).describe("The recommended next coping action for the user.")
      }),
      prompt,
    });

    return Response.json(result.object);
  } catch (error: any) {
    console.error("Error in AI grounding endpoint:", error);
    return Response.json(
      { error: "Failed to process grounding feedback. We are still here for you. Please focus on your breathing." },
      { status: 500 }
    );
  }
}
export const runtime = 'nodejs';
