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

// Image assets.  These files are stored alongside this script.  When
// developing your own game you can swap these files out to customise
// the appearance.
const imgJump    = new Image();
const imgFire    = new Image();
const imgPlayer1 = new Image();
const imgPlayer2 = new Image();
imgJump.src    = 'jump button.png';
imgFire.src    = 'fire button.png';
imgPlayer1.src = 'Cenno Kio123.png';
imgPlayer2.src = 'rudo ben 123.png';

// Track how many images have loaded before starting the game
let imagesLoaded = 0;
function onImageLoad() {
  imagesLoaded++;
  // When all four images are ready we can start the game
  if (imagesLoaded === 4) {
    init();
  }
}
imgJump.onload    = onImageLoad;
imgFire.onload    = onImageLoad;
imgPlayer1.onload = onImageLoad;
imgPlayer2.onload = onImageLoad;

// Player class.  Encapsulates the state and behaviour of each character.
class Player {
  /**
   * Create a new player.
   * @param {number} x         Horizontal position on the canvas (top left)
   * @param {string} name      Display name
   * @param {HTMLImageElement} image Sprite used to draw this player
   * @param {number} direction +1 for projectiles moving right, −1 for left
   */
  constructor(x, name, image, direction) {
    this.x = x;
    this.y = 0; // will be set when round resets
    this.startY = 0; // ground level, set later
    this.vy = 0; // vertical velocity
    this.width  = 180; // width of the sprite when drawn
    this.height = 220; // height of the sprite when drawn
    this.name = name;
    this.image = image;
    this.direction = direction;
    this.hp   = 100;
    this.mana = 100;
    this.wins = 0;
    // Cooldown timer preventing immediate successive shots.  When >0
    // the player may not fire.  This is decremented each frame in
    // updateWorld().  The initial value is zero so the player can fire
    // immediately on round start.
    this.fireCooldownTimer = 0;
    // Index of the player in the players array (0 or 1).  Assigned in
    // init() after creation.
    this.index = 0;
  }
  /**
   * Attempt to make the player jump.  Only possible if on the ground and
   * sufficient mana is available.
   */
  jump() {
    // Look up the configuration for this player.  Each player has their own
    // tunable parameters stored under config.p1 or config.p2.  If the
    // character is grounded and has sufficient mana, apply the jump
    // velocity and deduct mana accordingly.
    const cfg = this.index === 0 ? config.p1 : config.p2;
    if (this.vy === 0 && this.mana >= cfg.jumpCost) {
      this.vy = cfg.jumpVelocity;
      this.mana -= cfg.jumpCost;
      // Play a short jump sound (slightly higher pitch)
      playTone(523.25, 0.05, 'triangle');
    }
  }
  /**
   * Attempt to fire a projectile.  Only possible if sufficient mana
   * is available.  The projectile direction is determined by this.direction.
   */
  fire() {
    const cfg = this.index === 0 ? config.p1 : config.p2;
    // Cannot fire if mana is too low or still cooling down
    if (this.mana >= cfg.fireCost && this.fireCooldownTimer <= 0) {
      this.mana -= cfg.fireCost;
      // Spawn the projectile at roughly mid‑height of the sprite
      const spawnY = this.y + this.height * 0.5;
      const spawnX = this.direction === 1 ? this.x + this.width : this.x;
      projectiles.push(new Projectile(spawnX, spawnY, this.direction, this));
      // Reset cooldown timer
      this.fireCooldownTimer = cfg.fireCooldown;
      // Play a firing sound (higher pitch)
      playTone(659.25, 0.05, 'square');
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
  constructor(x, y, dir, owner) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.owner = owner;
    this.radius = 8;
    // Look up speed and damage from the owner's configuration.  Each
    // character can customise their projectile speed and damage via the
    // debug panel.
    const cfg = owner.index === 0 ? config.p1 : config.p2;
    this.speed = cfg.projectileSpeed;
    this.damage = cfg.projectileDamage;
  }
  update(delta) {
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
const MAX_MANA  = 100;
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
    jumpCost: 10,
    jumpVelocity: -15,
    fireCost: 20,
    projectileSpeed: 600,
    projectileDamage: 15,
    manaRegenRate: 20,
    fireCooldown: 0.4
  },
  p2: {
    jumpCost: 10,
    jumpVelocity: -15,
    fireCost: 20,
    projectileSpeed: 600,
    projectileDamage: 15,
    manaRegenRate: 20,
    fireCooldown: 0.4
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

// Key mapping for control events (only keydown triggers actions to avoid
// repeating the action while a key is held).  We register keydown events
// below once the game has been initialised.
const controls = {
  'KeyW':    { action: 'jump',  playerIndex: 0 },
  'KeyF':    { action: 'fire',  playerIndex: 0 },
  'ArrowUp': { action: 'jump',  playerIndex: 1 },
  'KeyL':    { action: 'fire',  playerIndex: 1 }
};

/**
 * Initialise the game.  Called once all images are loaded.  Sets up
 * players, state variables, event listeners and kicks off the game loop.
 */
function init() {
  // Create two players on opposite sides of the arena
  const p1X = 120;
  const p2X = canvas.width - 120 - 180; // align right with same margin
  players = [
    new Player(p1X, 'Cenno Kio', imgPlayer1,  1),
    new Player(p2X, 'Rudo Ben',  imgPlayer2, -1)
  ];
  // Assign each player a unique index (0 or 1) so configuration can be
  // referenced via config.p1 and config.p2.  The index is used in methods
  // such as jump() and fire() to look up per‑player parameters.
  players.forEach((p, i) => {
    p.index = i;
  });

  // Scale player sprites proportionally based on their image aspect ratio.
  // Both characters share the same nominal height to ensure they sit
  // neatly on the ground.  Widths are computed from the image aspect.
  const targetHeight = 220;
  for (const p of players) {
    const ratio = p.image.width / p.image.height;
    p.height = targetHeight;
    p.width  = ratio * targetHeight;
  }

  // Mark the second player as AI controlled.  Additional timers used to
  // determine when the AI should fire.
  players[1].isAI = true;
  players[1].aiFireTimer = 1.5; // seconds until next shot

  // Reset state for the very first round.  We begin in a countdown
  // state rather than immediately playing.  The resetRound call
  // initialises player positions and timers, and sets countdownTimer.
  projectiles = [];
  roundOverTimer = 0;
  resetRound();
  gameState = 'countdown';

  // Handle keyboard events for jump/fire.  Only react on the first
  // keydown (not on repeats) so that holding the key doesn’t repeatedly
  // trigger the action.  Keyup isn’t strictly necessary here but could
  // be useful for other expansions.
  document.addEventListener('keydown', (e) => {
    // Ignore repeated key presses
    if (e.repeat) return;
    // Toggle pause with the P key.  When paused the game world stops
    // updating until resumed.  Do not trigger any other actions.
    if (e.code === 'KeyP') {
      paused = !paused;
      // Update the debug panel button if present
      const pauseBtn = document.getElementById('debug-pause-btn');
      if (pauseBtn) pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      return;
    }
    const ctl = controls[e.code];
    if (!ctl) return;
    const player = players[ctl.playerIndex];
    if (!player) return;
    if (ctl.action === 'jump') player.jump();
    else if (ctl.action === 'fire') player.fire();
    resumeAudio();
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
    // Check vertical bounds first
    if (y >= controlY && y <= controlY + controlSize) {
      // Jump area (left icon)
      if (x >= jumpX && x <= jumpX + controlSize) {
        players[0].jump();
      }
      // Fire area (right icon)
      else if (x >= fireX && x <= fireX + controlSize) {
        players[0].fire();
      }
    }
    resumeAudio();
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
    p.mana = MAX_MANA;
    p.startY = baseY;
    p.y = baseY;
    p.vy = 0;
    p.fireCooldownTimer = 0;
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

  // Update players: apply gravity, update vertical position, regen mana
  for (const p of players) {
    // Look up per‑player configuration
    const cfg = p.index === 0 ? config.p1 : config.p2;
    // Mana regeneration capped at MAX_MANA
    p.mana = Math.min(MAX_MANA, p.mana + cfg.manaRegenRate * delta);
    // Decrement fire cooldown timer
    if (p.fireCooldownTimer > 0) {
      p.fireCooldownTimer -= delta;
      if (p.fireCooldownTimer < 0) p.fireCooldownTimer = 0;
    }
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
        // Collision!  Reduce target health and remove projectile.  Damage
        // is determined by the owner’s projectile configuration.
        p.hp -= proj.damage;
        // Spawn explosion particles at impact point.  Colour reflects
        // which player fired the projectile.
        const colour = (proj.owner === players[0]) ? '#ffd85b' : '#ff5b5b';
        for (let j = 0; j < 8; j++) {
          particles.push(new Particle(proj.x, proj.y, colour));
        }
        // Play a hit sound: lower frequency for damage
        playTone(196, 0.15, 'sawtooth');
        projectiles.splice(i, 1);
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
  // Fire periodically based on a countdown timer
  ai.aiFireTimer -= delta;
  const cfg = config.p2;
  if (ai.aiFireTimer <= 0 && ai.mana >= cfg.fireCost && ai.fireCooldownTimer <= 0) {
    ai.fire();
    // schedule next shot between 1 and 2 seconds
    ai.aiFireTimer = 1 + Math.random() * 1.5;
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

  // Draw HUD (names, HP/mana bars, wins)
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

/**
 * Draw the heads‑up display for both players, including their names,
 * round wins, health bars and mana bars, as well as the timer.
 */
function drawHUD() {
  const marginX = 30;
  const marginY = 20;
  const barWidth  = 300;
  // Health and mana bar sizes.  Making the bars taller helps them
  // stand out when stacked vertically.
  const hpBarHeight   = 20;
  const manaBarHeight = 14;
  const barGap    = 6;
  const avatarSize = 44;
  const sectionHeight = avatarSize;
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
    ctx.fillStyle = '#073047';
    ctx.fillRect(barX, barY, barWidth, hpBarHeight + manaBarHeight + barGap);
    // HP bar (draw fill and border) – use dynamic colour based on health
    const hpWidth = (p.hp / MAX_HP) * barWidth;
    ctx.fillStyle = getHpColor(p.hp / MAX_HP);
    ctx.fillRect(barX, barY, hpWidth, hpBarHeight);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, hpBarHeight);
    // Mana bar (draw fill and border)
    const manaWidth = (p.mana / MAX_MANA) * barWidth;
    ctx.fillStyle = '#0099ff';
    const manaY = barY + hpBarHeight + barGap;
    ctx.fillRect(barX, manaY, manaWidth, manaBarHeight);
    ctx.strokeRect(barX, manaY, barWidth, manaBarHeight);
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
    ctx.fillStyle = '#073047';
    ctx.fillRect(barX, barY, barWidth, hpBarHeight + manaBarHeight + barGap);
    // HP bar (dynamic colour)
    const hpWidth2 = (p.hp / MAX_HP) * barWidth;
    ctx.fillStyle = getHpColor(p.hp / MAX_HP);
    ctx.fillRect(barX + (barWidth - hpWidth2), barY, hpWidth2, hpBarHeight);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, hpBarHeight);
    // Mana bar
    const manaWidth2 = (p.mana / MAX_MANA) * barWidth;
    ctx.fillStyle = '#0099ff';
    const manaY2 = barY + hpBarHeight + barGap;
    ctx.fillRect(barX + (barWidth - manaWidth2), manaY2, manaWidth2, manaBarHeight);
    ctx.strokeRect(barX, manaY2, barWidth, manaBarHeight);
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
    lines.push(`  Jump cost: ${cfg.jumpCost} mana`);
    lines.push(`  Jump velocity: ${Math.abs(cfg.jumpVelocity)} px/s`);
    lines.push(`  Fire cost: ${cfg.fireCost} mana`);
    lines.push(`  Fire cooldown: ${cfg.fireCooldown}s`);
    lines.push(`  Projectile speed: ${cfg.projectileSpeed} px/s`);
    lines.push(`  Damage per hit: ${cfg.projectileDamage} HP`);
    lines.push(`  Mana regen: ${cfg.manaRegenRate}/s`);
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
    p1JumpCost: document.getElementById('debug-p1-jump-cost'),
    p1JumpVel: document.getElementById('debug-p1-jump-velocity'),
    p1FireCost: document.getElementById('debug-p1-fire-cost'),
    p1FireCooldown: document.getElementById('debug-p1-fire-cooldown'),
    p1ProjSpeed: document.getElementById('debug-p1-projectile-speed'),
    p1ProjDamage: document.getElementById('debug-p1-projectile-damage'),
    p1ManaRegen: document.getElementById('debug-p1-mana-regen'),
    // Player 2 fields
    p2JumpCost: document.getElementById('debug-p2-jump-cost'),
    p2JumpVel: document.getElementById('debug-p2-jump-velocity'),
    p2FireCost: document.getElementById('debug-p2-fire-cost'),
    p2FireCooldown: document.getElementById('debug-p2-fire-cooldown'),
    p2ProjSpeed: document.getElementById('debug-p2-projectile-speed'),
    p2ProjDamage: document.getElementById('debug-p2-projectile-damage'),
    p2ManaRegen: document.getElementById('debug-p2-mana-regen'),
    // Global fields
    roundDuration: document.getElementById('debug-round-duration'),
    hitboxMarginX: document.getElementById('debug-hitbox-margin-x'),
    hitboxMarginY: document.getElementById('debug-hitbox-margin-y'),
    frontRatio: document.getElementById('debug-front-ratio'),
    // Defaults buttons
    saveDefaultsBtn: document.getElementById('debug-save-defaults'),
    resetDefaultsBtn: document.getElementById('debug-reset-defaults')
  };
  // If any required input is missing bail out
  for (const key in refs) {
    if (!refs[key]) return;
  }
  // Helper to set all input values based on the current config state
  function populateInputs() {
    // Player 1
    refs.p1JumpCost.value    = config.p1.jumpCost;
    refs.p1JumpVel.value     = Math.abs(config.p1.jumpVelocity);
    refs.p1FireCost.value    = config.p1.fireCost;
    refs.p1FireCooldown.value= config.p1.fireCooldown;
    refs.p1ProjSpeed.value   = config.p1.projectileSpeed;
    refs.p1ProjDamage.value  = config.p1.projectileDamage;
    refs.p1ManaRegen.value   = config.p1.manaRegenRate;
    // Player 2
    refs.p2JumpCost.value    = config.p2.jumpCost;
    refs.p2JumpVel.value     = Math.abs(config.p2.jumpVelocity);
    refs.p2FireCost.value    = config.p2.fireCost;
    refs.p2FireCooldown.value= config.p2.fireCooldown;
    refs.p2ProjSpeed.value   = config.p2.projectileSpeed;
    refs.p2ProjDamage.value  = config.p2.projectileDamage;
    refs.p2ManaRegen.value   = config.p2.manaRegenRate;
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
  refs.p1JumpCost.addEventListener('input', () => {
    const val = parseFloat(refs.p1JumpCost.value);
    if (!isNaN(val)) config.p1.jumpCost = val;
  });
  refs.p1JumpVel.addEventListener('input', () => {
    const val = parseFloat(refs.p1JumpVel.value);
    if (!isNaN(val)) config.p1.jumpVelocity = -Math.abs(val);
  });
  refs.p1FireCost.addEventListener('input', () => {
    const val = parseFloat(refs.p1FireCost.value);
    if (!isNaN(val)) config.p1.fireCost = val;
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
  refs.p1ManaRegen.addEventListener('input', () => {
    const val = parseFloat(refs.p1ManaRegen.value);
    if (!isNaN(val)) config.p1.manaRegenRate = val;
  });
  // Player 2 listeners
  refs.p2JumpCost.addEventListener('input', () => {
    const val = parseFloat(refs.p2JumpCost.value);
    if (!isNaN(val)) config.p2.jumpCost = val;
  });
  refs.p2JumpVel.addEventListener('input', () => {
    const val = parseFloat(refs.p2JumpVel.value);
    if (!isNaN(val)) config.p2.jumpVelocity = -Math.abs(val);
  });
  refs.p2FireCost.addEventListener('input', () => {
    const val = parseFloat(refs.p2FireCost.value);
    if (!isNaN(val)) config.p2.fireCost = val;
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
  refs.p2ManaRegen.addEventListener('input', () => {
    const val = parseFloat(refs.p2ManaRegen.value);
    if (!isNaN(val)) config.p2.manaRegenRate = val;
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
}