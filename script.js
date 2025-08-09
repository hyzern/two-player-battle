/*

 * Two‑player arena combat game.
 *
 * This script implements a simple arena battle between two characters.  Each
 * player can jump and fire a projectile.  Jumping and firing consume
 * mana; mana regenerates over time.  Hitting an opponent with a projectile
 * reduces their health.  The first player to win two rounds wins the match.
 *
 * Controls:
 *   Player 1 (left side):
 *     Jump  – W key
 *     Fire  – F key
 *   Player 2 (right side):
 *     Jump  – ArrowUp key
 *     Fire  – L key
 *
 * The game is drawn on an HTML5 canvas.  When the page loads all of the
 * images used by the UI are loaded asynchronously; once they are ready the
 * game loop begins.
 */

// Grab the canvas and 2D drawing context
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Image assets used by the UI.  These files are stored alongside this
// script.  Additional character portraits are loaded later as part
// of the CHAR_DATA definition below.  We track the number of images
// loaded so that the character selection overlay shows correct
// images before the game begins.  Images do not automatically start
// the game; the user selects a character first.
const imgJump  = new Image();
c
  onst imgFire  = new Image();
imgJump.src    = 'jump button.png';
imgFire.src    = 'fire button.png';

// Track how many images have loaded.  When all required assets are
// ready we enable the character selection screen.  The total count
// will be updated after declaring the CHAR_DATA object.
let imagesLoaded = 0;
let totalImagesToLoad = 0;
function onImageLoad() {
  imagesLoaded++;
  // When all images have loaded and the character selection overlay
  // exists we can enable interaction (handled in init()).
  if (imagesLoaded === totalImagesToLoad) {
    imagesReady = true;
    // Hide the loading overlay now that all assets are ready.  We
    // guard with a null check in case the element is not present.
    const loading = document.getElementById('loading-screen');
    if (loading) {
      loading.style.display = 'none';
    }
  }
}
imgJump.onload = onImageLoad;
imgFire.onload = onImageLoad;

// ---------------------------------------------------------------------
// Character definitions and image assets.  Each playable hero is
// described here with their name, portrait file and gameplay stats.
// Stats are applied to the player when the character is selected.
// Ultimate values come into play once the character's HP drops below
// half; holding the fire button for the specified wind‑up launches
// the ultimate.
const CHAR_DATA = {
  rudo: {
    name: 'Rudo Ben',
    file: 'rudo ben 123.png',
    // Base movement/attack values
    jumpVelocity: -900,     // Upwards jump velocity
    fireCooldown: 0.50,     // Seconds between normal shots
    projectileSpeed: 520,   // Pixels per second
    projectileDamage: 16,
    projectileSize: 1.0,
    // Ultimate values
    ultDamage: 44,
    ultSpeed: 740,
    ultWindup: 0.9,
    ultSize: 1.0,
    // Dodge/jump cooldown
    jumpCooldown: 2.5,
    // Defend durations (in seconds)
    defendDuration: 1.0,
    defendCooldown: 2.0
  },
  cenno: {
    name: 'Cenno Kio',
    file: 'Cenno Kio123.png',
    jumpVelocity: -850,
    fireCooldown: 0.35,
    projectileSpeed: 440,
    projectileDamage: 13,
    projectileSize: 1.25,
    ultDamage: 42,
    ultSpeed: 640,
    ultWindup: 1.1,
    ultSize: 1.25,
    jumpCooldown: 2.5,
    defendDuration: 1.0,
    defendCooldown: 2.0
  },
  vian: {
    name: 'Vian Naru',
    file: 'Vian Naru 123.png',
    jumpVelocity: -900,
    fireCooldown: 0.28,
    projectileSpeed: 680,
    projectileDamage: 12,
    projectileSize: 0.9,
    ultDamage: 41,
    ultSpeed: 700,
    ultWindup: 1.0,
    ultSize: 0.9,
    jumpCooldown: 2.0,
    defendDuration: 1.0,
    defendCooldown: 2.0
  }
};

// Load character portraits.  Count them towards the total images to
// load so that the character selection overlay only becomes active
// after all portraits are ready.  Each portrait is stored on the
// corresponding CHAR_DATA entry as `sprite`.
for (const key of Object.keys(CHAR_DATA)) {
  const img = new Image();
  img.src = CHAR_DATA[key].file;
  CHAR_DATA[key].sprite = img;
  totalImagesToLoad++;
  img.onload = onImageLoad;
}
// Also count jump and fire images in the total to load
totalImagesToLoad += 2;


// Once all images are ready this flag becomes true.  init() uses
// it to enable the selection overlay.
let imagesReady = false;

