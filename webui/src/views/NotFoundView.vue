<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="glitch-wrapper">
        <h1 class="glitch" data-text="404">404</h1>
      </div>
      <p class="muted">页面不见了，返回首页看看。</p>
      <button class="btn btn-primary" @click="$router.push('/')">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>返回首页</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: fadeInUp 0.6s ease forwards;
}

.glitch-wrapper {
  position: relative;
}

.glitch {
  font-size: clamp(80px, 20vw, 160px);
  font-weight: 900;
  margin: 0;
  background: linear-gradient(135deg, var(--text) 0%, var(--accent-bright) 50%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  text-shadow: 0 0 40px rgba(47, 155, 255, 0.3);
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--accent-bright), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glitch::before {
  animation: glitch-1 2s infinite linear alternate-reverse;
  clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
}

.glitch::after {
  animation: glitch-2 2s infinite linear alternate-reverse;
  clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent), #2f6bff);
  color: #f2edff;
  box-shadow: 0 8px 24px rgba(47, 155, 255, 0.3);
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(47, 155, 255, 0.4);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glitch-1 {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
}

@keyframes glitch-2 {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(2px, -2px); }
  40% { transform: translate(2px, 2px); }
  60% { transform: translate(-2px, -2px); }
  80% { transform: translate(-2px, 2px); }
}
</style>
