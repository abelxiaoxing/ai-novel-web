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
  twinkleSpeed: number;
  spriteIndex: number;
};

const canvasRef = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let animationId = 0;
let resizeAnimationId = 0;
let lastFrameTime = 0;
let stars: Star[] = [];
let starSprites: HTMLCanvasElement[] = [];
let reduceMotion = false;
let qualityFactor = 1;
let frameInterval = 1000 / 30;

const pointer = { x: 0, y: 0 };
const targetPointer = { x: 0, y: 0 };

const config = {
  near: 0.08,
  far: 1.18,
  baseSpeed: 0.00022,
  speedVariance: 0.00052,
  densityDivisor: 9800,
  minStars: 120,
  maxStars: 460,
  targetFps: 30,
  lowPowerFps: 24,
};

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const pickSpriteIndex = () => {
  const value = Math.random();
  if (value > 0.84) {
    return 2;
  }
  if (value > 0.48) {
    return 1;
  }
  return 0;
};

const createStar = (): Star => {
  return {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: randomBetween(config.near, config.far),
    size: randomBetween(0.62, 1.42),
    speed: randomBetween(config.baseSpeed, config.baseSpeed + config.speedVariance),
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: randomBetween(0.0009, 0.0017),
    spriteIndex: pickSpriteIndex(),
  };
};

const estimateQuality = () => {
  const area = width * height;
  let quality = area > 2_800_000 ? 0.7 : area > 2_000_000 ? 0.82 : 1;
  const cpuThreads =
    typeof navigator !== "undefined"
      ? (navigator.hardwareConcurrency ?? 8)
      : 8;
  const memorySource =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number })
      : {};
  const memorySize =
    typeof memorySource.deviceMemory === "number"
      ? memorySource.deviceMemory
      : 8;
  if (cpuThreads <= 4) {
    quality *= 0.8;
  }
  if (memorySize <= 4) {
    quality *= 0.84;
  }
  if (reduceMotion) {
    quality *= 0.56;
  }
  return Math.max(0.5, Math.min(1, quality));
};

const createSprite = (
  coreColor: string,
  glowColor: string,
  radius: number
) => {
  const size = Math.max(20, Math.ceil(radius * 6));
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const spriteCtx = sprite.getContext("2d");
  if (!spriteCtx) {
    return sprite;
  }

  const center = size / 2;
  const gradient = spriteCtx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center
  );
  gradient.addColorStop(0, coreColor);
  gradient.addColorStop(0.45, glowColor);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  spriteCtx.fillStyle = gradient;
  spriteCtx.fillRect(0, 0, size, size);

  return sprite;
};

const buildSprites = () => {
  starSprites = [
    createSprite("rgba(238, 248, 255, 0.95)", "rgba(168, 215, 255, 0.72)", 6),
    createSprite("rgba(190, 226, 255, 0.92)", "rgba(93, 183, 246, 0.68)", 5.8),
    createSprite("rgba(152, 210, 255, 0.9)", "rgba(55, 152, 235, 0.63)", 5.4),
  ];
};

const buildStars = () => {
  const density = (width * height) / config.densityDivisor;
  const count = Math.round(
    Math.max(
      config.minStars,
      Math.min(config.maxStars, density * qualityFactor)
    )
  );
  stars = Array.from({ length: count }, createStar);
};

const resetStar = (star: Star, respawnFar: boolean) => {
  star.x = Math.random() * 2 - 1;
  star.y = Math.random() * 2 - 1;
  star.z = respawnFar
    ? config.far
    : randomBetween(config.near, config.far);
  star.size = randomBetween(0.62, 1.42);
  star.speed = randomBetween(config.baseSpeed, config.baseSpeed + config.speedVariance);
  star.twinkle = Math.random() * Math.PI * 2;
  star.twinkleSpeed = randomBetween(0.0009, 0.0017);
  star.spriteIndex = pickSpriteIndex();
};