// ---------------------------------------------------------------------
// Player class.  Encapsulates the state and behaviour of each character.
cl
  ass Player {
  /**
   * Create a new player.
   * @param {number} x         Horizontal position on the canvas (top left)
   * @param {string} name      Display name
   * @param {HTMLImageElement} image Sprite used to draw this player
   * @param {number} direction +1 for projectiles moving right, −1 for left
   */
  constructor(x, name, image, direction, characterKey) {
    // Horizontal and vertical positions
    this.x = x;
    this.y = 0;
    this.startY = 0;
    this.vy = 0;
    // Visual dimensions.  These are overriden when drawing using
    // character sprite sizes (the art is square-ish but scaled here).
    this.width  = 180;
    this.height = 220;
    // Set the character definition.  The key refers to the entry in
    // CHAR_DATA which contains stats and the sprite.
    this.characterKey = characterKey;
    const charDef = CHAR_DATA[characterKey];
    this.name   = charDef.name;
    this.image  = charDef.sprite;
    this.direction = direction;
    // Stats and HP
    
    this.maxHp = 100;
    this.hp    = 100;
    this.wins  = 0;
    // Timers and state flags
    this.fireCooldownTimer = 0;
    this.jumpCooldownTimer = 0;
    this.defendTimer       = 0;
    this.defendCooldownTimer = 0;
    this.isDefending = false;
    this.firePressed = false;
    this.fireHoldTime = 0;
    this.ultimateReady = false;
    this.ultimateUsed  = false;
    // When the player jumps they become invulnerable to ultimate
    // projectiles for a short duration.  This timer counts down
    // after a dodge and is used to implement the RPS logic where
    // dodging beats ultimate attacks.  See updateWorld() for usage.
    this.invulnerableTimer = 0;
    // Assigned after player list creation
    this.index = 0;
  }
  /**
   * Attempt to make the player jump.  Only possible if on the ground and
   * sufficient mana is available.
   */
  jump() {
    const stats = CHAR_DATA[this.characterKey];
    // Determine configuration overrides for this player.  If a value
    // exists in the per‑player config object use it; otherwise fall
    // back to the character definition.  The index property is set
    // after players are created (0 for Player 1, 1 for Player 2).
    const cfgKey = 'p' + (this.index + 1);
    const cfg = config[cfgKey] || {};
    // Jump only if on the ground and the jump cooldown has expired
    if (this.vy === 0 && this.jumpCooldownTimer <= 0) {
      // Use override values if present
      const jumpVel = (cfg.jumpVelocity !== undefined ? cfg.jumpVelocity : stats.jumpVelocity);
      const jumpCd  = (cfg.jumpCooldown !== undefined ? cfg.jumpCooldown : stats.jumpCooldown);
      this.vy = jumpVel;
      this.jumpCooldownTimer = jumpCd;
      // Set a brief invulnerability window so that jumping can dodge
      // ultimate attacks.  Normal projectiles will still hit if
      // timed correctly.  The duration here (0.3s) is tuned for
      // responsiveness and can be adjusted via stats if desired.
      this.invulnerableTimer = 0.3;
      // Play a short jump sound
      playTone(523.25, 0.05, 'triangle');
    }
  }
  /**
   * Attempt to fire a projectile.  Only possible if sufficient mana
   * is available.  The projectile direction is determined by this.direction.
   */
  fire() {
    // Old fire method retained for backward compatibility.  It simply
    // calls fireNormal().  New logic is implemented in fireNormal()
    // and fireUltimate().  External code should call startFire()
    // followed by stopFire() instead of this method.
    this.fireNormal();
  }

  /**
   * Fire a normal projectile.  Uses the character's stats for speed,
   * damage and size.  Enforces the fire cooldown.
   */
  fireNormal() {
    const stats = CHAR_DATA[this.characterKey];
    if (this.fireCooldownTimer > 0) return;
    // Determine configuration overrides for this player
    const cfgKey = 'p' + (this.index + 1);
    const cfg = config[cfgKey] || {};
    const speed  = (cfg.projectileSpeed  !== undefined ? cfg.projectileSpeed  : stats.projectileSpeed);
    const damage = (cfg.projectileDamage !== undefined ? cfg.projectileDamage : stats.projectileDamage);
    const size   = (cfg.projectileSize   !== undefined ? cfg.projectileSize   : stats.projectileSize);
    const cooldown = (cfg.fireCooldown   !== undefined ? cfg.fireCooldown   : stats.fireCooldown);
    const spawnY = this.y + this.height * 0.5;
    const spawnX = this.direction === 1 ? this.x + this.width : this.x;
    projectiles.push(new Projectile(spawnX, spawnY, this.direction, this, {
      speed: speed,
      damage: damage,
      size: size,
      isUltimate: false,
      linger: 0,
      ghost: false,
      delay: 0
    }));
    this.fireCooldownTimer = cooldown;
    playTone(659.25, 0.05, 'square');
  }

  /**
   * Launch the ultimate attack if ready.  Spawns different projectiles
   * depending on the character.  After firing, the ultimate is no
   * longer available for the remainder of the round.
   */
  fireUltimate() {
    if (!this.ultimateReady || this.ultimateUsed) return;
    const stats = CHAR_DATA[this.characterKey];
    const spawnY = this.y + this.height * 0.5;
    const spawnX = this.direction === 1 ? this.x + this.width : this.x;
    if (this.characterKey === 'vian') {
      const delay = 0.12;
      for (let i = 0; i < 2; i++) {
        projectiles.push(new Projectile(spawnX, spawnY, this.direction, this, {
          speed: stats.ultSpeed,
          damage: 0,
          size: stats.ultSize,
          isUltimate: true,
          linger: 0,
          ghost: true,
          delay: i * delay
        }));
      }
      projectiles.push(new Projectile(spawnX, spawnY, this.direction, this, {
        speed: stats.ultSpeed,
        damage: stats.ultDamage,
        size: stats.ultSize,
        isUltimate: true,
        linger: 0,
        ghost: false,
        delay: 2 * delay
      }));
    } else if (this.characterKey === 'cenno') {
      projectiles.push(new Projectile(spawnX, spawnY, this.direction, this, {
        speed: stats.ultSpeed,
        damage: stats.ultDamage,
        size: stats.ultSize,
        isUltimate: true,
        linger: 0.15,
        ghost: false,
        delay: 0
      }));
    } else {
      // Rudo
      projectiles.push(new Projectile(spawnX, spawnY, this.direction, this, {
        speed: stats.ultSpeed,
        damage: stats.ultDamage,
        size: stats.ultSize,
        isUltimate: true,
        linger: 0,
        ghost: false,
        delay: 0
      }));
    }
    this.ultimateUsed = true;
    this.ultimateReady = false;
    playTone(329.63, 0.1, 'sawtooth');
  }

  /**
   * Begin holding the fire button.  This starts accumulating
   * time to determine whether to fire an ultimate.
   */
  startFire() {
    this.firePressed = true;
    this.fireHoldTime = 0;
  }

  /**
   * Stop holding the fire button.  Determines whether to fire
   * a normal or ultimate projectile based on hold time and
   * readiness.
   */
  stopFire() {
    const stats = CHAR_DATA[this.characterKey];
    if (this.firePressed) {
      if (this.ultimateReady && !this.ultimateUsed && this.fireHoldTime >= stats.ultWindup) {
        this.fireUltimate();
      } else {
        this.fireNormal();
      }
    }
    this.firePressed = false;
    this.fireHoldTime = 0;
  }

  /**
   * Update timers controlling cooldowns and statuses.  Called each frame.
   */
  updateTimers(dt) {
    const stats = CHAR_DATA[this.characterKey];
    if (this.fireCooldownTimer > 0) this.fireCooldownTimer -= dt;
    if (this.jumpCooldownTimer > 0) this.jumpCooldownTimer -= dt;
    if (this.defendCooldownTimer > 0) this.defendCooldownTimer -= dt;
    if (this.firePressed) this.fireHoldTime += dt;
    if (this.isDefending) {
      this.defendTimer += dt;
      if (this.defendTimer >= stats.defendDuration) {
        this.isDefending = false;
        this.defendCooldownTimer = stats.defendCooldown;
      }
    }
    // Decay the invulnerability window after a dodge.  When this
    // reaches zero the player can be hit by ultimate attacks again.
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer < 0) this.invulnerableTimer = 0;
    }
    // Determine ultimate readiness based on HP threshold
    if (!this.ultimateUsed && this.hp <= this.maxHp * 0.5) {
      this.ultimateReady = true;
    }
  }
}

// Projectile class.  Projectiles travel horizontally at a fixed speed.
class Projectile {
  /**
   * @param {number} x   Starting x position
   * @param {number} y   Starting y position
   * @param {number} dir Direction: +1 for rightwards, −1 for leftwards
   * @param {Player} owner Player who fired this projectile
   */
  constructor(x, y, dir, owner, opts = {}) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.owner = owner;
    // Options with sensible defaults
    this.speed    = opts.speed    !== undefined ? opts.speed    : 600;
    this.damage   = opts.damage   !== undefined ? opts.damage   : 10;
    this.size     = opts.size     !== undefined ? opts.size     : 1.0;
    this.isUltimate = opts.isUltimate || false;
    this.linger   = opts.linger   || 0;
    this.ghost    = opts.ghost    || false;
    this.delay    = opts.delay    || 0;
    // Internal timers
    this.elapsed  = 0;
    this.lingerRemaining = 0;
    this.radius   = 8 * this.size;
    this.lifespan = 3;
  }
  update(delta) {
    this.elapsed += delta;
    // Wait until delay has passed before moving
    if (this.elapsed < this.delay) return;
    // If lingering, remain in place and reduce linger time
    if (this.lingerRemaining > 0) {
      this.lingerRemaining -= delta;
      return;
    }
    this.x += this.dir * this.speed * delta;
  }
  /**
   * Check collision with a player.  We shrink the player's bounding box by
   * horizontal and vertical margins to better approximate the vulnerable
   * portion of the sprite.  This avoids spurious hits when a projectile
   * grazes the front or back of a character or clips empty space above the
   * head after they jump.  See HITBOX_MARGIN_X_RATIO and
   * HITBOX_MARGIN_Y_RATIO for the exact margins.
   *
   * @param {Player} player Target player
   * @returns {boolean} True if this projectile overlaps the player's hitbox
   */
  collides(player) {
    // Compute horizontal and vertical margins to shrink the raw sprite
    // dimensions.  These margins exclude portions of the image that are
    // mostly empty or decorative (e.g. feathers or antlers).  Values are
    // taken from the global configuration so that testers can adjust them.
    const marginX = player.width * config.hitboxMarginX;
    const marginY = player.height * config.hitboxMarginY;
    // Determine the forward-facing region of the character.  When facing
    // right (direction === 1) the forward side is the right half; when
    // facing left it is the left half.  The FRONT_HIT_RATIO defines how
    // much of the sprite counts as the front.  We compute a pair of
    // horizontal bounds (fx1, fx2) representing this region before
    // applying the collision margins.
    let fx1, fx2;
    if (player.direction === 1) {
      // Facing right: front is the right portion
      fx1 = player.x + player.width * (1 - config.frontHitRatio);
      fx2 = player.x + player.width;
    } else {
      // Facing left: front is the left portion
      fx1 = player.x;
      fx2 = player.x + player.width * config.frontHitRatio;
    }
    // Apply margins: clamp the forward region by marginX on both sides to
    // further narrow the vulnerable area.  We combine the front region
    // and margins to yield the final horizontal bounds px1..px2.
    const px1 = Math.max(fx1 + marginX, player.x + marginX);
    const px2 = Math.min(fx2 - marginX, player.x + player.width - marginX);
    // Vertical bounds are symmetric regardless of facing direction.
    const py1 = player.y + marginY;
    const py2 = player.y + player.height - marginY;
    // Bounding circle vs axis aligned rectangle test: check whether the
    // projectile’s circle intersects the rectangle defined above.  We
    // perform a simple overlap check by comparing the projectile’s
    // extents against the rectangle edges.  If both horizontal and
    // vertical extents overlap there is a collision.
    const withinX = this.x + this.radius > px1 && this.x - this.radius < px2;
    const withinY = this.y + this.radius > py1 && this.y - this.radius < py2;
    return withinX && withinY;
  }
}

