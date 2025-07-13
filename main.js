/* ───────────────────────── CONFIG ───────────────────────── */
const COLS = 8, ROWS = 6;               // 8 × 6 = 48 pieces
const SNAP_SLOT = 30, SNAP_PIE = 12;    // snapping tolerances

const CANVAS_W = 1400, CANVAS_H = 840;

const BOARD_X = 20,  BOARD_Y = 80;
const BOARD_W = 800, BOARD_H = 600;

const PIE_W = BOARD_W / COLS;
const PIE_H = BOARD_H / ROWS;

/* ──────────────────────── NICKNAME ─────────────────────── */
const NICK_MAX = 12;
let nickname = localStorage.getItem('ij_nick') || null;

/* ─────────────────────── PHASER GAME ───────────────────── */
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#2c2c2c',
  scale: { width: CANVAS_W, height: CANVAS_H, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create }
};
new Phaser.Game(config);

/* ───────────────────────── Globals ─────────────────────── */
let scene;
let pieces = [], groups = [], placedCount = 0;
/* HUD & stats */
let hudText, timerEvent, startTime, timeElapsed, moves;
/* Ghost hint */
let ghostSprite = null, ghostVisible = false;
let eyeIcon = null, eyeLabel = null;

/* ───────────────────────── PRELOAD ─────────────────────── */
function preload() { this.load.image('puzzle', 'assets/IRYS.jpg'); }

/* ───────────────────────── CREATE ──────────────────────── */
function create() {
  scene = this;

  /* board outline */
  this.add.graphics().lineStyle(2, 0xffffff, 0.25)
      .strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

  /* H key toggles hint */
  this.input.keyboard.on('keydown-H', () => toggleGhost());

  /* title overlay, then prompt for nickname, then start puzzle */
  showTitleOverlay(() => promptNickname(buildPieces));
}

/* ─────────────────── TITLE OVERLAY ─────────────────────── */
function showTitleOverlay(done) {
  const backdrop = scene.add.rectangle(
      CANVAS_W/2, CANVAS_H/2, CANVAS_W, CANVAS_H, 0x000000, 0.85
    ).setDepth(5).setInteractive();

  const hero = scene.add.image(CANVAS_W/2, CANVAS_H/2 - 20, 'puzzle')
    .setDepth(5).setAlpha(0.35);
  hero.setScale(Math.max(BOARD_W/hero.width, BOARD_H/hero.height) * 1.35);

  const title = scene.add.text(
      CANVAS_W/2, CANVAS_H/2 - 200, 'IRYS JIGSAW',
      { font: '76px Arial Black', fill: '#ff89ff',
        stroke: '#ffffff', strokeThickness: 5 }
    ).setOrigin(0.5).setDepth(6);

  const play = scene.add.text(
      CANVAS_W/2, CANVAS_H/2 + 150, '▶ Play',
      { font: '42px Arial', fill: '#ffffff',
        backgroundColor: '#ff5e9c', padding: { x: 20, y: 8 } }
    ).setOrigin(0.5).setDepth(6).setInteractive();
  play.on('pointerover', () => play.setStyle({ backgroundColor: '#ff84b8' }));
  play.on('pointerout',  () => play.setStyle({ backgroundColor: '#ff5e9c' }));

  const dismiss = () => { [backdrop, hero, title, play].forEach(o => o.destroy()); done(); };
  backdrop.on('pointerup', dismiss);
  play.on('pointerup',    dismiss);
}

/* ─────────────────── SIMPLE NICKNAME PROMPT ───────────── */
function promptNickname(next) {
  if (nickname) { next(); return; }

  let ok = false, val = '';
  while (!ok) {
    val = window.prompt('Enter a nickname (3–12 ASCII characters):', '');
    if (val === null) continue;               // user pressed Cancel
    val = val.trim();
    ok = /^[\x00-\x7F]{3,12}$/.test(val);
    if (!ok) window.alert('Nickname must be 3–12 ASCII characters.');
  }
  nickname = val;
  localStorage.setItem('ij_nick', nickname);
  next();
}

/* ─────────────────── HUD & GHOST ───────────────────────── */
function createHUD() {
  if (hudText) hudText.destroy();
  hudText = scene.add.text(
      20, 20,
      `${nickname} • Time 00:00  ·  Moves 0`,
      { font: '24px Arial', fill: '#ffffff' }
    ).setDepth(2);

  placeHintToggle();
}

