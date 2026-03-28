// ─── Socket.io connection ────────────────────────────────────────────────────
const socket = io();

let myId = null;
let myPlayer = null;
let otherPlayer = null;

socket.on('connect', () => {
    console.log('[Client]: Connected to server via socket.io');
});

socket.on('PLAYER_JOINED', (data) => {
    myId = data.id;
    console.log(`[Client]: Assigned as ${myId}`);
});

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

// ─── Phaser Scene ─────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Player references
        this.player1 = null;
        this.player2 = null;

        // Background references
        this.bg1 = null;
        this.bg2 = null;
        this.bg3 = null;
        this.bg4 = null;
        this.bg5 = null;

        // Fireball group
        this.fireballs = null;

        // WASD keys
        this.wasd = null;
    }

    // ── preload ───────────────────────────────────────────────────────────────
    preload() {
        this.load.image('bg1', 'assets/parallax_mountain_pack/layers/parallax-mountain-bg.png');
        this.load.image('bg2', 'assets/parallax_mountain_pack/layers/parallax-mountain-montain-far.png');
        this.load.image('bg3', 'assets/parallax_mountain_pack/layers/parallax-mountain-mountains.png');
        this.load.image('bg4', 'assets/parallax_mountain_pack/layers/parallax-mountain-trees.png');
        this.load.image('bg5', 'assets/parallax_mountain_pack/layers/parallax-mountain-foreground-trees.png');
        this.load.spritesheet('rogue', 'assets/rogue spritesheet calciumtrice.png', {
            frameWidth: 32,
            frameHeight: 32
        });
    }

    // ── create ────────────────────────────────────────────────────────────────
    create() {
        try {
            const { width, height } = this.scale;

            this.bg1 = this.add.image(width / 2, height / 2, 'bg1').setDisplaySize(width, height).setDepth(-5);
            this.bg2 = this.add.image(width / 2, height / 2, 'bg2').setDisplaySize(width, height).setDepth(-4);
            this.bg3 = this.add.image(width / 2, height / 2, 'bg3').setDisplaySize(width, height).setDepth(-3);
            this.bg4 = this.add.image(width / 2, height / 2, 'bg4').setDisplaySize(width, height).setDepth(-2);
            this.bg5 = this.add.image(width / 2, height / 2, 'bg5').setDisplaySize(width, height).setDepth(-1);

            // --- Generate textures from Graphics (no external assets) ---
            createCircleTexture(this, 'fireball_tex', 10, 0xff8800);    // orange

            // Animations
            this.anims.create({
                key: 'rogue-idle',
                frames: this.anims.generateFrameNumbers('rogue', { start: 0, end: 9 }),
                frameRate: 10,
                repeat: -1
            });
            this.anims.create({
                key: 'rogue-run',
                frames: this.anims.generateFrameNumbers('rogue', { start: 10, end: 19 }),
                frameRate: 15,
                repeat: -1
            });

            // --- Player 1 (blue, left side) ---
            this.player1 = this.physics.add.sprite(200, height / 2, 'rogue');
            this.player1.setCollideWorldBounds(true);
            this.player1.setScale(3.5);
            this.player1.setTint(0x88bbff); // Light blue tint
            this.player1.setImmovable(true);
            this.player1.hp = 100;
            this.player1.isInvulnerable = false;
            this.player1.hpBar = this.add.graphics();
            
            // --- Player 2 (red, right side) ---
            this.player2 = this.physics.add.sprite(600, height / 2, 'rogue');
            this.player2.setCollideWorldBounds(true);
            this.player2.setScale(3.5);
            this.player2.setFlipX(true); // look left by default
            this.player2.setTint(0xff8888); // Light red tint
            this.player2.setImmovable(true);
            this.player2.hp = 100;
            this.player2.isInvulnerable = false;
            this.player2.hpBar = this.add.graphics();

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
            this.physics.add.overlap(
                this.fireballs,
                this.player1,
                this.onFireballHit,
                null,
                this
            );

            // --- WASD input ---
            this.wasd = {
                up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
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

            // Set up Socket listeners for Game events
            socket.on('BROADCAST_STATE', (data) => {
                if (data.senderId !== myId && otherPlayer) {
                    otherPlayer.setPosition(data.x, data.y);
                    if (data.vx !== undefined && data.vy !== undefined) {
                        otherPlayer.setVelocity(data.vx, data.vy);
                    }
                }
            });

            socket.on('BROADCAST_SPELL', (data) => {
                if (data.senderId !== myId && otherPlayer) {
                    this.spawnRemoteFireball(data);
                }
            });

            console.log('[GameScene]: create() complete');
        } catch (err) {
            console.error('[GameScene create Error]:', err);
        }
    }

    // ── update ────────────────────────────────────────────────────────────────
    update() {
        try {
            if (!myId) return; // wait for server to assign ID

            if (!myPlayer) {
                if (myId === 'Player 1') {
                    myPlayer = this.player1;
                    otherPlayer = this.player2;
                } else {
                    myPlayer = this.player2;
                    otherPlayer = this.player1;
                }
                // Allow our player to move locally with friction
                myPlayer.setImmovable(false);
                myPlayer.setDragX(800);
                
                // Lock the other player since they are network-controlled
                otherPlayer.setImmovable(true);
                otherPlayer.setDragX(0);
            }

            this.handleMyMovement();
            
            this.updatePlayerAnimations(this.player1);
            this.updatePlayerAnimations(this.player2);
            
            this.updateHealthBar(this.player1);
            this.updateHealthBar(this.player2);

            // Emit STATE_UPDATE constantly
            socket.emit('STATE_UPDATE', {
                x: myPlayer.x,
                y: myPlayer.y,
                vx: myPlayer.body.velocity.x,
                vy: myPlayer.body.velocity.y
            });

        } catch (err) {
            console.error('[GameScene update Error]:', err);
        }
    }

    // ── handleMyMovement ─────────────────────────────────────────────────
    handleMyMovement() {
        if (!myPlayer) return;
        const speed = 400;
        const jumpSpeed = -750;

        myPlayer.setVelocityX(0);  // reset each frame so drag takes over cleanly

        if (this.wasd.left.isDown)  myPlayer.setVelocityX(-speed);
        if (this.wasd.right.isDown) myPlayer.setVelocityX(speed);

        // Reset jumps when the player hits the floor
        if (myPlayer.body.blocked.down || myPlayer.body.touching.down) {
            myPlayer.jumps = 0;
        }

        // JustDown triggers once per key press (double jump limit)
        if (Phaser.Input.Keyboard.JustDown(this.wasd.up)) {
            if (myPlayer.jumps === undefined) myPlayer.jumps = 0;
            if (myPlayer.jumps < 2) {
                myPlayer.setVelocityY(jumpSpeed);
                myPlayer.jumps++;
            }
        }
    }

    // ── updateHealthBar ───────────────────────────────────────────────────────
    updateHealthBar(player) {
        if (!player || !player.hpBar || !player.active) {
            if (player && player.hpBar) player.hpBar.clear();
            return;
        }
        player.hpBar.clear();
        if (player.hp <= 0) return;
        
        const barWidth = 200;
        const barHeight = 20;
        let x, y;
        
        if (player === this.player1) {
            x = 20;
            y = 20;
        } else {
            x = this.scale.width - barWidth - 20;
            y = 20;
        }
        
        // Background (black)
        player.hpBar.fillStyle(0x000000, 1);
        player.hpBar.fillRect(x, y, barWidth, barHeight);
        
        // Health (green/red)
        const color = player.hp > 30 ? 0x00ff00 : 0xff0000;
        player.hpBar.fillStyle(color, 1);
        
        const currentWidth = (barWidth - 4) * (player.hp / 100);
        player.hpBar.fillRect(x + 2, y + 2, currentWidth, barHeight - 4);
    }

    // ── updatePlayerAnimations ────────────────────────────────────────────────
    updatePlayerAnimations(player) {
        if (!player || !player.active) return;
        
        if (Math.abs(player.body.velocity.x) > 5 || Math.abs(player.body.velocity.y) > 5) {
            player.anims.play('rogue-run', true);
        } else {
            player.anims.play('rogue-idle', true);
        }

        if (player.body.velocity.x < -5) {
            player.setFlipX(true);
        } else if (player.body.velocity.x > 5) {
            player.setFlipX(false);
        }
    }

    // ── castFireball ──────────────────────────────────────────────────────────
    castFireball(pointer) {
        try {
            if (!myPlayer) return;

            // Get an inactive fireball from the pool
            const fireball = this.fireballs.get(myPlayer.x, myPlayer.y);
            if (!fireball) {
                console.warn('[castFireball]: Pool exhausted, no fireball available.');
                return;
            }

            fireball.enableBody(true, myPlayer.x, myPlayer.y, true, true);
            fireball.body.allowGravity = false;
            fireball.body.setCollideWorldBounds(true);
            fireball.body.onWorldBounds = true;

            // Direction vector from player to cursor
            const dx = pointer.worldX - myPlayer.x;
            const dy = pointer.worldY - myPlayer.y;
            const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
            const projectileSpeed = 450;

            fireball.body.setVelocity(
                (dx / magnitude) * projectileSpeed,
                (dy / magnitude) * projectileSpeed
            );
            
            // Broadcast Spell
            socket.emit('SPELL_CAST', {
                spell: 'fireball',
                x: myPlayer.x,
                y: myPlayer.y,
                targetX: pointer.worldX,
                targetY: pointer.worldY,
                angle: Math.atan2(dy, dx),
                scale: 1
            });
        } catch (err) {
            console.error('[castFireball Error]:', err);
        }
    }

    // ── spawnRemoteFireball ───────────────────────────────────────────────────
    spawnRemoteFireball(data) {
        try {
            const fireball = this.fireballs.get(data.x, data.y);
            if (!fireball) return;

            fireball.enableBody(true, data.x, data.y, true, true);
            fireball.body.allowGravity = false;
            fireball.body.setCollideWorldBounds(true);
            fireball.body.onWorldBounds = true;

            const dx = data.targetX - data.x;
            const dy = data.targetY - data.y;
            const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
            const projectileSpeed = 450;

            fireball.body.setVelocity(
                (dx / magnitude) * projectileSpeed,
                (dy / magnitude) * projectileSpeed
            );
        } catch (err) {
            console.error('[spawnRemoteFireball Error]:', err);
        }
    }

    // ── onFireballHit ─────────────────────────────────────────────────────────
    onFireballHit(fireball, player) {
        try {
            if (!fireball.active) return;
            fireball.disableBody(true, true);
            fireball.setPosition(-9999, -9999);
            
            if (!player.active || player.isInvulnerable) return;

            player.hp = Math.max(0, player.hp - 10);
            
            player.isInvulnerable = true;
            this.time.delayedCall(100, () => {
                player.isInvulnerable = false;
            });

            if (player.hp === 0) {
                console.log(`[GameScene]: ${player === myPlayer ? 'I died!' : 'Opponent died!'}`);
                player.setActive(false).setVisible(false);
                player.body.setVelocity(0, 0);
                if (player.hpBar) player.hpBar.clear();

                // Respawn after 3 seconds
                this.time.delayedCall(3000, () => {
                    player.hp = 100;
                    player.setActive(true).setVisible(true);
                    if (player === this.player1) player.setPosition(200, this.scale.height / 2);
                    if (player === this.player2) player.setPosition(600, this.scale.height / 2);
                });
            } else {
                if (player === myPlayer) {
                    console.log('[GameScene]: I was hit by a fireball! HP:', player.hp);
                } else {
                    console.log('[GameScene]: I hit the other player! HP:', player.hp);
                }

                // Flash tint
                player.setTint(0xff0000);
                this.time.delayedCall(200, () => {
                    player.clearTint();
                });
            }

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
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1500 },
            debug: false,
        },
    },
    scene: [GameScene],
};

const game = new Phaser.Game(config);