// Particle class used for simple explosion effects when projectiles
// collide with players.  Each particle has a velocity and fades
// gradually over its lifetime.
class Particle {
  /**
   * Create a particle for explosion or confetti.
   * @param {number} x        Initial x position
   * @param {number} y        Initial y position
   * @param {string} color    Base colour of the particle
   * @param {number} life     Lifetime in seconds (optional; default 0.4)
   * @param {number} size     Radius in pixels (optional; default 4)
   */
  constructor(x, y, color, life = 0.4, size = 4) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 400;
    this.vy = (Math.random() - 0.5) * 400;
    this.life = life;
    this.remaining = life;
    this.color = color;
    this.size = size;
  }
  update(delta) {
    this.remaining -= delta;
    if (this.remaining < 0) this.remaining = 0;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
  }
  draw(ctx) {
    const alpha = this.remaining / this.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Global game state variables
let players;
let projectiles;
let roundTimer;
let roundStartTime;
let gameState;
let roundOverTimer;
let winningPlayer = null;
// Countdown timer shown at the start of each round.  When greater than
// zero the game is in a pre‑play state and a 3–2–1–Go animation is
// displayed.  Once the timer reaches zero the round begins.
let countdownTimer = 0;
// Duration of the KO animation.  When greater than zero a large "KO!"
// indicator is drawn in the centre of the screen.  It decays over
// time until disappearing.
let koTimer = 0;

// When true the game world stops updating, allowing testers to tweak
// configuration values without the action progressing.  The scene is still
// drawn each frame.  Toggled via the pause button in the debug panel or
// the 'P' key on the keyboard.
let paused = false;

// Background star field.  An array of objects with positions,
// radii and phases used to create a subtle twinkling effect.
let stars = [];

// Array of particles for visual effects (e.g. explosion on hit)
let particles = [];

// Audio context and helper functions for simple sound effects.  Many
// browsers require a user interaction before audio can play, so we
// resume the context on the first input event.
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

// Flag to ensure the background music starts only once
let musicStarted = false;

/**
 * Play a short tone.  Using oscillators allows us to synthesise sound
 * effects without external files.  You can adjust the frequency,
 * waveform and duration to taste.
 * @param {number} freq Frequency of the tone in hertz
 * @param {number} duration Duration in seconds
 * @param {string} type Waveform type ('sine', 'square', 'sawtooth', 'triangle')
 */
function playTone(freq = 440, duration = 0.1, type = 'sine') {
  // Skip if audio context isn’t available or has been closed
  if (!audioCtx || audioCtx.state === 'closed') return;
  const oscillator = audioCtx.createOscillator();
  const gainNode   = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

/**
 * Begin playing a looping background melody.  This uses a simple
 * repeating sequence of pitches to provide atmosphere without
 * requiring external audio files.  The music will only start once
 * the user interacts with the game (see resumeAudio).  The
 * playback interval is stored so it can persist across rounds.
 */
function startBackgroundMusic() {
  if (musicStarted) return;
  musicStarted = true;
  const melody = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
  let i = 0;
  setInterval(() => {
    playTone(melody[i % melody.length], 0.2, 'sine');
    i++;
  }, 450);
}

/**
 * Resume the audio context on the first user interaction.  Without this
 * browsers such as Chrome will refuse to play any audio.
 */
function resumeAudio() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  // Start the background melody once audio can play
  startBackgroundMusic();
}

// Constants controlling game mechanics
const MAX_HP    = 100;
const GRAVITY   = 35; // downward acceleration in pixels per second squared

// When debugging collisions you can enable hitbox rendering.  Setting this
// flag to true will draw rectangles around the player hitboxes and circles
// around projectiles so you can visualise exactly where collisions occur.
const SHOW_HITBOX = true;

// NOTE: The collision margins and front hit ratio have been moved into the
// configurable `config` object below so that testers can adjust them in
// real‑time via the debug panel.  The definitions here are retained for
// reference but are no longer used directly.

// Tunable gameplay parameters.  These values are grouped into per‑player
// sections so that each character can be tuned independently.  Global
// settings (such as round duration and hitbox shape) live alongside the
// player sections.  Values are editable in real‑time via the debug panel.
const config = {
  // Player‑specific configuration.  Each sub‑object contains the core
  // parameters controlling movement, attacks and resource consumption for
  // that fighter.  Note that jumpVelocity is stored as a negative value to
  // indicate upward motion.  Fire cooldown controls how often a player
  // may fire regardless of mana (seconds).
  p1: {
    jumpVelocity: -15,
    jumpCooldown: 2.5,
    fireCooldown: 0.4,
    projectileSpeed: 600,
    projectileDamage: 15,
    projectileSize: 1.0
  },
  p2: {
    jumpVelocity: -15,
    jumpCooldown: 2.5,
    fireCooldown: 0.4,
    projectileSpeed: 600,
    projectileDamage: 15,
    projectileSize: 1.0
  },
  // Length of a single round in seconds.  The timer counts down from this
  // value to zero.  Exposed in the debug panel so testers can speed up or
  // slow down matches.
  roundDuration: 60,
  // Collision margins.  These percentages shrink the hitbox horizontally
  // and vertically; e.g. 0.2 means 20% of each side is excluded.  Adjust
  // these to refine how forgiving collisions feel.
  hitboxMarginX: 0.2,
  hitboxMarginY: 0.1,
  // Fraction of the sprite width considered to be the forward side.  Only
  // this portion of the character can be hit.  A value of 0.5 means half
  // of the body (facing the opponent) is vulnerable.
  frontHitRatio: 0.5
};

// Copy of the initial configuration.  When the user hits "Reset defaults"
// from the debug panel the values in this object are used to restore the
// game parameters.  When "Update defaults" is clicked the current config
// values are copied into this object.  Because the structure contains
// nested objects we use JSON methods to perform a deep clone when
// updating defaults.
let defaultConfig = JSON.parse(JSON.stringify(config));

// -----------------------------------------------------------------------------
// Debugging configuration.  When SHOW_DEBUG is true a small overlay is drawn
// at the bottom of the screen listing key gameplay values.  These values are
// extracted from constants defined in this file.  Toggling this flag makes it
// easy to enable/disable the overlay for development and then hide it in
// production.
const SHOW_DEBUG = false;

// Gameplay constants for the debug overlay have been superseded by the
// `config` object.  When SHOW_DEBUG is true, the overlay will read
// dynamically from config rather than these legacy definitions.

/**
 * Compute a colour for the health bar based on the current health ratio.
 * A full bar is green, half health is orange and low health is red.
 * Colours are linearly interpolated between these anchors.
 * @param {number} ratio A value between 0 (empty) and 1 (full)
 * @returns {string} CSS colour in hexadecimal format
 */
function getHpColor(ratio) {
  // Clamp ratio to [0,1]
  if (ratio < 0) ratio = 0;
  if (ratio > 1) ratio = 1;
  // Colour anchors: low (red), medium (orange), high (green)
  const red    = [255, 85, 85];   // #ff5555
  const orange = [255, 170, 51];  // #ffaa33
  const green  = [51, 255, 102];  // #33ff66
  let c1, c2, t;
  if (ratio >= 0.5) {
    // Interpolate between orange and green when above 50%
    t = (ratio - 0.5) / 0.5;
    c1 = orange;
    c2 = green;
  } else {
    // Interpolate between red and orange when below 50%
    t = ratio / 0.5;
    c1 = red;
    c2 = orange;
  }
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  // Convert to hex string
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Key mapping for control events.  Each key maps to an action and a
// player index.  Fire actions are initiated on keydown (startFire)
// and resolved on keyup (stopFire).  Defend toggles a shield while
// held.  We register keydown/keyup events once the game begins.
const controls = {
  'KeyW':    { action: 'jump',   playerIndex: 0 },
  'KeyS':    { action: 'defend', playerIndex: 0 },
  'KeyF':    { action: 'fire',   playerIndex: 0 },
  'ArrowUp':    { action: 'jump',   playerIndex: 1 },
  'ArrowDown': { action: 'defend', playerIndex: 1 },
  'KeyL':    { action: 'fire',   playerIndex: 1 }
};

/**
 * Initialise the game.  Called once all images are loaded.  Sets up
 * players, state variables, event listeners and kicks off the game loop.
 */
function init() {
  // Setup character selection once images are ready.  init() may be
  // invoked before all images have finished loading; the overlay is
  // enabled only when imagesReady is true.  After a character is
  // selected the startGame() function is called.
  setupCharacterSelect();

  // Handle keyboard press events.  Use startFire()/stopFire for
  // firing; set defending flag for shields.  Pause toggles on P.
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    // Pause/unpause
    if (e.code === 'KeyP') {
      paused = !paused;
      const pauseBtn = document.getElementById('debug-pause-btn');
      if (pauseBtn) pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      // Show debug panel when paused
      const dbg = document.getElementById('debug-panel');
      if (dbg) dbg.style.display = paused ? 'block' : 'none';
      return;
    }
    const ctl = controls[e.code];
    if (!ctl) return;
    const player = players[ctl.playerIndex];
    if (!player) return;
    switch (ctl.action) {
      case 'jump':
        player.jump();
        break;
      case 'fire':
        player.startFire();
        break;
      case 'defend':
        // Begin defending only if cooldown expired
        if (player.defendCooldownTimer <= 0) {
          player.isDefending = true;
          player.defendTimer = 0;
        }
        break;
    }
    resumeAudio();
  });
  document.addEventListener('keyup', (e) => {
    const ctl = controls[e.code];
    if (!ctl) return;
    const player = players[ctl.playerIndex];
    if (!player) return;
    switch (ctl.action) {
      case 'fire':
        player.stopFire();
        break;
      case 'defend':
        // Stop defending and start cooldown
        if (player.isDefending) {
          const stats = CHAR_DATA[player.characterKey];
          player.isDefending = false;
          player.defendTimer = 0;
          player.defendCooldownTimer = stats.defendCooldown;
        }
        break;
    }
  });

  // Allow clicking on the on‑screen buttons to control the left player.  The
  // two icons drawn at the bottom of the canvas correspond to jumping and
  // firing.  Because the original design places only one set of icons
  // centred along the bottom, we map clicks to the left player (index 0).
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const controlSize = 120;
    const controlY    = canvas.height - controlSize - 10;
    const spacing     = 80;
    const jumpX = canvas.width / 2 - controlSize - spacing / 2;
    const fireX = canvas.width / 2 + spacing / 2;
    if (y >= controlY && y <= controlY + controlSize && players[0]) {
      // Jump area
      if (x >= jumpX && x <= jumpX + controlSize) {
        players[0].jump();
      } else if (x >= fireX && x <= fireX + controlSize) {
        players[0].startFire();
      }
      resumeAudio();
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    // When releasing the mouse after pressing fire, stop firing for P1
    if (players[0]) players[0].stopFire();
  });

  // Kick off the main loop
  lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);

  // Initialise the debug control inputs after all other listeners are set up.
  // This reads current values from the config object and updates them when
  // the user interacts with the debug panel.  If the elements are not
  // present (e.g. in production), the helper will simply return.
  initDebugControls();

  // Generate a star field once.  Stars twinkle over time by modulating
  // their alpha values.  We regenerate when the canvas size changes.
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 1,
      phase: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 1.5
    });
  }

}

