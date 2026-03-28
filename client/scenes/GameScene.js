// scenes/GameScene.js — Core gameplay scene
// ─────────────────────────────────────────────────────────────────────────────
// Section map:
//   1. constructor
//   2. Lifecycle   — preload / create / update
//   3. Players     — assignPlayers / handleMyMovement / updatePlayerAnimations
//   4. UI          — updateHealthBar
//   5. Spells      — castFireball / castSpellFromResult / spawnExplosion
//   6. Collisions  — onFireballHit
//   7. Network     — onRemoteStateUpdate / onRemoteSpell
// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {  // eslint-disable-line no-undef

    // ── 1. Constructor ────────────────────────────────────────────────────────
    constructor() {
        super({ key: 'GameScene' });

        this.player1 = null;
        this.player2 = null;
        this.myPlayer = null;
        this.otherPlayer = null;

        this.fireballs = null;
        this.platforms = null;
        this.playerIndicator = null;
        this.wasd = null;

        // STATE_UPDATE throttle — 20 updates/sec
        this.stateTimer = 0;
        this.STATE_INTERVAL = 50;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  2. Lifecycle
    // ═════════════════════════════════════════════════════════════════════════

    preload() {
        // Spritesheet is loaded here because it's always required
        this.load.spritesheet('rogue', 'assets/rogue spritesheet calciumtrice.png', {
            frameWidth: 32,
            frameHeight: 32,
        });

        // Arena-specific assets delegated to the selected arena
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        arena?.preload?.(this);
    }

    create() {
        try {
            gameSceneRef = this;  // eslint-disable-line no-undef
            const { width, height } = this.scale;

            this._buildBackground(width, height);
            this._buildTextures();
            this._buildAnimations();
            this._buildPlayers(width, height);
            this._buildPlatforms(width, height);
            this._buildFireballGroup();
            this._buildInput(width, height);

            this.assignPlayers();

            console.log('[GameScene]: create() done. myPlayerId =', myPlayerId);  // eslint-disable-line no-undef
        } catch (err) {
            console.error('[GameScene create Error]:', err);
        }
    }

    update(time, delta) {
        try {
            if (!this.myPlayer && myPlayerId) this.assignPlayers();  // eslint-disable-line no-undef
            if (!this.myPlayer) return;

            this.handleMyMovement();
            this.updatePlayerAnimations(this.player1);
            this.updatePlayerAnimations(this.player2);
            this.updateHealthBar(this.player1);
            this.updateHealthBar(this.player2);
            this._updateIndicator(time);
            this._emitStateUpdate(delta);
        } catch (err) {
            console.error('[GameScene update Error]:', err);
        }
    }

    // ── Private create helpers ────────────────────────────────────────────────

    _buildBackground(width, height) {
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        arena?.buildBackground?.(this);
    }

    _buildTextures() {
        createCircleTexture(this, 'fireball_tex', 10, 0xff8800);  // eslint-disable-line no-undef
    }

    _buildAnimations() {
        const anims = [
            { key: 'rogue-idle', start: 0, end: 9, frameRate: 10, repeat: -1 },
            { key: 'rogue-cast', start: 10, end: 19, frameRate: 15, repeat: 0 },
            { key: 'rogue-run', start: 20, end: 29, frameRate: 15, repeat: -1 },
        ];

        anims.forEach(({ key, start, end, frameRate, repeat }) => {
            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers('rogue', { start, end }),
                frameRate,
                repeat,
            });
        });
    }

    _buildPlayers(width, height) {
        const makePlayer = (x, flip) => {
            const p = this.physics.add.sprite(x, height / 2, 'rogue');
            p.setCollideWorldBounds(true).setScale(3.5).setImmovable(true);
            if (flip) p.setFlipX(true);
            p.hp = 100;
            p.isInvulnerable = false;
            p.hpBar = this.add.graphics();
            return p;
        };

        this.player1 = makePlayer(200, false);
        this.player2 = makePlayer(width - 200, true);
    }

    _buildPlatforms(width, height) {
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        this.platforms = arena?.buildPlatforms?.(this, width, height)
            ?? this.physics.add.staticGroup();

        const dropDownCallback = (p) => {
            if (p === this.myPlayer && this.wasd.down.isDown) return false;
            return true;
        };

        this.physics.add.collider(this.player1, this.platforms, null, dropDownCallback, this);
        this.physics.add.collider(this.player2, this.platforms, null, dropDownCallback, this);
    }

    _buildFireballGroup() {
        this.fireballs = this.physics.add.group({
            defaultKey: 'fireball_tex',
            allowGravityY: false,
        });

        // Fireballs extinguish on platforms
        this.physics.add.collider(this.fireballs, this.platforms, (fb) => {
            if (fb.active) fb.disableBody(true, true).setPosition(-9999, -9999);
        });

        // Fireballs can hit either player (owner tag prevents self-hits)
        this.physics.add.overlap(this.fireballs, this.player1, this.onFireballHit, null, this);
        this.physics.add.overlap(this.fireballs, this.player2, this.onFireballHit, null, this);
    }

    _buildInput() {
        this.wasd = {
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),   // eslint-disable-line no-undef
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),   // eslint-disable-line no-undef
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),    // eslint-disable-line no-undef
            jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), // eslint-disable-line no-undef
        };

        // Click-to-cast fallback (dev / non-voice mode)
        this.input.on('pointerdown', (ptr) => {
            if (this.myPlayer) this.castFireball(ptr);
        });

        // Cast animation plays immediately on mousedown for responsiveness
        this.game.canvas.addEventListener('mousedown', () => {
            if (!this.myPlayer || this.myPlayer.isCasting) return;
            this.myPlayer.isCasting = true;
            this.myPlayer.anims.play('rogue-cast', true);
            this.myPlayer.once('animationcomplete-rogue-cast', () => {
                this.myPlayer.isCasting = false;
            });
        });

        // Clean up fireballs that exit the world
        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject?.active) {
                body.gameObject.disableBody(true, true);
                body.gameObject.setPosition(-9999, -9999);
            }
        });
    }

    // ── Private update helpers ────────────────────────────────────────────────

    _updateIndicator(time) {
        if (!this.playerIndicator) return;
        const bob = Math.sin(time / 150) * 8;
        this.playerIndicator.setPosition(this.myPlayer.x, this.myPlayer.y - 70 + bob);
        this.playerIndicator.setVisible(this.myPlayer.active);
    }

    _emitStateUpdate(delta) {
        this.stateTimer += delta;
        if (this.stateTimer < this.STATE_INTERVAL) return;
        this.stateTimer = 0;

        socket.emit('STATE_UPDATE', {  // eslint-disable-line no-undef
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            vx: this.myPlayer.body.velocity.x,
            vy: this.myPlayer.body.velocity.y,
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  3. Players
    // ═════════════════════════════════════════════════════════════════════════

    assignPlayers() {
        if (!myPlayerId || this.myPlayer) return;  // eslint-disable-line no-undef

        const isP1 = myPlayerId === 'Player 1';  // eslint-disable-line no-undef
        this.myPlayer = isP1 ? this.player1 : this.player2;
        this.otherPlayer = isP1 ? this.player2 : this.player1;

        // Local player needs physics; remote is network-driven
        this.myPlayer.setImmovable(false).setDragX(800);
        this.otherPlayer.setImmovable(true).setDragX(0);

        this.playerIndicator = this.add.text(
            this.myPlayer.x, this.myPlayer.y - 70, '▼',
            { fontSize: '28px', fill: '#ffff00', stroke: '#000000', strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(10);

        console.log(`[GameScene]: assignPlayers() — I am ${myPlayerId}`);  // eslint-disable-line no-undef
    }

    handleMyMovement() {
        const speedMult = (typeof playerSpeed !== 'undefined') ? playerSpeed : 1.0;  // eslint-disable-line no-undef
        const speed = 400 * speedMult;
        const p = this.myPlayer;

        p.setVelocityX(0);
        if (this.wasd.left.isDown) p.setVelocityX(-speed);
        if (this.wasd.right.isDown) p.setVelocityX(speed);

        // Double-jump
        if (p.body.blocked.down || p.body.touching.down) p.jumps = 0;
        if (Phaser.Input.Keyboard.JustDown(this.wasd.jump)) {  // eslint-disable-line no-undef
            if (p.jumps === undefined) p.jumps = 0;
            if (p.jumps < 2) { p.setVelocityY(-750); p.jumps++; }
        }
    }

    updatePlayerAnimations(player) {
        if (!player?.active || player.isCasting) return;

        const moving = Math.abs(player.body.velocity.x) > 5
            || Math.abs(player.body.velocity.y) > 10;
        player.anims.play(moving ? 'rogue-run' : 'rogue-idle', true);

        if (player.body.velocity.x < -5) player.setFlipX(true);
        else if (player.body.velocity.x > 5) player.setFlipX(false);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  4. UI
    // ═════════════════════════════════════════════════════════════════════════

    updateHealthBar(player) {
        if (!player?.hpBar) return;
        player.hpBar.clear();
        if (!player.active || player.hp <= 0) return;

        const BAR_W = 200;
        const BAR_H = 18;
        const x = (player === this.player1) ? 20 : this.scale.width - BAR_W - 20;
        const y = 20;

        // Background
        player.hpBar.fillStyle(0x000000, 1);
        player.hpBar.fillRect(x, y, BAR_W, BAR_H);

        // Fill
        const color = player.hp > 30 ? 0x00ff00 : 0xff0000;
        player.hpBar.fillStyle(color, 1);
        player.hpBar.fillRect(x + 2, y + 2, (BAR_W - 4) * (player.hp / 100), BAR_H - 4);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  5. Spells
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Spawns a fireball aimed at `pointer` (click / dev mode).
     */
    castFireball(pointer) {
        try {
            if (!this.myPlayer) return;

            const fb = this._getFreshFireball();
            if (!fb) return;

            const dx = pointer.worldX - this.myPlayer.x;
            const dy = pointer.worldY - this.myPlayer.y;

            this._launchFireball(fb, dx, dy, 1.0);
            this._emitSpellCast('fireball', pointer.worldX, pointer.worldY, 1.0);
        } catch (err) {
            console.error('[castFireball Error]:', err);
        }
    }

    /**
     * Processes a Gemini AI result and casts the matching spell.
     * Called via window.castSpellFromAudio (bridge in socket.js).
     */
    castSpellFromResult(result) {
        try {
            if (!this.myPlayer) return;

            if (result.backfire) {
                this.spawnExplosion(this.myPlayer.x, this.myPlayer.y, 0xff0000);
                this.myPlayer.hp = Math.max(0, this.myPlayer.hp - 15);
                console.log('[Spell]: BACKFIRE! Self-damage applied.');
                return;
            }

            const scale = volumeToScale(result.volume);  // eslint-disable-line no-undef
            const targetX = this.input.activePointer.worldX || this.otherPlayer?.x || this.scale.width / 2;
            const targetY = this.input.activePointer.worldY || this.otherPlayer?.y || this.scale.height / 2;

            const fb = this._getFreshFireball(scale);
            if (!fb) return;

            const dx = targetX - this.myPlayer.x;
            const dy = targetY - this.myPlayer.y;

            this._launchFireball(fb, dx, dy, scale);
            this._emitSpellCast(result.spell, targetX, targetY, scale);
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

            this.add.tween({
                targets: circle,
                alpha: 0, scaleX: 3, scaleY: 3,
                duration: 400,
                ease: 'Power2',
                onComplete: () => circle.destroy(),
            });
        } catch (err) {
            console.error('[spawnExplosion Error]:', err);
        }
    }

    // ── Spell helpers ─────────────────────────────────────────────────────────

    _getFreshFireball(scale = 1.0) {
        const fb = this.fireballs.get();
        if (!fb) { console.warn('[Spell]: Fireball pool exhausted.'); return null; }

        fb.enableBody(true, this.myPlayer.x, this.myPlayer.y, true, true);
        fb.setScale(scale);
        fb.body.allowGravity = false;
        fb.body.collideWorldBounds = true;
        fb.body.onWorldBounds = true;
        fb.owner = this.myPlayer;
        return fb;
    }

    _launchFireball(fb, dx, dy, speed = 450) {
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        fb.body.setVelocity((dx / mag) * 450, (dy / mag) * 450);
    }

    _emitSpellCast(spell, targetX, targetY, scale) {
        const dx = targetX - this.myPlayer.x;
        const dy = targetY - this.myPlayer.y;

        socket.emit('SPELL_CAST', {  // eslint-disable-line no-undef
            spell,
            x: this.myPlayer.x,
            y: this.myPlayer.y,
            targetX,
            targetY,
            angle: Math.atan2(dy, dx),
            scale,
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  6. Collisions
    // ═════════════════════════════════════════════════════════════════════════

    onFireballHit(obj1, obj2) {
        try {
            const isPlayer = (o) => o === this.player1 || o === this.player2;
            const player = isPlayer(obj1) ? obj1 : obj2;
            const fireball = isPlayer(obj1) ? obj2 : obj1;

            if (!fireball.active) return;
            if (fireball.owner === player) return; // no self-hit

            fireball.disableBody(true, true).setPosition(-9999, -9999);

            if (!player.active || player.isInvulnerable) return;

            player.hp = Math.max(0, player.hp - 10);
            player.isInvulnerable = true;
            this.time.delayedCall(100, () => { player.isInvulnerable = false; });

            player.setTint(0xff0000);
            this.time.delayedCall(200, () => player.clearTint());

            const tag = player === this.myPlayer ? 'I was hit' : 'Hit opponent';
            console.log(`[Collision]: ${tag}! HP → ${player.hp}`);

            if (player.hp <= 0) this._handlePlayerDeath(player);
        } catch (err) {
            console.error('[onFireballHit Error]:', err);
        }
    }

    _handlePlayerDeath(player) {
        console.log('[Collision]:', player === this.myPlayer ? 'I died!' : 'Opponent died!');

        player.setActive(false).setVisible(false);
        player.body.setVelocity(0, 0);
        player.hpBar?.clear();

        // Respawn after 3 seconds
        this.time.delayedCall(3000, () => {
            player.hp = 100;
            player.setActive(true).setVisible(true);
            const spawnX = (player === this.player1) ? 200 : this.scale.width - 200;
            player.setPosition(spawnX, this.scale.height / 2);
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  7. Network
    // ═════════════════════════════════════════════════════════════════════════

    /** Called by socket.js when BROADCAST_STATE arrives. */
    onRemoteStateUpdate(data) {
        try {
            if (!this.otherPlayer) return;
            this.otherPlayer.setPosition(data.x, data.y);
            if (data.vx !== undefined) this.otherPlayer.setVelocity(data.vx, data.vy);
        } catch (err) {
            console.error('[onRemoteStateUpdate Error]:', err);
        }
    }

    /** Called by socket.js when BROADCAST_SPELL arrives. */
    onRemoteSpell(data) {
        try {
            const fb = this.fireballs.get();
            if (!fb) { console.warn('[Network]: Fireball pool exhausted for remote spell.'); return; }

            fb.enableBody(true, data.x, data.y, true, true);
            fb.setScale(data.scale || 1.0);
            fb.body.allowGravity = false;
            fb.body.collideWorldBounds = true;
            fb.body.onWorldBounds = true;
            fb.owner = this.otherPlayer; // prevents hitting the sender

            const dx = data.targetX - data.x;
            const dy = data.targetY - data.y;
            const mag = Math.sqrt(dx * dx + dy * dy) || 1;
            fb.body.setVelocity((dx / mag) * 450, (dy / mag) * 450);
        } catch (err) {
            console.error('[onRemoteSpell Error]:', err);
        }
    }
}