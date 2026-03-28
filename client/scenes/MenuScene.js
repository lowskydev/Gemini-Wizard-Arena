// scenes/MenuScene.js — Arena selection screen
// ─────────────────────────────────────────────────────────────────────────────

class MenuScene extends Phaser.Scene {  // eslint-disable-line no-undef
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        this.load.image('bg1', 'assets/parallax_mountain_pack/layers/parallax-mountain-bg.png');
        this.load.image('bg2', 'assets/parallax_mountain_pack/layers/parallax-mountain-montain-far.png');
        this.load.image('bg3', 'assets/parallax_mountain_pack/layers/parallax-mountain-mountains.png');
        this.load.image('bg4', 'assets/parallax_mountain_pack/layers/parallax-mountain-trees.png');
        this.load.image('bg5', 'assets/parallax_mountain_pack/layers/parallax-mountain-foreground-trees.png');
        this.load.spritesheet('rogue', 'assets/rogue spritesheet calciumtrice.png', {
            frameWidth: 32, frameHeight: 32,
        });
    }

    create() {
        const { width, height } = this.scale;
        this._buildBackground(width, height);
        this._buildTitle(width, height);
        this._buildArenaCards(width, height);
        this._buildControlsHint(width, height);
        this._buildDecorativeRogues(width, height);
    }

    _buildBackground(width, height) {
        ['bg1', 'bg2', 'bg3', 'bg4', 'bg5'].forEach((key, i) => {
            this.add.image(width / 2, height / 2, key)
                .setDisplaySize(width, height)
                .setDepth(-5 + i);
        });
        const ov = this.add.graphics().setDepth(0);
        ov.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.65, 0.65);
        ov.fillRect(0, 0, width, height);
    }

    _buildTitle(width, height) {
        this.add.text(width / 2, height * 0.13, 'WIZARD ARENA', {
            fontSize: `${Math.round(width * 0.085)}px`,
            fontFamily: '"Courier New", monospace',
            color: '#f5d87a',
            stroke: '#2a1040',
            strokeThickness: 10,
            shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 0, fill: true },
        }).setOrigin(0.5).setDepth(3);

        this.add.text(width / 2, height * 0.22, 'CHOOSE YOUR ARENA', {
            fontSize: `${Math.round(width * 0.022)}px`,
            fontFamily: '"Courier New", monospace',
            color: '#c8b0d8',
            stroke: '#1a0030',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(3);
    }

    _buildArenaCards(width, height) {
        const cardW = width * 0.36;
        const cardH = height * 0.44;
        const cardY = height * 0.53;
        const gap = width * 0.05;
        this._buildArenaCard('ruins', width / 2 - cardW / 2 - gap / 2, cardY, cardW, cardH);
        this._buildArenaCard('crypt', width / 2 + cardW / 2 + gap / 2, cardY, cardW, cardH);
    }

    _buildControlsHint(width, height) {
        this.add.text(
            width / 2, height * 0.94,
            'WASD / SPACE to move  ·  SHIFT to cast  ·  Click to fire',
            {
                fontSize: `${Math.round(width * 0.016)}px`,
                fontFamily: '"Courier New", monospace',
                color: '#604878',
                stroke: '#1a0030',
                strokeThickness: 3,
            }
        ).setOrigin(0.5).setDepth(3);
    }

    _buildDecorativeRogues(width, height) {
        if (!this.anims.exists('menu-idle')) {
            this.anims.create({
                key: 'menu-idle',
                frames: this.anims.generateFrameNumbers('rogue', { start: 0, end: 9 }),
                frameRate: 10, repeat: -1,
            });
        }
        if (!this.anims.exists('menu-run')) {
            this.anims.create({
                key: 'menu-run',
                frames: this.anims.generateFrameNumbers('rogue', { start: 20, end: 29 }),
                frameRate: 15, repeat: -1,
            });
        }
        this.add.sprite(width * 0.08, height * 0.14, 'rogue')
            .setScale(3.5).setDepth(2).play('menu-idle');
        this.add.sprite(width * 0.92, height * 0.14, 'rogue')
            .setScale(3.5).setFlipX(true).setDepth(2).play('menu-idle');
    }

    _buildArenaCard(arenaKey, cx, cy, cardW, cardH) {
        const arena = window.ARENAS[arenaKey];
        const isRuins = arenaKey === 'ruins';
        const accentCol = isRuins ? 0xf5d87a : 0x9060d0;
        const accentHex = isRuins ? '#f5d87a' : '#b080f0';
        const bgBase = isRuins ? 0x1e1030 : 0x0a0520;
        const bgHover = isRuins ? 0x2e1a40 : 0x180838;
        const x0 = cx - cardW / 2;
        const y0 = cy - cardH / 2;

        const cardBg = this.add.graphics().setDepth(4);
        const drawCard = (shade, borderAlpha = 0.9) => {
            cardBg.clear();
            cardBg.fillStyle(shade, 0.9);
            cardBg.fillRect(x0, y0, cardW, cardH);
            cardBg.lineStyle(3, accentCol, borderAlpha);
            cardBg.strokeRect(x0, y0, cardW, cardH);
            const cs = 12;
            cardBg.lineStyle(5, accentCol, 1);
            [[x0, y0], [x0 + cardW, y0], [x0, y0 + cardH], [x0 + cardW, y0 + cardH]]
                .forEach(([px, py]) => {
                    cardBg.beginPath();
                    cardBg.moveTo(px + (px === x0 ? cs : -cs), py);
                    cardBg.lineTo(px, py);
                    cardBg.lineTo(px, py + (py === y0 ? cs : -cs));
                    cardBg.strokePath();
                });
        };
        drawCard(bgBase);

        this.add.text(cx, y0 + cardH * 0.1, arena.name.toUpperCase(), {
            fontSize: `${Math.round(cardW * 0.085)}px`,
            fontFamily: '"Courier New", monospace',
            color: accentHex, stroke: '#1a0030', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(5);

        this._buildCardPreview(isRuins, cx, cy, cardW, cardH, x0, y0);

        this.add.text(cx, y0 + cardH * 0.65, `"${arena.description}"`, {
            fontSize: `${Math.round(cardW * 0.072)}px`,
            fontFamily: '"Courier New", monospace',
            color: '#a090b8', stroke: '#1a0030', strokeThickness: 3,
            wordWrap: { width: cardW * 0.85 }, align: 'center',
        }).setOrigin(0.5).setDepth(5);

        const btnText = this.add.text(cx, y0 + cardH * 0.85, 'SELECT', {
            fontSize: `${Math.round(cardW * 0.055)}px`,
            fontFamily: '"Courier New", monospace',
            color: accentHex, stroke: '#1a0030', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(6);

        this.tweens.add({
            targets: btnText, alpha: 0.55,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        const zone = this.add.zone(cx, cy, cardW, cardH)
            .setInteractive({ useHandCursor: true }).setDepth(7);
        zone.on('pointerover', () => { drawCard(bgHover, 1.0); btnText.setColor('#ffffff'); });
        zone.on('pointerout', () => { drawCard(bgBase, 0.9); btnText.setColor(accentHex); });
        zone.on('pointerdown', () => {
            window.selectedArena = arenaKey;
            drawCard(isRuins ? 0x4a2a60 : 0x280850, 1.0);
            this.time.delayedCall(130, () => this.scene.start('GameScene'));
        });
    }

    _buildCardPreview(isRuins, cx, cy, cardW, cardH, x0, y0) {
        const previewH = cardH * 0.38;
        const previewGfx = this.add.graphics().setDepth(5);
        if (isRuins) {
            previewGfx.fillGradientStyle(0x2a1040, 0x2a1040, 0x503060, 0x503060, 1);
        } else {
            previewGfx.fillGradientStyle(0x050510, 0x050510, 0x0a0520, 0x0a0520, 1);
        }
        previewGfx.fillRect(x0 + 4, y0 + cardH * 0.18, cardW - 8, previewH);

        const midX = cx;
        const midY = y0 + cardH * 0.18 + previewH * 0.5;
        const iconGfx = this.add.graphics().setDepth(6);
        if (isRuins) {
            iconGfx.fillStyle(0x3a1a50, 1);
            iconGfx.fillTriangle(
                midX - 60, midY + previewH * 0.35,
                midX, midY - previewH * 0.35,
                midX + 60, midY + previewH * 0.35
            );
            iconGfx.fillStyle(0x8060a0, 0.5);
            iconGfx.fillCircle(midX + 40, midY - previewH * 0.2, 18);
        } else {
            iconGfx.fillStyle(0xd0d8ff, 0.9);
            iconGfx.fillCircle(midX, midY - previewH * 0.2, 22);
            iconGfx.fillStyle(0x1a1030, 1);
            [-40, 0, 40].forEach(ox =>
                iconGfx.fillRect(midX + ox - 8, midY + previewH * 0.05, 16, previewH * 0.4)
            );
        }
    }
}