// Initialise the game when the page loads.  This ensures that the
// canvas and other DOM elements are available.  init() will in turn
// set up the character selection overlay and start the render loop.
window.addEventListener('load', init);

/**
 * Configure the character selection overlay.  This overlay is displayed
 * when the game first loads and allows the user to choose their hero.
 * After a selection is made the AI picks a remaining character and
 * startGame() is invoked.
 */
function setupCharacterSelect() {
  const overlay = document.getElementById('character-select-overlay');
  const startBtn = document.getElementById('start-game-btn');
  if (!overlay || !startBtn) return;
  let selectedKey = null;
  // Wait until all images are ready before allowing selection
  const wait = setInterval(() => {
    if (imagesReady) {
      clearInterval(wait);
      overlay.style.display = 'flex';
    }
  }, 100);
  // Add click handlers to each character option
  overlay.querySelectorAll('.character-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const key = opt.getAttribute('data-char');
      selectedKey = key;
      // Highlight selection
      overlay.querySelectorAll('.character-option img').forEach(img => {
        img.style.borderColor = 'transparent';
      });
      opt.querySelector('img').style.borderColor = '#ffcc00';
      // Enable start button
      startBtn.disabled = false;
      startBtn.style.opacity = 1;
    });
  });
  // Start button triggers game start
  startBtn.addEventListener('click', () => {
    if (!selectedKey) return;
    // Choose AI character randomly from remaining options
    const keys = Object.keys(CHAR_DATA).filter(k => k !== selectedKey);
    const aiKey = keys[Math.floor(Math.random() * keys.length)];
    startGame(selectedKey, aiKey);
    overlay.style.display = 'none';
  });
}

/**
 * Instantiate players based on selected characters and reset state
 * for a new match.  Called after the player picks a hero from the
 * selection overlay.
 * @param {string} p1Key Character key for player 1
 * @param {string} p2Key Character key for player 2 (AI)
 */
function startGame(p1Key, p2Key) {
  // Create new players with selected characters on opposite sides
  const p1X = 120;
  const p2X = canvas.width - 120 - 180;
  players = [
    new Player(p1X, CHAR_DATA[p1Key].name, CHAR_DATA[p1Key].sprite, 1, p1Key),
    new Player(p2X, CHAR_DATA[p2Key].name, CHAR_DATA[p2Key].sprite, -1, p2Key)
  ];
  players.forEach((p, i) => p.index = i);
  // Scale sprites proportionally
  const targetHeight = 220;
  for (const p of players) {
    const ratio = p.image.width / p.image.height;
    p.height = targetHeight;
    p.width  = ratio * targetHeight;
  }
  // Mark second player as AI
  players[1].isAI = true;
  players[1].aiFireTimer = 1 + Math.random();
  // Reset state
  projectiles = [];
  particles = [];
  roundOverTimer = 0;
  resetRound();
  gameState = 'countdown';
}

/**
 * Reset the state at the start of a new round.  Restores health, mana
 * and positions, and resets the timer.
 */
function resetRound() {
  // Reset the round timer; this will count down after the countdown completes.
  // Use the configurable round duration rather than the constant so that
  // testers can adjust match length via the debug panel.  See config.roundDuration.
  roundTimer = config.roundDuration;
  projectiles = [];
  // Initialise the pre‑round countdown.  We allocate a small
  // additional slice for the "Go" cue so that it is visible for
  // approximately half a second after the numbers expire.  The
  // countdownTimer is measured in seconds.
  countdownTimer = 3.5;
  // Place both players on the ground near the bottom of the canvas
  const baseY = canvas.height - 220 - 120; // leave space for controls at bottom
  for (const p of players) {
    p.hp   = MAX_HP;
    p.startY = baseY;
    p.y = baseY;
    p.vy = 0;
    // Reset all timers and state flags
    p.fireCooldownTimer = 0;
    p.jumpCooldownTimer = 0;
    p.defendTimer = 0;
    p.defendCooldownTimer = 0;
    p.isDefending = false;
    p.firePressed = false;
    p.fireHoldTime = 0;
    p.ultimateReady = false;
    p.ultimateUsed = false;
    p.invulnerableTimer = 0;
  }
}

// Variables used by the game loop to compute delta time
let lastFrameTime = 0;

/**
 * The main game loop.  Updates the world, checks for round end, draws
 * everything to the canvas and schedules the next frame.  The loop
 * continues running until the game state moves to 'finished'.
 * @param {DOMHighResTimeStamp} timestamp Provided by requestAnimationFrame
 */
