// client/spells.js — SpellCaster
// Owns: textures, casting, hit effects, debuffs, remote spell rendering.
// All 4 spells are long-range projectiles with distinct behaviours.
// GameScene calls sc.init(scene) once, then sc.cast() / sc.onRemoteSpell().
// ─────────────────────────────────────────────────────────────────────────────

class SpellCaster {

    constructor() {
        this.scene = null;
        this.balls = null;
        this._fancyTextures = {};  // Track which spells have WebGPU textures
    }

    // ── Init ───────────────────────────────────────────────────────────────────

    init(scene, ballGroup) {
        this.scene = scene;
        this.balls = ballGroup;
        this._buildFallbackTextures();
    }

    /** Simple circle fallback textures for every spell */
    _buildFallbackTextures() {
        const spells = window.SPELL_CONFIG?.SPELLS ?? {};
        Object.entries(spells).forEach(([key, cfg]) => {
            createCircleTexture(this.scene, `spell_${key}`, cfg.radius, cfg.color); // eslint-disable-line no-undef
        });
    }

    /** Register a WebGPU-generated spritesheet for a spell */
    registerFancyTexture(spellKey) {
        this._fancyTextures[spellKey] = true;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Cast a spell locally based on a Gemini result object.
     * @param {{ spell, volume, backfire }} result
     * @param {Phaser.GameObjects.Sprite} caster
     * @param {Phaser.GameObjects.Sprite} target
     * @param {{ worldX, worldY }}        pointer
     */
    cast(result, caster, target, pointer) {
        try {
            if (!caster) return;

            if (result.backfire) {
                this._handleBackfire(caster);
                return;
            }

            const scale = volumeToScale(result.volume); // eslint-disable-line no-undef
            const targetX = (pointer?.worldX > 0) ? pointer.worldX : (target?.x ?? this.scene.scale.width / 2);
            const targetY = (pointer?.worldY > 0) ? pointer.worldY : (target?.y ?? this.scene.scale.height / 2);

            this._playCastAnim(caster);

            // ALL spells are directional projectiles aimed at the cursor
            this._launchProjectile(caster, result.spell, scale, targetX, targetY);

            // Clear state → IDLE
            window.dispatchEvent(new CustomEvent('castStateChange', {
                detail: { state: CastState.IDLE }
            }));

        } catch (err) {
            console.error('[SpellCaster.cast Error]:', err);
        }
    }

    /**
     * Render a spell received over the network.
     */
    onRemoteSpell(data, remoteCaster, localPlayer) {
        try {
            const { spell: spellType, x, y, targetX, targetY, scale = 1.0 } = data;

            const fb = this._getFreshBall(x, y, spellType, scale);
            if (!fb) return;
            fb.owner = remoteCaster;

            const cfg = this._getConfig(spellType);
            fb.body.allowGravity = cfg.gravity ?? false;
            this._aim(fb, x, y, targetX, targetY, cfg.speed);

            // Auto-destroy after lifetime
            this.scene.time.delayedCall(cfg.lifetime, () => this._destroyBall(fb));
        } catch (err) {
            console.error('[SpellCaster.onRemoteSpell Error]:', err);
        }
    }

    /**
     * Process collision between a projectile and a player.
     * Returns damage dealt (0 = no hit).
     */
    onHit(ball, player, myPlayer) {
        try {
            if (!ball.active || ball.owner === player) return 0;

            const spellType = ball.spellType || 'fireball';
            const scale = ball.scaleX || 1.0;
            this._destroyBall(ball);

            const cfg = this._getConfig(spellType);
            const dmg = Math.round(cfg.damage * scale);

            // VFX explosion
            this._spawnExplosion(player.x, player.y, cfg.color, spellType);

            // Apply debuff
            this._applyDebuff(player, spellType, cfg, scale);

            const tag = player === myPlayer ? 'I was hit' : 'Hit opponent';
            console.log(`[Hit]: ${tag} with ${spellType}, dmg=${dmg}`);

            return dmg;
        } catch (err) {
            console.error('[SpellCaster.onHit Error]:', err);
            return 0;
        }
    }

    // ── Projectile launch ─────────────────────────────────────────────────────

    _launchProjectile(caster, spellType, scale, targetX, targetY) {
        const cfg = this._getConfig(spellType);

        const fb = this._getFreshBall(caster.x, caster.y, spellType, scale);
        if (!fb) return;

        fb.owner = caster;
        fb.body.allowGravity = cfg.gravity ?? false;

        this._aim(fb, caster.x, caster.y, targetX, targetY, cfg.speed);

        // Auto-destroy after lifetime
        this.scene.time.delayedCall(cfg.lifetime, () => this._destroyBall(fb));
    }

    _handleBackfire(caster) {
        console.log('[SpellCaster]: BACKFIRE!');
        this._spawnExplosion(caster.x, caster.y, 0xff0000, 'backfire');
        this._playCastAnim(caster);

        window.dispatchEvent(new CustomEvent('castStateChange', {
            detail: { state: CastState.IDLE }
        }));

        return -15; // signal self-damage
    }

    // ── Pool & physics helpers ────────────────────────────────────────────────

    _getConfig(spellType) {
        return window.SPELL_CONFIG?.SPELLS?.[spellType] ?? window.SPELL_CONFIG?.SPELLS?.fireball ?? {
            color: 0xff8800, radius: 10, speed: 500, damage: 10,
            gravity: false, lifetime: 4000,
        };
    }

    _getFreshBall(x, y, spellType, scale) {
        const fallbackKey = `spell_${spellType}`;
        const fancyKey = `spell_${spellType}_fancy`;
        const hasFancy = this._fancyTextures[spellType] && this.scene.textures.exists(fancyKey);
        const texKey = hasFancy ? fancyKey : (this.scene.textures.exists(fallbackKey) ? fallbackKey : 'spell_fireball');

        const fb = this.balls.get(x, y, texKey);
        if (!fb) { console.warn('[SpellCaster]: Ball pool exhausted.'); return null; }

        fb.enableBody(true, x, y, true, true);
        fb.setScale(scale);
        fb.body.collideWorldBounds = true;
        fb.body.onWorldBounds = true;
        fb.spellType = spellType;

        // Play animated spritesheet if available
        const animKey = `${spellType}-fancy`;
        if (hasFancy && this.scene.anims.exists(animKey)) {
            fb.setTexture(fancyKey);
            fb.play(animKey, true);
        } else {
            fb.setTexture(texKey);
        }

        return fb;
    }

    _aim(fb, fromX, fromY, toX, toY, speed) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        fb.body.setVelocity((dx / mag) * speed, (dy / mag) * speed);
    }

