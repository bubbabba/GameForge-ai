import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GenerateGameBody } from "@workspace/api-zod";

const router: IRouter = Router();

const GENRE_HINTS: Record<string, string> = {
  Platformer:
    "side-scrolling platform game with jumping mechanics, platforms, and gravity physics",
  Horror:
    "dark atmospheric horror game with tension, scares, and eerie visuals",
  Shooter: "shooting game where the player can fire projectiles at enemies",
  Puzzle: "puzzle game that requires logic and thinking to solve challenges",
  Racing: "top-down or side-view racing game with speed and obstacles",
  RPG: "role-playing game with character stats, exploration, and combat",
};

const MAX_PROMPT_LENGTH = 1000;

router.post("/games/generate", async (req, res): Promise<void> => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    req.log.error("CLAUDE_API_KEY is not set");
    res.status(500).json({
      error:
        "CLAUDE_API_KEY is not configured. Please add it in the Secrets tab.",
    });
    return;
  }

  const parsed = GenerateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prompt, genre } = parsed.data;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({
      error: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
    });
    return;
  }

  const genreHint = GENRE_HINTS[genre] ?? genre;

  const claudePrompt = `You are an expert Phaser.js game developer. Generate a complete, self-contained, playable browser game using Phaser 3.

User's game description: "${prompt}"
Genre: ${genre} (${genreHint})

REQUIREMENTS:
1. Output ONLY a complete HTML document — no explanations, no markdown, no code blocks, just raw HTML starting with <!DOCTYPE html>
2. Use Phaser 3 from CDN: https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js
3. The game must be fully self-contained in the HTML — all JavaScript inline in a <script> tag
4. Game canvas must be exactly 800x500 pixels
5. Include proper game mechanics matching the genre
6. Add keyboard controls (arrow keys, WASD, or spacebar as appropriate)
7. Include a score or lives system where applicable
8. Add game over / win conditions
9. Use colorful, visually appealing graphics drawn with Phaser's built-in graphics API (no external image assets needed)
10. Make the game actually fun and playable — not just a demo
11. Add on-screen instructions (small text showing controls)
12. Set document body background to #0a0a0f (dark) and center the canvas

Genre-specific guidance for ${genre}:
${genre === "Platformer" ? "- Moving platforms or static platforms, player jumps and moves left/right, collect items or reach a goal, gravity physics" : ""}
${genre === "Horror" ? "- Dark atmosphere, avoid enemies, flashlight mechanic or limited visibility, tension-building, eerie color palette" : ""}
${genre === "Shooter" ? "- Player fires bullets, enemies spawn and move, waves of enemies, power-ups, health system" : ""}
${genre === "Puzzle" ? "- Clear win condition through logical steps, visual feedback on progress, hint system, satisfying solution animations" : ""}
${genre === "Racing" ? "- Speed-based gameplay, avoid obstacles, lap system or finish line, acceleration and deceleration" : ""}
${genre === "RPG" ? "- Player movement, enemies to fight, health and damage system, stats display, exploration" : ""}

Generate the complete HTML game now. Start immediately with <!DOCTYPE html>`;

  req.log.info({ genre, promptLength: prompt.length }, "Generating game");

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: claudePrompt,
        },
      ],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      res.status(500).json({ error: "Unexpected response format from Claude" });
      return;
    }

    let gameCode = content.text.trim();

    // Strip markdown code fences if Claude wrapped the response
    if (gameCode.startsWith("```")) {
      gameCode = gameCode
        .replace(/^```(?:html)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    // Generate a title from the prompt
    const titleWords = prompt
      .split(" ")
      .slice(0, 5)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const title = `${titleWords} (${genre})`;

    req.log.info({ title }, "Game generated successfully");
    res.json({ gameCode, title });
  } catch (err) {
    const error = err as Error & { status?: number; message?: string };
    req.log.error({ err }, "Claude API call failed");

    if (error.status === 401) {
      res.status(500).json({ error: "Invalid Claude API key. Check your CLAUDE_API_KEY secret." });
      return;
    }
    if (error.status === 429) {
      res.status(500).json({ error: "Claude API rate limit reached. Please wait a moment and try again." });
      return;
    }

    res.status(500).json({
      error: error.message ?? "Game generation failed. Please try again.",
    });
  }
});

export default router;