function gameLoop(timestamp) {
  const delta = (timestamp - lastFrameTime) / 1000; // convert ms to seconds
  lastFrameTime = timestamp;
  // If the game is paused do not advance any timers or update entities.
  if (paused) {
    drawScene();
    requestAnimationFrame(gameLoop);
    return;
  }

  // Update state based on the current mode.  During the countdown
  // phase we decrement the countdownTimer until it expires, at which
  // point the game transitions into the playing state and the round
  // timer begins decreasing.  While playing we update the world
  // normally.  During round over we wait a few seconds before
  // starting the next round or finishing the match.
  if (gameState === 'countdown') {
    countdownTimer -= delta;
    if (countdownTimer <= 0) {
      // Begin the round once the countdown completes
      countdownTimer = 0;
      gameState = 'playing';
    }
  } else if (gameState === 'playing') {
    updateWorld(delta);
  } else if (gameState === 'roundOver') {
    // Wait a couple of seconds before starting the next round or ending the game
    roundOverTimer += delta;
    if (roundOverTimer > 3) {
      // Check for a winner; first to two wins takes the match
      const winner = players.find(p => p.wins >= 2);
      if (winner) {
        // Store the winning player for celebration effects
        winningPlayer = winner;
        // Spawn celebratory confetti across the screen in the winner’s colour
        const confettiCount = 80;
        for (let i = 0; i < confettiCount; i++) {
          const confettiX = Math.random() * canvas.width;
          const confettiY = Math.random() * canvas.height * 0.6; // keep top half
          // Random bright colours for variety
          const colours = ['#ffcf33', '#ff6f61', '#7ee787', '#58a6ff'];
          const colour = colours[Math.floor(Math.random() * colours.length)];
          particles.push(new Particle(confettiX, confettiY, colour, 1.5, 6));
        }
        // Play a simple victory jingle: a sequence of tones
        setTimeout(() => playTone(523.25, 0.3, 'triangle'), 0);
        setTimeout(() => playTone(659.25, 0.3, 'triangle'), 300);
        setTimeout(() => playTone(783.99, 0.4, 'triangle'), 600);
        gameState = 'finished';
      } else {
        // Prepare the next round by resetting state and entering the
        // countdown again.
        resetRound();
        gameState = 'countdown';
      }
    }
  }
  // Decay the KO animation timer regardless of state
  if (koTimer > 0) {
    koTimer -= delta;
    if (koTimer < 0) koTimer = 0;
  }
  // Draw the scene regardless of game state (so end messages are visible)
  drawScene();
  if (gameState !== 'finished') {
    requestAnimationFrame(gameLoop);
  }
}

/**
 * Update all entities for the current frame.
 * @param {number} delta Elapsed time since last frame in seconds
 */
function updateWorld(delta) {
  // Decrement the round timer
  roundTimer -= delta;
  if (roundTimer < 0) roundTimer = 0;

  // Update players: apply gravity and timers
  for (const p of players) {
    // Update internal timers (cooldowns, fire hold, defend)
    p.updateTimers(delta);
    // Apply gravity
    if (p.vy !== 0 || p.y < p.startY) {
      p.vy += GRAVITY * delta;
      p.y  += p.vy;
      if (p.y >= p.startY) {
        p.y  = p.startY;
        p.vy = 0;
      }
    }
  }
  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update(delta);
    // Remove projectiles that leave the screen
    if (proj.x < -proj.radius || proj.x > canvas.width + proj.radius) {
      projectiles.splice(i, 1);
      continue;
    }
    // Check collisions with the opposing player
    for (const p of players) {
      if (p !== proj.owner && p.hp > 0 && proj.collides(p)) {
        // Ignore collisions if projectile has not started due to delay
        if (proj.elapsed < proj.delay) continue;
        // -----------------------------------------------------------------
        // Rock‑Paper‑Scissors collision resolution
        // 1) Dodge beats Ult: if the player is currently invulnerable
        //    (within the jump invulnerability window) and the projectile
        //    is an ultimate, the ult misses entirely.  Normal shots
        //    still connect during a jump.  Remove the projectile and
        //    play a soft miss sound.
        if (p.invulnerableTimer > 0 && proj.isUltimate) {
          // Remove the projectile and optionally play a light whoosh
          projectiles.splice(i, 1);
          playTone(440, 0.05, 'sine');
          break;
        }
        // 2) Defend beats Normal: if the target is defending and the
        //    projectile is not an ultimate (or is a fake ghost), then
        //    block the shot.  Spawn a grey ripple and consume the
        //    projectile.  Ghost projectiles from Vian’s ult also
        //    dissipate harmlessly on impact.
        if ((p.isDefending && !proj.isUltimate) || proj.ghost) {
          const colour = '#cccccc';
          for (let j = 0; j < 6; j++) {
            particles.push(new Particle(proj.x, proj.y, colour));
          }
          playTone(294, 0.1, 'triangle');
          projectiles.splice(i, 1);
          break;
        }
        // 3) Normal beats Dodge and Ult beats Defend: all other
        //    collisions result in damage.  Apply damage and handle
        //    lingering effects for Cenno’s ultimate.  After a hit
        //    normal projectiles are destroyed; ultimates either linger
        //    or vanish depending on their behaviour.
        p.hp -= proj.damage;
        if (proj.linger > 0) {
          proj.damage = 0;
          proj.lingerRemaining = proj.linger;
          proj.ghost = true;
        } else {
          projectiles.splice(i, 1);
        }
        // Spawn explosion particles with colour based on owner
        const colour = (proj.owner === players[0]) ? '#ffd85b' : '#ff5b5b';
        for (let j = 0; j < 8; j++) {
          particles.push(new Particle(proj.x, proj.y, colour));
        }
        playTone(196, 0.15, 'sawtooth');
        break;
      }
    }
  }
  // Update particles and remove those that have expired
  for (let i = particles.length - 1; i >= 0; i--) {
    const part = particles[i];
    part.update(delta);
    if (part.remaining <= 0) {
      particles.splice(i, 1);
    }
  }
  // Update star phases to create a twinkling effect
  for (const star of stars) {
    star.phase += star.speed * delta;
  }
  // Clamp HP values to non‑negative
  for (const p of players) {
    if (p.hp < 0) p.hp = 0;
  }
  // Check if the round has ended because of time or health
  const playersDead = players.filter(p => p.hp <= 0);
  if (roundTimer <= 0 || playersDead.length > 0) {
    // If a player has been knocked out, trigger a KO animation.  The KO
    // indicator will be drawn for a short duration on top of the
    // normal round over sequence.
    if (playersDead.length > 0) {
      koTimer = 1.2;
      // Play a heavy hit sound to emphasise the KO
      playTone(110, 0.3, 'square');
    }
    // Determine winner: the player with more HP wins.  If one is dead the
    // other automatically wins.  If both alive at time end, compare HP.
    let winnerIndex;
    if (players[0].hp > players[1].hp) winnerIndex = 0;
    else if (players[1].hp > players[0].hp) winnerIndex = 1;
    else winnerIndex = null; // tie
    if (winnerIndex !== null) {
      players[winnerIndex].wins++;
    }
    gameState = 'roundOver';
    roundOverTimer = 0;
    // Play a round‑over sound (distinct from KO)
    playTone(329.63, 0.3, 'triangle');
  }

  // Update AI for the second player (if enabled).  This runs after
  // collisions and health checks so that the AI can react to newly
  // spawned projectiles on the next frame.
  if (players[1] && players[1].isAI && gameState === 'playing') {
    updateAI(delta);
  }
}

/**
 * Simple AI controller for the second player.  The AI alternates
 * between firing at random intervals and jumping to avoid incoming
 * projectiles.  Jumping occurs only when the AI is on the ground
 * (vy === 0) and there is a projectile close enough to threaten it.
 * @param {number} delta Elapsed time since last frame in seconds
 */
