// scenes/GameScene.js — Phaser scene: lifecycle, movement, UI, network wiring.
// Spell logic lives in client/spells.js. HUD in client/hud.js.
// HP is server-authoritative: damage events emit SPELL_HIT; server broadcasts HP_UPDATE.
// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {  // eslint-disable-line no-undef

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
        this.castingHUD = null;
        this.stateTimer = 0;
        this.STATE_INTERVAL = 50; // ms — 20 updates/sec
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Lifecycle
    // ═════════════════════════════════════════════════════════════════════════

    preload() {
        this.load.spritesheet('rogue', 'assets/rogue spritesheet calciumtrice.png', {
            frameWidth: 32, frameHeight: 32,
        });
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        arena?.preload?.(this);
    }

    async create() {
        try {
            gameSceneRef = this;  // eslint-disable-line no-undef
            const { width, height } = this.scale;

            this._buildArena(width, height);
            await this._buildSpellTextures();
            this._buildAnimations();
            this._buildPlayers(width, height);
            this._buildPlatforms(width, height);
            this._buildBallGroup();
            this._buildInput();

            // Init spell system
            window.spellCaster.init(this, this.fireballs);  // eslint-disable-line no-undef

            // Init HUD
            this.castingHUD = new CastingHUD(this);  // eslint-disable-line no-undef

            this.assignPlayers();
            console.log('[GameScene]: ready. myPlayerId =', myPlayerId);  // eslint-disable-line no-undef
        } catch (err) {
            console.error('[GameScene.create Error]:', err);
        }
    }

    update(time, delta) {
        try {
            if (!this.myPlayer && myPlayerId) this.assignPlayers();  // eslint-disable-line no-undef
            if (!this.myPlayer) return;

            this._handleMovement();
            this._updateAnimations(this.player1);
            this._updateAnimations(this.player2);
            this._drawHealthBar(this.player1);
            this._drawHealthBar(this.player2);
            this._updateIndicator(time);
            this._emitState(delta);
            if (this.castingHUD) this.castingHUD.update();
        } catch (err) {
            console.error('[GameScene.update Error]:', err);
        }
    }

    shutdown() {
        if (this.castingHUD) this.castingHUD.destroy();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Build helpers
    // ═════════════════════════════════════════════════════════════════════════

    _buildArena(width, height) {
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        arena?.buildBackground?.(this);
    }

    async _buildSpellTextures() {
        try {
            // Wait for spell-fx.js module to register on window
            let attempts = 50;
            while (!window.generateAllSpellSpritesheets && attempts-- > 0) {
                await new Promise(r => setTimeout(r, 100));
            }

            if (window.generateAllSpellSpritesheets) {
                const sheets = await window.generateAllSpellSpritesheets();

                for (const [spellName, canvas] of Object.entries(sheets)) {
                    if (!canvas) continue;
                    const texKey = `spell_${spellName}_fancy`;
                    this.textures.addSpriteSheet(texKey, canvas, {
                        frameWidth: 32, frameHeight: 32,
                    });
                    window.spellCaster.registerFancyTexture(spellName);
                    console.log(`[GameScene]: ${spellName} WebGPU texture registered.`);
                }
            }
        } catch (e) {
            console.warn('[GameScene]: WebGPU spell textures skipped —', e.message);
            window.lastSpellFXError = e.message;
        }
    }

    _buildAnimations() {
        // Player animations
        [
            { key: 'rogue-idle', start: 0, end: 9, frameRate: 10, repeat: -1 },
            { key: 'rogue-cast', start: 10, end: 19, frameRate: 15, repeat: 0 },
            { key: 'rogue-run', start: 20, end: 29, frameRate: 15, repeat: -1 },
        ].forEach(({ key, start, end, frameRate, repeat }) => {
            if (!this.anims.exists(key)) {
                this.anims.create({
                    key,
                    frames: this.anims.generateFrameNumbers('rogue', { start, end }),
                    frameRate, repeat,
                });
            }
        });

        // Spell spritesheet animations (WebGPU-generated)
        const spellNames = ['fireball', 'frostbite', 'bolt', 'nova'];
        spellNames.forEach(name => {
            const texKey = `spell_${name}_fancy`;
            const animKey = `${name}-fancy`;
            if (this.textures.exists(texKey) && !this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(texKey, { start: 0, end: 15 }),
                    frameRate: 20, repeat: -1,
                });
            }
        });
    }

    _buildPlayers(width, height) {
        const make = (x, flip) => {
            const p = this.physics.add.sprite(x, height / 2, 'rogue');
            p.setCollideWorldBounds(true).setScale(3.5).setImmovable(true);
            if (flip) p.setFlipX(true);
            p.hp = 100;
            p.isInvulnerable = false;
            p.activeDebuffs = {};
            p.hpBar = this.add.graphics();
            return p;
        };
        this.player1 = make(200, false);
        this.player2 = make(width - 200, true);
    }

    _buildPlatforms(width, height) {
        const arena = window.ARENAS[window.selectedArena || 'ruins'];  // eslint-disable-line no-undef
        this.platforms = arena?.buildPlatforms?.(this, width, height)
            ?? this.physics.add.staticGroup();

        const dropThrough = (p) => !(p === this.myPlayer && this.wasd?.down?.isDown);
        this.physics.add.collider(this.player1, this.platforms, null, dropThrough, this);
        this.physics.add.collider(this.player2, this.platforms, null, dropThrough, this);
    }

    _buildBallGroup() {
        this.fireballs = this.physics.add.group({ allowGravityY: false });

        // Balls extinguish on platforms
        this.physics.add.collider(this.fireballs, this.platforms, (fb) => {
            if (fb.active) { fb.disableBody(true, true); fb.setPosition(-9999, -9999); }
        });

        // Hit either player
        this.physics.add.overlap(this.fireballs, this.player1, this._onBallHit, null, this);
        this.physics.add.overlap(this.fireballs, this.player2, this._onBallHit, null, this);

        // Cleanup on world exit
        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject?.active) {
                body.gameObject.disableBody(true, true);
                body.gameObject.setPosition(-9999, -9999);
            }
        });
    }

    _buildInput() {
        this.wasd = {
            left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),     // eslint-disable-line no-undef
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),     // eslint-disable-line no-undef
            down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),     // eslint-disable-line no-undef
            jump:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), // eslint-disable-line no-undef
        };

        // Click to fire the prepared spell at the cursor
        this.input.on('pointerdown', (pointer) => {
            if (!this.myPlayer?.preparedSpell) return;

            const result = this.myPlayer.preparedSpell;
            this.myPlayer.preparedSpell = null;

            const scale = (typeof volumeToScale !== 'undefined') ? volumeToScale(result.volume) : 1.0; // eslint-disable-line no-undef

            window.spellCaster.cast(result, this.myPlayer, this.otherPlayer, pointer);  // eslint-disable-line no-undef

            // Broadcast to other player
            socket.emit('SPELL_CAST', {  // eslint-disable-line no-undef
                spell: result.spell,
                x: this.myPlayer.x,
                y: this.myPlayer.y,
                targetX: pointer.worldX,
                targetY: pointer.worldY,
                angle: Math.atan2(pointer.worldY - this.myPlayer.y, pointer.worldX - this.myPlayer.x),
                scale: scale,
            });
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Players
    // ═════════════════════════════════════════════════════════════════════════

    assignPlayers() {
        if (!myPlayerId || this.myPlayer) return;  // eslint-disable-line no-undef
        const isP1 = myPlayerId === 'Player 1';    // eslint-disable-line no-undef
        this.myPlayer = isP1 ? this.player1 : this.player2;
        this.otherPlayer = isP1 ? this.player2 : this.player1;

        this.myPlayer.setImmovable(false).setDragX(800);
        this.otherPlayer.setImmovable(true).setDragX(0);

        this.playerIndicator = this.add.text(
            this.myPlayer.x, this.myPlayer.y - 70, '▼',
            { fontSize: '28px', fill: '#ffff00', stroke: '#000000', strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(10);

        this.preparedLabel = this.add.text(
            this.myPlayer.x, this.myPlayer.y - 110, '',
            { fontSize: '18px', fill: '#00ffff', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(10);

        console.log(`[GameScene]: I am ${myPlayerId}`);  // eslint-disable-line no-undef
    }

    /** Called by socket.js when Gemini returns a spell result. */
    prepareSpell(result) {
        if (!this.myPlayer) return;
        this.myPlayer.preparedSpell = result;
        console.log('[GameScene]: Spell Prepared:', result.spell);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Movement
    // ═════════════════════════════════════════════════════════════════════════

    _handleMovement() {
        const castMult = (typeof playerSpeed !== 'undefined') ? playerSpeed : 1.0;  // eslint-disable-line no-undef
        const slowMult = this.myPlayer.activeDebuffs?.slow ? 0.5 : 1.0;
        const speed = 400 * castMult * slowMult;
        const p = this.myPlayer;

        p.setVelocityX(0);
        if (this.wasd.left.isDown) p.setVelocityX(-speed);
        if (this.wasd.right.isDown) p.setVelocityX(speed);

        if (p.body.blocked.down || p.body.touching.down) p.jumps = 0;
        if (Phaser.Input.Keyboard.JustDown(this.wasd.jump)) {  // eslint-disable-line no-undef
            if ((p.jumps ?? 0) < 2) { p.setVelocityY(-750); p.jumps = (p.jumps ?? 0) + 1; }
        }
    }

    _updateAnimations(player) {
        if (!player?.active || player.isCasting) return;
        const moving = Math.abs(player.body.velocity.x) > 5 || Math.abs(player.body.velocity.y) > 10;
        player.anims.play(moving ? 'rogue-run' : 'rogue-idle', true);
        if (player.body.velocity.x < -5) player.setFlipX(true);
        else if (player.body.velocity.x > 5) player.setFlipX(false);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Health bar
    // ═════════════════════════════════════════════════════════════════════════

    _drawHealthBar(player) {
        if (!player?.hpBar) return;
        player.hpBar.clear();
        if (!player.active || player.hp <= 0) return;

        const BAR_W = 200;
        const BAR_H = 18;
        const x = (player === this.player1) ? 20 : this.scale.width - BAR_W - 20;

        player.hpBar.fillStyle(0x000000, 1).fillRect(x, 20, BAR_W, BAR_H);
        player.hpBar.fillStyle(player.hp > 30 ? 0x00ff00 : 0xff0000, 1)
            .fillRect(x + 2, 22, (BAR_W - 4) * (player.hp / 100), BAR_H - 4);

        // Debuff pips
        let px = x;
        if (player.activeDebuffs?.burn) {
            player.hpBar.fillStyle(0xff4400, 1).fillRect(px, 6, 10, 10);
            px += 14;
        }
        if (player.activeDebuffs?.slow) {
            player.hpBar.fillStyle(0x44ddff, 1).fillRect(px, 6, 10, 10);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Collision handler
    // ═════════════════════════════════════════════════════════════════════════

    _onBallHit(obj1, obj2) {
        try {
            const isPlayer = (o) => o === this.player1 || o === this.player2;
            const player = isPlayer(obj1) ? obj1 : obj2;
            const ball = isPlayer(obj1) ? obj2 : obj1;

            const dmg = window.spellCaster.onHit(ball, player, this.myPlayer);  // eslint-disable-line no-undef
            if (dmg === 0) return;

            socket.emit('SPELL_HIT', {  // eslint-disable-line no-undef
                targetId: (player === this.player1) ? 'Player 1' : 'Player 2',
                damage: dmg,
                spell: ball.spellType,
            });
        } catch (err) {
            console.error('[_onBallHit Error]:', err);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Update helpers
    // ═════════════════════════════════════════════════════════════════════════

    _updateIndicator(time) {
        if (!this.playerIndicator || !this.myPlayer) return;
        const bob = Math.sin(time / 150) * 8;
        this.playerIndicator.setPosition(this.myPlayer.x, this.myPlayer.y - 70 + bob);
        this.playerIndicator.setVisible(this.myPlayer.active);

        if (this.preparedLabel) {
            this.preparedLabel.setPosition(this.myPlayer.x, this.myPlayer.y - 110 + bob);
            const spell = this.myPlayer.preparedSpell?.spell;
            if (spell) {
                const cfg = window.SPELL_CONFIG?.SPELLS?.[spell];
                this.preparedLabel.setText(`✨ ${(cfg?.displayName ?? spell).toUpperCase()}`);
                this.preparedLabel.setColor(cfg?.glowColor ?? '#00ffff');
                this.preparedLabel.setVisible(true);
                this.playerIndicator.setTint(cfg?.color ?? 0x00ffff);
            } else {
                this.preparedLabel.setVisible(false);
                this.playerIndicator.clearTint();
            }
        }
    }

    _emitState(delta) {
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
    //  Network — called by socket.js
    // ═════════════════════════════════════════════════════════════════════════

    onRemoteStateUpdate(data) {
        try {
            if (!this.otherPlayer) return;
            this.otherPlayer.setPosition(data.x, data.y);
            if (data.vx !== undefined) this.otherPlayer.setVelocity(data.vx, data.vy);
        } catch (err) {
            console.error('[onRemoteStateUpdate Error]:', err);
        }
    }

    onRemoteSpell(data) {
        try {
            window.spellCaster.onRemoteSpell(data, this.otherPlayer, this.myPlayer);  // eslint-disable-line no-undef
        } catch (err) {
            console.error('[onRemoteSpell Error]:', err);
        }
    }

    /** Called by socket.js when HP_UPDATE arrives from server. */
    onHpUpdate({ playerId, hp }) {
        try {
            const player = playerId === 'Player 1' ? this.player1 : this.player2;
            if (!player) return;

            player.hp = hp;
            player.setTint(0xff0000);
            this.time.delayedCall(200, () => player.clearTint());

            if (hp <= 0) this._handleDeath(player);
        } catch (err) {
            console.error('[onHpUpdate Error]:', err);
        }
    }

    _handleDeath(player) {
        console.log('[Death]:', player === this.myPlayer ? 'I died!' : 'Opponent died!');
        player.setActive(false).setVisible(false);
        player.body.setVelocity(0, 0);
        player.hpBar?.clear();
        player.activeDebuffs = {};

        this.time.delayedCall(3000, () => {
            player.hp = 100;
            player.setActive(true).setVisible(true);
            player.setPosition(
                player === this.player1 ? 200 : this.scale.width - 200,
                this.scale.height / 2
            );
        });
    }
}
