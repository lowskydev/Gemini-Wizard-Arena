/**
 * spell-fx.js — Procedural pixel-art spell spritesheets via RAW WebGPU.
 * Generates 4 distinct animated spritesheets (16 frames × 32×32 each):
 *   • fireball  — swirling orange/amber flame ball
 *   • frostbite — spinning ice crystal shard, cyan/white
 *   • bolt      — crackling yellow lightning bolt shape
 *   • nova      — pulsing purple energy orb with ring
 */

// ── Shader library ────────────────────────────────────────────────────────

const COMMON_VERTEX = `
    @vertex
    fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 4>(
            vec2f(-1.0, -1.0), vec2f(1.0, -1.0),
            vec2f(-1.0, 1.0),  vec2f(1.0, 1.0)
        );
        return vec4f(pos[vi], 0.0, 1.0);
    }
`;

const COMMON_UNIFORMS = `
    struct Uniforms {
        frame: f32,
        frameCount: f32,
    }
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    fn hash(p: vec2f) -> f32 {
        return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
    }
    fn hash2(p: vec2f) -> vec2f {
        return vec2f(hash(p), hash(p + vec2f(37.0, 17.0)));
    }
`;

// ── Fireball shader ───────────────────────────────────────────────────────
const FIREBALL_FRAG = `
    ${COMMON_UNIFORMS}
    ${COMMON_VERTEX}

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = (fragCoord.xy % 32.0) / 32.0;
        let t = uniforms.frame / uniforms.frameCount;
        let center = vec2f(0.5, 0.5);
        let dist = distance(uv, center);
        let angle = atan2(uv.y - 0.5, uv.x - 0.5);

        // Animated radius with noise
        let noise = hash(vec2f(angle * 3.0, t * 10.0)) * 0.08;
        let radius = 0.28 + 0.06 * sin(t * 6.28 * 3.0 + angle * 4.0) + noise;

        if (dist > radius + 0.04) { discard; }

        // Core → edge colour gradient
        var color: vec3f;
        let norm = dist / radius;
        if (norm < 0.3) {
            color = vec3f(1.0, 1.0, 0.7);  // white-hot core
        } else if (norm < 0.6) {
            color = mix(vec3f(1.0, 0.85, 0.3), vec3f(1.0, 0.5, 0.0), (norm - 0.3) / 0.3);
        } else {
            color = mix(vec3f(1.0, 0.4, 0.0), vec3f(0.6, 0.05, 0.0), (norm - 0.6) / 0.4);
        }

        // Pixel noise for that crunchy look
        if (hash(fragCoord.xy + t * 100.0) > (1.1 - norm * 0.9)) { discard; }

        // Outer glow (semi-transparent fringe)
        var alpha = 1.0;
        if (dist > radius) {
            alpha = 1.0 - (dist - radius) / 0.04;
            color = vec3f(0.8, 0.2, 0.0);
        }

        return vec4f(color, clamp(alpha, 0.0, 1.0));
    }
`;

// ── Frostbite shader ──────────────────────────────────────────────────────
const FROSTBITE_FRAG = `
    ${COMMON_UNIFORMS}
    ${COMMON_VERTEX}

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = (fragCoord.xy % 32.0) / 32.0;
        let t = uniforms.frame / uniforms.frameCount;
        let center = vec2f(0.5, 0.5);
        let d = uv - center;
        let dist = length(d);

        // Rotating crystal shape — 6-pointed star via angle modulation
        let rot = t * 6.28;
        let angle = atan2(d.y, d.x) + rot;
        let spike = abs(cos(angle * 3.0));  // 6 spikes
        let radius = 0.18 + spike * 0.14;

        if (dist > radius + 0.03) { discard; }

        // Icy colour gradient
        var color: vec3f;
        let norm = dist / radius;
        if (norm < 0.25) {
            color = vec3f(0.9, 1.0, 1.0);  // bright white center
        } else if (norm < 0.6) {
            color = mix(vec3f(0.6, 0.95, 1.0), vec3f(0.2, 0.7, 1.0), (norm - 0.25) / 0.35);
        } else {
            color = mix(vec3f(0.15, 0.55, 0.9), vec3f(0.05, 0.2, 0.6), (norm - 0.6) / 0.4);
        }

        // Crystalline sparkle
        let sparkle = hash(floor(fragCoord.xy * 0.5) + vec2f(t * 20.0, 0.0));
        if (sparkle > 0.92 && norm < 0.7) {
            color = vec3f(1.0, 1.0, 1.0);
        }

        // Pixelated edge
        if (hash(fragCoord.xy) > (1.2 - norm * 1.0)) { discard; }

        var alpha = 1.0;
        if (dist > radius) {
            alpha = 1.0 - (dist - radius) / 0.03;
            color = vec3f(0.1, 0.4, 0.8);
        }

        return vec4f(color, clamp(alpha, 0.0, 1.0));
    }
`;