function placeHintToggle() {
  const eyeX = hudText.x + hudText.width + 20;
  if (eyeIcon) eyeIcon.destroy();
  if (eyeLabel) eyeLabel.destroy();

  eyeIcon = scene.add.text(eyeX, 20, '👁',
            { font: '28px Arial', fill: '#ffffff' })
          .setInteractive().setDepth(2);
  eyeLabel = scene.add.text(eyeX + 32, 22, 'Hint',
            { font: '22px Arial', fill: '#ffffff' })
          .setInteractive().setDepth(2);

  eyeIcon.on('pointerup',  toggleGhost);
  eyeLabel.on('pointerup', toggleGhost);
}

function updateHUD() {
  const mm = String(Math.floor(timeElapsed/60)).padStart(2,'0');
  const ss = String(timeElapsed%60).padStart(2,'0');
  hudText.setText(`${nickname} • Time ${mm}:${ss}  ·  Moves ${moves}`);
  placeHintToggle();   // ensure icon keeps up with width changes
}

function createGhost() {
  if (ghostSprite) ghostSprite.destroy();
  ghostSprite = scene.add.image(
      BOARD_X + BOARD_W/2, BOARD_Y + BOARD_H/2, 'puzzle'
    ).setDisplaySize(BOARD_W, BOARD_H).setAlpha(0).setDepth(0);
  ghostVisible = false;
  eyeIcon.setStyle({ fill: '#ffffff' });
  eyeLabel.setStyle({ fill: '#ffffff' });
}

function toggleGhost() {
  ghostVisible = !ghostVisible;
  ghostSprite.setAlpha(ghostVisible ? 0.25 : 0);
  const col = ghostVisible ? '#ffeb3b' : '#ffffff';
  eyeIcon.setStyle({ fill: col });
  eyeLabel.setStyle({ fill: col });
}

function startTimer() {
  if (timerEvent) return;
  startTime = scene.time.now;
  timerEvent = scene.time.addEvent({
    delay: 1000, loop: true,
    callback: () => { timeElapsed = Math.floor((scene.time.now - startTime)/1000); updateHUD(); }
  });
}

/* ─────────────────── BUILD PIECES ───────────────────────── */
function buildPieces() {
  /* reset stats */
  if (timerEvent) timerEvent.remove(false);
  [timerEvent, timeElapsed, moves, placedCount] = [null, 0, 0, 0];
  pieces = []; groups = [];

  createHUD();
  createGhost();

  const src = scene.textures.get('puzzle').getSourceImage();
  const sx = src.width / COLS, sy = src.height / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;

      /* slice */
      const cv = document.createElement('canvas');
      cv.width = PIE_W; cv.height = PIE_H;
      cv.getContext('2d').drawImage(src, c*sx, r*sy, sx, sy, 0, 0, PIE_W, PIE_H);
      scene.textures.addCanvas(`piece${id}`, cv);

      /* scatter */
      const px = Phaser.Math.Between(BOARD_X + BOARD_W + 40, CANVAS_W - PIE_W/2);
      const py = Phaser.Math.Between(40, CANVAS_H - PIE_H/2);

      const spr = scene.add.image(px, py, `piece${id}`)
        .setInteractive({ draggable: true })
        .setData({ row: r, col: c, id })
        .setDepth(1);

      pieces[id] = { sprite: spr, row: r, col: c };
      groups[id] = [id];

      spr.on('dragstart', () => bringGroupToTop(id));
      spr.on('drag',      (p,x,y) => moveGroup(id,x,y));
      spr.on('dragend',   () => handleDrop(id));
    }
  }
}

/* ─────────────────── GROUP HELPERS ─────────────────────── */
const getGroup = idx => groups.find(g => g.includes(idx));

function bringGroupToTop(idx){ getGroup(idx).forEach(i => pieces[i].sprite.setDepth(1)); }

function moveGroup(idx,x,y){
  const grp=getGroup(idx), lead=pieces[idx].sprite, dx=x-lead.x, dy=y-lead.y;
  grp.forEach(i => { const s = pieces[i].sprite; s.x += dx; s.y += dy; });
}

