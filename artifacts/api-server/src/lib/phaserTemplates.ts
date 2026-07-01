/**
 * Phaser.js 2D game template shells.
 *
 * Each shell is a complete, self-contained HTML game with:
 *  - Working game loop, physics, player movement, HUD, game-over/win screens
 *  - Helper methods on `scene`: addPlatform(), addCoin(), addEnemy(), etc.
 *  - Claude fills ONLY the game logic via ${GAME_LOGIC} injection
 *
 * Claude defines global functions: buildLevel(scene), gameUpdate(scene, time, delta)
 */

// ── Shared CSS / meta head ───────────────────────────────────────────────────

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#090909;display:flex;justify-content:center;align-items:center;overflow:hidden}
</style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"><\/script>`;

const FOOT = `
<script>
// ── Claude's game logic ──────────────────────────────────────────────────────
// Must define: function buildLevel(scene){...}  function gameUpdate(scene,time,delta){...}
\${GAME_LOGIC}
<\/script>
</body>
</html>`;

// ── Platformer Shell ─────────────────────────────────────────────────────────

export const PLATFORMER_SHELL = HEAD + `
<script>
const W=800,H=500,WORLD_W=2400;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.score=0;this.lives=3;this.isOver=false;this.isWin=false;this._coinCount=0;
    // Groups
    this.platforms=this.physics.add.staticGroup();
    this.coins=this.physics.add.group();
    this.enemies=this.physics.add.group();
    this.projectiles=this.physics.add.group();
    // Base textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_plat',64,16,g=>{g.fillStyle(0x556b2f);g.fillRect(0,0,64,16)});
    mk('_coin',14,14,g=>{g.fillStyle(0xffd700);g.fillCircle(7,7,7)});
    mk('_enemy',24,24,g=>{g.fillStyle(0xff4444);g.fillRect(0,0,24,24)});
    mk('_player',22,30,g=>{g.fillStyle(0x00ff88);g.fillRect(0,0,22,30)});
    // Player
    this.player=this.physics.add.sprite(80,H-80,'_player');
    this.player.setBounce(0.05).setCollideWorldBounds(true);
    this.player.body.setGravityY(500);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    this.spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // World & camera
    this.physics.world.setBounds(0,0,WORLD_W,H+200);
    this.cameras.main.setBounds(0,0,WORLD_W,H);
    this.cameras.main.startFollow(this.player,true,0.1,0.1);
    this.player.setCollideWorldBounds(true);
    // HUD
    this.hudScore=this.add.text(16,14,'Score: 0',{fontSize:'18px',color:'#fff',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(10);
    this.hudLives=this.add.text(16,40,'♥♥♥',{fontSize:'18px',color:'#ff5555',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(10);
    this.hudCtrl=this.add.text(W-12,H-12,'Arrows/WASD: Move  Space/W/↑: Jump',{fontSize:'12px',color:'#666'}).setOrigin(1,1).setScrollFactor(0).setDepth(10);
    // Colliders
    this.physics.add.collider(this.player,this.platforms);
    this.physics.add.collider(this.enemies,this.platforms);
    // Overlaps
    this.physics.add.overlap(this.player,this.coins,(pl,c)=>{
      c.destroy();this._coinCount--;this.addScore(10);
      if(this._coinCount<=0)this.triggerWin();
      if(typeof onCoinCollect==='function')onCoinCollect(this,c);
    });
    this.physics.add.overlap(this.player,this.enemies,(pl,e)=>{
      if(this.isOver||this.isWin)return;
      if(typeof onEnemyHit==='function')onEnemyHit(this,e);else{e.destroy();this.loseLife();}
    });
    // Claude builds the level
    if(typeof buildLevel==='function')buildLevel(this);
  }
  // ── helpers Claude can call ─────────────────────────────────────────────
  addPlatform(x,y,w,h,color=0x556b2f){
    const r=this.add.rectangle(x,y,w,h,color);
    this.physics.add.existing(r,true);
    r.body.setSize(w,h);
    this.platforms.add(r);
    return r;
  }
  addCoin(x,y,tex='_coin'){
    const c=this.coins.create(x,y,tex);
    c.setBounceY(0.2);c.body.setAllowGravity(false);
    this._coinCount++;
    return c;
  }
  addEnemy(x,y,tex='_enemy',cfg={}){
    const e=this.enemies.create(x,y,tex);
    e.setCollideWorldBounds(true);
    e.body.setGravityY(500);
    e._patrol=cfg.patrol??200;e._dir=1;e._speed=cfg.speed??80;
    e._startX=x;
    return e;
  }
  patrolEnemies(){
    this.enemies.getChildren().forEach(e=>{
      if(!e.active)return;
      e.setVelocityX(e._speed*e._dir);
      if(Math.abs(e.x-e._startX)>e._patrol)e._dir*=-1;
    });
  }
  addScore(pts){this.score+=pts;this.hudScore.setText('Score: '+this.score)}
  loseLife(){
    if(this.isOver)return;
    this.lives--;
    this.hudLives.setText('♥'.repeat(Math.max(0,this.lives)));
    if(this.lives<=0){this.triggerGameOver();return;}
    this.player.setPosition(80,H-80);this.player.setVelocity(0,0);
    this.cameras.main.shake(200,0.01);
  }
  triggerGameOver(){
    if(this.isOver&&this.isWin)return;
    this.isOver=true;
    this._showOverlay('GAME OVER','#ff4444');
  }
  triggerWin(){
    if(this.isOver||this.isWin)return;
    this.isWin=true;
    this._showOverlay('YOU WIN! ','#00ff88');
  }
  _showOverlay(msg,col){
    const cam=this.cameras.main;
    const cx=cam.scrollX+W/2,cy=cam.scrollY+H/2;
    this.add.rectangle(cx,cy,W,H,0x000000,0.78).setDepth(20);
    this.add.text(cx,cy-40,msg,{fontSize:'54px',color:col,fontStyle:'bold',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(21);
    this.add.text(cx,cy+20,'Score: '+this.score,{fontSize:'26px',color:'#fff'}).setOrigin(0.5).setDepth(21);
    this.add.text(cx,cy+60,'Press R to restart',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(21);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  // ── main update ────────────────────────────────────────────────────────
  update(time,delta){
    if(this.isOver||this.isWin)return;
    const grounded=this.player.body.blocked.down;
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const jump=Phaser.Input.Keyboard.JustDown(this.cursors.up)||Phaser.Input.Keyboard.JustDown(this.spaceKey)||Phaser.Input.Keyboard.JustDown(this.wasd.up);
    if(left)this.player.setVelocityX(-210);
    else if(right)this.player.setVelocityX(210);
    else this.player.setVelocityX(0);
    if(jump&&grounded)this.player.setVelocityY(-560);
    if(this.player.y>H+120)this.loseLife();
    if(typeof gameUpdate==='function')gameUpdate(this,time,delta);
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#1a0a2e',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── Shooter Shell ────────────────────────────────────────────────────────────

export const SHOOTER_SHELL = HEAD + `
<script>
const W=800,H=500;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.score=0;this.lives=3;this.isOver=false;this.isWin=false;
    this._wave=1;this._kills=0;this._nextWave=10;this._lastShot=0;this._shootCooldown=250;
    // Groups
    this.enemies=this.physics.add.group();
    this.bullets=this.physics.add.group();
    this.powerups=this.physics.add.group();
    // Textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_ship',28,32,g=>{g.fillStyle(0x00ccff);g.fillTriangle(14,0,28,32,0,32)});
    mk('_bullet',6,14,g=>{g.fillStyle(0x00ff88);g.fillRect(0,0,6,14)});
    mk('_enemy',26,22,g=>{g.fillStyle(0xff4400);g.fillTriangle(13,22,26,0,0,0)});
    mk('_star',3,3,g=>{g.fillStyle(0xffffff);g.fillRect(0,0,3,3)});
    mk('_powerup',18,18,g=>{g.fillStyle(0xffaa00);g.fillCircle(9,9,9)});
    // Starfield
    for(let i=0;i<120;i++){const s=this.add.image(Phaser.Math.Between(0,W),Phaser.Math.Between(0,H),'_star');s._spd=Phaser.Math.FloatBetween(0.3,1.5);this._stars=(this._stars||[]);this._stars.push(s)}
    // Player ship
    this.player=this.physics.add.sprite(W/2,H-60,'_ship');
    this.player.setCollideWorldBounds(true);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    this.spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // HUD
    this.hudScore=this.add.text(16,14,'Score: 0',{fontSize:'18px',color:'#00ff88',stroke:'#000',strokeThickness:3}).setDepth(10);
    this.hudLives=this.add.text(16,40,'♥♥♥',{fontSize:'18px',color:'#ff5555',stroke:'#000',strokeThickness:3}).setDepth(10);
    this.hudWave=this.add.text(W/2,14,'Wave 1',{fontSize:'18px',color:'#fff'}).setOrigin(0.5,0).setDepth(10);
    this.hudCtrl=this.add.text(W-12,H-12,'Arrows/WASD: Move  Space: Shoot',{fontSize:'12px',color:'#555'}).setOrigin(1,1).setDepth(10);
    // Overlaps
    this.physics.add.overlap(this.bullets,this.enemies,(b,e)=>{
      b.destroy();
      if(typeof onEnemyHit==='function')onEnemyHit(this,e);
      else{e.destroy();this.addScore(10);this._kills++;}
    });
    this.physics.add.overlap(this.player,this.enemies,(pl,e)=>{
      if(this.isOver)return;
      e.destroy();this.loseLife();
    });
    this.physics.add.overlap(this.player,this.powerups,(pl,p)=>{
      p.destroy();
      if(typeof onPowerup==='function')onPowerup(this);
      else{this._shootCooldown=Math.max(80,this._shootCooldown-50);}
    });
    // Claude builds wave/enemy config
    if(typeof buildLevel==='function')buildLevel(this);
  }
  // ── helpers ─────────────────────────────────────────────────────────────
  spawnEnemy(x,y,speedY=90,cfg={}){
    const e=this.enemies.create(x??Phaser.Math.Between(20,W-20),y??-20,'_enemy');
    e.setVelocityY(cfg.speedY??speedY);
    if(cfg.speedX)e.setVelocityX(cfg.speedX);
    e._hp=cfg.hp??1;
    return e;
  }
  fireBullet(){
    const b=this.bullets.create(this.player.x,this.player.y-20,'_bullet');
    b.setVelocityY(-600);b.body.setAllowGravity(false);
    return b;
  }
  addScore(pts){this.score+=pts;this.hudScore.setText('Score: '+this.score)}
  loseLife(){
    if(this.isOver)return;
    this.lives--;this.hudLives.setText('♥'.repeat(Math.max(0,this.lives)));
    this.cameras.main.shake(180,0.012);
    if(this.lives<=0)this.triggerGameOver();
  }
  triggerGameOver(){
    this.isOver=true;
    this._showOverlay('GAME OVER','#ff4444');
  }
  triggerWin(){
    this.isWin=true;
    this._showOverlay('MISSION COMPLETE','#00ff88');
  }
  _showOverlay(msg,col){
    this.add.rectangle(W/2,H/2,W,H,0x000000,0.78).setDepth(20);
    this.add.text(W/2,H/2-40,msg,{fontSize:'46px',color:col,fontStyle:'bold',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(21);
    this.add.text(W/2,H/2+20,'Score: '+this.score,{fontSize:'24px',color:'#fff'}).setOrigin(0.5).setDepth(21);
    this.add.text(W/2,H/2+60,'Press R to restart',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(21);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  update(time,delta){
    if(this.isOver||this.isWin)return;
    // Scroll stars
    (this._stars||[]).forEach(s=>{s.y+=s._spd;if(s.y>H)s.y=0});
    // Player movement
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const up=this.cursors.up.isDown||this.wasd.up.isDown;
    const down=this.cursors.down.isDown||this.wasd.down.isDown;
    const spd=220;
    this.player.setVelocity(right?spd:left?-spd:0,down?spd:up?-spd:0);
    // Auto-shoot on space
    if(this.spaceKey.isDown&&time-this._lastShot>this._shootCooldown){
      this._lastShot=time;this.fireBullet();
    }
    // Cull off-screen bullets & enemies
    this.bullets.getChildren().forEach(b=>{if(b.y<-30)b.destroy()});
    this.enemies.getChildren().forEach(e=>{if(e.y>H+40)e.destroy()});
    if(typeof gameUpdate==='function')gameUpdate(this,time,delta);
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#050510',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── Racing Shell (top-down) ──────────────────────────────────────────────────

export const RACING_SHELL = HEAD + `
<script>
const W=800,H=500;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.score=0;this.isOver=false;this.isWin=false;
    this._laps=0;this._targetLaps=3;this._speed=0;this._maxSpeed=280;this._angle=0;
    this._checkpoints=[];this._nextCP=0;this._bestLap=Infinity;this._lapStart=0;
    // Groups
    this.walls=this.physics.add.staticGroup();
    this.boosts=this.physics.add.group();
    this.aiCars=this.physics.add.group();
    // Textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_car',20,32,g=>{g.fillStyle(0x00ccff);g.fillRect(2,0,16,32);g.fillStyle(0x0088aa);g.fillRect(4,6,12,8)});
    mk('_aicar',20,32,g=>{g.fillStyle(0xff6600);g.fillRect(2,0,16,32)});
    mk('_wall',20,20,g=>{g.fillStyle(0x888888);g.fillRect(0,0,20,20)});
    mk('_road',W,H,g=>{g.fillStyle(0x2d2d2d);g.fillRect(0,0,W,H)});
    mk('_boost',22,22,g=>{g.fillStyle(0xffdd00);g.fillRect(0,0,22,22)});
    mk('_grass',1,1,g=>{g.fillStyle(0x1a4a1a);g.fillRect(0,0,1,1)});
    // Background road
    this.add.image(W/2,H/2,'_road');
    // Grass outside track (just green background)
    this.cameras.main.setBackgroundColor(0x1a4a1a);
    // Player car
    this.player=this.physics.add.sprite(W/2,H-80,'_car');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(16,28).setOffset(2,2);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    // HUD
    this.hudSpeed=this.add.text(16,14,'Speed: 0',{fontSize:'17px',color:'#fff',stroke:'#000',strokeThickness:3}).setDepth(10);
    this.hudLap=this.add.text(W/2,14,'Lap: 0 / '+this._targetLaps,{fontSize:'18px',color:'#fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setDepth(10);
    this.hudScore=this.add.text(W-12,14,'',{fontSize:'16px',color:'#ffdd00'}).setOrigin(1,0).setDepth(10);
    this.hudCtrl=this.add.text(W-12,H-12,'Arrows/WASD: Steer  W/↑: Accelerate  S/↓: Brake',{fontSize:'12px',color:'#555'}).setOrigin(1,1).setDepth(10);
    // Colliders
    this.physics.add.collider(this.player,this.walls,(pl)=>{this._speed*=0.3;});
    this.physics.add.overlap(this.player,this.boosts,(pl,b)=>{
      b.destroy();this._speed=Math.min(this._maxSpeed*1.5,this._speed+80);
      this.hudScore.setText('BOOST!').setColor('#ffdd00');
      this.time.delayedCall(1000,()=>this.hudScore.setText(''));
    });
    // Claude builds the track
    if(typeof buildLevel==='function')buildLevel(this);
    this._lapStart=this.time.now;
  }
  // ── helpers ─────────────────────────────────────────────────────────────
  addWall(x,y,w,h){
    const r=this.add.rectangle(x,y,w,h,0x666666);
    this.physics.add.existing(r,true);r.body.setSize(w,h);
    this.walls.add(r);return r;
  }
  addBoost(x,y){const b=this.boosts.create(x,y,'_boost');b.body.setAllowGravity(false);return b;}
  addCheckpoint(x,y,radius=40){this._checkpoints.push({x,y,r:radius});}
  addAiCar(x,y,pathFn){
    const c=this.aiCars.create(x,y,'_aicar');
    c._pathFn=pathFn;c._t=Math.random();c._speed=Phaser.Math.Between(80,150);
    return c;
  }
  completeLap(){
    this._laps++;
    const lapTime=((this.time.now-this._lapStart)/1000).toFixed(1);
    if(parseFloat(lapTime)<this._bestLap)this._bestLap=parseFloat(lapTime);
    this._lapStart=this.time.now;
    this.hudLap.setText('Lap: '+this._laps+' / '+this._targetLaps);
    this.hudScore.setText('Lap '+this._laps+'! '+lapTime+'s').setColor('#00ff88');
    this.time.delayedCall(2000,()=>this.hudScore.setText(''));
    if(this._laps>=this._targetLaps)this.triggerWin();
  }
  triggerGameOver(){this.isOver=true;this._showOverlay('CRASHED!','#ff4444')}
  triggerWin(){this.isWin=true;this._showOverlay('RACE COMPLETE!','#00ff88')}
  _showOverlay(msg,col){
    this.add.rectangle(W/2,H/2,W,H,0x000000,0.78).setDepth(20);
    this.add.text(W/2,H/2-40,msg,{fontSize:'46px',color:col,fontStyle:'bold',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(21);
    this.add.text(W/2,H/2+20,'Laps: '+this._laps+' | Best: '+(this._bestLap===Infinity?'—':this._bestLap+'s'),{fontSize:'22px',color:'#fff'}).setOrigin(0.5).setDepth(21);
    this.add.text(W/2,H/2+60,'Press R to restart',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(21);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  update(time,delta){
    if(this.isOver||this.isWin)return;
    const dt=delta/1000;
    const accel=this.cursors.up.isDown||this.wasd.up.isDown;
    const brake=this.cursors.down.isDown||this.wasd.down.isDown;
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const absSpd=Math.abs(this._speed);
    if(accel)this._speed=Math.min(this._maxSpeed,this._speed+300*dt);
    else if(brake)this._speed=Math.max(-80,this._speed-250*dt);
    else this._speed*=0.96;
    if(absSpd>10){const turn=100*dt*(absSpd/this._maxSpeed);if(left)this._angle-=turn;if(right)this._angle+=turn;}
    this.player.setAngle(this._angle);
    const rad=Phaser.Math.DegToRad(this._angle-90);
    this.player.setVelocity(Math.cos(rad)*this._speed,Math.sin(rad)*this._speed);
    this.hudSpeed.setText('Speed: '+Math.round(absSpd));
    // Checkpoint detection
    if(this._checkpoints.length>0){
      const cp=this._checkpoints[this._nextCP];
      if(Phaser.Math.Distance.Between(this.player.x,this.player.y,cp.x,cp.y)<cp.r){
        this._nextCP=(this._nextCP+1)%this._checkpoints.length;
        if(this._nextCP===0)this.completeLap();
      }
    }
    // AI cars follow path
    this.aiCars.getChildren().forEach(c=>{
      if(typeof c._pathFn==='function'){
        c._t=(c._t+c._speed*dt/1000)%1;
        const pos=c._pathFn(c._t);
        const dx=pos.x-c.x,dy=pos.y-c.y;
        const ang=Math.atan2(dy,dx);
        c.setVelocity(Math.cos(ang)*c._speed,Math.sin(ang)*c._speed);
        c.setRotation(ang+Math.PI/2);
      }
    });
    if(typeof gameUpdate==='function')gameUpdate(this,time,delta);
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#1a4a1a',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── Puzzle Shell (grid-based Sokoban-style) ──────────────────────────────────

export const PUZZLE_SHELL = HEAD + `
<script>
const W=800,H=500,CELL=48;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.isOver=false;this.isWin=false;this._moves=0;this._level=0;
    this._grid=[];this._boxes=[];this._targets=[];this._undoStack=[];
    this._px=0;this._py=0;
    // Textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_floor',CELL,CELL,g=>{g.fillStyle(0x2a2a3a);g.fillRect(0,0,CELL,CELL);g.lineStyle(1,0x3a3a5a);g.strokeRect(0,0,CELL,CELL)});
    mk('_wall',CELL,CELL,g=>{g.fillStyle(0x555566);g.fillRect(0,0,CELL,CELL);g.fillStyle(0x777788,0.5);g.fillRect(2,2,CELL-4,CELL-4)});
    mk('_box',CELL-4,CELL-4,g=>{g.fillStyle(0xcc8800);g.fillRect(0,0,CELL-4,CELL-4);g.fillStyle(0xffaa22,0.4);g.fillRect(3,3,CELL-10,CELL-10)});
    mk('_target',CELL,CELL,g=>{g.fillStyle(0x1a3a1a);g.fillRect(0,0,CELL,CELL);g.fillStyle(0x00cc44,0.6);g.fillCircle(CELL/2,CELL/2,CELL/2-6)});
    mk('_boxdone',CELL-4,CELL-4,g=>{g.fillStyle(0x00aa44);g.fillRect(0,0,CELL-4,CELL-4)});
    mk('_player',CELL-10,CELL-10,g=>{g.fillStyle(0x4488ff);g.fillCircle((CELL-10)/2,(CELL-10)/2,(CELL-10)/2)});
    // HUD
    this.hudMoves=this.add.text(16,14,'Moves: 0',{fontSize:'18px',color:'#fff',stroke:'#000',strokeThickness:3}).setDepth(10);
    this.hudLevel=this.add.text(W/2,14,'Level 1',{fontSize:'18px',color:'#fff'}).setOrigin(0.5,0).setDepth(10);
    this.hudCtrl=this.add.text(W-12,H-12,'Arrows/WASD: Move  Z: Undo  R: Restart',{fontSize:'12px',color:'#555'}).setOrigin(1,1).setDepth(10);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    this.undoKey=this.input.keyboard.addKey('Z');
    this.restartKey=this.input.keyboard.addKey('R');
    this._inputCooldown=0;
    // Claude defines level(s)
    if(typeof buildLevel==='function')buildLevel(this);
  }
  // ── helpers ─────────────────────────────────────────────────────────────
  loadLevel(layout,ox,oy){
    // layout: array of strings. '#'=wall, '.'=floor, '@'=player, '$'=box, '*'=box-on-target, '+'=player-on-target, 'X'=target
    this._tiles&&this._tiles.getChildren().forEach(t=>t.destroy());
    this._playerSprite&&this._playerSprite.destroy();
    this._boxSprites&&this._boxSprites.forEach(b=>b.destroy());
    this._targetSprites&&this._targetSprites.forEach(t=>t.destroy());
    this._tiles=this.add.group();this._boxSprites=[];this._targetSprites=[];
    this._grid=layout.map(r=>[...r]);this._undoStack=[];this._moves=0;
    this.hudMoves.setText('Moves: 0');
    const rows=layout.length,cols=layout[0].length;
    this._offX=ox??(W-cols*CELL)/2;this._offY=oy??(H-rows*CELL)/2;
    for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){
      const ch=layout[r][c],tx=this._offX+c*CELL+CELL/2,ty=this._offY+r*CELL+CELL/2;
      if(ch===' ')continue;
      const floor=this.add.image(tx,ty,'_floor').setDepth(0);this._tiles.add(floor);
      if(ch==='#'){this.add.image(tx,ty,'_wall').setDepth(1);this._tiles.add(this.add.image(tx,ty,'_wall').setDepth(1));}
      if(ch==='X'||ch==='*'||ch==='+'){const t=this.add.image(tx,ty,'_target').setDepth(1);this._targetSprites.push({r,c,img:t});}
      if(ch==='$'||ch==='*'){const b=this.add.image(tx,ty,'_box').setDepth(2);this._boxSprites.push({r,c,img:b});}
      if(ch==='@'||ch==='+'){this._py=r;this._px=c;}
    }}
    this._playerSprite=this.add.image(this._offX+this._px*CELL+CELL/2,this._offY+this._py*CELL+CELL/2,'_player').setDepth(3);
  }
  _cell(r,c){return this._grid[r]?.[c]??'#'}
  _isFloor(ch){return '.@$*X+ '.includes(ch)&&ch!=='#'}
  _isBox(ch){return ch==='$'||ch==='*'}
  _isTarget(ch){return ch==='X'||ch==='*'||ch==='+'} 
  tryMove(dr,dc){
    if(this.isWin||this.isOver)return;
    const nr=this._py+dr,nc=this._px+dc;
    const cell=this._cell(nr,nc);
    if(cell==='#'||cell===' ')return;
    let snapshot=JSON.stringify(this._grid);
    if(this._isBox(cell)){
      const br=nr+dr,bc=nc+dc,bcell=this._cell(br,bc);
      if(bcell==='#'||bcell===' '||this._isBox(bcell))return;
      // push box
      this._grid[br][bc]=this._isTarget(bcell)?'*':'$';
      this._grid[nr][nc]=this._isTarget(cell)?'X':'.';
      this._updateBoxSprite(nr,nc,br,bc);
    }
    this._grid[this._py][this._px]=this._isTarget(this._grid[this._py][this._px])?'X':'.';
    this._grid[nr][nc]=this._isTarget(this._grid[nr][nc])?'+':'@';
    this._py=nr;this._px=nc;
    this._undoStack.push(snapshot);if(this._undoStack.length>50)this._undoStack.shift();
    this._moves++;this.hudMoves.setText('Moves: '+this._moves);
    this._playerSprite.setPosition(this._offX+this._px*CELL+CELL/2,this._offY+this._py*CELL+CELL/2);
    this._checkWin();
    if(typeof gameUpdate==='function')gameUpdate(this,0,0);
  }
  _updateBoxSprite(fr,fc,tr,tc){
    const b=this._boxSprites.find(b=>b.r===fr&&b.c===fc);
    if(b){b.r=tr;b.c=tc;b.img.setPosition(this._offX+tc*CELL+CELL/2,this._offY+tr*CELL+CELL/2);
      b.img.setTexture(this._isTarget(this._grid[tr][tc])?'_boxdone':'_box');}
  }
  undo(){
    if(!this._undoStack.length)return;
    this._grid=JSON.parse(this._undoStack.pop());
    // Rebuild sprites from grid
    this._reloadSprites();
    this._moves=Math.max(0,this._moves-1);this.hudMoves.setText('Moves: '+this._moves);
  }
  _reloadSprites(){
    const rows=this._grid.length,cols=this._grid[0].length;
    // Hide all box sprites, re-place from grid
    this._boxSprites.forEach(b=>b.img.setVisible(false));this._boxSprites=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const ch=this._grid[r][c];
      if(ch==='$'||ch==='*'){
        const tx=this._offX+c*CELL+CELL/2,ty=this._offY+r*CELL+CELL/2;
        const b=this.add.image(tx,ty,ch==='*'?'_boxdone':'_box').setDepth(2);
        this._boxSprites.push({r,c,img:b});
      }
      if(ch==='@'||ch==='+'){this._py=r;this._px=c;}
    }
    this._playerSprite.setPosition(this._offX+this._px*CELL+CELL/2,this._offY+this._py*CELL+CELL/2);
  }
  _checkWin(){const solved=this._grid.every(row=>row.indexOf('$')===-1);if(solved)this.completeLevel();}
  completeLevel(){
    if(this._levelComplete)return;this._levelComplete=true;
    const overlay=this.add.rectangle(W/2,H/2,W,H,0x000000,0.7).setDepth(20);
    const txt=this.add.text(W/2,H/2-30,'LEVEL COMPLETE!',{fontSize:'44px',color:'#00ff88',fontStyle:'bold',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(21);
    const sub=this.add.text(W/2,H/2+20,'Moves: '+this._moves,{fontSize:'22px',color:'#fff'}).setOrigin(0.5).setDepth(21);
    this.time.delayedCall(1500,()=>{overlay.destroy();txt.destroy();sub.destroy();this._levelComplete=false;
      if(typeof onLevelComplete==='function')onLevelComplete(this);else this.triggerWin();});
  }
  triggerWin(){
    this.isWin=true;
    this.add.rectangle(W/2,H/2,W,H,0x000000,0.78).setDepth(22);
    this.add.text(W/2,H/2-40,'PUZZLE SOLVED!',{fontSize:'48px',color:'#00ff88',fontStyle:'bold',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(23);
    this.add.text(W/2,H/2+20,'Total Moves: '+this._moves,{fontSize:'24px',color:'#fff'}).setOrigin(0.5).setDepth(23);
    this.add.text(W/2,H/2+60,'Press R to restart',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(23);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  update(time,delta){
    if(this.isWin||this.isOver)return;
    this._inputCooldown-=delta;if(this._inputCooldown>0)return;
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const up=this.cursors.up.isDown||this.wasd.up.isDown;
    const down=this.cursors.down.isDown||this.wasd.down.isDown;
    if(left){this.tryMove(0,-1);this._inputCooldown=160;}
    else if(right){this.tryMove(0,1);this._inputCooldown=160;}
    else if(up){this.tryMove(-1,0);this._inputCooldown=160;}
    else if(down){this.tryMove(1,0);this._inputCooldown=160;}
    if(Phaser.Input.Keyboard.JustDown(this.undoKey))this.undo();
    if(Phaser.Input.Keyboard.JustDown(this.restartKey)){if(typeof gameRestart==='function')gameRestart();this.scene.restart();}
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#1a1a2e',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── Horror Shell (top-down maze with flashlight) ─────────────────────────────

export const HORROR_SHELL = HEAD + `
<script>
const W=800,H=500;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.isOver=false;this.isWin=false;this._fear=0;this._maxFear=100;this._keys=[];
    // Groups
    this.walls=this.physics.add.staticGroup();
    this.enemies=this.physics.add.group();
    this.items=this.physics.add.group();
    // Textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_hero',20,20,g=>{g.fillStyle(0xddccaa);g.fillCircle(10,10,10)});
    mk('_wall',40,40,g=>{g.fillStyle(0x333344);g.fillRect(0,0,40,40);g.lineStyle(1,0x444455);g.strokeRect(0,0,40,40)});
    mk('_floor',40,40,g=>{g.fillStyle(0x1a1a1e);g.fillRect(0,0,40,40)});
    mk('_enemy',18,18,g=>{g.fillStyle(0xcc0000);g.fillCircle(9,9,9)});
    mk('_item',16,16,g=>{g.fillStyle(0xffdd44);g.fillRect(0,0,16,16)});
    mk('_exit',30,30,g=>{g.fillStyle(0x00ff44);g.fillRect(0,0,30,30)});
    // Darkness overlay (using Graphics for flashlight)
    this._darkness=this.add.graphics().setDepth(15);
    // Player
    this.player=this.physics.add.sprite(W/2,H/2,'_hero').setCollideWorldBounds(true);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    // HUD
    this.hudFear=this.add.text(16,14,'Fear: ░░░░░░░░░░',{fontSize:'15px',color:'#ff4444',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(20);
    this.hudMsg=this.add.text(W/2,H-36,'',{fontSize:'15px',color:'#fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setScrollFactor(0).setDepth(20);
    this.hudCtrl=this.add.text(W-12,H-12,'WASD/Arrows: Move',{fontSize:'12px',color:'#444'}).setOrigin(1,1).setScrollFactor(0).setDepth(20);
    // Camera follows player
    this.cameras.main.startFollow(this.player,true,0.1,0.1);
    // Colliders
    this.physics.add.collider(this.player,this.walls);
    this.physics.add.overlap(this.player,this.enemies,(pl,e)=>{
      if(this.isOver)return;
      if(typeof onEnemyTouch==='function')onEnemyTouch(this,e);else this.triggerGameOver();
    });
    this.physics.add.overlap(this.player,this.items,(pl,item)=>{
      item.destroy();
      if(typeof onItemCollect==='function')onItemCollect(this,item);
      else{this._fear=Math.max(0,this._fear-20);this.showMessage('Item collected!',-20);}
    });
    if(typeof buildLevel==='function')buildLevel(this);
  }
  // ── helpers ─────────────────────────────────────────────────────────────
  addWall(x,y,w,h){
    const r=this.add.rectangle(x,y,w,h,0x333344).setDepth(1);
    this.physics.add.existing(r,true);r.body.setSize(w,h);
    this.walls.add(r);return r;
  }
  addEnemy(x,y,cfg={}){
    const e=this.enemies.create(x,y,'_enemy').setDepth(3);
    e._speed=cfg.speed??50;e._sight=cfg.sight??120;e._startX=x;e._startY=y;
    e._patrol=cfg.patrol??100;e._dir=cfg.dir??{x:1,y:0};
    e.body.setAllowGravity(false);
    return e;
  }
  addItem(x,y,type='key'){const i=this.items.create(x,y,'_item').setDepth(2);i._type=type;i.body.setAllowGravity(false);return i;}
  addExit(x,y){
    const ex=this.add.image(x,y,'_exit').setDepth(2);
    this.physics.add.existing(ex,true);
    this.physics.add.overlap(this.player,ex,()=>{if(!this.isOver&&!this.isWin)this.triggerWin();});
    return ex;
  }
  addFear(amount){
    this._fear=Math.min(this._maxFear,this._fear+amount);
    this._updateFearHUD();
    if(this._fear>=this._maxFear)this.triggerGameOver();
  }
  showMessage(msg,duration=2000){this.hudMsg.setText(msg);this.time.delayedCall(Math.abs(duration),()=>this.hudMsg.setText(''));}
  _updateFearHUD(){
    const filled=Math.round(this._fear/this._maxFear*10);
    this.hudFear.setText('Fear: '+'█'.repeat(filled)+'░'.repeat(10-filled));
  }
  triggerGameOver(){
    this.isOver=true;
    const cam=this.cameras.main;
    this.add.rectangle(cam.scrollX+W/2,cam.scrollY+H/2,W,H,0x000000,0.9).setDepth(25);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2-40,'YOU DIED',{fontSize:'54px',color:'#cc0000',fontStyle:'bold'}).setOrigin(0.5).setDepth(26);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2+30,'Press R to restart',{fontSize:'18px',color:'#666'}).setOrigin(0.5).setDepth(26);
    this.cameras.main.shake(500,0.02);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  triggerWin(){
    this.isWin=true;
    const cam=this.cameras.main;
    this.add.rectangle(cam.scrollX+W/2,cam.scrollY+H/2,W,H,0x000000,0.85).setDepth(25);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2-40,'YOU ESCAPED!',{fontSize:'48px',color:'#00ff88',fontStyle:'bold'}).setOrigin(0.5).setDepth(26);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2+30,'Press R to play again',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(26);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  _drawFlashlight(){
    const px=this.player.x-this.cameras.main.scrollX;
    const py=this.player.y-this.cameras.main.scrollY;
    const radius=130;
    this._darkness.clear();
    this._darkness.fillStyle(0x000000,0.88);
    this._darkness.fillRect(0,0,W,H);
    // Erase flashlight cone (draw spotlight via gradient workaround: just clear a circle)
    this._darkness.fillStyle(0x000000,0);
    // Use a radial cutout: multiple alpha layers
    for(let i=radius;i>0;i-=8){
      const alpha=0.88*(i/radius);
      this._darkness.fillStyle(0x000000,alpha);
      this._darkness.fillCircle(px,py,i);
    }
  }
  update(time,delta){
    if(this.isOver||this.isWin)return;
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const up=this.cursors.up.isDown||this.wasd.up.isDown;
    const down=this.cursors.down.isDown||this.wasd.down.isDown;
    const spd=120;
    this.player.setVelocity(right?spd:left?-spd:0,down?spd:up?-spd:0);
    // Face movement direction
    if(left||right||up||down)this.player.setRotation(Math.atan2(this.player.body.velocity.y,this.player.body.velocity.x)+Math.PI/2);
    this._drawFlashlight();
    // Passive fear drain/gain
    this._fear=Math.max(0,this._fear-0.02);this._updateFearHUD();
    if(typeof gameUpdate==='function')gameUpdate(this,time,delta);
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#0a0a0a',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── RPG Shell (top-down, 4-direction, dialog, combat) ────────────────────────

export const RPG_SHELL = HEAD + `
<script>
const W=800,H=500;
class GameScene extends Phaser.Scene{
  constructor(){super('GameScene')}
  create(){
    this.isOver=false;this.isWin=false;
    this._hp=10;this._maxHp=10;this._xp=0;this._level=1;this._gold=0;
    this._lastAttack=0;this._attackCooldown=600;this._dialog=false;
    // Groups
    this.walls=this.physics.add.staticGroup();
    this.enemies=this.physics.add.group();
    this.npcs=this.physics.add.group();
    this.items=this.physics.add.group();
    this.projectiles=this.physics.add.group();
    // Textures
    const mk=(n,w,h,fn)=>{const g=this.make.graphics({add:false});fn(g);g.generateTexture(n,w,h);g.destroy()};
    mk('_hero',22,28,g=>{g.fillStyle(0x4488ff);g.fillRect(0,0,22,28);g.fillStyle(0xffddaa);g.fillCircle(11,8,8)});
    mk('_wall',40,40,g=>{g.fillStyle(0x445544);g.fillRect(0,0,40,40)});
    mk('_floor',40,40,g=>{g.fillStyle(0x2a2a1e);g.fillRect(0,0,40,40);g.lineStyle(1,0x3a3a2e);g.strokeRect(0,0,40,40)});
    mk('_enemy',22,22,g=>{g.fillStyle(0xcc2200);g.fillRect(0,0,22,22);g.fillStyle(0xff4400,0.5);g.fillCircle(11,11,9)});
    mk('_npc',22,28,g=>{g.fillStyle(0xffdd44);g.fillRect(0,0,22,28);g.fillStyle(0xffeeaa);g.fillCircle(11,8,8)});
    mk('_item',18,18,g=>{g.fillStyle(0x44ccff);g.fillRect(0,0,18,18)});
    mk('_slash',16,16,g=>{g.fillStyle(0xffffff,0.8);g.fillCircle(8,8,8)});
    // Player
    this.player=this.physics.add.sprite(W/2,H/2,'_hero').setCollideWorldBounds(true).setDepth(5);
    // Input
    this.cursors=this.input.keyboard.createCursorKeys();
    this.wasd=this.input.keyboard.addKeys({up:'W',left:'A',right:'D',down:'S'});
    this.attackKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey=this.input.keyboard.addKey('E');
    // HUD
    this.hudHp=this.add.text(16,14,'HP: ♥♥♥♥♥♥♥♥♥♥',{fontSize:'15px',color:'#ff4444',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(20);
    this.hudXp=this.add.text(16,38,'XP: 0  Lv.1',{fontSize:'15px',color:'#44ddff',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(20);
    this.hudGold=this.add.text(16,60,'Gold: 0',{fontSize:'15px',color:'#ffdd44',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(20);
    this.hudMsg=this.add.text(W/2,H-36,'',{fontSize:'16px',color:'#fff',stroke:'#000',strokeThickness:3,backgroundColor:'#00000066',padding:{x:8,y:4}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(20);
    this.hudCtrl=this.add.text(W-12,H-12,'WASD: Move  Space: Attack  E: Talk',{fontSize:'12px',color:'#555'}).setOrigin(1,1).setScrollFactor(0).setDepth(20);
    // Camera
    this.cameras.main.startFollow(this.player,true,0.1,0.1);
    // Colliders
    this.physics.add.collider(this.player,this.walls);
    this.physics.add.collider(this.enemies,this.walls);
    this.physics.add.overlap(this.player,this.items,(pl,item)=>{
      item.destroy();
      if(typeof onItemPickup==='function')onItemPickup(this,item);
      else{this._gold+=5;this.hudGold.setText('Gold: '+this._gold);}
    });
    this.physics.add.overlap(this.enemies,this.projectiles,(e,p)=>{
      p.destroy();this._damageEnemy(e,2);
    });
    if(typeof buildLevel==='function')buildLevel(this);
  }
  // ── helpers ─────────────────────────────────────────────────────────────
  addWall(x,y,w,h){
    const r=this.add.rectangle(x,y,w,h,0x445544).setDepth(1);
    this.physics.add.existing(r,true);r.body.setSize(w,h);
    this.walls.add(r);return r;
  }
  addEnemy(x,y,cfg={}){
    const e=this.enemies.create(x,y,'_enemy').setDepth(4);
    e._hp=cfg.hp??4;e._maxHp=cfg.hp??4;e._speed=cfg.speed??60;e._dmg=cfg.dmg??1;e._xpReward=cfg.xp??5;e._goldReward=cfg.gold??2;
    e.body.setAllowGravity(false);e.setCollideWorldBounds(true);
    // HP bar
    e._hpBar=this.add.graphics().setDepth(4);
    return e;
  }
  addNpc(x,y,dialog){
    const n=this.npcs.create(x,y,'_npc').setDepth(4);
    n._dialog=dialog;n.body.setAllowGravity(false);n.body.setImmovable(true);
    this.add.text(x,y-30,'!',{fontSize:'16px',color:'#ffdd44',stroke:'#000',strokeThickness:3}).setDepth(5);
    return n;
  }
  addItem(x,y,type='potion'){const i=this.items.create(x,y,'_item').setDepth(3);i._type=type;i.body.setAllowGravity(false);return i;}
  _damageEnemy(e,dmg){
    e._hp-=dmg;
    // Update HP bar
    if(e._hpBar){e._hpBar.clear();e._hpBar.fillStyle(0xff0000);e._hpBar.fillRect(e.x-15,e.y-20,30*(e._hp/e._maxHp),4);}
    if(e._hp<=0){
      e._hpBar&&e._hpBar.destroy();e.destroy();
      this._xp+=e._xpReward||5;this._gold+=e._goldReward||2;
      this._checkLevelUp();
      this.hudXp.setText('XP: '+this._xp+'  Lv.'+this._level);
      this.hudGold.setText('Gold: '+this._gold);
      if(typeof onEnemyKill==='function')onEnemyKill(this,e);
    }
  }
  _checkLevelUp(){const threshold=this._level*20;if(this._xp>=threshold){this._level++;this._maxHp+=2;this._hp=this._maxHp;this._updateHpHUD();this.showMessage('Level Up! Lv.'+this._level);}}
  takeDamage(dmg){
    this._hp=Math.max(0,this._hp-dmg);this._updateHpHUD();
    this.cameras.main.shake(150,0.01);
    if(this._hp<=0)this.triggerGameOver();
  }
  heal(amount){this._hp=Math.min(this._maxHp,this._hp+amount);this._updateHpHUD();}
  _updateHpHUD(){const f=Math.ceil(this._hp/this._maxHp*10);this.hudHp.setText('HP: '+'♥'.repeat(f)+'♡'.repeat(10-f));}
  attack(){
    const vel=this.player.body.velocity;
    const dx=vel.x||0,dy=vel.y||(-1);
    const len=Math.sqrt(dx*dx+dy*dy)||1;
    const p=this.projectiles.create(this.player.x,this.player.y,'_slash');
    p.setVelocity(dx/len*350,dy/len*350);p.body.setAllowGravity(false);
    this.time.delayedCall(400,()=>p.active&&p.destroy());
  }
  showMessage(msg,duration=2500){this.hudMsg.setText(msg);this.time.delayedCall(duration,()=>this.hudMsg.setText(''));}
  triggerGameOver(){
    this.isOver=true;
    const cam=this.cameras.main;
    this.add.rectangle(cam.scrollX+W/2,cam.scrollY+H/2,W,H,0x000000,0.85).setDepth(25);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2-40,'GAME OVER',{fontSize:'54px',color:'#ff4444',fontStyle:'bold'}).setOrigin(0.5).setDepth(26);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2+30,'Press R to restart',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(26);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  triggerWin(){
    this.isWin=true;
    const cam=this.cameras.main;
    this.add.rectangle(cam.scrollX+W/2,cam.scrollY+H/2,W,H,0x000000,0.85).setDepth(25);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2-40,'VICTORY!',{fontSize:'54px',color:'#ffdd44',fontStyle:'bold'}).setOrigin(0.5).setDepth(26);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2+20,'Lv.'+this._level+' | Gold: '+this._gold,{fontSize:'22px',color:'#fff'}).setOrigin(0.5).setDepth(26);
    this.add.text(cam.scrollX+W/2,cam.scrollY+H/2+60,'Press R to play again',{fontSize:'18px',color:'#aaa'}).setOrigin(0.5).setDepth(26);
    this.input.keyboard.once('keydown-R',()=>{if(typeof gameRestart==='function')gameRestart();this.scene.restart()});
  }
  update(time,delta){
    if(this.isOver||this.isWin)return;
    const left=this.cursors.left.isDown||this.wasd.left.isDown;
    const right=this.cursors.right.isDown||this.wasd.right.isDown;
    const up=this.cursors.up.isDown||this.wasd.up.isDown;
    const down=this.cursors.down.isDown||this.wasd.down.isDown;
    const spd=150;
    this.player.setVelocity(right?spd:left?-spd:0,down?spd:up?-spd:0);
    if(Phaser.Input.Keyboard.JustDown(this.attackKey)&&time-this._lastAttack>this._attackCooldown){
      this._lastAttack=time;this.attack();
    }
    // Interact
    if(Phaser.Input.Keyboard.JustDown(this.interactKey)){
      this.npcs.getChildren().forEach(n=>{
        if(Phaser.Math.Distance.Between(this.player.x,this.player.y,n.x,n.y)<50){
          this.showMessage(n._dialog||'...',3000);
          if(typeof onNpcTalk==='function')onNpcTalk(this,n);
        }
      });
    }
    // Enemy AI: move toward player
    this.enemies.getChildren().forEach(e=>{
      if(!e.active)return;
      const dx=this.player.x-e.x,dy=this.player.y-e.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<200){const len=dist||1;e.setVelocity(dx/len*e._speed,dy/len*e._speed);}
      else e.setVelocity(0,0);
      if(dist<24&&time-this._lastDmg>800){this._lastDmg=time;this.takeDamage(e._dmg||1);}
      if(e._hpBar)e._hpBar.clear().fillStyle(0xff0000).fillRect(e.x-15,e.y-20,30*(e._hp/e._maxHp),4);
    });
    if(typeof gameUpdate==='function')gameUpdate(this,time,delta);
  }
}
new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#1a1a0a',
  physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:[GameScene]});
<\/script>` + FOOT;

// ── Shell registry ───────────────────────────────────────────────────────────

export const PHASER_SHELLS: Record<string, string> = {
  Platformer: PLATFORMER_SHELL,
  Adventure: PLATFORMER_SHELL,
  Fantasy: PLATFORMER_SHELL,
  Shooter: SHOOTER_SHELL,
  // 3D-only genres that can also be requested as 2D — map to nearest equivalent
  "Space Shooter": SHOOTER_SHELL,
  Racing: RACING_SHELL,
  Puzzle: PUZZLE_SHELL,
  Horror: HORROR_SHELL,
  "FP Horror": HORROR_SHELL,
  RPG: RPG_SHELL,
};

export const DEFAULT_PHASER_SHELL = PLATFORMER_SHELL;

