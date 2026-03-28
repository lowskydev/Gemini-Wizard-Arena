// ─── Socket.io connection ────────────────────────────────────────────────────
const socket = io();

// ─── Multiplayer state (module-level, shared across scenes) ──────────────────
let myPlayerId = null;
let gameSceneRef = null;

socket.on('connect', () => {
  console.log('[Client]: Connected to server via socket.io');
});

socket.on('PLAYER_JOINED', ({ id, socketId }) => {
  myPlayerId = id;
  console.log(`[Client]: Assigned as ${id} (socket ${socketId})`);
  if (gameSceneRef) gameSceneRef.assignPlayers();
});

socket.on('BROADCAST_STATE', (data) => {
  if (gameSceneRef) gameSceneRef.onRemoteStateUpdate(data);
});

socket.on('BROADCAST_SPELL', (data) => {
  if (gameSceneRef) gameSceneRef.onRemoteSpell(data);
});

window.castSpellFromAudio = (result) => {
  if (gameSceneRef) gameSceneRef.castSpellFromResult(result);
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createRectTexture = (scene, key, width, height, color) => {
  try {
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, width, height);
    gfx.generateTexture(key, width, height);
    gfx.destroy();
  } catch (err) {
    console.error('[createRectTexture Error]:', err);
  }
};

const createCircleTexture = (scene, key, radius, color) => {
  try {
    const diameter = radius * 2;
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillCircle(radius, radius, radius);
    gfx.generateTexture(key, diameter, diameter);
    gfx.destroy();
  } catch (err) {
    console.error('[createCircleTexture Error]:', err);
  }
};

function volumeToScale(volume) {
  if (volume <= 50) return 1.0;
  if (volume <= 85) return 1.5;
  return 2.0;
}

function createSoulsButton(scene, x, y, textStr, onClick) {
  const btnWidth = 240;
  const btnHeight = 60;
  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const text = scene.add.text(0, 0, textStr, {
    fontFamily: 'Georgia, serif',
    fontSize: '24px',
    color: '#aaaaaa',
    fontStyle: 'bold',
    letterSpacing: 2
  }).setOrigin(0.5);

  container.add([bg, text]);

  const draw = (isHover) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    if (isHover) {
      bg.lineStyle(2, 0xffaa00, 1);
      text.setColor('#ffffff');
      text.setShadow(0, 0, '#ffaa00', 8, false, true);
    } else {
      bg.lineStyle(1, 0x555555, 0.8);
      text.setColor('#aaaaaa');
      text.setShadow(0, 0, '#000000', 0);
    }
    bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
  };

  draw(false);

  const zone = scene.add.zone(0, 0, btnWidth, btnHeight).setInteractive({ cursor: 'pointer' });
  container.add(zone);
  zone.on('pointerover', () => { draw(true); container.setScale(1.05); });
  zone.on('pointerout', () => { draw(false); container.setScale(1); });
  zone.on('pointerdown', onClick);

  return container;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENES
// ═══════════════════════════════════════════════════════════════════════════════