function handleDrop(idx){
  startTimer(); moves++; updateHUD();
  const grp=getGroup(idx);

  /* board snap */
  let near=true;
  grp.forEach(i=>{
    const p=pieces[i];
    const tx=BOARD_X+PIE_W/2+p.col*PIE_W;
    const ty=BOARD_Y+PIE_H/2+p.row*PIE_H;
    if(Phaser.Math.Distance.Between(p.sprite.x,p.sprite.y,tx,ty)>SNAP_SLOT) near=false;
  });
  if(near){
    grp.forEach(i=>{
      const p=pieces[i];
      const tx=BOARD_X+PIE_W/2+p.col*PIE_W;
      const ty=BOARD_Y+PIE_H/2+p.row*PIE_H;
      p.sprite.setPosition(tx,ty).disableInteractive().setDepth(1);
    });
    placedCount += grp.length;
    groups = groups.filter(g => g !== grp);
    if(placedCount === COLS*ROWS) showWinModal();
    return;
  }
  tryMergeGroup(idx);
}

/* ─────────────────── MERGE LOGIC ───────────────────────── */
function tryMergeGroup(idx){
  const grpA=getGroup(idx);
  grpA.forEach(i=>{
    const a=pieces[i];
    ['left','right','up','down'].forEach(dir=>{
      const nr = dir==='up'?a.row-1 : dir==='down'?a.row+1 : a.row;
      const nc = dir==='left'?a.col-1 : dir==='right'?a.col+1 : a.col;
      if(nr<0||nr>=ROWS||nc<0||nc>=COLS) return;

      const nb = nr*COLS + nc;
      const grpB = getGroup(nb);
      if(grpA === grpB) return;

      const b = pieces[nb];
      const wantDX = (nc - a.col) * PIE_W;
      const wantDY = (nr - a.row) * PIE_H;
      const realDX = b.sprite.x - a.sprite.x;
      const realDY = b.sprite.y - a.sprite.y;

      if(Math.abs(realDX-wantDX)<SNAP_PIE && Math.abs(realDY-wantDY)<SNAP_PIE){
        const shiftX = wantDX - realDX, shiftY = wantDY - realDY;
        grpB.forEach(k => { const s = pieces[k].sprite; s.x += shiftX; s.y += shiftY; });
        grpA.push(...grpB);
        groups = groups.filter(g => g !== grpB);
      }
    });
  });
}

/* ─────────────────── WIN POP-UP ────────────────────────── */
function showWinModal(){
  if(timerEvent) timerEvent.remove(false);
  window.scrollTo({top:0,behavior:'smooth'});

  scene.add.rectangle(CANVAS_W/2,CANVAS_H/2,520,280,0x000000,0.80)
       .setStrokeStyle(2,0xffffff);

  scene.add.image(CANVAS_W/2,CANVAS_H/2-50,'puzzle')
       .setDepth(1).setScale(0.4);

  const mm = String(Math.floor(timeElapsed/60)).padStart(2,'0');
  const ss = String(timeElapsed%60).padStart(2,'0');
  scene.add.text(
      CANVAS_W/2,CANVAS_H/2+40,
      `${nickname}\n${mm}:${ss} • ${moves} moves`,
      {font:'28px Arial',fill:'#ffeb3b',align:'center'}
    ).setOrigin(0.5);

  const replay = scene.add.text(
      CANVAS_W/2,CANVAS_H/2+120,
      '↻  Replay',
      {font:'32px Arial',fill:'#ffffff',
       backgroundColor:'#ff5e9c',padding:{x:20,y:8}}
    ).setOrigin(0.5).setDepth(100).setInteractive();
  replay.on('pointerover',()=>replay.setStyle({backgroundColor:'#ff84b8'}));
  replay.on('pointerout', ()=>replay.setStyle({backgroundColor:'#ff5e9c'}));
  replay.on('pointerup',  ()=>scene.scene.restart());

  scene.add.particles('puzzle').createEmitter({
    x:CANVAS_W/2,y:BOARD_Y,
    speed:{min:200,max:400},
    angle:{min:180,max:360},
    scale:{start:0.1,end:0},
    lifespan:1000,
    quantity:40,
    blendMode:'ADD'
  }).explode(40,CANVAS_W/2,BOARD_Y+20);

  submitScore({ nickname, moves, time: timeElapsed });
}

/* ─────────────────── SUBMIT SCORE ─────────────────────── */
function submitScore(data){
  fetch('/.netlify/functions/score',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
  }).catch(()=>{ /* ignore if endpoint missing */ });
}
