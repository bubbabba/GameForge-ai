/**
 * Three.js 3D game generation via Claude.
 *
 * Claude outputs ONLY JavaScript game logic.
 * We inject it into a hardcoded HTML shell that guarantees:
 *  - Three.js CDN is loaded before any game code runs
 *  - scene / camera / renderer / lighting / clock / keys are pre-defined
 *  - The animation loop calls gameUpdate(delta) every frame
 */

import Anthropic from "@anthropic-ai/sdk";
import { THREE_JS_SHELLS, DEFAULT_3D_SHELL } from "./threejsTemplates";

// ─── Per-genre Claude prompts ─────────────────────────────────────────────

const GENRE_SYSTEM_PROMPTS: Record<string, string> = {
  "FP Horror": `You are generating JavaScript game logic for a FIRST-PERSON HORROR game in Three.js.

The environment is pre-configured with:
- scene, camera (PerspectiveCamera at eye height 1.7, inside the scene), renderer
- flashlight (SpotLight) already attached to camera — it illuminates what the player faces
- Fog: heavy black exponential fog (radius ~8 units of visibility)
- clock, keys{}, W=800, H=500, hud (div), showOverlay(text, color), hideOverlay()

YOUR JOB — output ONLY JavaScript (no HTML, no <script> tags, no markdown):
1. Build a maze using BoxGeometry walls (dark gray/brown MeshLambertMaterial)
   - Maze should be at least 10x10 units. Walls height ~3 units.
2. Add a floor (PlaneGeometry, dark MeshLambertMaterial, rotated -Math.PI/2)
3. Place an EXIT marker (glowing green BoxGeometry or Text sprite at maze end)
4. Add 1-2 simple enemy cubes that patrol/chase the player
5. Implement first-person mouselook via pointer lock OR keyboard turning (A/D turn, W/S move)
   - If using keyboard: A/D rotate camera Y, W/S move camera forward/back
6. Detect collision with walls (simple AABB — don't let player walk through walls)
7. Detect collision with enemies → game over
8. Detect reaching exit → show win overlay
9. Show controls in controlsEl.textContent
10. Define function gameUpdate(delta) { ... } — this is called every frame
11. Optionally define function gameRestart() { ... }
12. Add a heartbeat/footstep sound effect using Web Audio API for atmosphere (optional)`,

  "Platformer": `You are generating JavaScript game logic for a THIRD-PERSON PLATFORMER in Three.js.

The environment is pre-configured with:
- scene (sky blue background), camera (PerspectiveCamera), renderer
- updateChaseCamera(playerMesh, lerpSpeed) helper — call each frame in gameUpdate
- Directional sunlight + ambient light, shadow maps enabled
- clock, keys{}, W=800, H=500, hud (div), showOverlay(text, color), hideOverlay()

YOUR JOB — output ONLY JavaScript:
1. Create a player: small box or capsule (bright color), add to scene, enable castShadow
2. Build platforms: 8-12 platforms at varying heights using BoxGeometry + MeshLambertMaterial
   - Start platform at y=0, at least 3 platforms reachable by jumping
   - Make at least one platform move horizontally (oscillate with Math.sin)
3. Add collectible coins (small yellow spheres) that disappear when touched
4. Implement platformer physics manually (no physics library):
   - velocity = {x:0, y:0, z:0}; gravity pulls y down each frame
   - WASD/Arrow keys move player horizontally; Space = jump (only when grounded)
   - Landing on a platform sets grounded=true and stops vertical velocity
5. Chase camera: call updateChaseCamera(playerMesh, 0.08) in gameUpdate
6. Show score (coins collected) and lives in hud
7. Fall below y=-10 → lose a life / respawn at start
8. Collect all coins → win
9. Show controls in controlsEl.textContent
10. Define function gameUpdate(delta) — called every frame
11. Define function gameRestart() — resets all state`,

  "Space Shooter": `You are generating JavaScript game logic for a SPACE SHOOTER in Three.js.

The environment is pre-configured with:
- scene (near-black with blue star light), camera (PerspectiveCamera facing -Z)
- clock, keys{}, W=800, H=500, hud (div), showOverlay(text, color), hideOverlay()

YOUR JOB — output ONLY JavaScript:
1. Create a player ship: a flat cone or custom shape (bright cyan/blue), at z=6, y=0
   - Move left/right/up/down with arrow keys or WASD; clamp to screen area
2. Spawn enemy ships: small red/orange boxes/cones approaching from -Z (coming toward camera)
   - Spawn every 1-2 seconds, random X/Y, coming from z=-100 toward camera
3. Shooting: Space fires a bullet (thin cylinder/sphere, bright green) along -Z
   - Limit to 5 bullets at once; destroy after 100 units
4. Collision: bullet hits enemy → enemy destroyed, score +10
   - Enemy reaches player Z → lose a life
5. Add a starfield: 200 small white spheres scattered in Z=-5 to -200, scroll toward camera
6. Score and lives in hud; 3 lives; game over at 0 lives
7. Every 500 points: increase enemy speed
8. Show controls in controlsEl.textContent
9. Define function gameUpdate(delta) — called every frame
10. Define function gameRestart() — resets all state`,

  "Racing": `You are generating JavaScript game logic for a RACING GAME in Three.js.

The environment is pre-configured with:
- scene (sky blue), camera (PerspectiveCamera behind-car view)
- updateRaceCamera(carMesh, lerpSpeed) helper — call each frame
- Directional sunlight + shadows enabled
- clock, keys{}, W=800, H=500, hud (div), showOverlay(text, color), hideOverlay()

YOUR JOB — output ONLY JavaScript:
1. Build a looping track: a flat road using a series of BoxGeometry segments in a large oval/figure-8
   - Road width ~6 units, use dark gray MeshLambertMaterial
   - Add side barriers (thin tall boxes, red/white)
2. Create a car: box body (bright color) on top of a flat base, add to scene
   - carSpeed, carAngle (Y rotation), position
   - W/Up = accelerate, S/Down = brake/reverse, A/Left = turn left, D/Right = turn right
   - Speed cap ~20 units/s; turning only works when moving
3. Add 5 AI obstacle cars (simple colored boxes) moving along the track at medium speed
4. Collision with obstacles: bump (reduce speed, show flash in HUD)
5. Track a lap counter: complete 3 laps → win
6. Speedometer in hud (current speed)
7. Chase camera: call updateRaceCamera(carMesh, 0.1) in gameUpdate
8. Show controls in controlsEl.textContent
9. Define function gameUpdate(delta) — called every frame
10. Define function gameRestart() — resets state`,

  "Puzzle": `You are generating JavaScript game logic for a 3D PUZZLE GAME in Three.js.

The environment is pre-configured with:
- scene (dark blue background 0x1a1a2e), camera (angled overhead, 50° FOV, at position 0,12,14 looking at 0,0,0)
- Good multi-directional lighting; shadows enabled
- clock, keys{}, W=800, H=500, hud (div), showOverlay(text, color), hideOverlay()

YOUR JOB — output ONLY JavaScript:
1. Build a SOKOBAN-style or block-pushing puzzle on a grid (unit size = 1):
   - Grid 8x8 or similar
   - Floor: flat plane (MeshLambertMaterial, medium gray)
   - Walls: tall gray boxes
   - Pushable blocks: colored boxes (distinct color, e.g. orange)
   - Target spots: flat thin boxes on floor (glowing color, e.g. green)
2. Player: small bright box that slides on the grid (one cell at a time)
3. Controls: Arrow keys or WASD → move one cell in that direction
   - If adjacent cell has a pushable block and cell beyond is empty → push block
   - Cannot move into walls or push blocks into walls
4. Puzzle logic: all colored blocks pushed onto target spots → win (showOverlay)
5. Include undo last move (Z key)
6. Design 1-2 solvable puzzle layouts hardcoded in the JS
7. Show move count in hud
8. Show controls in controlsEl.textContent  
9. Define function gameUpdate(delta) — called every frame (can be mostly empty for grid-based game)
10. Define function gameRestart() — resets puzzle`,
};

