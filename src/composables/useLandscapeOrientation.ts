import { onBeforeUnmount, onMounted, ref } from 'vue'

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
}

export function useLandscapeOrientation() {
  const isMobilePortrait = ref(false)
  let portraitQuery: MediaQueryList | null = null

  function updateOrientationState() {
    isMobilePortrait.value = portraitQuery?.matches ?? false
  }

  async function lockLandscape(enterFullscreen = false) {
    if (!isMobilePortrait.value) return

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
    portraitQuery = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
    updateOrientationState()
    portraitQuery.addEventListener('change', updateOrientationState)
    void lockLandscape()
  })

  onBeforeUnmount(() => {
    portraitQuery?.removeEventListener('change', updateOrientationState)
  })

  return {
    isMobilePortrait,
    enableLandscape: () => lockLandscape(true),
  }
}