    _destroyBall(fb) {
        if (!fb?.active) return;
        fb.disableBody(true, true);
        fb.setPosition(-9999, -9999);
    }

    // ── Debuffs ───────────────────────────────────────────────────────────────

    _applyDebuff(player, spellType, cfg, scale) {
        if (!cfg.debuff) return;

        switch (cfg.debuff) {
            case 'burn':
                this._applyBurn(player, cfg.debuffDuration);
                break;
            case 'slow':
                this._applySlow(player, cfg.debuffDuration);
                break;
            case 'knockback':
                this._applyKnockback(player, cfg.knockbackForce ?? 700, scale);
                break;
        }
    }

    _applySlow(player, duration) {
        if (player.activeDebuffs?.slow) return;
        player.activeDebuffs = player.activeDebuffs || {};
        player.activeDebuffs.slow = true;
        player.setTint(0x44ddff);
        this.scene.time.delayedCall(duration, () => {
            if (player.activeDebuffs) player.activeDebuffs.slow = false;
            player.clearTint();
        });
    }

    _applyBurn(player, duration) {
        if (player.activeDebuffs?.burn) return;
        player.activeDebuffs = player.activeDebuffs || {};
        player.activeDebuffs.burn = true;
        let ticks = 0;
        const maxTicks = Math.ceil(duration / 1000);
        const ev = this.scene.time.addEvent({
            delay: 1000,
            repeat: maxTicks - 1,
            callback: () => {
                ticks++;
                this._spawnExplosion(player.x, player.y, 0xff4400, 'burn');
                if (ticks >= maxTicks) {
                    if (player.activeDebuffs) player.activeDebuffs.burn = false;
                    ev.remove();
                }
            },
        });
    }

    _applyKnockback(player, force, scale) {
        if (!player?.active) return;
        // Push away from impact — use the player's facing as a rough proxy
        const dir = player.flipX ? 1 : -1;
        player.setVelocity(dir * force * scale, -300 * scale);
    }

    // ── VFX ───────────────────────────────────────────────────────────────────

    _spawnExplosion(x, y, color = 0xff8800, type = 'default') {
        try {
            const size = type === 'nova' ? 60 : 40;
            const circle = this.scene.add.graphics();
            circle.fillStyle(color, 0.85);
            circle.fillCircle(0, 0, size);
            circle.setPosition(x, y);
            this.scene.add.tween({
                targets: circle,
                alpha: 0, scaleX: 2.5, scaleY: 2.5,
                duration: 450, ease: 'Power2',
                onComplete: () => circle.destroy(),
            });

            // Secondary ring for nova
            if (type === 'nova' || type === 'knockback') {
                const ring = this.scene.add.graphics();
                ring.lineStyle(3, 0xbb44ff, 0.9);
                ring.strokeCircle(0, 0, 15);
                ring.setPosition(x, y);
                this.scene.add.tween({
                    targets: ring,
                    scaleX: 8, scaleY: 8, alpha: 0,
                    duration: 600, ease: 'Power2',
                    onComplete: () => ring.destroy(),
                });
            }
        } catch (err) {
            console.error('[_spawnExplosion Error]:', err);
        }
    }

    // ── Animation helper ──────────────────────────────────────────────────────

    _playCastAnim(player) {
        if (!player || player.isCasting) return;
        player.isCasting = true;
        player.anims.play('rogue-cast', true);
        player.once('animationcomplete-rogue-cast', () => {
            player.isCasting = false;
        });
    }
}

// Singleton
window.spellCaster = new SpellCaster();
