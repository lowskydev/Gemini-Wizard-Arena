/**
 * Generates a procedural pixel-art fireball spritesheet using RAW WebGPU.
 * Returns a 2D canvas populated with 16 frames of 32x32 animation.
 */
export async function generateFireballSpritesheet() {
    console.log('[SpellFX]: Starting Raw WebGPU generation...');
    const frameCount = 16;
    const frameSize = 32;
    const width = frameCount * frameSize;
    const height = frameSize;

    // 1. Initialize WebGPU
    if (!navigator.gpu) {
        window.lastSpellFXError = 'WebGPU NOT SUPPORTED (navigator.gpu is missing).';
        throw new Error(window.lastSpellFXError);
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        window.lastSpellFXError = 'WebGPU FAIL: No adapter found (check your GPU drivers/flags).';
        throw new Error(window.lastSpellFXError);
    }
    const device = await adapter.requestDevice();

    // 2. Create Off-screen Texture
    const format = 'rgba8unorm';
    const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const shaderCode = `
        struct Uniforms {
            frame: f32,
            frameCount: f32,
        }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        @vertex
        fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
            var pos = array<vec2f, 4>(
                vec2f(-1.0, -1.0), vec2f(1.0, -1.0),
                vec2f(-1.0, 1.0),  vec2f(1.0, 1.0)
            );
            return vec4f(pos[vi], 0.0, 1.0);
        }

        fn hash(p: vec2f) -> f32 {
            return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
        }

        @fragment
        fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
            let uv = (fragCoord.xy % 32.0) / 32.0;
            let dist = distance(uv, vec2f(0.5, 0.5));
            
            let t = uniforms.frame / uniforms.frameCount;
            let radius = 0.25 + 0.15 * sin(t * 6.28 + hash(uv) * 3.0);
            
            if (dist > radius) { discard; }

            var color = vec3f(1.0, 0.53, 0.0); // Amber
            if (dist < radius * 0.4) { color = vec3f(1.0, 1.0, 0.6); }
            else if (dist > radius * 0.8) { color = vec3f(0.8, 0.1, 0.0); }

            if (hash(fragCoord.xy) > (1.3 - dist * 2.8)) { discard; }

            return vec4f(color, 1.0);
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }]
        },
        primitive: { topology: 'triangle-strip' }
    });

    const uniformBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });

    const commandEncoder = device.createCommandEncoder();
    for (let i = 0; i < frameCount; i++) {
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([i, frameCount]));
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texture.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: i === 0 ? 'clear' : 'load',
                storeOp: 'store'
            }]
        });
        pass.setScissorRect(i * frameSize, 0, frameSize, frameSize);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(4);
        pass.end();
    }

    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const buffer = device.createBuffer({
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [width, height]);
    device.queue.submit([commandEncoder.finish()]);

    await buffer.mapAsync(GPUMapMode.READ);
    const pixelData = new Uint8Array(buffer.getMappedRange());
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = y * bytesPerRow + x * 4;
            const destIdx = (y * width + x) * 4;
            imageData.data.set(pixelData.subarray(srcIdx, srcIdx + 4), destIdx);
        }
    }
    ctx.putImageData(imageData, 0, 0);
    buffer.unmap();

    console.log('[SpellFX]: Raw generation successful.');
    return finalCanvas;
}

window.generateFireballSpritesheet = generateFireballSpritesheet;
console.log('[SpellFX]: Module loaded and function registered on window.');
