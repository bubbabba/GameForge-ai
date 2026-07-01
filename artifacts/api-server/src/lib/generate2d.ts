/**
 * Phaser.js 2D game generation via Claude.
 *
 * Claude outputs ONLY JavaScript game logic that defines two global functions:
 *   function buildLevel(scene) { ... }    — called once in create()
 *   function gameUpdate(scene, time, delta) { ... }  — called every frame
 *
 * This logic is injected into a pre-built Phaser shell that already has:
 *   - Working game loop, physics, player movement, HUD, game-over/win screens
 *   - Helper methods: addPlatform, addCoin, addEnemy, triggerWin, etc.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PHASER_SHELLS, DEFAULT_PHASER_SHELL } from "./phaserTemplates";
import { getValidationFailure } from "./validateGameCode";

// ─── Per-genre Claude system prompts ─────────────────────────────────────────

const GENRE_SYSTEM_PROMPTS: Record<string, string> = {
  Platformer: `You are generating JavaScript game logic for a 2D PLATFORMER in Phaser.js.

The Phaser template shell already provides a fully working game with:
- scene.player — physics sprite with gravity, WASD+arrows = move, Space/W/↑ = jump
- scene.platforms (StaticGroup), scene.coins (Group), scene.enemies (Group), scene.projectiles (Group)
- scene.addPlatform(x, y, width, height, color) — creates a static platform
- scene.addCoin(x, y) — adds a collectible (+10 score, auto win when all collected)
- scene.addEnemy(x, y, texture, {patrol:200, speed:80}) — adds a patrolling enemy
- scene.patrolEnemies() — call in gameUpdate to auto-patrol all enemies
- scene.addScore(pts), scene.loseLife(), scene.triggerGameOver(), scene.triggerWin()
- World is 2400×500px. Camera follows player.
- Callbacks: onEnemyHit(scene, enemy), onCoinCollect(scene, coin), gameRestart()

YOUR JOB — output ONLY JavaScript (no HTML, no <script> tags, no markdown fences):

1. Define: function buildLevel(scene) {
   - Ground: scene.addPlatform(1200, 490, 2400, 20, 0x228B22)
   - 10-15 platforms at various heights (mix of sizes, some moving)
   - 15-25 coins scattered across the level
   - 4-8 enemies with patrol ranges
   - Optional: goal flag/exit area that triggers scene.triggerWin()
   - Style (colors, theme) matching the user's description
}

2. Define: function gameUpdate(scene, time, delta) {
   - Call scene.patrolEnemies() to move enemies
   - Handle moving platforms (use Math.sin for oscillation)
   - Increase difficulty over time
   - Check any custom win conditions
}

3. Optionally define: function onEnemyHit(scene, enemy) — custom enemy collision response

IMPORTANT: Every platform, coin, and enemy must be fully placed. No placeholders. Output raw JS immediately:`,

  Adventure: `You are generating JavaScript game logic for a 2D ADVENTURE PLATFORMER in Phaser.js.

Same shell as Platformer. Create an adventure-themed side-scroller with:
- scene.addPlatform(x, y, w, h, color), scene.addCoin(x, y), scene.addEnemy(x, y, tex, cfg)
- scene.patrolEnemies(), scene.addScore(pts), scene.loseLife(), scene.triggerWin()

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — adventure world (ancient ruins, forest, dungeon theme):
   - Extended ground with gaps and pits
   - Tall vertical sections requiring precise jumping
   - Moving platforms over lava/water (use tween or Math.sin)
   - 20+ collectibles, 6+ enemies, boss area at the end
   - Exit door/portal that triggers triggerWin when player reaches it

2. function gameUpdate(scene, time, delta) — animate moving platforms, check exit

Output raw JavaScript immediately:`,

  Fantasy: `You are generating JavaScript game logic for a 2D FANTASY PLATFORMER in Phaser.js.

Same shell as Platformer. Create a fantasy-themed world with magic and creatures.
- scene.addPlatform(x, y, w, h, color), scene.addCoin(x, y), scene.addEnemy(x, y, tex, cfg)
- scene.patrolEnemies(), scene.addScore(pts), scene.loseLife(), scene.triggerWin()

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — fantasy world (floating islands, magic crystals, dragons):
   - Floating platforms at varied heights (0x9966cc, 0x6644aa colors)
   - Magic gem collectibles (use scene.addCoin for gems)
   - Fantasy creatures as enemies
   - Castle/tower at the end as goal
   - Dramatic layout with height variation

2. function gameUpdate(scene, time, delta) — animate platforms, check win

Output raw JavaScript immediately:`,

  Shooter: `You are generating JavaScript game logic for a 2D TOP-DOWN SHOOTER in Phaser.js.

The Phaser template shell already provides:
- scene.player — ship sprite, WASD+arrows = move (all directions), Space = auto-fire bullets
- scene.enemies (Group), scene.bullets (Group), scene.powerups (Group)
- scene.spawnEnemy(x, y, speedY, {speedX, hp}) — spawns an enemy
- scene.fireBullet() — fires a bullet from player position
- scene.addScore(pts), scene.loseLife(), scene.triggerGameOver(), scene.triggerWin()
- scene._wave, scene._kills — wave counter and kill counter
- Callbacks: onEnemyHit(scene, enemy), onPowerup(scene), gameRestart()

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — configure the shooter:
   - Set up enemy wave timer: scene.time.addEvent({delay:1500, loop:true, callback:()=>spawnWave(scene)})
   - Define spawnWave(scene) — spawn 1-3 enemies per wave with increasing speed
   - Define enemy formation patterns (line, V-shape, zigzag)
   - Spawn powerups occasionally
   - Win condition: reach score X or survive Y waves → scene.triggerWin()

2. function gameUpdate(scene, time, delta) — difficulty scaling, special boss behavior

3. function onEnemyHit(scene, enemy) — handle HP, explosion effect, score

IMPORTANT: Enemies must actually spawn and move. Output raw JavaScript immediately:`,

  Racing: `You are generating JavaScript game logic for a TOP-DOWN RACING GAME in Phaser.js.

The Phaser template shell already provides:
- scene.player — car sprite with steering physics (W/↑=accel, S/↓=brake, A/D=steer)
- scene.walls (StaticGroup), scene.boosts (Group), scene.aiCars (Group)
- scene.addWall(x, y, w, h) — adds a track boundary wall
- scene.addBoost(x, y) — adds a speed boost pad
- scene.addCheckpoint(x, y, radius) — adds a checkpoint for lap tracking
- scene.addAiCar(x, y, pathFn) — adds AI car with path function t→{x,y}
- scene.completeLap() — called automatically when all checkpoints passed
- scene._targetLaps = 3 (change if needed), scene.triggerWin(), scene.triggerGameOver()

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — build the race track:
   - Create an oval or figure-8 track using scene.addWall() for inner and outer boundaries
   - The track should fit within 800×500px (or use camera pan)
   - Add 4-6 checkpoints in order around the track
   - Add 3-5 AI cars with path functions that follow the track oval
   - Add boost pads on straight sections
   - Road surface: add colored rectangles for visual track surface

2. function gameUpdate(scene, time, delta) — custom race logic

IMPORTANT: The track must be a complete closed loop. Checkpoints must be in order.
Output raw JavaScript immediately:`,

  Puzzle: `You are generating JavaScript game logic for a SOKOBAN-STYLE PUZZLE GAME in Phaser.js.

The Phaser template shell already provides a complete grid-based puzzle system:
- scene.loadLevel(layout, offsetX, offsetY) — loads a level from string array
  Layout chars: '#'=wall, '.'=floor, '@'=player, '$'=box, 'X'=target, '*'=box-on-target, ' '=empty
- scene.tryMove(dr, dc) — moves player/pushes boxes (auto-called from keys)
- scene.undo() — undoes last move (Z key, auto-wired)
- scene._moves — move counter (auto-tracked)
- Win: auto-detected when all '$' boxes are on 'X' targets (no '$' left in grid)

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — define and load the puzzle:
   - Call scene.loadLevel(layout, offsetX, offsetY) with a solvable layout
   - Create 1-3 levels of increasing difficulty
   - Level 1: 3-4 boxes, simple layout (beginners)
   - Level 2: 5-6 boxes, more walls, requires planning
   - Level 3 (optional): complex, satisfying solution
   - Store extra levels for when first is solved

2. function gameUpdate(scene, time, delta) — advance to next level when current solved

CRITICAL: Every level MUST be solvable. Test mentally: can every box reach a target?
Grid size: aim for 10-14 columns × 8-12 rows. Keep it centered on 800×500.
Output raw JavaScript immediately:`,

  Horror: `You are generating JavaScript game logic for a TOP-DOWN HORROR GAME in Phaser.js.

The Phaser template shell already provides:
- scene.player — hero sprite, WASD+arrows = move, camera follows
- scene.walls (StaticGroup), scene.enemies (Group), scene.items (Group)
- scene.addWall(x, y, w, h) — creates a wall/obstacle
- scene.addEnemy(x, y, {speed, sight, patrol}) — adds a chasing/patrolling enemy
- scene.addItem(x, y, type) — adds a collectible (key, note, flashlight battery)
- scene.addExit(x, y) — adds the exit that triggers scene.triggerWin()
- scene.addFear(amount) — increases fear meter (0-100); death at 100
- scene.showMessage(text, duration) — shows message on HUD
- Darkness/flashlight already rendered each frame
- Callbacks: onEnemyTouch(scene, enemy), onItemCollect(scene, item), gameRestart()

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — build the horror maze:
   - Create a maze using scene.addWall() (40px grid recommended)
   - Place the player start far from the exit
   - Add 2-4 enemies with chase behavior
   - Add collectible items (keys to unlock exit, notes with lore)
   - Place the exit (scene.addExit) in a hard-to-reach area
   - Use scene.cameras.main.setBounds(0,0,W,H) for the world size

2. function gameUpdate(scene, time, delta) — enemy AI: chase player when near, patrol when far:
   scene.enemies.getChildren().forEach(e => {
     const dx = scene.player.x - e.x, dy = scene.player.y - e.y;
     const dist = Math.sqrt(dx*dx+dy*dy);
     if (dist < e._sight) {
       e.setVelocity(dx/dist*e._speed, dy/dist*e._speed);
       scene.addFear(0.05); // passive fear near enemy
     } else {
       // patrol logic
       e.setVelocity(e._dir.x*e._speed, e._dir.y*e._speed);
     }
   });

3. function onEnemyTouch(scene, enemy) — jumpscare effect then game over:
   scene.cameras.main.flash(500, 255, 0, 0);
   scene.cameras.main.shake(400, 0.03);
   scene.time.delayedCall(600, () => scene.triggerGameOver());

Output raw JavaScript immediately:`,

  RPG: `You are generating JavaScript game logic for a TOP-DOWN RPG in Phaser.js.

The Phaser template shell already provides:
- scene.player — hero sprite, WASD+arrows = move, Space = attack, E = interact
- scene.walls (StaticGroup), scene.enemies (Group), scene.npcs (Group), scene.items (Group)
- scene.addWall(x, y, w, h) — creates a wall/obstacle
- scene.addEnemy(x, y, {hp, speed, dmg, xp, gold}) — enemy with HP, auto-chases player
- scene.addNpc(x, y, dialog) — NPC with dialog shown on E press
- scene.addItem(x, y, type) — collectible item
- scene._hp, scene._maxHp, scene._xp, scene._level, scene._gold — player stats
- scene.takeDamage(amount), scene.heal(amount), scene.showMessage(text)
- scene.triggerWin(), scene.triggerGameOver()
- Enemy auto-chase + HP bar built into template
- Callbacks: onItemPickup(scene, item), onEnemyKill(scene, enemy), onNpcTalk(scene, npc)

YOUR JOB — output ONLY JavaScript:

1. function buildLevel(scene) — build the RPG world:
   - Create a village/dungeon layout with rooms and corridors using scene.addWall()
   - Place 3-5 NPCs with meaningful dialog (quest, lore, hints)
   - Distribute 6-12 enemies across the map (increasing difficulty by area)
   - Place items: potions (heal 3 HP), treasure chests (gold)
   - A boss enemy at the end (high HP, triggers triggerWin when killed)
   - scene.cameras.main.setBounds(0, 0, 1200, 900) for larger world

2. function gameUpdate(scene, time, delta) — custom game logic (event triggers, boss behavior)

3. function onItemPickup(scene, item) — potion heals, chest gives gold

4. function onEnemyKill(scene, enemy) — check if boss killed → triggerWin

Output raw JavaScript immediately:`,
};

const DEFAULT_SYSTEM_PROMPT = GENRE_SYSTEM_PROMPTS["Platformer"];

// ─── Build user message ───────────────────────────────────────────────────────

function buildUserMessage(prompt: string, genre: string, simplified = false): string {
  const desc = simplified
    ? `Simple ${genre} game: ${prompt.slice(0, 300)}`
    : `Game description: "${prompt}"`;

  return `${desc}

Apply the user's description to theme, color palette, difficulty, and specific mechanics.
Output ONLY JavaScript code starting immediately — no preamble, no fences, no HTML:`;
}

// ─── Strip markdown fences ────────────────────────────────────────────────────

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:javascript|js|typescript|ts)?\r?\n/, "")
      .replace(/\r?\n```\s*$/, "")
      .trim();
  }
  return s;
}

// ─── Compute quality score ────────────────────────────────────────────────────

function computeQualityScore(
  logic: string,
  validationFailure: string | null,
  usedSimplified: boolean,
): number {
  let score = 100;

  // Validation failure: major deduction
  if (validationFailure) score -= 35;

  // Simplified prompt (had to retry): moderate deduction
  if (usedSimplified) score -= 15;

  // Code length: reward rich output
  const nonEmpty = logic.split("\n").filter((l) => l.trim().length > 0).length;
  if (nonEmpty < 30) score -= 25;
  else if (nonEmpty < 60) score -= 10;
  else if (nonEmpty >= 120) score += 5; // bonus for rich content

  // Presence of required functions
  if (!logic.includes("buildLevel")) score -= 15;
  if (!logic.includes("gameUpdate")) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface Generate2DResult {
  gameCode: string;
  title: string;
  qualityScore: number;
}

export async function generate2DGame(
  apiKey: string,
  prompt: string,
  genre: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any,
): Promise<Generate2DResult> {
  const shell = PHASER_SHELLS[genre] ?? DEFAULT_PHASER_SHELL;
  const systemPrompt = GENRE_SYSTEM_PROMPTS[genre] ?? DEFAULT_SYSTEM_PROMPT;
  const anthropic = new Anthropic({ apiKey });

  async function callClaude(simplified: boolean): Promise<string> {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: buildUserMessage(prompt, genre, simplified) }],
    });
    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected response format from Claude");
    }
    return stripFences(content.text);
  }

  let logic: string;
  let usedSimplified = false;

  // Attempt 1: full prompt
  try {
    logic = await callClaude(false);
    logger?.info({ chars: logic.length }, "2D game generated (attempt 1)");
  } catch (firstErr) {
    logger?.warn({ err: firstErr }, "First 2D attempt failed — retrying simplified");
    logic = await callClaude(true);
    usedSimplified = true;
    logger?.info({ chars: logic.length }, "2D game generated (attempt 2 — simplified)");
  }

  // Validate; retry with simplified prompt if seriously broken
  const firstFailure = getValidationFailure(logic, 20);
  if (firstFailure && !usedSimplified) {
    logger?.warn({ reason: firstFailure }, "Validation failed — retrying with simplified prompt");
    try {
      const retry = await callClaude(true);
      const retryFailure = getValidationFailure(retry, 20);
      if (!retryFailure) {
        logic = retry;
        usedSimplified = true;
        logger?.info({ chars: logic.length }, "2D game regenerated after validation failure");
      }
      // If retry also fails, keep the first attempt (it may be good enough)
    } catch {
      // Keep first attempt
    }
  }

  // Safety: escape any </script> in the logic that would break the shell
  logic = logic.replace(/<\/script>/gi, "<\\/script>");

  // Inject into template shell
  const gameCode = shell.replace("${GAME_LOGIC}", logic);

  // Title
  const words = prompt.trim().split(/\s+/).slice(0, 5);
  const titleCase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const title = `${titleCase} (${genre})`;

  const qualityScore = computeQualityScore(logic, getValidationFailure(logic, 20), usedSimplified);
  logger?.info({ title, qualityScore }, "2D game generated successfully");

  return { gameCode, title, qualityScore };
}
