import buttonClickSound from '../../assets/sounds/button-click.mp3'
import starAppearSound from '../../assets/sounds/star-appear.mp3'
import starWaveSound from '../../assets/sounds/star-wave.mp3'

export type SoundName = 'buttonClick' | 'starAppear' | 'starWave'

const soundSources: Record<SoundName, string> = {
  buttonClick: buttonClickSound,
  starAppear: starAppearSound,
  starWave: starWaveSound,
}

const soundNames = Object.keys(soundSources) as SoundName[]

export function useGameSounds() {
  const players: Partial<Record<SoundName, HTMLAudioElement>> = {}

  function initialize() {
    soundNames.forEach((soundName) => {
      const audio = new Audio(soundSources[soundName])
      audio.preload = 'auto'
      players[soundName] = audio
    })
  }

  function play(soundName: SoundName) {
    const audio = players[soundName]
    if (!audio) return

    audio.currentTime = 0
    void audio.play().catch(() => {})
  }

  function stop(soundName: SoundName) {
    const audio = players[soundName]
    if (!audio) return

    audio.pause()
    audio.currentTime = 0
  }

  function stopAll() {
    soundNames.forEach(stop)
  }

  return { initialize, play, stop, stopAll }
}
