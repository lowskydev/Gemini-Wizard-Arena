// scenes/EndScene.js — "YOU DIED" screen shown when a player is eliminated
// ─────────────────────────────────────────────────────────────────────────────

class EndScene extends Phaser.Scene {   // eslint-disable-line no-undef
    constructor() {
        super({ key: 'EndScene' });
        this.timeElapsed = 0;
    }

    create() {
        gameSceneRef = null; // eslint-disable-line no-undef
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x440000, 0.5).setOrigin(0);

        this.deathText = this.add.text(width / 2, height * 0.38, 'YOU DIED', {
            fontFamily: 'Georgia, serif',
            fontSize: '140px',
            color: '#ff0000',
            fontStyle: 'bold',
            letterSpacing: 25,
        }).setOrigin(0.5).setShadow(0, 0, '#000000', 20, false, true);

        this.deathText.setAlpha(0);
        this.add.tween({
            targets: this.deathText,
            alpha: 1, scale: { from: 0.9, to: 1 },
            duration: 3000, ease: 'Sine.easeOut',
        });

        createSoulsButton(this, width / 2 - 150, height * 0.7, 'Go To Lobby', () => {  // eslint-disable-line no-undef
            this.scene.start('MenuScene');
        });
        createSoulsButton(this, width / 2 + 150, height * 0.7, 'Restart', () => {      // eslint-disable-line no-undef
            this.scene.start('GameScene');
        });
    }

    update(time, delta) {
        this.timeElapsed += delta;
        this.deathText.setScale(1 + Math.sin(this.timeElapsed * 0.001) * 0.02);
    }
}