const resize = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  width = window.innerWidth;
  height = window.innerHeight;
  qualityFactor = estimateQuality();
  frameInterval =
    1000 /
    (qualityFactor < 0.75 || reduceMotion ? config.lowPowerFps : config.targetFps);
  const dprCap = qualityFactor < 0.75 ? 1 : 1.35;
  dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  buildSprites();
  buildStars();
  lastFrameTime = 0;
  drawFrame(performance.now(), true);
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

const queueResize = () => {
  if (resizeAnimationId) {
    return;
  }
  resizeAnimationId = requestAnimationFrame(() => {
    resizeAnimationId = 0;
    resize();
  });
};

const drawFrame = (time: number, force = false) => {
  if (!ctx || !width || !height) {
    return;
  }
  if (!force && lastFrameTime && time - lastFrameTime < frameInterval) {
    animationId = requestAnimationFrame(drawFrame);
    return;
  }

  const delta = lastFrameTime ? Math.min(4, (time - lastFrameTime) / 16.67) : 1;
  lastFrameTime = time;
  pointer.x += (targetPointer.x - pointer.x) * 0.07;
  pointer.y += (targetPointer.y - pointer.y) * 0.07;

  ctx.clearRect(0, 0, width, height);

  ctx.globalCompositeOperation = "screen";

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const spreadX = width * 0.54;
  const spreadY = height * 0.54;

  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index];
    star.z -= star.speed * delta;
    if (star.z <= config.near) {
      resetStar(star, true);
    }

    const depth = 1 - (star.z - config.near) / (config.far - config.near);
    const scale = 0.3 + depth * 1.4;
    const parallaxX = pointer.x * depth * 0.12;
    const parallaxY = pointer.y * depth * 0.12;
    const x = centerX + (star.x + parallaxX) * spreadX * scale;
    const y = centerY + (star.y + parallaxY) * spreadY * scale;

    if (x < -40 || x > width + 40 || y < -40 || y > height + 40) {
      resetStar(star, false);
      continue;
    }

    const twinkle =
      0.76 + Math.sin(time * star.twinkleSpeed + star.twinkle) * 0.24;
    const alpha = (0.12 + depth * 0.48) * twinkle;
    const size = star.size * (1.35 + depth * 4.6);
    const sprite = starSprites[star.spriteIndex];

    ctx.globalAlpha = alpha;
    const half = size * 0.5;
    ctx.drawImage(sprite, x - half, y - half, size, size);

    if (depth > 0.72) {
      const streakWidth = size * (1.4 + depth * 1.3);
      const streakHeight = Math.max(1, size * 0.16);
      ctx.globalAlpha = alpha * 0.2;
      ctx.drawImage(
        sprite,
        x - streakWidth * 0.5,
        y - streakHeight * 0.5,
        streakWidth,
        streakHeight
      );
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (!force && !reduceMotion && !document.hidden) {
    animationId = requestAnimationFrame(drawFrame);
  }
};

const handleMouseOut = (event: MouseEvent) => {
  if (!event.relatedTarget) {
    resetPointer();
  }
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = 0;
    }
    return;
  }
  if (!reduceMotion && !animationId) {
    lastFrameTime = 0;
    animationId = requestAnimationFrame(drawFrame);
  }
};

onMounted(() => {
  reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  resize();
  window.addEventListener("resize", queueResize, { passive: true });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("blur", resetPointer);
  window.addEventListener("mouseout", handleMouseOut);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (!reduceMotion && !document.hidden) {
    animationId = requestAnimationFrame(drawFrame);
  }
});

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (resizeAnimationId) {
    cancelAnimationFrame(resizeAnimationId);
  }
  window.removeEventListener("resize", queueResize);
  window.removeEventListener("pointermove", updatePointer);
  window.removeEventListener("blur", resetPointer);
  window.removeEventListener("mouseout", handleMouseOut);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(90, 170, 240, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(90, 170, 240, 0.06) 1px, transparent 1px);
  background-size: 180px 180px, 120px 120px;
  opacity: 0.16;
}

.space-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 30%,
    rgba(70, 150, 220, 0.2),
    rgba(8, 12, 18, 0) 62%
  );
  opacity: 0.54;
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