// ── Bolt shader ───────────────────────────────────────────────────────────
const BOLT_FRAG = `
    ${COMMON_UNIFORMS}
    ${COMMON_VERTEX}

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = (fragCoord.xy % 32.0) / 32.0;
        let t = uniforms.frame / uniforms.frameCount;
        let center = vec2f(0.5, 0.5);
        let d = uv - center;
        let dist = length(d);

        // Zigzag lightning bolt shape — horizontal bias
        let px = (uv.x - 0.15) / 0.7;  // normalise x across sprite
        if (px < 0.0 || px > 1.0) { discard; }

        // Generate zigzag center line
        let segments = 5.0;
        let seg = floor(px * segments);
        let segFrac = fract(px * segments);
        let yOffset = hash(vec2f(seg, t * 8.0 + uniforms.frame)) * 0.3 - 0.15;
        let nextYOffset = hash(vec2f(seg + 1.0, t * 8.0 + uniforms.frame)) * 0.3 - 0.15;
        let boltCenter = 0.5 + mix(yOffset, nextYOffset, segFrac);

        let boltDist = abs(uv.y - boltCenter);
        let thickness = 0.06 + 0.02 * sin(t * 6.28 * 2.0);

        if (boltDist > thickness + 0.04) { discard; }

        // Colour: white core → yellow → dark yellow edge
        var color: vec3f;
        let norm = boltDist / thickness;
        if (norm < 0.3) {
            color = vec3f(1.0, 1.0, 1.0);
        } else if (norm < 0.7) {
            color = mix(vec3f(1.0, 1.0, 0.6), vec3f(1.0, 0.9, 0.1), (norm - 0.3) / 0.4);
        } else {
            color = vec3f(0.9, 0.7, 0.0);
        }

        // Crackling sparks
        if (hash(fragCoord.xy + vec2f(t * 50.0, 0.0)) > 0.88 && boltDist < thickness * 1.5) {
            color = vec3f(1.0, 1.0, 1.0);
        }

        var alpha = 1.0;
        if (boltDist > thickness) {
            alpha = 1.0 - (boltDist - thickness) / 0.04;
            color = vec3f(0.8, 0.7, 0.0);
        }

        return vec4f(color, clamp(alpha, 0.0, 1.0));
    }
`;

// ── Nova shader ───────────────────────────────────────────────────────────
const NOVA_FRAG = `
    ${COMMON_UNIFORMS}
    ${COMMON_VERTEX}

    @fragment
    fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = (fragCoord.xy % 32.0) / 32.0;
        let t = uniforms.frame / uniforms.frameCount;
        let center = vec2f(0.5, 0.5);
        let d = uv - center;
        let dist = length(d);
        let angle = atan2(d.y, d.x);

        // Pulsing orb with energy ring
        let pulseRadius = 0.2 + 0.04 * sin(t * 6.28 * 2.0);
        let ringRadius = 0.32 + 0.03 * sin(t * 6.28 * 3.0 + 1.5);
        let ringThickness = 0.04;

        let inOrb = dist < pulseRadius;
        let ringDist = abs(dist - ringRadius);
        let inRing = ringDist < ringThickness;

        if (!inOrb && !inRing && dist > ringRadius + ringThickness + 0.02) { discard; }

        var color: vec3f;
        var alpha = 1.0;

        if (inOrb) {
            let norm = dist / pulseRadius;
            if (norm < 0.3) {
                color = vec3f(1.0, 0.8, 1.0);  // bright pink-white core
            } else {
                color = mix(vec3f(0.85, 0.4, 1.0), vec3f(0.5, 0.1, 0.8), (norm - 0.3) / 0.7);
            }
            // Swirl pattern
            let swirl = sin(angle * 6.0 + t * 6.28 * 4.0 + dist * 20.0);
            if (swirl > 0.5) { color += vec3f(0.15, 0.05, 0.2); }
        } else if (inRing) {
            let norm = ringDist / ringThickness;
            color = mix(vec3f(0.9, 0.5, 1.0), vec3f(0.4, 0.1, 0.7), norm);
            // Rotating energy sparks on ring
            let sparkAngle = angle + t * 6.28 * 2.0;
            if (sin(sparkAngle * 8.0) > 0.7) {
                color = vec3f(1.0, 0.9, 1.0);
            }
        } else {
            // Faint outer glow
            alpha = 1.0 - (dist - ringRadius - ringThickness) / 0.02;
            color = vec3f(0.5, 0.15, 0.7);
        }

        // Pixel noise
        if (hash(fragCoord.xy + vec2f(0.0, t * 30.0)) > 0.94) {
            color = min(color + vec3f(0.3), vec3f(1.0));
        }

        return vec4f(color, clamp(alpha, 0.0, 1.0));
    }
`;

