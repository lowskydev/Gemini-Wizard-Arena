// utils.js — Shared helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a filled-circle texture and registers it with the Phaser texture
 * manager under the given key.
 */
const createCircleTexture = (scene, key, radius, color) => {
    try {
        if (scene.textures.exists(key)) return; // avoid duplicate
        const gfx = scene.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(radius, radius, radius);
        gfx.generateTexture(key, radius * 2, radius * 2);
        gfx.destroy();
    } catch (err) {
        console.error('[createCircleTexture Error]:', err);
    }
};

/**
 * Creates a Dark-Souls-style interactive button inside a Phaser container.
 * Highlights on hover; fires onClick on pointerdown.
 */
function createSoulsButton(scene, x, y, textStr, onClick) {
    const BTN_W = 240;
    const BTN_H = 60;

    const container = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const label = scene.add.text(0, 0, textStr, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#aaaaaa',
        fontStyle: 'bold',
        letterSpacing: 2,
    }).setOrigin(0.5);

    container.add([bg, label]);

    const draw = (isHover) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);

        if (isHover) {
            bg.lineStyle(2, 0xffaa00, 1);
            label.setColor('#ffffff').setShadow(0, 0, '#ffaa00', 8, false, true);
        } else {
            bg.lineStyle(1, 0x555555, 0.8);
            label.setColor('#aaaaaa').setShadow(0, 0, '#000000', 0);
        }

        bg.strokeRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
    };

    draw(false);

    const zone = scene.add.zone(0, 0, BTN_W, BTN_H).setInteractive({ cursor: 'pointer' });
    container.add(zone);

    zone.on('pointerover', () => { draw(true); container.setScale(1.05); });
    zone.on('pointerout', () => { draw(false); container.setScale(1); });
    zone.on('pointerdown', onClick);

    return container;
}
