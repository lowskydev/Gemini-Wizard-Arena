import tgpu from 'typegpu';

async function initBackground() {
    try {
        const canvas = document.getElementById('gpu-bg');
        if (!canvas) return;
        
        let device;
        try {
            const root = await tgpu.init();
            device = root.device;
        } catch (e) {
            // Fallback to purely raw WebGPU if typegpu root initialization misses something
            const adapter = await navigator.gpu?.requestAdapter();
            device = await adapter?.requestDevice();
        }

        if (!device) {
            console.warn('WebGPU not supported on this browser. Procedural background disabled.');
            return;
        }

        const context = canvas.getContext('webgpu');
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });

        const shaderModule = device.createShaderModule({
            code: `
                struct Uniforms {
                    time: f32,
                    res: vec2f,
                };
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                @vertex
                fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
                    var pos = array<vec2f, 3>(
                        vec2f(-1.0, -1.0),
                        vec2f(3.0, -1.0),
                        vec2f(-1.0, 3.0)
                    );
                    return vec4f(pos[vertexIndex], 0.0, 1.0);
                }

                fn hash(p: vec2f) -> f32 {
                    return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
                }

                @fragment
                fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
                    let uv = fragCoord.xy / uniforms.res;
                    let t = uniforms.time * 0.5;
                    
                    var color = vec3f(0.05, 0.0, 0.0) + vec3f(0.1, 0.0, 0.0) * (1.0 - uv.y);
                    
                    let e1 = hash(floor(uv * 20.0 - t * 2.0));
                    let e2 = hash(floor(uv * 40.0 - t * 4.0));
                    
                    if (e1 > 0.98) {
                        color += vec3f(1.0, 0.27, 0.0) * sin(t * 10.0 + e1 * 100.0);
                    }
                    if (e2 > 0.99) {
                        color += vec3f(0.8, 0.1, 0.0) * sin(t * 15.0 + e2 * 100.0);
                    }
                    
                    color -= vec3f(0.2, 0.0, 0.0) * hash(uv * 100.0);
                    color = clamp(color, vec3f(0.0), vec3f(1.0));

                    return vec4f(color, 1.0);
                }
            `
        });

        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        const uniformBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
        });

        const uniformData = new Float32Array(4);

        let startTime = performance.now();

        function frame() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            const now = performance.now();
            uniformData[0] = (now - startTime) / 1000.0;
            uniformData[2] = canvas.width;
            uniformData[3] = canvas.height;
            device.queue.writeBuffer(uniformBuffer, 0, uniformData);

            const commandEncoder = device.createCommandEncoder();
            const textureView = context.getCurrentTexture().createView();
            
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }]
            });
            
            renderPass.setPipeline(pipeline);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(3);
            renderPass.end();
            
            device.queue.submit([commandEncoder.finish()]);
            
            requestAnimationFrame(frame);
        }
        
        frame();
    } catch (err) {
        console.warn('WebGPU init failed:', err);
    }
}

initBackground();