// ── Rendering pipeline ────────────────────────────────────────────────────

const SPELL_SHADERS = {
    fireball:  FIREBALL_FRAG,
    frostbite: FROSTBITE_FRAG,
    bolt:      BOLT_FRAG,
    nova:      NOVA_FRAG,
};

/**
 * Renders one 16-frame spritesheet (512×32) from a WGSL fragment shader.
 * Returns an HTMLCanvasElement.
 */
async function renderSpritesheet(device, shaderCode) {
    const frameCount = 16;
    const frameSize = 32;
    const width = frameCount * frameSize;
    const height = frameSize;
    const format = 'rgba8unorm';

    const texture = device.createTexture({
        size: [width, height],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-strip' },
    });

    const uniformBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    const commandEncoder = device.createCommandEncoder();
    for (let i = 0; i < frameCount; i++) {
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([i, frameCount]));
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texture.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: i === 0 ? 'clear' : 'load',
                storeOp: 'store',
            }],
        });
        pass.setScissorRect(i * frameSize, 0, frameSize, frameSize);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(4);
        pass.end();
    }

    // Read back to CPU
    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const readBuffer = device.createBuffer({
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyTextureToBuffer({ texture }, { buffer: readBuffer, bytesPerRow }, [width, height]);
    device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const pixelData = new Uint8Array(readBuffer.getMappedRange());

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = y * bytesPerRow + x * 4;
            const dstIdx = (y * width + x) * 4;
            imageData.data.set(pixelData.subarray(srcIdx, srcIdx + 4), dstIdx);
        }
    }
    ctx.putImageData(imageData, 0, 0);
    readBuffer.unmap();

    // Cleanup
    texture.destroy();
    uniformBuffer.destroy();
    readBuffer.destroy();

    return canvas;
}

/**
 * Main entry: generates all 4 spell spritesheets.
 * Returns { fireball: Canvas, frostbite: Canvas, bolt: Canvas, nova: Canvas }
 */
export async function generateAllSpellSpritesheets() {
    console.log('[SpellFX]: Initialising WebGPU for all spells...');

    if (!navigator.gpu) {
        throw new Error('WebGPU NOT SUPPORTED.');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const device = await adapter.requestDevice();

    const results = {};
    for (const [name, shader] of Object.entries(SPELL_SHADERS)) {
        try {
            results[name] = await renderSpritesheet(device, shader);
            console.log(`[SpellFX]: ✅ ${name} spritesheet ready.`);
        } catch (e) {
            console.warn(`[SpellFX]: ⚠️ ${name} failed:`, e.message);
        }
    }

    device.destroy();
    return results;
}

// Legacy compat — keep the old single function too
export async function generateFireballSpritesheet() {
    const all = await generateAllSpellSpritesheets();
    return all.fireball;
}

// Register on window for non-module access
window.generateAllSpellSpritesheets = generateAllSpellSpritesheets;
window.generateFireballSpritesheet = generateFireballSpritesheet;

console.log('[SpellFX]: Module loaded.');