const DEFAULT_GENRE_PROMPT = GENRE_SYSTEM_PROMPTS["Space Shooter"];

// ─── Public API ───────────────────────────────────────────────────────────

export interface Generate3DResult {
  gameCode: string;
  title: string;
}

export async function generate3DGame(
  apiKey: string,
  prompt: string,
  genre: string,
): Promise<Generate3DResult> {
  const shell = THREE_JS_SHELLS[genre] ?? DEFAULT_3D_SHELL;
  const systemPrompt = GENRE_SYSTEM_PROMPTS[genre] ?? DEFAULT_GENRE_PROMPT;

  const userMessage = `Game description from user: "${prompt}"

Implement the game logic now. Output ONLY raw JavaScript — no HTML, no markdown fences, no import statements, no explanations. Your code will be injected into a pre-built Three.js HTML shell.

Key reminder:
- The following are already defined for you: THREE, scene, camera, renderer, clock, keys, hud, controlsEl, showOverlay, hideOverlay, W, H
- You MUST define: function gameUpdate(delta) { ... }
- You SHOULD define: function gameRestart() { ... }
- Add ALL your game objects to scene with scene.add(...)
- Keep it simple — basic BoxGeometry/SphereGeometry shapes work perfectly
- Make it genuinely fun and playable

Start your JavaScript code immediately:`;

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  let logic = content.text.trim();

  // Strip any accidental markdown fences (handles ```js, ```javascript, ```, no fence)
  if (logic.startsWith("```")) {
    logic = logic
      .replace(/^```(?:javascript|js|typescript|ts)?\r?\n/, "")
      .replace(/\r?\n```\s*$/, "")
      .trim();
  }

  // ── Shell-injection safety ──────────────────────────────────────────────
  // Claude's output goes directly into an HTML <script> block, so any literal
  // </script> in Claude's code (even inside a JS string or comment) would
  // prematurely close the script tag and corrupt the page.
  // Replace every occurrence with the JS-safe unicode escape equivalent.
  logic = logic.replace(/<\/script>/gi, "<\\/script>");

  // Inject into shell
  const gameCode = shell.replace("${GAME_LOGIC}", logic);

  const titleWords = prompt.split(" ").slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const title = `${titleWords} [3D ${genre}]`;

  return { gameCode, title };
}