// ── MainMenuScene — friend's enhanced version + live socket identity labels ───
class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
    this.timeElapsed = 0;
    this.selectedClass = 1;
  }

  create() {
    const { width, height } = this.scale;

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.8, 0.8);
    vignette.fillRect(0, 0, width, height);

    this.title = this.add.text(width / 2, height * 0.25, 'Vibe-Wizard Arena', {
      fontFamily: 'Georgia, serif',
      fontSize: '80px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.title.setShadow(2, 4, '#000000', 10, false, true);

    const line = this.add.graphics();
    line.lineStyle(2, 0x550000, 0.8);
    line.beginPath();
    line.moveTo(width / 2 - 200, height * 0.35);
    line.lineTo(width / 2 + 200, height * 0.35);
    line.strokePath();

    // Friend's wider lobby box
    const lobbyBox = this.add.graphics();
    lobbyBox.fillStyle(0x000000, 0.6);
    lobbyBox.lineStyle(1, 0x333333, 1);
    lobbyBox.fillRect(width / 2 - 350, height * 0.38, 700, 370);
    lobbyBox.strokeRect(width / 2 - 350, height * 0.38, 700, 370);

    this.add.text(width / 2, height * 0.42, 'LAN LOBBY', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      color: '#cccccc',
      letterSpacing: 4
    }).setOrigin(0.5);

    // Two-column layout from friend, labels updated with live socket identity
    const p1Label = (myPlayerId === 'Player 1') ? 'Player 1: You ✓' : 'Player 1: Connected';
    const p2Label = (myPlayerId === 'Player 2') ? 'Player 2: You ✓' : 'Player 2: Waiting...';
    const p1Color = (myPlayerId === 'Player 1') ? '#4488ff' : '#ff4444';
    const p2Color = (myPlayerId === 'Player 2') ? '#ff4444' : '#555555';

    this.add.text(width / 2 - 150, height * 0.49, p1Label, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: p1Color
    }).setOrigin(0.5);

    this.add.text(width / 2 + 150, height * 0.49, p2Label, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: p2Color
    }).setOrigin(0.5);

    // Friend's class selection cards — unchanged
    this.add.text(width / 2, height * 0.56, 'Choose Your Wizard', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#aaaaaa',
      fontStyle: 'italic'
    }).setOrigin(0.5);

    const createCard = (x, y, label, colorHex, classId) => {
      const container = this.add.container(x, y);
      const w = 180, h = 120;

      const bg = this.add.graphics();
      const text = this.add.text(0, 30, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const avatar = this.add.graphics();
      avatar.fillStyle(colorHex, 1);
      avatar.fillCircle(0, -15, 25);

      container.add([bg, avatar, text]);

      const drawCard = () => {
        bg.clear();
        bg.fillStyle(0x000000, 0.8);
        if (this.selectedClass === classId) {
          bg.lineStyle(3, colorHex, 1);
          text.setColor('#ffffff');
          text.setShadow(0, 0, '#' + colorHex.toString(16).padStart(6, '0'), 8);
        } else {
          bg.lineStyle(2, 0x444444, 0.8);
          text.setColor('#aaaaaa');
          text.setShadow(0, 0, '#000000', 0);
        }
        bg.fillRect(-w / 2, -h / 2, w, h);
        bg.strokeRect(-w / 2, -h / 2, w, h);
      };

      const zone = this.add.zone(0, 0, w, h).setInteractive({ cursor: 'pointer' });
      container.add(zone);

      zone.on('pointerdown', () => { this.selectedClass = classId; this.events.emit('classChanged'); });
      zone.on('pointerover', () => { container.setScale(1.05); });
      zone.on('pointerout', () => { container.setScale(1); });

      this.events.on('classChanged', drawCard);
      drawCard();
    };

    createCard(width / 2 - 120, height * 0.66, 'Pyromancer', 0xff4400, 1);
    createCard(width / 2 + 120, height * 0.66, 'Frost Magus', 0x0088ff, 2);

    this.add.text(width / 2, height * 0.775, '🎮  A/D to move  ·  W to jump  ·  SHIFT to cast', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#666666'
    }).setOrigin(0.5);

    createSoulsButton(this, width / 2, height * 0.86, 'ENTER ARENA', () => {
      this.scene.start('GameScene');
    });
  }

  update(time, delta) {
    this.timeElapsed += delta;
    const scale = 1 + Math.sin(this.timeElapsed * 0.0015) * 0.02;
    this.title.setScale(scale);
    this.title.setAlpha(0.8 + Math.sin(this.timeElapsed * 0.002) * 0.2);
  }
}

// ── EndScene ──────────────────────────────────────────────────────────────────
class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' });
    this.timeElapsed = 0;
  }

  create() {
    gameSceneRef = null;
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x440000, 0.4).setOrigin(0);

    this.deathText = this.add.text(width / 2, height * 0.4, 'YOU DIED', {
      fontFamily: 'Georgia, serif',
      fontSize: '140px',
      color: '#ff0000',
      fontStyle: 'bold',
      letterSpacing: 25
    }).setOrigin(0.5).setShadow(0, 0, '#000000', 20, false, true);

    this.deathText.setAlpha(0);
    this.add.tween({
      targets: this.deathText,
      alpha: 1,
      scale: { from: 0.9, to: 1 },
      duration: 3000,
      ease: 'Sine.easeOut'
    });

    createSoulsButton(this, width / 2 - 150, height * 0.7, 'Go To Lobby', () => {
      this.scene.start('MainMenuScene');
    });
    createSoulsButton(this, width / 2 + 150, height * 0.7, 'Restart', () => {
      this.scene.start('GameScene');
    });
  }

  update(time, delta) {
    this.timeElapsed += delta;
    this.deathText.setScale(1 + Math.sin(this.timeElapsed * 0.001) * 0.02);
  }
}

