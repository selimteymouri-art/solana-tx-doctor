"use client";

/**
 * Original procedural particle effect inspired by the public Pixel Ink description.
 * Not Shaders.com's source code, preset, or an exact fluid-simulation replica.
 * No dependencies beyond React. Next.js App Router compatible.
 *
 * INTEGRATION (give this file to your coding agent):
 * 1. Save as components/XezaPixelInk.tsx (or src/components/... in a src project).
 * 2. Import into app/page.tsx using the project's existing import convention.
 * 3. In the EXISTING outer page div, add `relative isolate` to its classes.
 * 4. Insert <XezaPixelInk /> as its FIRST child, before the existing header.
 * 5. Keep header z-50. Add `z-10` to the existing relative main element.
 *    Keep the skip link above everything. Preserve scanner logic and all content.
 *
 * Structure, for illustration only (do not replace the existing page):
 * <div className="relative isolate min-h-screen bg-[#070b12] ...">
 *   <XezaPixelInk />
 *   <header className="sticky top-0 z-50 ...">...</header>
 *   <main className="relative z-10 ...">...existing scanner...</main>
 * </div>
 *
 * Default effect covers the first 680px and fades before the results area.
 * Tune <XezaPixelInk opacity={0.4} speed={0.7} height={680} />.
 * Reduced motion: one static frame. Hidden/offscreen: animation paused.
 * Without WebGL: subtle CSS glow. Context loss: retain the CSS fallback.
 */

import { useEffect, useRef } from "react";

const vertexSource = `
precision highp float;
attribute vec4 aSeed;
uniform float uTime;
uniform vec2 uSize;
uniform float uDpr;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float t = uTime;
  float x = fract(aSeed.x + t * (0.025 + aSeed.w * 0.018)) * 2.8 - 1.4;
  float spread = (aSeed.y + aSeed.z - 1.0);
  float wave = sin(x * 3.4 - t * 0.65) * 0.13;
  wave += sin(x * 7.2 + t * 0.38 + spread * 4.0) * 0.055;
  float y = x * 0.52 + wave + spread * (0.18 + 0.18 * aSeed.w);
  float drift = sin(t * 0.45 + aSeed.x * 18.0) * 0.016;
  x += drift;
  // Short, subtle horizontal glitch pulses; no flashing full-screen layer.
  float glitch = pow(max(0.0, sin(t * 0.8)), 40.0);
  x += sin(floor(y * 48.0) * 7.0) * glitch * 0.01;
  float aspect = uSize.x / max(uSize.y, 1.0);
  y *= min(aspect, 1.8);
  gl_Position = vec4(x, y, 0.0, 1.0);
  gl_PointSize = (0.8 + aSeed.w * 1.7) * uDpr;
  vec3 cyan = vec3(0.098, 0.89, 1.0);
  vec3 blue = vec3(0.263, 0.22, 1.0);
  vec3 pink = vec3(1.0, 0.176, 0.494);
  float hue = 0.5 + 0.5 * sin(x * 2.0 + spread * 3.0 - t * 0.16);
  vColor = hue < 0.5 ? mix(cyan, blue, hue * 2.0)
                         : mix(blue, pink, (hue - 0.5) * 2.0);
  float edge = 1.0 - smoothstep(0.78, 1.4, abs(x));
  vAlpha = (0.08 + 0.45 * aSeed.w * aSeed.w) * edge;
}
`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float square = max(abs(p.x), abs(p.y));
  float alpha = (1.0 - smoothstep(0.28, 0.5, square)) * vAlpha;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

type Props = { opacity?: number; speed?: number; height?: number };

export default function XezaPixelInk({ opacity = 0.4, speed = 0.7, height = 680 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: "low-power",
    });
    if (!gl) return;

    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const release = () => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
    };
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Shader allocation failed");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
        }
        return shader;
      };
      program = gl.createProgram();
      if (!program) throw new Error("Program allocation failed");
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
      }
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer allocation failed");
    } catch (error) {
      console.warn("XEZA background: using CSS fallback.", error);
      release();
      return;
    }

    const count = matchMedia("(max-width: 640px)").matches ? 6000 : 18000;
    const seeds = new Float32Array(count * 4);
    let seed = 71;
    for (let i = 0; i < seeds.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      seeds[i] = seed / 4294967296;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program!, "aSeed");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 0, 0);
    const timeUniform = gl.getUniformLocation(program!, "uTime");
    const sizeUniform = gl.getUniformLocation(program!, "uSize");
    const dprUniform = gl.getUniformLocation(program!, "uDpr");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const motionSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0.7;
    let frame = 0;
    let inView = true;
    let lost = false;
    let clock = 0;
    let lastTime = 0;
    const paint = () => {
      if (lost) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeUniform, clock);
      gl.drawArrays(gl.POINTS, 0, count);
    };
    const tick = (now: number) => {
      frame = 0;
      if (lost || document.hidden || !inView || reduced.matches || !motionSpeed) return;
      if (lastTime) clock += Math.min((now - lastTime) / 1000, 0.05) * motionSpeed;
      lastTime = now;
      paint();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (lost || document.hidden || !inView) return;
      paint();
      if (!reduced.matches && motionSpeed) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      if (lost) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(sizeUniform, rect.width, rect.height);
      gl.uniform1f(dprUniform, dpr);
      paint();
    };
    const onLost = () => {
      lost = true;
      cancelAnimationFrame(frame);
    };
    const sizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    sizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    canvas.addEventListener("webglcontextlost", onLost);
    resize();
    sync();

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      canvas.removeEventListener("webglcontextlost", onLost);
      release();
    };
  }, [speed]);

  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: "0 0 auto", height,
      zIndex: 0, pointerEvents: "none", overflow: "hidden",
      opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.4,
      background: "radial-gradient(ellipse at 24% 70%, #19e3ff12, transparent 48%), radial-gradient(ellipse at 78% 25%, #ff2d7e12, transparent 48%)",
      maskImage: "linear-gradient(to bottom, transparent, black 14%, black 60%, transparent)",
      WebkitMaskImage: "linear-gradient(to bottom, transparent, black 14%, black 60%, transparent)",
    }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
