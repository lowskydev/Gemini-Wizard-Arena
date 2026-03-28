// hud.js — Casting state HUD overlay
// Manages visual indicators: LISTENING / PROCESSING (charging) / READY
// Driven by 'castStateChange' events from audio.js
// ─────────────────────────────────────────────────────────────────────────────

class CastingHUD {

    constructor(scene) {
        this.scene = scene;
        const { width, height } = scene.scale;
        this.width = width;
        this.height = height;

        this._buildElements();
        this._bindEvents();
        this._volumeLevel = 0;
    }

    // ── Build DOM-like Phaser overlay ─────────────────────────────────────────

    _buildElements() {
        const { width } = this;
        const cx = width / 2;

        // Container for the central casting indicator
        this.container = this.scene.add.container(cx, 80).setDepth(100).setAlpha(0);

        // Background pill
        this.pillBg = this.scene.add.graphics();
        this._drawPill(0x000000, 0.7);
        this.container.add(this.pillBg);

        // State icon (emoji-based text)
        this.stateIcon = this.scene.add.text(-120, 0, '', {
            fontSize: '32px', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.container.add(this.stateIcon);

        // State label
        this.stateLabel = this.scene.add.text(10, 0, '', {
            fontSize: '22px', fontFamily: '"Courier New", monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 3,
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.stateLabel);

        // Volume bar (shown during LISTENING)
        this.volumeBar = this.scene.add.graphics();
        this.container.add(this.volumeBar);

        // Charging spinner dots
        this.chargeDots = [];
        for (let i = 0; i < 3; i++) {
            const dot = this.scene.add.graphics();
            dot.fillStyle(0xffffff, 0.8);
            dot.fillCircle(0, 0, 4);
            dot.setPosition(60 + i * 16, 0);
            dot.setVisible(false);
            this.container.add(dot);
            this.chargeDots.push(dot);
        }

        // Spell legend at bottom-left
        this._buildSpellLegend();

        // Controls hint
        this.scene.add.text(width / 2, this.height - 20, 'Press SHIFT to Speak  •  Left-Click to Fire', {
            fontSize: '15px', fontFamily: '"Courier New", monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

        // WebGPU FX tag
        const hasGPU = this.scene.textures.exists('spell_fireball_fancy');
        this.scene.add.text(10, this.height - 20, `FX: ${hasGPU ? 'WebGPU ✨' : 'Standard'}`, {
            fontSize: '13px', color: hasGPU ? '#ffff00' : '#666666',
            backgroundColor: '#000000cc', padding: { x: 4, y: 3 },
        }).setDepth(100).setScrollFactor(0);
    }

    _drawPill(color, alpha) {
        this.pillBg.clear();
        this.pillBg.fillStyle(color, alpha);
        this.pillBg.fillRoundedRect(-160, -24, 320, 48, 24);
    }

    _buildSpellLegend() {
        const spells = window.SPELL_CONFIG?.SPELLS ?? {};
        const entries = Object.values(spells);
        const baseY = this.height - 20 - entries.length * 22;

        entries.forEach((cfg, i) => {
            const pad = cfg.displayName.padEnd(10, ' ');
            this.scene.add.text(12, baseY + i * 22, `● ${pad}— ${cfg.description}`, {
                fontSize: '14px', fontFamily: '"Courier New", monospace',
                color: cfg.glowColor, stroke: '#000000', strokeThickness: 2,
                backgroundColor: '#00000066', padding: { x: 4, y: 2 },
            }).setDepth(50).setScrollFactor(0);
        });
    }

    // ── Event binding ─────────────────────────────────────────────────────────

    _bindEvents() {
        this._onStateChange = (e) => this._handleStateChange(e.detail);
        this._onVolume = (e) => { this._volumeLevel = e.detail; };

        window.addEventListener('castStateChange', this._onStateChange);
        window.addEventListener('micVolume', this._onVolume);
    }

    destroy() {
        window.removeEventListener('castStateChange', this._onStateChange);
        window.removeEventListener('micVolume', this._onVolume);
        if (this._chargeTween) this._chargeTween.destroy();
        if (this._readyTween) this._readyTween.destroy();
    }

    // ── State handler ─────────────────────────────────────────────────────────

    _handleStateChange({ state, data }) {
        // Kill any running tweens
        if (this._chargeTween) { this._chargeTween.destroy(); this._chargeTween = null; }
        if (this._readyTween) { this._readyTween.destroy(); this._readyTween = null; }
        this.chargeDots.forEach(d => d.setVisible(false));

        switch (state) {
            case CastState.LISTENING:   return this._showListening();
            case CastState.PROCESSING:  return this._showProcessing();
            case CastState.READY:       return this._showReady(data);
            case CastState.IDLE:
            default:                    return this._showIdle();
        }
    }

    _showListening() {
        this.container.setAlpha(1);
        this._drawPill(0x332200, 0.85);
        this.stateIcon.setText('🎤');
        this.stateLabel.setText('SAY A SPELL!').setColor('#ffcc44');
        this.volumeBar.setVisible(true);

        // Pulse the whole container
        this._chargeTween = this.scene.tweens.add({
            targets: this.container,
            scaleX: { from: 1.0, to: 1.04 },
            scaleY: { from: 1.0, to: 1.04 },
            duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    _showProcessing() {
        this.container.setAlpha(1).setScale(1);
        this._drawPill(0x1a1040, 0.9);
        this.stateIcon.setText('⚡');
        this.stateLabel.setText('CHARGING').setColor('#bb88ff');
        this.volumeBar.setVisible(false);

        // Animated dots
        this.chargeDots.forEach((dot, i) => {
            dot.setVisible(true);
            this.scene.tweens.add({
                targets: dot,
                alpha: { from: 0.2, to: 1 },
                duration: 400,
                delay: i * 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        });

        // Slow rotation-like scale pulse
        this._chargeTween = this.scene.tweens.add({
            targets: this.container,
            scaleX: { from: 1.0, to: 1.06 },
            scaleY: { from: 1.0, to: 1.06 },
            duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    _showReady(data) {
        this.container.setAlpha(1).setScale(1);
        const spellKey = data?.spell ?? 'fireball';
        const spellCfg = window.SPELL_CONFIG?.SPELLS?.[spellKey];
        const color = spellCfg?.glowColor ?? '#00ff88';

        this._drawPill(0x002200, 0.9);
        this.stateIcon.setText('✅');
        this.stateLabel.setText(`${(spellCfg?.displayName ?? spellKey).toUpperCase()} READY!`).setColor(color);
        this.volumeBar.setVisible(false);

        // Bright flash then settle
        this._readyTween = this.scene.tweens.add({
            targets: this.container,
            scaleX: { from: 1.15, to: 1.0 },
            scaleY: { from: 1.15, to: 1.0 },
            duration: 300, ease: 'Back.easeOut',
        });

        // Auto-hide after spell is fired or times out
        this.scene.time.delayedCall(4000, () => {
            if (this.stateLabel.text.includes('READY')) this._showIdle();
        });
    }

    _showIdle() {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0, duration: 300, ease: 'Power2',
        });
        this.volumeBar.setVisible(false);
    }

    // ── Per-frame update (called from GameScene.update) ──────────────────────

    update() {
        // Draw live volume bar during LISTENING
        if (currentCastState === CastState.LISTENING) {
            this.volumeBar.clear();
            const barW = 100;
            const barH = 6;
            const x = -barW / 2;
            const y = 18;
            const fill = (this._volumeLevel / 100) * barW;

            this.volumeBar.fillStyle(0x333333, 0.8);
            this.volumeBar.fillRoundedRect(x, y, barW, barH, 3);

            const volColor = this._volumeLevel > 85 ? 0xff4444 :
                             this._volumeLevel > 50 ? 0xffcc44 : 0x44ff44;
            this.volumeBar.fillStyle(volColor, 1);
            this.volumeBar.fillRoundedRect(x, y, Math.max(2, fill), barH, 3);
        }
    }
}

window.CastingHUD = CastingHUD;
