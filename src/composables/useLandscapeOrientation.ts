import { onBeforeUnmount, onMounted } from 'vue'

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
}

export function useLandscapeOrientation() {
  async function lockLandscape(enterFullscreen = false) {
    if (!window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches) return

    if (enterFullscreen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen()
      } catch {
        // Fullscreen and orientation locking depend on browser permissions.
      }
    }

    const orientation = screen.orientation as LockableScreenOrientation | undefined
    if (!orientation?.lock) return

    try {
      await orientation.lock('landscape')
    } catch {
      // The portrait guard remains visible when automatic locking is unavailable.
    }
  }

  onMounted(() => {
    void lockLandscape()
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', handleFirstInteraction)
  })

  function handleFirstInteraction() {
    void lockLandscape(true)
  }
}