function updateAI(delta) {
  const ai = players[1];
  // Fire periodically based on a countdown timer.  AI will choose
  // between a normal shot and ultimate if available.
  ai.aiFireTimer -= delta;
  if (ai.aiFireTimer <= 0 && ai.fireCooldownTimer <= 0) {
    // 30% chance to attempt an ultimate if ready
    if (ai.ultimateReady && !ai.ultimateUsed && Math.random() < 0.3) {
      ai.fireUltimate();
    } else {
      ai.fireNormal();
    }
    // schedule next shot between 0.8 and 1.6 seconds
    ai.aiFireTimer = 0.8 + Math.random() * 0.8;
  }
  // Dodge incoming projectiles: look for any projectile heading towards
  // the AI that will pass within a horizontal threshold soon.  If found
  // and the AI is grounded, initiate a jump (costs mana).
  if (ai.vy === 0) {
    for (const proj of projectiles) {
      // Only consider projectiles fired by the opponent
      if (proj.owner === players[0] && proj.dir === 1) {
        const distanceX = ai.x - proj.x;
        // Only react if the projectile is in front of the AI but not
        // already behind.  The threshold determines how early the AI
        // jumps; lower values make it braver, higher values make it
        // jump sooner.
        if (distanceX > 0 && distanceX < 240) {
          // Ensure the projectile is roughly at the same height
          const verticalDistance = Math.abs(proj.y - (ai.y + ai.height / 2));
          if (verticalDistance < ai.height / 2) {
            ai.jump();
            break;
          }
        }
      }
    }
  }
}

/**
 * Draw all game elements to the canvas.
 */
