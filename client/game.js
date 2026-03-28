// ─── Socket.io connection ────────────────────────────────────────────────────
const socket = io();

socket.on('connect', () => {
    console.log('[Client]: Connected to server via socket.io');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a Phaser RenderTexture that looks like a filled rectangle.
 * This gives us a texture we can hand to physics sprites.
 */
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

/**
 * Creates a Phaser RenderTexture that looks like a filled circle.
 */
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

// ─── Phaser Scene ─────────────────────────────────────────────────────────────

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
        bg.fillRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);

        if (isHover) {
            bg.lineStyle(2, 0xffaa00, 1); // gold
            text.setColor('#ffffff');
            text.setShadow(0, 0, '#ffaa00', 8, false, true);
        } else {
            bg.lineStyle(1, 0x555555, 0.8);
            text.setColor('#aaaaaa');
            text.setShadow(0, 0, '#000000', 0);
        }
        bg.strokeRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight);
    };

    draw(false);

    const zone = scene.add.zone(0, 0, btnWidth, btnHeight).setInteractive({ cursor: 'pointer' });
    container.add(zone);

    zone.on('pointerover', () => { draw(true); container.setScale(1.05); });
    zone.on('pointerout', () => { draw(false); container.setScale(1); });
    zone.on('pointerdown', onClick);

    return container;
}

class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
        this.timeElapsed = 0;
    }

    create() {
        const { width, height } = this.scale;

        // Vignette-like overlay
        const vignette = this.add.graphics();
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.8, 0.8);
        vignette.fillRect(0, 0, width, height);

        // Title: Vibe-Wizard Arena
        this.title = this.add.text(width / 2, height * 0.25, 'Vibe-Wizard Arena', {
            fontFamily: 'Georgia, serif',
            fontSize: '80px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.title.setShadow(2, 4, '#000000', 10, false, true);

        // Simple elegant line separator
        const line = this.add.graphics();
        line.lineStyle(2, 0x550000, 0.8);
        line.beginPath();
        line.moveTo(width / 2 - 200, height * 0.35);
        line.lineTo(width / 2 + 200, height * 0.35);
        line.strokePath();

        // Lobby UI Box
        const lobbyBox = this.add.graphics();
        lobbyBox.fillStyle(0x000000, 0.5);
        lobbyBox.lineStyle(1, 0x333333, 1);
        lobbyBox.fillRect(width / 2 - 250, height * 0.4, 500, 250);
        lobbyBox.strokeRect(width / 2 - 250, height * 0.4, 500, 250);

        this.add.text(width / 2, height * 0.48, 'LAN LOBBY', {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: '#cccccc',
            letterSpacing: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.55, 'Player 1: Connected', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#ff4444' // red
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.62, 'Player 2: Waiting...', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#555555' 
        }).setOrigin(0.5);

        // Ready Button -> goes to EndScene for testing
        createSoulsButton(this, width / 2, height * 0.8, 'READY', () => {
            this.scene.start('EndScene');
        });
    }

    update(time, delta) {
        this.timeElapsed += delta;
        // Slow pulsing effect for title
        const scale = 1 + Math.sin(this.timeElapsed * 0.0015) * 0.02;
        this.title.setScale(scale);
        this.title.setAlpha(0.8 + Math.sin(this.timeElapsed * 0.002) * 0.2);
    }
}

class EndScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EndScene' });
        this.timeElapsed = 0;
    }

    create() {
        const { width, height } = this.scale;
        
        // Dark red overlay
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

        // Add buttons below
        createSoulsButton(this, width / 2 - 150, height * 0.7, 'Go To Lobby', () => {
            this.scene.start('MainMenuScene');
        });

        createSoulsButton(this, width / 2 + 150, height * 0.7, 'Restart', () => {
            // TODO: implement restart later
            console.log('Restart pressed, to be implemented');
        });
    }

    update(time, delta) {
        this.timeElapsed += delta;
        // Keep the death text slowly pulsating slightly
        this.deathText.setScale(1 + Math.sin(this.timeElapsed * 0.001) * 0.02);
    }
}
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Player references
        this.player1 = null;
        this.player2 = null;

        // Fireball group (pre-allocated, never instantiated inside update)
        this.fireballs = null;

        // WASD keys
        this.wasd = null;
    }

    // ── create ────────────────────────────────────────────────────────────────
    create() {
        try {
            const { width, height } = this.scale;

            // --- Generate textures from Graphics (no external assets) ---
            createRectTexture(this, 'player1_tex', 40, 40, 0x4488ff);   // blue
            createRectTexture(this, 'player2_tex', 40, 40, 0xff4444);   // red
            createCircleTexture(this, 'fireball_tex', 10, 0xff8800);    // orange

            // --- Player 1 (blue, left side) ---
            this.player1 = this.physics.add.sprite(200, height / 2, 'player1_tex');
            this.player1.setCollideWorldBounds(true);
            this.player1.setDragX(800);   // friction so it doesn't slide forever

            // --- Player 2 (red, right side) ---
            this.player2 = this.physics.add.sprite(600, height / 2, 'player2_tex');
            this.player2.setCollideWorldBounds(true);
            this.player2.setImmovable(true);   // AI/network will control this later

            // --- Fireball group (physics-enabled, inactive pool) ---
            this.fireballs = this.physics.add.group({
                defaultKey: 'fireball_tex',
                maxSize: 20,
                allowGravityY: false,       // spells fly straight
            });

            // --- Collision: fireball hits Player 2 → destroy both ---
            this.physics.add.overlap(
                this.fireballs,
                this.player2,
                this.onFireballHit,
                null,
                this
            );

            // --- WASD input ---
            this.wasd = {
                up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };

            // --- Click to cast fireball ---
            this.input.on('pointerdown', this.castFireball, this);

            // --- World bounds kill fireballs that leave the screen ---
            this.physics.world.on('worldbounds', (body) => {
                if (body.gameObject && body.gameObject.active) {
                    body.gameObject.setActive(false).setVisible(false);
                }
            });

            // Enable world bounds collision checking for the fireball group
            // (done per-fireball in castFireball)

            console.log('[GameScene]: create() complete');
        } catch (err) {
            console.error('[GameScene create Error]:', err);
        }
    }

    // ── update ────────────────────────────────────────────────────────────────
    update() {
        try {
            this.handlePlayer1Movement();
        } catch (err) {
            console.error('[GameScene update Error]:', err);
        }
    }

    // ── handlePlayer1Movement ─────────────────────────────────────────────────
    handlePlayer1Movement() {
        const speed = 250;
        const p1 = this.player1;

        p1.setVelocityX(0);  // reset each frame so drag takes over cleanly

        if (this.wasd.left.isDown)  p1.setVelocityX(-speed);
        if (this.wasd.right.isDown) p1.setVelocityX(speed);
        if (this.wasd.up.isDown)    p1.setVelocityY(-speed);
        if (this.wasd.down.isDown)  p1.setVelocityY(speed);
    }

    // ── castFireball ──────────────────────────────────────────────────────────
    castFireball(pointer) {
        try {
            // Get an inactive fireball from the pool
            const fireball = this.fireballs.get(this.player1.x, this.player1.y);
            if (!fireball) {
                console.warn('[castFireball]: Pool exhausted, no fireball available.');
                return;
            }

            fireball.setActive(true).setVisible(true);
            fireball.body.allowGravity = false;
            fireball.body.setCollideWorldBounds(true);
            fireball.body.onWorldBounds = true;

            // Direction vector from player to cursor
            const dx = pointer.worldX - this.player1.x;
            const dy = pointer.worldY - this.player1.y;
            const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
            const projectileSpeed = 450;

            fireball.body.setVelocity(
                (dx / magnitude) * projectileSpeed,
                (dy / magnitude) * projectileSpeed
            );
        } catch (err) {
            console.error('[castFireball Error]:', err);
        }
    }

    // ── onFireballHit ─────────────────────────────────────────────────────────
    onFireballHit(fireball, _player2) {
        try {
            fireball.setActive(false).setVisible(false);
            fireball.body.setVelocity(0, 0);
            console.log('[GameScene]: Fireball hit Player 2!');
        } catch (err) {
            console.error('[onFireballHit Error]:', err);
        }
    }
}

// ─── Phaser Game Config ───────────────────────────────────────────────────────

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    transparent: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false,
        },
    },
    scene: [MainMenuScene, GameScene, EndScene],
};

const game = new Phaser.Game(config);