// ── GameScene — full multiplayer (my version, untouched) ──────────────────────
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.localPlayer = null;
    this.remotePlayer = null;
    this.p1Sprite = null;
    this.p2Sprite = null;
    this.localFireballs = null;
    this.remoteFireballs = null;
    this.wasd = null;
    this.stateUpdateTimer = 0;
    this.STATE_UPDATE_INTERVAL = 50;
  }

  create() {
    try {
      gameSceneRef = this;
      const { width, height } = this.scale;

      createRectTexture(this, 'player1_tex', 40, 40, 0x4488ff);
      createRectTexture(this, 'player2_tex', 40, 40, 0xff4444);
      createCircleTexture(this, 'fireball_tex', 10, 0xff8800);
      createCircleTexture(this, 'remote_fireball_tex', 10, 0xbb44ff);

      const floor = this.physics.add.staticGroup();
      const floorTile = this.add.rectangle(width / 2, height - 20, width, 40, 0x1a1e2b);
      this.physics.add.existing(floorTile, true);
      floor.add(floorTile);

      const platform = this.add.rectangle(width / 2, height * 0.55, 200, 20, 0x252d3a);
      this.physics.add.existing(platform, true);
      floor.add(platform);

      this.p1Sprite = this.physics.add.sprite(160, height / 2, 'player1_tex');
      this.p1Sprite.setCollideWorldBounds(true).setDragX(800);

      this.p2Sprite = this.physics.add.sprite(width - 160, height / 2, 'player2_tex');
      this.p2Sprite.setCollideWorldBounds(true).setDragX(800);

      this.physics.add.collider(this.p1Sprite, floor);
      this.physics.add.collider(this.p2Sprite, floor);

      this.localFireballs = this.physics.add.group({ defaultKey: 'fireball_tex', maxSize: 20, allowGravityY: false });
      this.remoteFireballs = this.physics.add.group({ defaultKey: 'remote_fireball_tex', maxSize: 20, allowGravityY: false });

      this.wasd = {
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      };

      this.input.on('pointerdown', (pointer) => {
        if (this.localPlayer) this.spawnLocalFireball(pointer.worldX, pointer.worldY, 1.0);
      });

      this.physics.world.on('worldbounds', (body) => {
        if (body.gameObject?.active) {
          body.gameObject.setActive(false).setVisible(false);
          body.setVelocity(0, 0);
        }
      });

      this.p1HpText = this.add.text(20, 20, 'P1 HP: 100', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#4488ff' });
      this.p2HpText = this.add.text(width - 20, 20, 'P2 HP: 100', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ff4444' }).setOrigin(1, 0);

      this.assignPlayers();
      console.log('[GameScene]: create() complete. myPlayerId =', myPlayerId);
    } catch (err) {
      console.error('[GameScene create Error]:', err);
    }
  }

  assignPlayers() {
    if (!myPlayerId) { console.warn('[assignPlayers]: myPlayerId not yet set'); return; }
    if (myPlayerId === 'Player 1') {
      this.localPlayer = this.p1Sprite;
      this.remotePlayer = this.p2Sprite;
    } else {
      this.localPlayer = this.p2Sprite;
      this.remotePlayer = this.p1Sprite;
    }
    this.setupCollisions();
    console.log(`[GameScene]: localPlayer = ${myPlayerId}`);
  }

  setupCollisions() {
    if (this._overlapLocal) this._overlapLocal.destroy();
    if (this._overlapRemote) this._overlapRemote.destroy();
    this._overlapLocal = this.physics.add.overlap(this.localFireballs, this.remotePlayer, this.onLocalFireballHit, null, this);
    this._overlapRemote = this.physics.add.overlap(this.remoteFireballs, this.localPlayer, this.onRemoteFireballHit, null, this);
  }

  update(time, delta) {
    try {
      if (!this.localPlayer) return;
      this.handleLocalPlayerMovement();
      this.killOffscreenFireballs();
      this.stateUpdateTimer += delta;
      if (this.stateUpdateTimer >= this.STATE_UPDATE_INTERVAL) {
        this.stateUpdateTimer = 0;
        socket.emit('STATE_UPDATE', {
          x: this.localPlayer.x,
          y: this.localPlayer.y,
          velocity: { x: this.localPlayer.body.velocity.x, y: this.localPlayer.body.velocity.y }
        });
      }
    } catch (err) {
      console.error('[GameScene update Error]:', err);
    }
  }

  handleLocalPlayerMovement() {
    const speedMult = (typeof playerSpeed !== 'undefined') ? playerSpeed : 1.0;
    const speed = 280 * speedMult;
    const p = this.localPlayer;
    p.setVelocityX(0);
    if (this.wasd.left.isDown) p.setVelocityX(-speed);
    if (this.wasd.right.isDown) p.setVelocityX(speed);
    if (this.wasd.up.isDown && p.body.blocked.down) p.setVelocityY(-520);
  }

  killOffscreenFireballs() {
    const kill = (group) => group.getChildren().forEach((fb) => {
      if (!fb.active) return;
      if (fb.x < -50 || fb.x > this.scale.width + 50 || fb.y < -50 || fb.y > this.scale.height + 50) {
        fb.setActive(false).setVisible(false);
        fb.body.setVelocity(0, 0);
      }
    });
    kill(this.localFireballs);
    kill(this.remoteFireballs);
  }

  spawnLocalFireball(targetX, targetY, scale) {
    try {
      const fireball = this.localFireballs.get(this.localPlayer.x, this.localPlayer.y);
      if (!fireball) { console.warn('[spawnLocalFireball]: Pool exhausted.'); return; }
      fireball.setActive(true).setVisible(true).setScale(scale);
      fireball.body.allowGravity = false;
      fireball.body.setCollideWorldBounds(true);
      fireball.body.onWorldBounds = true;
      const dx = targetX - this.localPlayer.x;
      const dy = targetY - this.localPlayer.y;
      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx);
      fireball.body.setVelocity((dx / mag) * 480, (dy / mag) * 480);
      socket.emit('SPELL_CAST', { spell: 'fireball', x: this.localPlayer.x, y: this.localPlayer.y, angle, scale });
    } catch (err) {
      console.error('[spawnLocalFireball Error]:', err);
    }
  }

  castSpellFromResult(result) {
    try {
      if (!this.localPlayer) return;
      if (result.backfire) {
        this.spawnExplosion(this.localPlayer.x, this.localPlayer.y, 0xff0000);
        console.log('[castSpellFromResult]: BACKFIRE!');
        return;
      }
      const targetX = this.remotePlayer ? this.remotePlayer.x : this.scale.width / 2;
      const targetY = this.remotePlayer ? this.remotePlayer.y : this.scale.height / 2;
      this.spawnLocalFireball(targetX, targetY, volumeToScale(result.volume));
    } catch (err) {
      console.error('[castSpellFromResult Error]:', err);
    }
  }

  spawnExplosion(x, y, color = 0xff8800) {
    try {
      const circle = this.add.graphics();
      circle.fillStyle(color, 0.85);
      circle.fillCircle(0, 0, 40);
      circle.setPosition(x, y);
      this.add.tween({ targets: circle, alpha: 0, scaleX: 3, scaleY: 3, duration: 400, ease: 'Power2', onComplete: () => circle.destroy() });
    } catch (err) {
      console.error('[spawnExplosion Error]:', err);
    }
  }

  onLocalFireballHit(fireball, remotePlayer) {
    try {
      fireball.setActive(false).setVisible(false);
      fireball.body.setVelocity(0, 0);
      this.spawnExplosion(remotePlayer.x, remotePlayer.y);
      console.log('[GameScene]: Local fireball hit remote player!');
    } catch (err) { console.error('[onLocalFireballHit Error]:', err); }
  }

  onRemoteFireballHit(fireball, localPlayer) {
    try {
      fireball.setActive(false).setVisible(false);
      fireball.body.setVelocity(0, 0);
      this.spawnExplosion(localPlayer.x, localPlayer.y, 0xbb44ff);
      console.log('[GameScene]: Remote fireball hit local player!');
    } catch (err) { console.error('[onRemoteFireballHit Error]:', err); }
  }

  onRemoteStateUpdate(data) {
    try {
      if (!this.remotePlayer) return;
      this.remotePlayer.setPosition(data.x, data.y);
      if (data.velocity) this.remotePlayer.setVelocity(data.velocity.x, data.velocity.y);
    } catch (err) { console.error('[onRemoteStateUpdate Error]:', err); }
  }

  onRemoteSpell(data) {
    try {
      const fireball = this.remoteFireballs.get(data.x, data.y);
      if (!fireball) { console.warn('[onRemoteSpell]: Remote pool exhausted.'); return; }
      fireball.setActive(true).setVisible(true).setScale(data.scale || 1.0);
      fireball.body.allowGravity = false;
      fireball.body.setCollideWorldBounds(true);
      fireball.body.onWorldBounds = true;
      fireball.body.setVelocity(Math.cos(data.angle) * 480, Math.sin(data.angle) * 480);
    } catch (err) { console.error('[onRemoteSpell Error]:', err); }
  }
}

// ─── Phaser Game Config ───────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 480 }, debug: false } },
  scene: [MainMenuScene, GameScene, EndScene],
};

const game = new Phaser.Game(config);