function drawScene() {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#010a1a');
  grad.addColorStop(1, '#02041a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Draw twinkling stars behind everything else
  for (const star of stars) {
    const alpha = 0.3 + 0.7 * (Math.sin(star.phase) * 0.5 + 0.5);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // If players have not been created yet (e.g. the user has not
  // selected a character) then skip drawing gameplay elements such as
  // HUD, players, projectiles and particles.  We still render the
  // background and stars so that the character selection screen has a
  // pleasant backdrop.  Without this guard the game would throw
  // errors referencing undefined players during initial page load.
  if (Array.isArray(players) && players.length > 0) {
    // Draw HUD (names, HP bars, wins) only once players exist
    drawHUD();
    // Draw players
    for (const p of players) {
      // Draw sprite
      ctx.drawImage(p.image, p.x, p.y, p.width, p.height);
      // Draw simple shadow below player
      const shadowW = p.width * 0.6;
      const shadowH = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.width/2, p.startY + p.height + 10, shadowW/2, shadowH/2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Draw projectiles
    for (const proj of projectiles) {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      // Colour based on owner
      ctx.fillStyle = proj.owner === players[0] ? '#ffd85b' : '#ff5b5b';
      ctx.fill();
    }
    // Draw explosion particles on top of projectiles
    for (const part of particles) {
      part.draw(ctx);
    }
    // Render hitboxes for debugging.  This is drawn after the main sprites and
    // particles so that outlines appear on top of the characters and bullets.
    if (SHOW_HITBOX) {
      drawHitboxes();
    }
  }

  // Draw bottom control icons (non‑interactive, purely decorative)
  const controlSize = 120;
  const controlY    = canvas.height - controlSize - 10;
  const spacing     = 80;
  // Left icon (jump)
  ctx.drawImage(imgJump,
    canvas.width/2 - controlSize - spacing/2,
    controlY,
    controlSize,
    controlSize);
  // Right icon (fire)
  ctx.drawImage(imgFire,
    canvas.width/2 + spacing/2,
    controlY,
    controlSize,
    controlSize);

  // When enabled draw a debugging overlay listing key constants.  This call
  // happens after most scene elements so that the overlay appears on top
  // of the arena artwork but still behind the end‑of‑match message.
  drawDebugInfo();
  // Only reference players when they exist to avoid errors before
  // character selection.  The winner message, countdown and KO
  // overlays depend on the existence of the players array and
  // game state.  Without this guard the page would throw a
  // TypeError when checking players before a game has started.
  if (Array.isArray(players) && players.length > 0) {
    // If the match has been won by someone, overlay a message
    const winner = players.find(p => p.wins >= 2);
    if (gameState === 'finished' && winner) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${winner.name} Wins!`, canvas.width / 2, canvas.height / 2);
      ctx.font = '24px sans-serif';
      ctx.fillText('Refresh the page to play again.', canvas.width / 2, canvas.height / 2 + 40);
    }
    // Draw pre‑round countdown overlay
    if (gameState === 'countdown' && countdownTimer > 0) {
      drawCountdown();
    }
    // Draw KO indicator if active
    if (koTimer > 0) {
      drawKO();
    }
  }
}

/**
 * Draw the heads‑up display for both players, including their names,
 * round wins, health bars and mana bars, as well as the timer.
 */
function drawHUD() {
  const marginX = 30;
  const marginY = 20;
  const barWidth  = 300;
  // Health bar size.  Without mana we only draw a single bar.
  const hpBarHeight   = 22;
  const barGap    = 6;
  const avatarSize = 44;
  const sectionHeight = avatarSize;
  // If players do not exist (e.g. before the match starts), do not
  // attempt to draw the HUD.  Without this check the code below
  // would reference undefined players and throw.  The HUD is only
  // rendered once players have been instantiated in startGame().
  if (!Array.isArray(players) || players.length === 0) {
    return;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Left player (index 0)
  {
    const p = players[0];
    const x = marginX;
    const y = marginY;
    // avatar
    ctx.save();
    // draw circular clipping for avatar
    ctx.beginPath();
    ctx.arc(x + avatarSize/2, y + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(p.image, x, y, avatarSize, avatarSize);
    ctx.restore();
    // name
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText(p.name, x + avatarSize + 10, y + avatarSize * 0.3);
    // wins as small coloured indicators
    const winIconSize = 12;
    const winY = y + avatarSize * 0.72;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      const cx = x + avatarSize + 10 + i * (winIconSize + 6);
      const cy = winY;
      ctx.fillStyle = i < p.wins ? '#ff5555' : '#55555a';
      ctx.arc(cx, cy, winIconSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // HP bar background
    const barX = x + avatarSize + 10;
    const barY = y + avatarSize + 6;
    // Background for HP bar
    ctx.fillStyle = '#073047';
    ctx.fillRect(barX, barY, barWidth, hpBarHeight);
    // HP bar (fill and border)
    const hpWidth = (p.hp / MAX_HP) * barWidth;
    ctx.fillStyle = getHpColor(p.hp / MAX_HP);
    ctx.fillRect(barX, barY, hpWidth, hpBarHeight);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, hpBarHeight);
    // Ultimate indicator: draw a small bar below HP if ready
    if (p.ultimateReady && !p.ultimateUsed) {
      const ultY = barY + hpBarHeight + 4;
      const ultW = 80;
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(barX, ultY, ultW, 6);
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.fillText('ULT', barX + 4, ultY + 4);
    }
  }
  // Right player (index 1) – mirrored horizontally
  {
    const p = players[1];
    const x = canvas.width - marginX - barWidth - avatarSize - 10;
    const y = marginY;
    // avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + barWidth + avatarSize + 10 + avatarSize/2, y + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.clip();
    // Player 2 avatar drawn on the far right
    ctx.drawImage(p.image, x + barWidth + avatarSize + 10, y, avatarSize, avatarSize);
    ctx.restore();
    // name (right aligned)
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(p.name, x + barWidth + avatarSize + 10 - avatarSize - 10, y + avatarSize * 0.3);
    // wins
    const winIconSize = 12;
    const winY = y + avatarSize * 0.72;
    ctx.textAlign = 'left';
    for (let i = 0; i < 2; i++) {
      const cx = x + barWidth + avatarSize + 10 - avatarSize - 10 - (i+1) * (winIconSize + 6);
      const cy = winY;
      ctx.beginPath();
      ctx.fillStyle = i < p.wins ? '#ff5555' : '#55555a';
      ctx.arc(cx, cy, winIconSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // HP/Mana bars – draw from right to left
    const barX = x + barWidth + avatarSize + 10 - barWidth;
    const barY = y + avatarSize + 6;
    // HP bar background
    ctx.fillStyle = '#073047';
    ctx.fillRect(barX, barY, barWidth, hpBarHeight);
    // HP bar (dynamic colour)
    const hpWidth2 = (p.hp / MAX_HP) * barWidth;
    ctx.fillStyle = getHpColor(p.hp / MAX_HP);
    ctx.fillRect(barX + (barWidth - hpWidth2), barY, hpWidth2, hpBarHeight);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, hpBarHeight);
    // Ultimate indicator on right side
    if (p.ultimateReady && !p.ultimateUsed) {
      const ultY = barY + hpBarHeight + 4;
      const ultW = 80;
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(barX + (barWidth - ultW), ultY, ultW, 6);
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('ULT', barX + barWidth - 4, ultY + 4);
      ctx.textAlign = 'left';
    }
  }
  // Draw timer in the top centre
  ctx.fillStyle = '#ffffff';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  if (gameState === 'playing') {
    ctx.fillText(Math.ceil(roundTimer).toString(), canvas.width / 2, marginY + 25);
  } else if (gameState === 'roundOver') {
    ctx.fillText('Round Over', canvas.width / 2, marginY + 25);
  }
}

/**
 * Draw the countdown numbers in the centre of the screen.  The
 * countdownTimer global is used to determine which value to show.  A
 * subtle scale and alpha effect is applied to each number for
 * polish.  When the timer reaches the final half second, display
 * “Go!” instead of a number.
 */
function drawCountdown() {
  const total = countdownTimer;
  let text;
  let alpha;
  // We treat the first three seconds as numeric countdown and the final
  // half second as a "Go" cue.  Subtracting 0.5 before rounding
  // ensures that 3.5–2.5 displays "3", 2.5–1.5 displays "2" and
  // 1.5–0.5 displays "1".
  if (total > 0.5) {
    const num = Math.ceil(total - 0.5);
    text = num.toString();
    // Fade out within each second: the fractional part of (t-0.5)
    const frac = (total - 0.5) - Math.floor(total - 0.5);
    alpha = 0.5 + 0.5 * frac;
  } else {
    text = 'Go!';
    // Fade out during the final half second
    alpha = total / 0.5;
  }
  // Draw the countdown text with scaling effect for visual interest
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
  ctx.font = 'bold 100px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

/**
 * Draw a large KO indicator on screen.  The koTimer variable
 * determines how long the indicator remains visible.  An easing
 * function is used to scale and fade the text as it disappears.
 */
function drawKO() {
  // Normalise timer into [0,1] where 1 means just appeared, 0 means done
  const t = koTimer / 1.2;
  // Ease out cubic for smooth shrink
  const scale = 1 + 0.5 * t * t;
  const alpha = t;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = `rgba(255,70,70,${alpha.toFixed(2)})`;
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KO!', 0, 0);
  ctx.restore();
}

/**
 * Draw a small debugging overlay in the corner of the screen.  The overlay
 * lists the core gameplay parameters such as jump cost, projectile speed and
 * damage.  This function is gated by the SHOW_DEBUG flag so that it can be
 * left in the code but hidden in production.  Values are pulled from
 * constants defined near the top of this file.
 */
function drawDebugInfo() {
  if (!SHOW_DEBUG) return;
  // Assemble text lines describing the gameplay constants.  We take the
  // absolute value of the jump velocity for display because the sign only
  // indicates direction in code (negative for upward).  If you adjust any of
  // these values in the logic, update the corresponding constant above.
  // Construct debug lines for each player and global settings.  Jump velocity
  // is displayed as a positive value for readability.  This overlay is
  // primarily intended for quick inspection; detailed editing is handled
  // through the debug panel.
  const lines = [];
  ['p1','p2'].forEach((key, idx) => {
    const cfg = config[key];
    lines.push(`Player ${idx+1}:`);
    lines.push(`  Jump cooldown: ${cfg.jumpCooldown}s`);
    lines.push(`  Jump velocity: ${Math.abs(cfg.jumpVelocity)} px/s`);
    lines.push(`  Fire cooldown: ${cfg.fireCooldown}s`);
    lines.push(`  Projectile speed: ${cfg.projectileSpeed} px/s`);
    lines.push(`  Projectile size: ${cfg.projectileSize}×`);
    lines.push(`  Damage per hit: ${cfg.projectileDamage} HP`);
  });
  lines.push(`Round duration: ${config.roundDuration}s`);
  lines.push(`Hitbox margin X: ${config.hitboxMarginX}`);
  lines.push(`Hitbox margin Y: ${config.hitboxMarginY}`);
  lines.push(`Front hit ratio: ${config.frontHitRatio}`);
  // Starting position for overlay (bottom‑left with a small margin)
  const margin = 20;
  const x = margin;
  let y = canvas.height - margin - lines.length * 16;
  ctx.save();
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += 16;
  }
  ctx.restore();
}

/**
 * Draw outlines for all active hitboxes and projectiles.  Only invoked
 * when SHOW_HITBOX is true.  This visual aid helps testers tune the
 * collision margins by showing the exact rectangles used for hits.
 */
function drawHitboxes() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,0,0.7)';
  ctx.lineWidth   = 2;
  // Draw player hitboxes.  These boxes are restricted to the
  // forward-facing portion of the sprite, as defined by FRONT_HIT_RATIO.
  for (const p of players) {
    const marginX = p.width * config.hitboxMarginX;
    const marginY = p.height * config.hitboxMarginY;
    // Determine forward region based on facing direction
    let fx1, fx2;
    if (p.direction === 1) {
      fx1 = p.x + p.width * (1 - config.frontHitRatio);
      fx2 = p.x + p.width;
    } else {
      fx1 = p.x;
      fx2 = p.x + p.width * config.frontHitRatio;
    }
    const px1 = Math.max(fx1 + marginX, p.x + marginX);
    const px2 = Math.min(fx2 - marginX, p.x + p.width - marginX);
    const py1 = p.y + marginY;
    const py2 = p.y + p.height - marginY;
    const w = px2 - px1;
    const h = py2 - py1;
    ctx.strokeRect(px1, py1, w, h);
  }
  // Draw projectile bounding circles
  for (const proj of projectiles) {
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Initialise the debug control inputs.  This helper queries the DOM for
 * elements with ids matching the debug fields and populates them with the
 * current values from the `config` object.  It attaches `input` event
 * listeners to update the config properties whenever the user changes the
 * value.  When the debug panel is not present in the DOM (e.g. when
 * building for production) the function exits without doing anything.
 */
function initDebugControls() {
  // Gather references to all debug inputs.  Because the debug panel
  // includes many fields we destructure them here for clarity.  If any
  // element is missing we assume the panel is absent and abort early.
  const refs = {
    pauseBtn: document.getElementById('debug-pause-btn'),
    // Player 1 fields
    p1JumpVel: document.getElementById('debug-p1-jump-velocity'),
    p1FireCooldown: document.getElementById('debug-p1-fire-cooldown'),
    p1ProjSpeed: document.getElementById('debug-p1-projectile-speed'),
    p1ProjDamage: document.getElementById('debug-p1-projectile-damage'),
    p1JumpCooldown: document.getElementById('debug-p1-jump-cooldown'),
    p1ProjSize: document.getElementById('debug-p1-projectile-size'),
    // Player 2 fields
    p2JumpVel: document.getElementById('debug-p2-jump-velocity'),
    p2FireCooldown: document.getElementById('debug-p2-fire-cooldown'),
    p2ProjSpeed: document.getElementById('debug-p2-projectile-speed'),
    p2ProjDamage: document.getElementById('debug-p2-projectile-damage'),
    p2JumpCooldown: document.getElementById('debug-p2-jump-cooldown'),
    p2ProjSize: document.getElementById('debug-p2-projectile-size'),
    // Global fields
    roundDuration: document.getElementById('debug-round-duration'),
    hitboxMarginX: document.getElementById('debug-hitbox-margin-x'),
    hitboxMarginY: document.getElementById('debug-hitbox-margin-y'),
    frontRatio: document.getElementById('debug-front-ratio'),
    // Defaults buttons
    saveDefaultsBtn: document.getElementById('debug-save-defaults'),
    resetDefaultsBtn: document.getElementById('debug-reset-defaults'),
    // Patch management controls
    patchNameInput: document.getElementById('debug-patch-name'),
    savePatchBtn: document.getElementById('debug-save-patch'),
    loadPatchSelect: document.getElementById('debug-load-patch')
  };
  // If any required input is missing bail out
  for (const key in refs) {
    if (!refs[key]) return;
  }
  // Helper to set all input values based on the current config state
  function populateInputs() {
    // Player 1
    refs.p1JumpVel.value     = Math.abs(config.p1.jumpVelocity);
    refs.p1FireCooldown.value= config.p1.fireCooldown;
    refs.p1ProjSpeed.value   = config.p1.projectileSpeed;
    refs.p1ProjDamage.value  = config.p1.projectileDamage;
    refs.p1JumpCooldown.value = config.p1.jumpCooldown;
    refs.p1ProjSize.value    = config.p1.projectileSize;
    // Player 2
    refs.p2JumpVel.value     = Math.abs(config.p2.jumpVelocity);
    refs.p2FireCooldown.value= config.p2.fireCooldown;
    refs.p2ProjSpeed.value   = config.p2.projectileSpeed;
    refs.p2ProjDamage.value  = config.p2.projectileDamage;
    refs.p2JumpCooldown.value = config.p2.jumpCooldown;
    refs.p2ProjSize.value    = config.p2.projectileSize;
    // Global
    refs.roundDuration.value  = config.roundDuration;
    refs.hitboxMarginX.value  = config.hitboxMarginX;
    refs.hitboxMarginY.value  = config.hitboxMarginY;
    refs.frontRatio.value     = config.frontHitRatio;
    // Pause button text
    refs.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }
  // Initialise all inputs
  populateInputs();
  // Event listeners for pause/resume.  Toggling pause will update the
  // button label accordingly.  Pausing simply prevents the world from
  // updating; drawing continues so testers can still see the scene.
  refs.pauseBtn.addEventListener('click', () => {
    paused = !paused;
    refs.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });
  // Player 1 listeners
  refs.p1JumpVel.addEventListener('input', () => {
    const val = parseFloat(refs.p1JumpVel.value);
    if (!isNaN(val)) config.p1.jumpVelocity = -Math.abs(val);
  });
  refs.p1FireCooldown.addEventListener('input', () => {
    const val = parseFloat(refs.p1FireCooldown.value);
    if (!isNaN(val) && val >= 0) config.p1.fireCooldown = val;
  });
  refs.p1ProjSpeed.addEventListener('input', () => {
    const val = parseFloat(refs.p1ProjSpeed.value);
    if (!isNaN(val)) config.p1.projectileSpeed = val;
  });
  refs.p1ProjDamage.addEventListener('input', () => {
    const val = parseFloat(refs.p1ProjDamage.value);
    if (!isNaN(val)) config.p1.projectileDamage = val;
  });
  refs.p1JumpCooldown.addEventListener('input', () => {
    const val = parseFloat(refs.p1JumpCooldown.value);
    if (!isNaN(val) && val >= 0) config.p1.jumpCooldown = val;
  });
  refs.p1ProjSize.addEventListener('input', () => {
    const val = parseFloat(refs.p1ProjSize.value);
    if (!isNaN(val) && val > 0) config.p1.projectileSize = val;
  });
  // Player 2 listeners
  refs.p2JumpVel.addEventListener('input', () => {
    const val = parseFloat(refs.p2JumpVel.value);
    if (!isNaN(val)) config.p2.jumpVelocity = -Math.abs(val);
  });
  refs.p2FireCooldown.addEventListener('input', () => {
    const val = parseFloat(refs.p2FireCooldown.value);
    if (!isNaN(val) && val >= 0) config.p2.fireCooldown = val;
  });
  refs.p2ProjSpeed.addEventListener('input', () => {
    const val = parseFloat(refs.p2ProjSpeed.value);
    if (!isNaN(val)) config.p2.projectileSpeed = val;
  });
  refs.p2ProjDamage.addEventListener('input', () => {
    const val = parseFloat(refs.p2ProjDamage.value);
    if (!isNaN(val)) config.p2.projectileDamage = val;
  });
  refs.p2JumpCooldown.addEventListener('input', () => {
    const val = parseFloat(refs.p2JumpCooldown.value);
    if (!isNaN(val) && val >= 0) config.p2.jumpCooldown = val;
  });
  refs.p2ProjSize.addEventListener('input', () => {
    const val = parseFloat(refs.p2ProjSize.value);
    if (!isNaN(val) && val > 0) config.p2.projectileSize = val;
  });
  // Global listeners
  refs.roundDuration.addEventListener('input', () => {
    const val = parseFloat(refs.roundDuration.value);
    if (!isNaN(val) && val > 0) config.roundDuration = val;
  });
  refs.hitboxMarginX.addEventListener('input', () => {
    const val = parseFloat(refs.hitboxMarginX.value);
    if (!isNaN(val) && val >= 0) config.hitboxMarginX = val;
  });
  refs.hitboxMarginY.addEventListener('input', () => {
    const val = parseFloat(refs.hitboxMarginY.value);
    if (!isNaN(val) && val >= 0) config.hitboxMarginY = val;
  });
  refs.frontRatio.addEventListener('input', () => {
    const val = parseFloat(refs.frontRatio.value);
    if (!isNaN(val) && val >= 0 && val <= 1) config.frontHitRatio = val;
  });
  // Defaults buttons
  refs.saveDefaultsBtn.addEventListener('click', () => {
    defaultConfig = JSON.parse(JSON.stringify(config));
  });
  refs.resetDefaultsBtn.addEventListener('click', () => {
    // Deep copy of defaults back into config
    config.p1 = { ...defaultConfig.p1 };
    config.p2 = { ...defaultConfig.p2 };
    config.roundDuration  = defaultConfig.roundDuration;
    config.hitboxMarginX  = defaultConfig.hitboxMarginX;
    config.hitboxMarginY  = defaultConfig.hitboxMarginY;
    config.frontHitRatio  = defaultConfig.frontHitRatio;
    // Also copy nested objects again to avoid reference sharing
    config.p1 = { ...defaultConfig.p1 };
    config.p2 = { ...defaultConfig.p2 };
    // Refresh inputs to reflect restored values and button label
    populateInputs();
  });

  // -----------------------------------------------------------------------
  // Patch management
  // Saved patches are stored in localStorage under the key 'gamePatches'.  Each
  // patch is an entry in the stored object mapping a name to a JSON string
  // representing the config.  Another key 'lastPatch' stores the most
  // recently selected patch name.  Use the controls in the debug panel to
  // save and load patches.  Patches persist between page reloads.

  function loadPatches() {
    try {
      const raw = localStorage.getItem('gamePatches');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function savePatches(patches) {
    try {
      localStorage.setItem('gamePatches', JSON.stringify(patches));
    } catch (e) {
      /* ignore storage errors */
    }
  }
  function refreshPatchSelect() {
    const patches = loadPatches();
    // Clear existing options (except the placeholder)
    const select = refs.loadPatchSelect;
    // Remove all but first option
    while (select.options.length > 1) {
      select.remove(1);
    }
    Object.keys(patches).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    // Set selected option if last patch exists
    const last = localStorage.getItem('lastPatch');
    if (last && patches[last]) {
      select.value = last;
    } else {
      select.value = '';
    }
  }
  // Initialize dropdown on load
  refreshPatchSelect();
  // Save patch button handler
  refs.savePatchBtn.addEventListener('click', () => {
    const name = refs.patchNameInput.value.trim();
    if (!name) return;
    const patches = loadPatches();
    // Store a deep copy of the current configuration
    patches[name] = JSON.stringify(config);
    savePatches(patches);
    localStorage.setItem('lastPatch', name);
    refreshPatchSelect();
  });
  // Load patch selection handler
  refs.loadPatchSelect.addEventListener('change', () => {
    const name = refs.loadPatchSelect.value;
    if (!name) return;
    const patches = loadPatches();
    const raw = patches[name];
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw);
      // Restore config fields from saved patch
      config.p1 = { ...cfg.p1 };
      config.p2 = { ...cfg.p2 };
      config.roundDuration = cfg.roundDuration;
      config.hitboxMarginX = cfg.hitboxMarginX;
      config.hitboxMarginY = cfg.hitboxMarginY;
      config.frontHitRatio = cfg.frontHitRatio;
      // Save last patch
      localStorage.setItem('lastPatch', name);
      // Update UI
      populateInputs();
    } catch (e) {
      console.error('Failed to load patch', e);
    }
  });
}
