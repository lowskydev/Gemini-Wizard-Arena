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
    backgroundColor: '#1a1a2e',
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
    scene: [GameScene],
};

const game = new Phaser.Game(config);
