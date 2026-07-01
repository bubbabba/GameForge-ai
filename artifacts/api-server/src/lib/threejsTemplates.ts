/**
 * Hardcoded Three.js HTML shells.
 * Claude fills in ONLY the game logic (objects, controls, update loop).
 * The boilerplate — scene, renderer, camera, lighting, CDN load, animation — is fixed.
 *
 * Each shell injects the placeholder:  ${GAME_LOGIC}
 */

function makeShell(
  cameraSetup: string,
  lightingSetup: string,
  sceneBg: string,
  fogSetup: string,
): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GameForge 3D</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#090909; overflow:hidden; display:flex; justify-content:center; align-items:center; }
    canvas { display:block; }
    #hud { position:fixed; top:10px; left:0; right:0; text-align:center; color:#fff; font:bold 14px/1.6 monospace; pointer-events:none; z-index:10; text-shadow:0 0 8px rgba(34,197,94,.7); white-space:pre-line; }
    #controls { position:fixed; bottom:10px; left:0; right:0; text-align:center; color:#666; font:12px monospace; pointer-events:none; z-index:10; }
    #overlay { position:fixed; inset:0; display:flex; justify-content:center; align-items:center; z-index:20; pointer-events:none; }
    #overlay-box { background:rgba(0,0,0,.88); border:1px solid rgba(34,197,94,.3); padding:28px 40px; border-radius:10px; display:none; text-align:center; font-family:monospace; }
    #overlay-title { font-size:30px; font-weight:bold; margin-bottom:8px; }
    #overlay-sub { font-size:13px; color:#888; }
  </style>
</head>
<body>
  <div id="hud"></div>
  <div id="controls"></div>
  <div id="overlay">
    <div id="overlay-box">
      <div id="overlay-title"></div>
      <div id="overlay-sub">Press R to restart</div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
  <script>
  window.addEventListener('load', function () {
    if (typeof THREE === 'undefined') {
      document.getElementById('hud').textContent = 'Error: Three.js failed to load. Check your connection.';
      return;
    }

    // ─── Canvas / Renderer ──────────────────────────────────────────────────
    const W = 800, H = 500;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ─── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(${sceneBg});
    ${fogSetup}

    // ─── Camera ─────────────────────────────────────────────────────────────
    ${cameraSetup}

    // ─── Lighting ───────────────────────────────────────────────────────────
    ${lightingSetup}

    // ─── Clock / Input ──────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.code] = true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup',   e => { keys[e.code] = false; });

    // ─── HUD helpers ────────────────────────────────────────────────────────
    const hud          = document.getElementById('hud');
    const controlsEl   = document.getElementById('controls');
    const overlayBox   = document.getElementById('overlay-box');
    const overlayTitle = document.getElementById('overlay-title');

    function showOverlay(text, color) {
      overlayTitle.style.color = color || '#22c55e';
      overlayTitle.textContent = text;
      overlayBox.style.display = 'block';
    }
    function hideOverlay() { overlayBox.style.display = 'none'; }

    // ═══════════════════════════════════════════════════════════════════════
    //  GAME LOGIC — filled in by AI
    //  Available globals: scene, camera, renderer, clock, keys, hud,
    //    controlsEl, showOverlay, hideOverlay, W, H, THREE
    //  Required export: function gameUpdate(delta) { ... }
    //  Optional export: function gameRestart() { ... }
    // ═══════════════════════════════════════════════════════════════════════
    \${GAME_LOGIC}
    // ═══════════════════════════════════════════════════════════════════════

    // ─── Animation loop ─────────────────────────────────────────────────────
    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (typeof gameUpdate === 'function') gameUpdate(delta);
      renderer.render(scene, camera);
    }
    animate();

    // ─── Restart ────────────────────────────────────────────────────────────
    window.addEventListener('keydown', function(e) {
      if (e.code === 'KeyR' && typeof gameRestart === 'function') {
        gameRestart();
        hideOverlay();
      }
    });
  });
  </script>
