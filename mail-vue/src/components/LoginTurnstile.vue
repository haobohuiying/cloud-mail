<template>
  <div class="login-challenge">
    <div ref="container" />
    <div v-if="failed" role="alert">
      验证码加载失败，请重试
      <button type="button" @click="mountWidget">重新加载</button>
    </div>
  </div>
</template>

<script setup>
import {onMounted, onBeforeUnmount, ref} from 'vue'
import {reloadTurnstileScript} from '@/utils/turnstile-script.js'

const props = defineProps({siteKey: String})
const emit = defineEmits(['update:token'])
const container = ref(null)
const failed = ref(false)
let widgetId = null
let disposed = false
let mounting = false

async function mountWidget() {
  if (mounting || disposed) return
  mounting = true
  failed.value = false
  emit('update:token', '')
  try {
    if (!props.siteKey) throw new Error('Turnstile site key is missing')
    const api = window.turnstile?.render ? window.turnstile : await reloadTurnstileScript()
    if (disposed) return
    if (widgetId !== null) api.remove(widgetId)
    widgetId = api.render(container.value, {
      sitekey: props.siteKey,
      action: 'login',
      size: 'flexible',
      callback: token => emit('update:token', token),
      'expired-callback': () => emit('update:token', ''),
      'error-callback': () => {
        emit('update:token', '')
        failed.value = true
      }
    })
  } catch {
    failed.value = true
  } finally {
    mounting = false
  }
}

function reset() {
  emit('update:token', '')
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId)
}

onMounted(mountWidget)
onBeforeUnmount(() => {
  disposed = true
  if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
})
defineExpose({reset})
</script>

<style scoped>
.login-challenge { margin: 12px 0; min-height: 65px; }
[role="alert"] { color: #c45656; font-size: 12px; }
</style>
