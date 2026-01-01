<template>
  <div class="not-found fade-in">
    <h1>404</h1>
    <p class="muted">页面不见了，返回首页看看。</p>
    <button class="btn btn-primary" @click="$router.push('/')">返回首页</button>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.not-found h1 {
  font-size: 64px;
  margin: 0;
}
</style>