</body>
</html>`;
}

// ─── Per-genre shells ──────────────────────────────────────────────────────

export const THREE_JS_SHELLS: Record<string, string> = {

  /** First-person horror: locked pointer, dark fog, dim flashlight */
  "FP Horror": makeShell(
    /* camera */ `
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 200);
    camera.position.set(0, 1.7, 0);
    scene.add(camera);
    // Flashlight follows camera
    const flashlight = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 8, 0.5);
    flashlight.castShadow = true;
    camera.add(flashlight);
    flashlight.target.position.set(0, 0, -1);
    camera.add(flashlight.target);
    `,
    /* lighting */ `
    scene.add(new THREE.AmbientLight(0x111122, 0.15));
    `,
    /* bg */ `0x000000`,
    /* fog */ `scene.fog = new THREE.FogExp2(0x000000, 0.12);`,
  ),

  /** Third-person platformer: chase camera that follows the player */
  "Platformer": makeShell(
    /* camera */ `
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 500);
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 0, 0);
    // Helper: call this each frame with player mesh to chase
    function updateChaseCamera(target, lerpSpeed) {
      const offset = new THREE.Vector3(0, 5, 10);
      const desired = target.position.clone().add(offset);
      camera.position.lerp(desired, lerpSpeed || 0.1);
      camera.lookAt(target.position.clone().add(new THREE.Vector3(0, 1, 0)));
    }
    `,
    /* lighting */ `
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffd580, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top  =  50; sun.shadow.camera.bottom = -50;
    scene.add(sun);
    `,
    /* bg */ `0x87ceeb`,
    /* fog */ `scene.fog = new THREE.Fog(0x87ceeb, 40, 150);`,
  ),

  /** Space shooter: camera looks forward along Z axis */
  "Space Shooter": makeShell(
    /* camera */ `
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 2000);
    camera.position.set(0, 2, 10);
    camera.lookAt(0, 0, 0);
    `,
    /* lighting */ `
    scene.add(new THREE.AmbientLight(0x111133, 0.8));
    const starLight = new THREE.PointLight(0x4466ff, 2, 500);
    starLight.position.set(0, 50, 0);
    scene.add(starLight);
    `,
    /* bg */ `0x000011`,
    /* fog */ `scene.fog = new THREE.Fog(0x000011, 200, 2000);`,
  ),

  /** Racing: chase camera behind a vehicle */
  "Racing": makeShell(
    /* camera */ `
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 0, 0);
    function updateRaceCamera(car, lerpSpeed) {
      const back = new THREE.Vector3(0, 3.5, 9);
      back.applyQuaternion(car.quaternion);
      const desired = car.position.clone().add(back);
      camera.position.lerp(desired, lerpSpeed || 0.12);
      const lookAt = car.position.clone().add(new THREE.Vector3(0, 1, 0));
      camera.lookAt(lookAt);
    }
    `,
    /* lighting */ `
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff5cc, 1.2);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
    sun.shadow.camera.top  =  100; sun.shadow.camera.bottom = -100;
    scene.add(sun);
    `,
    /* bg */ `0x87ceeb`,
    /* fog */ `scene.fog = new THREE.Fog(0x87ceeb, 100, 600);`,
  ),

  /** 3D Puzzle: angled overhead camera, static */
  "Puzzle": makeShell(
    /* camera */ `
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 12, 14);
    camera.lookAt(0, 0, 0);
    `,
    /* lighting */ `
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffeedd, 1.0);
    key.position.set(8, 16, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xddeeff, 0.4);
    fill.position.set(-8, 8, -8);
    scene.add(fill);
    `,
    /* bg */ `0x1a1a2e`,
    /* fog */ ``,
  ),
};

/** Fallback shell for unknown 3D genres */
export const DEFAULT_3D_SHELL = THREE_JS_SHELLS["Space Shooter"];
