<template>
  <div class="space-background" aria-hidden="true">
    <canvas ref="canvasRef" class="space-canvas"></canvas>
    <div class="space-grid"></div>
    <div class="space-glow"></div>
    <div class="space-vignette"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

type Star = {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  twinkle: number;
  color: [number, number, number];
};

const canvasRef = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let animationId = 0;
let lastTime = 0;
let stars: Star[] = [];
let backgroundGradient: CanvasGradient | null = null;
let reduceMotion = false;

const pointer = { x: 0, y: 0 };
const targetPointer = { x: 0, y: 0 };

const config = {
  near: 0.05,
  far: 1.25,
  baseSpeed: 0.00035,
  speedVariance: 0.0012,
  starBaseSize: 0.6,
};

const createStar = (): Star => {
  const mix = Math.random();
  const r = Math.round(110 + 70 * mix);
  const g = Math.round(160 + 65 * mix);
  const b = Math.round(210 + 45 * mix);
  return {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: config.near + Math.random() * (config.far - config.near),
    size: config.starBaseSize + Math.random() * 1.4,
    speed: config.baseSpeed + Math.random() * config.speedVariance,
    twinkle: Math.random() * Math.PI * 2,
    color: [r, g, b],
  };
};

const buildStars = () => {
  const density = Math.floor((width * height) / 5500);
  const count = Math.max(240, Math.min(900, density));
  stars = Array.from({ length: count }, createStar);
};

const buildGradient = () => {
  if (!ctx) {
    return;
  }
  const radius = Math.max(width, height) * 0.85;
  backgroundGradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.4,
    0,
    width * 0.5,
    height * 0.4,
    radius
  );
  backgroundGradient.addColorStop(0, "rgba(25, 44, 76, 0.35)");
  backgroundGradient.addColorStop(0.45, "rgba(8, 14, 22, 0.2)");
  backgroundGradient.addColorStop(1, "rgba(5, 7, 10, 0.9)");
};

const resetStar = (star: Star, respawnFar: boolean) => {
  star.x = Math.random() * 2 - 1;
  star.y = Math.random() * 2 - 1;
  star.z = respawnFar
    ? config.far
    : config.near + Math.random() * (config.far - config.near);
  star.size = config.starBaseSize + Math.random() * 1.4;
  star.speed = config.baseSpeed + Math.random() * config.speedVariance;
  star.twinkle = Math.random() * Math.PI * 2;
};

const resize = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx = canvas.getContext("2d", { alpha: true });
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  buildStars();
  buildGradient();
  drawFrame(0, true);
};

const updatePointer = (event: PointerEvent) => {
  if (!width || !height) {
    return;
  }
  targetPointer.x = (event.clientX / width - 0.5) * 2;
  targetPointer.y = (event.clientY / height - 0.5) * 2;
};

const resetPointer = () => {
  targetPointer.x = 0;
  targetPointer.y = 0;
};

const drawFrame = (time: number, force = false) => {
  if (!ctx || !width || !height) {
    return;
  }
  const delta = lastTime ? Math.min(2, (time - lastTime) / 16.67) : 1;
  lastTime = time;
  pointer.x += (targetPointer.x - pointer.x) * 0.05;
  pointer.y += (targetPointer.y - pointer.y) * 0.05;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a0f15";
  ctx.fillRect(0, 0, width, height);
  if (backgroundGradient) {
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "lighter";

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const spreadX = width * 0.55;
  const spreadY = height * 0.55;

  for (const star of stars) {
    star.z -= star.speed * delta;
    if (star.z <= config.near) {
      resetStar(star, true);
    }

    const depth = 1 - (star.z - config.near) / (config.far - config.near);
    const scale = 0.35 + depth * 1.45;
    const parallaxX = pointer.x * depth * 0.14;
    const parallaxY = pointer.y * depth * 0.14;
    const x = centerX + (star.x + parallaxX) * spreadX * scale;
    const y = centerY + (star.y + parallaxY) * spreadY * scale;

    if (x < -80 || x > width + 80 || y < -80 || y > height + 80) {
      resetStar(star, false);
      continue;
    }

    const focus = 0.58;
    const dof = 1 - Math.min(1, Math.abs(depth - focus) / 0.65);
    const twinkle = 0.75 + Math.sin(time * 0.0014 + star.twinkle) * 0.25;
    const alpha = (0.08 + dof * 0.55 + depth * 0.22) * twinkle;
    const size = star.size * (0.4 + depth * 1.8);
    const [r, g, b] = star.color;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    if (dof > 0.55) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  ctx.globalCompositeOperation = "source-over";

  if (!force && !reduceMotion) {
    animationId = requestAnimationFrame(drawFrame);
  }
};

const handleMouseOut = (event: MouseEvent) => {
  if (!event.relatedTarget) {
    resetPointer();
  }
};

onMounted(() => {
  reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", updatePointer);
  window.addEventListener("blur", resetPointer);
  window.addEventListener("mouseout", handleMouseOut);

  if (!reduceMotion) {
    animationId = requestAnimationFrame(drawFrame);
  }
});

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", updatePointer);
  window.removeEventListener("blur", resetPointer);
  window.removeEventListener("mouseout", handleMouseOut);
});
</script>

<style scoped>
.space-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: #0a0f15;
  overflow: hidden;
}

.space-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.space-grid {
  position: absolute;
  inset: -10%;
  background-image:
    linear-gradient(90deg, rgba(90, 170, 240, 0.1) 1px, transparent 1px),
    linear-gradient(0deg, rgba(90, 170, 240, 0.08) 1px, transparent 1px);
  background-size: 140px 140px, 90px 90px;
  opacity: 0.22;
}

.space-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 30%,
    rgba(70, 150, 220, 0.25),
    rgba(8, 12, 18, 0) 60%
  );
  mix-blend-mode: screen;
  opacity: 0.7;
}

.space-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 40%,
    rgba(7, 10, 15, 0) 0%,
    rgba(6, 8, 12, 0.6) 58%,
    rgba(3, 4, 6, 0.92) 100%
  );
}
</style>
