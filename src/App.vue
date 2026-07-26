<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameSounds } from './composables/useGameSounds'
import { useLandscapeOrientation } from './composables/useLandscapeOrientation'
import {
  CHEST_COUNT,
  completionCopy,
  journeyItems,
  questions,
} from './game/gameConfig'
import {
  isFiniteNumber,
  isRecord,
  readStoredJson,
  readStoredText,
  writeStoredJson,
  writeStoredText,
} from './utils/storage'
import backgroundImage from '../assets/background.png'
import anchorImage from '../assets/ui/anchor.png'
import congratsImage from '../assets/ui/congrats.png'
import gameTitleImage from '../assets/ui/header.png'
import homeImage from '../assets/ui/home.png'
import mascotImage from '../assets/ui/mascot.png'
import panelRopeImage from '../assets/ui/panel_rope.png'
import playAgainImage from '../assets/ui/play_again.png'
import woodPanelImage from '../assets/ui/wood_panel.png'
import emptyStarImage from '../assets/ui/empty_star.png'
import starImage from '../assets/ui/star.png'
import settingsImage from '../assets/ui/settings.png'
import woodSignImage from '../assets/ui/wood_sign.png'
import chest1 from '../assets/chests/chest1.png'
import chest1Open from '../assets/chests/chest1open.png'
import chest2 from '../assets/chests/chest2.png'
import chest2Open from '../assets/chests/chest2open.png'
import chest3 from '../assets/chests/chest3.png'
import chest3Open from '../assets/chests/chest3open.png'
import chest4 from '../assets/chests/chest4.png'
import chest4Open from '../assets/chests/chest4open.png'
import chest5 from '../assets/chests/chest5.png'
import chest5Open from '../assets/chests/chest5open.png'
import chest6 from '../assets/chests/chest6.png'
import chest6Open from '../assets/chests/chest6open.png'

// The scene was designed for the collapsed navigation width. Starting in that
// state keeps the usable game viewport identical on every fresh browser.
const isCollapsed = ref(true)
useLandscapeOrientation()
const mascotShadowVisualOffsetY = 18
const mascotVisualOffsetY = 22
const starGroupVisualOffsetY = -1
const woodPanelHeightAdjustment = 28
const chestOpenStates = ref(Array.from({ length: CHEST_COUNT }, () => false))
const score = ref(0)
const solvedCount = ref(0)
const currentQuestionIndex = ref(0)
const isAnswerLocked = ref(false)
const isGameComplete = ref(false)
const wrongChestId = ref<number | null>(null)
const isSettingsOpen = ref(false)
const isCompletionPanelVisible = ref(false)
const starPulseDurationMs = 620
const finalStarBurstDurationMs = 760
const finalStarPulseDelayMs = 520
const finalStarPulseStepMs = 210
// A new namespace prevents stale layout values from older builds from making
// the same release look different in two browsers.
const layoutStorageVersion = 'responsive-v1'
const completionLayoutStorageKey = `takim-macerasi-completion-layout-${layoutStorageVersion}`
const completionTitleText = completionCopy.title
const completionBodyText = completionCopy.body
const totalRounds = questions.length

const chestAssetVersion = 'clean-20260725'
const chestImages = [chest1, chest2, chest3, chest4, chest5, chest6].map(
  (source) => `${source}?v=${chestAssetVersion}`,
)
const chestOpenImages = [
  chest1Open,
  chest2Open,
  chest3Open,
  chest4Open,
  chest5Open,
  chest6Open,
].map((source) => `${source}?v=${chestAssetVersion}`)

type FlyingStar = {
  id: number
  x: number
  y: number
  deltaX: number
  deltaY: number
}

type CompletionLayoutItem = {
  x: number
  y: number
}

type CompletionLayout = {
  stars: CompletionLayoutItem
  title: CompletionLayoutItem
  body: CompletionLayoutItem
  playAgain: CompletionLayoutItem & { width: number }
  home: CompletionLayoutItem & { width: number }
}

const currentQuestion = computed(
  () => questions[Math.min(currentQuestionIndex.value, questions.length - 1)]!,
)
const flyingStar = ref<FlyingStar | null>(null)
const pulsingStarIndices = ref<number[]>([])
const pulsingStarIndexSet = computed(() => new Set(pulsingStarIndices.value))
const isFinalStarBurst = ref(false)
const chestElements: HTMLElement[] = []
const starSlotElements: HTMLElement[] = []
let flyingStarId = 0
let starPulseResetTimeoutId: number | null = null
let questionAdvanceTimeoutId: number | null = null
let finalStarCelebrationRunId = 0
let finalStarCelebrationTimeoutIds: number[] = []

const {
  initialize: initializeSounds,
  play: playSound,
  stop: stopSound,
  stopAll: stopAllSounds,
} = useGameSounds()

function handleInterfaceClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const clickable = target.closest('button, .chest-slot.clickable')
  if (!clickable) return
  if (clickable instanceof HTMLButtonElement && clickable.disabled) return

  playSound('buttonClick')
}

function normalizeCompletionActionWidth(width: number | undefined, fallback: number) {
  if (!Number.isFinite(width)) return fallback
  return Math.max(72, Math.min(width ?? fallback, 92))
}

function mergeLayoutItem<T extends CompletionLayoutItem>(
  fallback: T,
  storedValue: unknown,
): T {
  if (!isRecord(storedValue)) return { ...fallback }

  return {
    ...fallback,
    x: isFiniteNumber(storedValue.x) ? storedValue.x : fallback.x,
    y: isFiniteNumber(storedValue.y) ? storedValue.y : fallback.y,
  }
}

function loadCompletionLayout(): CompletionLayout {
  const defaultLayout: CompletionLayout = {
    stars: { x: 93.03214896891019, y: 162.49592327996385 },
    title: { x: 137.3830483614082, y: 205.85488958990535 },
    body: { x: 57.90724167688412, y: 280.59681773862627 },
    playAgain: { x: 103.1653135281632, y: 383.75043174671447, width: 82 },
    home: { x: 222.18551664623175, y: 387.53869330469365, width: 82 },
  }

  const storedLayout = readStoredJson(completionLayoutStorageKey)
  if (!isRecord(storedLayout)) return defaultLayout

  const playAgain = mergeLayoutItem(defaultLayout.playAgain, storedLayout.playAgain)
  const home = mergeLayoutItem(defaultLayout.home, storedLayout.home)

  return {
    stars: mergeLayoutItem(defaultLayout.stars, storedLayout.stars),
    title: mergeLayoutItem(defaultLayout.title, storedLayout.title),
    body: mergeLayoutItem(defaultLayout.body, storedLayout.body),
    playAgain: {
      ...playAgain,
      width: normalizeCompletionActionWidth(
        isRecord(storedLayout.playAgain) && isFiniteNumber(storedLayout.playAgain.width)
          ? storedLayout.playAgain.width
          : undefined,
        defaultLayout.playAgain.width,
      ),
    },
    home: {
      ...home,
      width: normalizeCompletionActionWidth(
        isRecord(storedLayout.home) && isFiniteNumber(storedLayout.home.width)
          ? storedLayout.home.width
          : undefined,
        defaultLayout.home.width,
      ),
    },
  }
}

const completionLayout: CompletionLayout = loadCompletionLayout()

function resetGameProgress() {
  stopSound('starAppear')
  stopSound('starWave')
  clearQuestionAdvanceTimeout()
  clearFinalStarCelebrationState()
  chestOpenStates.value = Array.from({ length: CHEST_COUNT }, () => false)
  score.value = 0
  solvedCount.value = 0
  currentQuestionIndex.value = 0
  isAnswerLocked.value = false
  isGameComplete.value = false
  wrongChestId.value = null
  flyingStar.value = null
}

function handlePlayAgainClick() {
  replayGame()
}

function handleHomeClick() {
  returnToStart()
}

type ShadowItem = {
  id: number
  x: number
  y: number
  width: number
  height: number
  opacity: number
  chestId?: number
  anchor?: 'content' | 'chest' | 'mascot'
}

type TextAreaItem = {
  id: number
  chestId: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  anchor?: 'content' | 'chest'
}

type ChestPosition = {
  x: number
  y: number
}

type MascotLayout = {
  x: number
  y: number
  width: number
}

type WoodPanelLayout = {
  x: number
  y: number
  width: number
  height: number
}

type GameTitleLayout = {
  x: number
  y: number
  width: number
}

type PanelRopeLayout = {
  id: number
  x: number
  y: number
  height: number
}

type StarGroupLayout = {
  x: number
  y: number
}

type SeaLabelLayout = {
  x: number
  y: number
}

const shadowStorageKey = `takim-macerasi-shadow-layout-${layoutStorageVersion}`
const textAreaStorageKey = `takim-macerasi-text-area-layout-${layoutStorageVersion}`
const textAreaVisualVersionKey = `takim-macerasi-text-area-visual-${layoutStorageVersion}`
const chestPositionStorageKey = `takim-macerasi-chest-position-${layoutStorageVersion}`
const mascotStorageKey = `takim-macerasi-mascot-layout-${layoutStorageVersion}`
const woodPanelStorageKey = `takim-macerasi-wood-panel-${layoutStorageVersion}`
const gameTitleStorageKey = `takim-macerasi-game-title-${layoutStorageVersion}`
const panelRopeStorageKey = `takim-macerasi-panel-rope-${layoutStorageVersion}`
const starGroupStorageKey = `takim-macerasi-star-group-${layoutStorageVersion}`
const seaLabelStorageKey = `takim-macerasi-sea-label-${layoutStorageVersion}`

function hasFiniteNumberFields<T extends object>(
  value: unknown,
  fields: readonly (keyof T)[],
): value is T {
  return (
    isRecord(value) &&
    fields.every((field) => isFiniteNumber(value[String(field)]))
  )
}

function loadNumericLayout<T extends object>(
  storageKey: string,
  fallback: T,
  fields: readonly (keyof T)[],
): T {
  const storedLayout = readStoredJson(storageKey)
  return hasFiniteNumberFields<T>(storedLayout, fields)
    ? storedLayout
    : { ...fallback }
}

type StoredShadowItem = Omit<ShadowItem, 'opacity'> & { opacity?: number }

function isStoredShadowItem(value: unknown): value is StoredShadowItem {
  if (!hasFiniteNumberFields<StoredShadowItem>(
    value,
    ['id', 'x', 'y', 'width', 'height'],
  )) {
    return false
  }

  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) return false
  if (value.chestId !== undefined && !isFiniteNumber(value.chestId)) return false
  return value.anchor === undefined || ['content', 'chest', 'mascot'].includes(value.anchor)
}

function isTextAreaItem(value: unknown): value is TextAreaItem {
  if (!hasFiniteNumberFields<TextAreaItem>(
    value,
    ['id', 'chestId', 'x', 'y', 'width', 'height', 'rotation'],
  )) {
    return false
  }

  return value.anchor === undefined || value.anchor === 'content' || value.anchor === 'chest'
}

function isPanelRopeLayout(value: unknown): value is PanelRopeLayout {
  return hasFiniteNumberFields<PanelRopeLayout>(value, ['id', 'x', 'y', 'height'])
}

const contentRef = ref<HTMLElement | null>(null)
const gameStageRef = ref<HTMLElement | null>(null)
const mascotRef = ref<HTMLElement | null>(null)
const mascotVisualRef = ref<HTMLElement | null>(null)
const gameStageScale = ref(1)
const gameStageWidth = ref(1438)

type GameStageReference = {
  width: number
  height: number
  viewportWidth: number
}

const defaultGameStageReference: GameStageReference = {
  width: 1438,
  height: 830,
  viewportWidth: 1528,
}

// This must be a build-time constant. Persisting it in localStorage made each
// computer use whichever viewport happened to be saved there previously.
const gameStageReference: GameStageReference = { ...defaultGameStageReference }
let contentResizeObserver: ResizeObserver | null = null

function createSceneViewportStyles(viewportWidth: number) {
  const vw = viewportWidth / 100

  return {
    '--scene-72vw': `${vw * 72}px`,
    '--scene-48vw': `${vw * 48}px`,
    '--scene-17vw': `${vw * 17}px`,
    '--scene-11-8vw': `${vw * 11.8}px`,
    '--scene-11-4vw': `${vw * 11.4}px`,
    '--scene-8-1vw': `${vw * 8.1}px`,
    '--scene-7-8vw': `${vw * 7.8}px`,
    '--scene-3-5vw': `${vw * 3.5}px`,
    '--scene-2-7vw': `${vw * 2.7}px`,
    '--scene-2-6vw': `${vw * 2.6}px`,
    '--scene-2-5vw': `${vw * 2.5}px`,
    '--scene-2-2vw': `${vw * 2.2}px`,
    '--scene-1-5vw': `${vw * 1.5}px`,
    '--scene-1-35vw': `${vw * 1.35}px`,
    '--scene-1-1vw': `${vw * 1.1}px`,
    '--scene-1vw': `${vw}px`,
    '--scene-0-85vw': `${vw * 0.85}px`,
  }
}

const gameStageStyle = computed(() => {
  const reference = gameStageReference

  return {
    width: `${gameStageWidth.value}px`,
    height: `${reference.height}px`,
    top: '50%',
    left: '50%',
    backgroundImage: `url(${backgroundImage})`,
    transform: `translate(-50%, -50%) scale(${gameStageScale.value})`,
    transformOrigin: 'center',
    ...createSceneViewportStyles(reference.viewportWidth),
  }
})

function createDefaultChestShadows(startId = 1): ShadowItem[] {
  const layouts = [
    {
      chestId: 1,
      x: -32.19753171517647,
      y: 92.04040623613713,
      width: 245.59991455078125,
      height: 64.00006103515625,
      opacity: 0.85,
    },
    {
      chestId: 2,
      x: -31,
      y: 97.60003662109375,
      width: 238.39996337890625,
      height: 59.20001220703125,
      opacity: 0.85,
    },
    {
      chestId: 3,
      x: -52.5999755859375,
      y: 110.4000244140625,
      width: 261.60009765625,
      height: 43.20001220703125,
      opacity: 0.85,
    },
    {
      chestId: 4,
      x: -21.4000244140625,
      y: 100.79998779296875,
      width: 212,
      height: 46.39996337890625,
      opacity: 0.85,
    },
    {
      chestId: 5,
      x: -19,
      y: 109.5999755859375,
      width: 210.4000244140625,
      height: 40,
      opacity: 0.85,
    },
    {
      chestId: 6,
      x: -15.00006103515625,
      y: 100,
      width: 224.7999267578125,
      height: 52,
      opacity: 0.8,
    },
  ]

  return layouts.map((layout, index) => ({
    id: startId + index,
    anchor: 'chest' as const,
    ...layout,
  }))
}

function createDefaultShadows(): ShadowItem[] {
  return [
    ...createDefaultChestShadows(),
    {
      id: 10,
      x: -26.560041367202835,
      y: 226.72613732978036,
      width: 346.8000183105469,
      height: 128.39999389648438,
      opacity: 0.85,
      anchor: 'mascot',
    },
  ]
}

function updateGameStageScale() {
  const content = contentRef.value
  if (!content) return

  const widthScale = content.clientWidth / gameStageReference.width
  const heightScale = content.clientHeight / gameStageReference.height

  if (content.clientWidth >= 900) {
    gameStageScale.value = heightScale
    gameStageWidth.value = content.clientWidth / heightScale
    return
  }

  gameStageScale.value = Math.min(widthScale, heightScale)
  gameStageWidth.value = gameStageReference.width
}

function loadShadows(): ShadowItem[] {
  const storedShadows = readStoredJson(shadowStorageKey)
  if (Array.isArray(storedShadows)) {
    const validShadows = storedShadows.filter(isStoredShadowItem).map((shadow) => ({
      ...shadow,
      opacity: shadow.opacity ?? 0.55,
    }))
    const maxShadowId = Math.max(0, ...validShadows.map((shadow) => shadow.id))
    const missingChestShadows = createDefaultChestShadows(maxShadowId + 1).filter(
      (defaultShadow) =>
        !validShadows.some(
          (shadow) =>
            shadow.anchor === 'chest' && shadow.chestId === defaultShadow.chestId,
        ),
    )
    return [...validShadows, ...missingChestShadows]
  }

  return createDefaultShadows()
}

const shadows = ref<ShadowItem[]>(loadShadows())
const contentShadows = computed(() =>
  shadows.value.filter((shadow) => shadow.anchor === 'content'),
)
const mascotShadows = computed(() =>
  shadows.value.filter((shadow) => shadow.anchor === 'mascot'),
)

if (shadows.value.length === 0) {
  shadows.value = createDefaultShadows()
}

function loadTextAreas(): TextAreaItem[] {
  const storedTextAreas = readStoredJson(textAreaStorageKey)
  if (Array.isArray(storedTextAreas)) {
    const validTextAreas = storedTextAreas.filter(isTextAreaItem)
    if (validTextAreas.length > 0) return validTextAreas
  }

  return [
    {
      id: 1,
      chestId: 1,
      x: 41.59991455078125,
      y: 60,
      width: 75.199951171875,
      height: 57.20001220703125,
      rotation: 4,
      anchor: 'chest',
    },
    { id: 2, chestId: 2, x: 28.79998779296875, y: 68.800048828125, width: 100, height: 42, rotation: 4, anchor: 'chest' },
    { id: 3, chestId: 3, x: 26.39990234375, y: 68.79998779296875, width: 100, height: 42, rotation: 4, anchor: 'chest' },
    { id: 4, chestId: 4, x: 31.20001220703125, y: 68.79998779296875, width: 100, height: 42, rotation: 4, anchor: 'chest' },
    { id: 5, chestId: 5, x: 25.5999755859375, y: 69.60003662109375, width: 100, height: 42, rotation: 4, anchor: 'chest' },
    { id: 6, chestId: 6, x: 28, y: 67.20001220703125, width: 100, height: 42, rotation: 4, anchor: 'chest' },
  ]
}

const textAreas = ref<TextAreaItem[]>(loadTextAreas())
const textAreaByChestId = computed(() =>
  new Map(textAreas.value.map((area) => [area.chestId, area])),
)

function openSettings() {
  isSettingsOpen.value = true
}

function closeSettings() {
  isSettingsOpen.value = false
}

function replayGame() {
  resetGameProgress()
}

function returnToStart() {
  resetGameProgress()
}

function loadMascotLayout(): MascotLayout {
  return loadNumericLayout(
    mascotStorageKey,
    { x: 3.8832769062992907, y: 49.85242894438205, width: 296.8000183105469 },
    ['x', 'y', 'width'],
  )
}

const mascotLayout = ref<MascotLayout>(loadMascotLayout())

function loadWoodPanelLayout(): WoodPanelLayout {
  const storedLayout = readStoredJson(woodPanelStorageKey)
  const width = isRecord(storedLayout) && isFiniteNumber(storedLayout.width)
    ? storedLayout.width
    : 640

  return {
    x: isRecord(storedLayout) && isFiniteNumber(storedLayout.x) ? storedLayout.x : 50,
    y: isRecord(storedLayout) && isFiniteNumber(storedLayout.y) ? storedLayout.y : 15,
    width,
    height:
      isRecord(storedLayout) && isFiniteNumber(storedLayout.height)
        ? storedLayout.height
        : width * (311 / 805),
  }
}

const woodPanelLayout = ref<WoodPanelLayout>(loadWoodPanelLayout())

function loadGameTitleLayout(): GameTitleLayout {
  return loadNumericLayout(
    gameTitleStorageKey,
    { x: 50, y: 8, width: 500 },
    ['x', 'y', 'width'],
  )
}

const gameTitleLayout = ref<GameTitleLayout>(loadGameTitleLayout())

function loadPanelRopeLayouts(): PanelRopeLayout[] {
  const storedLayouts = readStoredJson(panelRopeStorageKey)
  if (Array.isArray(storedLayouts)) {
    const validLayouts = storedLayouts.filter(isPanelRopeLayout)
    if (validLayouts.length > 0) return validLayouts
  }

  return [
    { id: 1, x: 32, y: 0, height: 185 },
    { id: 2, x: 68, y: 0, height: 185 },
    { id: 3, x: 86.5, y: 9.5, height: 55 },
    { id: 4, x: 93, y: 9.5, height: 55 },
  ]
}

const panelRopeLayouts = ref<PanelRopeLayout[]>(loadPanelRopeLayouts())
const panelRopeInset = 60

function getPanelRopeLeft(rope: PanelRopeLayout, index: number) {
  if (index === 0) {
    return `calc(${woodPanelLayout.value.x}% - ${woodPanelLayout.value.width / 2 - panelRopeInset}px)`
  }

  if (index === 1) {
    return `calc(${woodPanelLayout.value.x}% + ${woodPanelLayout.value.width / 2 - panelRopeInset}px)`
  }

  return `${rope.x}%`
}

function loadSeaLabelLayout(): SeaLabelLayout {
  return loadNumericLayout(seaLabelStorageKey, { x: 0, y: 0 }, ['x', 'y'])
}

const seaLabelLayout = ref<SeaLabelLayout>(loadSeaLabelLayout())

function loadStarGroupLayout(): StarGroupLayout {
  return loadNumericLayout(starGroupStorageKey, { x: 50, y: 40.5 }, ['x', 'y'])
}

const starGroupLayout = ref<StarGroupLayout>(loadStarGroupLayout())

function loadChestPositions(): Record<number, ChestPosition> {
  const defaultPositions = Object.fromEntries(
    chestImages.map((_, index) => [index + 1, { x: 0, y: 0 }]),
  )

  const storedPositions = readStoredJson(chestPositionStorageKey)
  if (!isRecord(storedPositions)) return defaultPositions

  return Object.fromEntries(
    chestImages.map((_, index) => {
      const chestId = index + 1
      const storedPosition = storedPositions[chestId]
      return [
        chestId,
        hasFiniteNumberFields<ChestPosition>(storedPosition, ['x', 'y'])
          ? storedPosition
          : { x: 0, y: 0 },
      ]
    }),
  )
}

const chestPositions = ref<Record<number, ChestPosition>>(loadChestPositions())

function getChestPosition(chestId: number) {
  return chestPositions.value[chestId] ?? { x: 0, y: 0 }
}

function getTextArea(chestId: number) {
  return textAreaByChestId.value.get(chestId)
}

function getTextAreaEntries(chestId: number) {
  const area = getTextArea(chestId)
  return area ? [area] : []
}

function getChestShadowEntries(chestId: number) {
  return shadows.value.filter(
    (shadow) => shadow.anchor === 'chest' && shadow.chestId === chestId,
  )
}

function migrateChestShadows() {
  const content = gameStageRef.value
  if (!content) return

  const contentRect = content.getBoundingClientRect()
  const previousShadows = shadows.value

  const migratedShadows = previousShadows.map((shadow): ShadowItem => {
    if (shadow.anchor === 'chest') return shadow

    const chestId = shadow.id >= 4 && shadow.id <= 9 ? shadow.id - 3 : undefined
    if (!chestId) return shadow

    const chestElement = chestElements[chestId - 1]
    if (!chestElement) return shadow

    const chestRect = chestElement.getBoundingClientRect()

    return {
      ...shadow,
      chestId,
      anchor: 'chest',
      x: (shadow.x / 100) * contentRect.width - (chestRect.left - contentRect.left),
      y: (shadow.y / 100) * contentRect.height - (chestRect.top - contentRect.top),
    }
  })

  if (migratedShadows.some((shadow, index) => shadow !== previousShadows[index])) {
    shadows.value = migratedShadows
    writeStoredJson(shadowStorageKey, migratedShadows)
  }
}

function migrateMascotShadows() {
  const content = gameStageRef.value
  const mascot = mascotVisualRef.value ?? mascotRef.value
  if (!content || !mascot) return

  const contentRect = content.getBoundingClientRect()
  const mascotRect = mascot.getBoundingClientRect()
  const scale = gameStageScale.value
  const previousShadows = shadows.value

  const migratedShadows = previousShadows.flatMap<ShadowItem>((shadow) => {
    if (shadow.anchor === 'chest' || shadow.anchor === 'mascot') return [shadow]

    const shadowCenterX =
      contentRect.left + (shadow.x / 100) * contentRect.width +
      (shadow.width * scale) / 2
    const shadowCenterY =
      contentRect.top + (shadow.y / 100) * contentRect.height +
      (shadow.height * scale) / 2
    const isNearMascot =
      shadowCenterX >= mascotRect.left - 80 &&
      shadowCenterX <= mascotRect.right + 80 &&
      shadowCenterY >= mascotRect.top - 60 &&
      shadowCenterY <= mascotRect.bottom + 100

    if (!isNearMascot) {
      return []
    }

    return [{
      ...shadow,
      anchor: 'mascot',
      x:
        ((shadow.x / 100) * contentRect.width -
          (mascotRect.left - contentRect.left)) /
        scale,
      y:
        ((shadow.y / 100) * contentRect.height -
          (mascotRect.top - contentRect.top)) /
      scale,
    }]
  })

  const hasChanges =
    migratedShadows.length !== previousShadows.length ||
    migratedShadows.some((shadow, index) => shadow !== previousShadows[index])

  if (hasChanges) {
    shadows.value = migratedShadows
    writeStoredJson(shadowStorageKey, migratedShadows)
  }
}

function migrateLegacyTextAreas() {
  const content = gameStageRef.value
  if (!content) return

  const contentRect = content.getBoundingClientRect()
  const previousTextAreas = textAreas.value

  const migratedTextAreas = previousTextAreas.map((area): TextAreaItem => {
    if (area.anchor === 'chest') return area

    const chestElement = chestElements[area.chestId - 1]
    if (!chestElement) return area

    const chestRect = chestElement.getBoundingClientRect()

    return {
      ...area,
      x: (area.x / 100) * contentRect.width - (chestRect.left - contentRect.left),
      y: (area.y / 100) * contentRect.height - (chestRect.top - contentRect.top),
      anchor: 'chest',
    }
  })

  if (migratedTextAreas.some((area, index) => area !== previousTextAreas[index])) {
    textAreas.value = migratedTextAreas
    writeStoredJson(textAreaStorageKey, migratedTextAreas)
  }
}

function improveTextAreaPresentation() {
  if (readStoredText(textAreaVisualVersionKey) === '1') return

  // Fresh installations already use the finalized positions baked into the code.
  if (!Array.isArray(readStoredJson(textAreaStorageKey))) {
    writeStoredText(textAreaVisualVersionKey, '1')
    return
  }

  textAreas.value.forEach((area) => {
    const chestElement = chestElements[area.chestId - 1]
    if (!chestElement) return

    area.x = (chestElement.clientWidth - area.width) / 2
    if (area.rotation === 5) area.rotation = 0
  })

  writeStoredJson(textAreaStorageKey, textAreas.value)
  writeStoredText(textAreaVisualVersionKey, '1')
}

function setChestElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) chestElements[index] = element
}

function setStarSlotElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) starSlotElements[index] = element
}

function openChest(chestId: number) {
  if (
    isAnswerLocked.value ||
    isGameComplete.value
  ) {
    return
  }

  const chestIndex = chestId - 1
  if (chestIndex < 0 || chestIndex >= chestOpenStates.value.length) return

  if (chestId !== currentQuestion.value.correctChestId) {
    wrongChestId.value = null
    window.requestAnimationFrame(() => {
      wrongChestId.value = chestId
    })
    return
  }

  isAnswerLocked.value = true
  chestOpenStates.value = chestOpenStates.value.map(
    (_, index) => index === chestIndex,
  )

  window.requestAnimationFrame(() => launchStarFromChest(chestIndex))
}

function finishWrongChestAnimation(chestId: number) {
  if (wrongChestId.value === chestId) wrongChestId.value = null
}

function launchStarFromChest(chestIndex: number) {
  const content = gameStageRef.value
  const chestElement = chestElements[chestIndex]
  const targetElement = starSlotElements[solvedCount.value]
  const chestImage = chestElement?.querySelector('img')

  if (!content || !chestImage || !targetElement) {
    finishQuestionWithoutAnimation(chestIndex)
    return
  }

  const contentRect = content.getBoundingClientRect()
  const chestRect = chestImage.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const starSize = 56
  const scale = gameStageScale.value
  const x =
    (chestRect.left - contentRect.left + chestRect.width / 2) / scale -
    starSize / 2
  const y =
    (chestRect.top - contentRect.top + chestRect.height * 0.42) / scale -
    starSize / 2
  const targetX =
    (targetRect.left - contentRect.left + targetRect.width / 2) / scale -
    starSize / 2
  const targetY =
    (targetRect.top - contentRect.top + targetRect.height / 2) / scale -
    starSize / 2

  flyingStar.value = {
    id: ++flyingStarId,
    x,
    y,
    deltaX: targetX - x,
    deltaY: targetY - y,
  }
}

function finishQuestionWithoutAnimation(chestIndex: number) {
  const solvedIndex = solvedCount.value
  playSound('starAppear')
  score.value += 10
  solvedCount.value += 1
  triggerStarPulse(solvedIndex)
  advanceToNextQuestion(chestIndex)
}

function finishStarFlight() {
  if (!flyingStar.value) return

  const chestIndex = currentQuestion.value.correctChestId - 1
  const solvedIndex = solvedCount.value
  flyingStar.value = null
  playSound('starAppear')
  score.value += 10
  solvedCount.value += 1
  triggerStarPulse(solvedIndex)
  clearQuestionAdvanceTimeout()
  questionAdvanceTimeoutId = window.setTimeout(() => {
    questionAdvanceTimeoutId = null
    advanceToNextQuestion(chestIndex)
  }, 380)
}

function clearQuestionAdvanceTimeout() {
  if (questionAdvanceTimeoutId === null) return

  window.clearTimeout(questionAdvanceTimeoutId)
  questionAdvanceTimeoutId = null
}

function triggerStarPulse(index: number) {
  if (starPulseResetTimeoutId !== null) {
    window.clearTimeout(starPulseResetTimeoutId)
    starPulseResetTimeoutId = null
  }

  pulsingStarIndices.value = []

  window.requestAnimationFrame(() => {
    pulsingStarIndices.value = [index]

    starPulseResetTimeoutId = window.setTimeout(() => {
      if (pulsingStarIndices.value.length === 1 && pulsingStarIndices.value[0] === index) {
        pulsingStarIndices.value = []
      }
      starPulseResetTimeoutId = null
    }, starPulseDurationMs)
  })
}

function scheduleFinalStarCelebrationTimeout(callback: () => void, delay: number) {
  const timeoutId = window.setTimeout(() => {
    finalStarCelebrationTimeoutIds = finalStarCelebrationTimeoutIds.filter(
      (trackedTimeoutId) => trackedTimeoutId !== timeoutId,
    )
    callback()
  }, delay)

  finalStarCelebrationTimeoutIds.push(timeoutId)
}

function clearFinalStarCelebrationState() {
  finalStarCelebrationRunId += 1
  finalStarCelebrationTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  finalStarCelebrationTimeoutIds = []
  isFinalStarBurst.value = false
  pulsingStarIndices.value = []
  isCompletionPanelVisible.value = false
}

function playFinalStarCelebration() {
  clearFinalStarCelebrationState()

  const celebrationRunId = finalStarCelebrationRunId

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return
    playSound('starWave')
  }, finalStarPulseDelayMs)

  for (let index = 0; index < totalRounds; index += 1) {
    scheduleFinalStarCelebrationTimeout(() => {
      if (celebrationRunId !== finalStarCelebrationRunId) return

      pulsingStarIndices.value = []
      window.requestAnimationFrame(() => {
        if (celebrationRunId !== finalStarCelebrationRunId) return
        pulsingStarIndices.value = [index]
      })
    }, finalStarPulseDelayMs + index * finalStarPulseStepMs)
  }

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return

    pulsingStarIndices.value = []
    isFinalStarBurst.value = false

    window.requestAnimationFrame(() => {
      if (celebrationRunId !== finalStarCelebrationRunId) return
      isFinalStarBurst.value = true
    })
  }, finalStarPulseDelayMs + totalRounds * finalStarPulseStepMs)

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return
    isFinalStarBurst.value = false
  }, finalStarPulseDelayMs + totalRounds * finalStarPulseStepMs + finalStarBurstDurationMs)

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return
    isCompletionPanelVisible.value = true
  }, finalStarPulseDelayMs + totalRounds * finalStarPulseStepMs + finalStarBurstDurationMs + 140)
}

function advanceToNextQuestion(chestIndex: number) {
  chestOpenStates.value[chestIndex] = false

  if (currentQuestionIndex.value >= questions.length - 1) {
    isGameComplete.value = true
    return
  }

  currentQuestionIndex.value += 1
  isAnswerLocked.value = false
}

onMounted(async () => {
  initializeSounds()
  updateGameStageScale()
  await nextTick()
  updateGameStageScale()

  contentResizeObserver = new ResizeObserver(updateGameStageScale)
  if (contentRef.value) contentResizeObserver.observe(contentRef.value)
  window.addEventListener('resize', updateGameStageScale)

  migrateChestShadows()
  migrateMascotShadows()
  migrateLegacyTextAreas()
  improveTextAreaPresentation()
})

watch(isGameComplete, (gameComplete) => {
  if (gameComplete) {
    playFinalStarCelebration()
    return
  }

  clearFinalStarCelebrationState()
})

onBeforeUnmount(() => {
  contentResizeObserver?.disconnect()
  window.removeEventListener('resize', updateGameStageScale)

  if (starPulseResetTimeoutId !== null) {
    window.clearTimeout(starPulseResetTimeoutId)
    starPulseResetTimeoutId = null
  }

  clearQuestionAdvanceTimeout()
  clearFinalStarCelebrationState()
  stopAllSounds()
})
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-collapsed': isCollapsed }"
    @click.capture="handleInterfaceClick"
  >
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">⚡</span>
        <span class="brand-text">
          <span class="brand-orange">TAKIM</span>
          <span class="brand-blue">MACERASI</span>
        </span>
      </div>

      <nav class="menu">
        <section class="menu-section">
          <div class="section-heading">
            <span class="compass-icon" aria-hidden="true"></span>
            <span class="section-title">Takım Macerası</span>
            <span class="chevron" aria-hidden="true">⌃</span>
          </div>

          <ul class="sub-menu">
            <li v-for="item in journeyItems" :key="item.label">
              <span class="sub-bullet" aria-hidden="true"></span>
              <span class="item-icon" :class="item.icon" aria-hidden="true"></span>
              <span class="item-label">{{ item.label }}</span>
            </li>
          </ul>
        </section>

        <section class="friends-section">
          <span class="users-icon" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span class="friends-label">Takım Arkadaşları</span>
          <span class="chevron chevron-down" aria-hidden="true">⌄</span>
        </section>
      </nav>

      <button
        class="sidebar-footer"
        type="button"
        :aria-label="isCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'"
        :aria-expanded="!isCollapsed"
        @click="isCollapsed = !isCollapsed"
      >
        <span class="collapse-icon" aria-hidden="true">{{ isCollapsed ? '☰›' : '⇆' }}</span>
        <span class="collapse-label">Daralt</span>
      </button>
    </aside>

    <main ref="contentRef" class="content">
      <div ref="gameStageRef" class="game-stage" :style="gameStageStyle">
      <header class="game-hud">
        <button class="back-button" type="button">
          <img :src="woodSignImage" alt="" aria-hidden="true" />
          <span class="back-button-content">
            <svg class="back-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.2 5.4 3.7 12l6.5 6.6M4.6 12h15.7" />
            </svg>
            <span>Geri Dön</span>
          </span>
        </button>

        <div class="game-stats">
          <div class="score-stack">
            <div class="stats-wood-sign">
              <img :src="woodSignImage" alt="" aria-hidden="true" />
              <div class="stats-sign-content">
                <div class="sign-stat">
                  <span>Tur</span>
                  <strong>{{ Math.min(currentQuestionIndex + 1, totalRounds) }}</strong>
                </div>
                <span class="sign-divider" aria-hidden="true"></span>
                <div class="sign-stat">
                  <span>Puan</span>
                  <strong>{{ score }}</strong>
                </div>
              </div>
              <button
                class="settings-button settings-button-inline"
                type="button"
                aria-label="Ayarlar"
                @click.stop="openSettings"
              >
                <img :src="settingsImage" alt="" aria-hidden="true" />
              </button>
            </div>
            <div
              class="sea-label"
              :style="{
                backgroundImage: `url(${woodSignImage})`,
                transform: `translate(${seaLabelLayout.x}px, ${seaLabelLayout.y}px)`,
              }"
            >
              Açık Deniz · Tur {{ Math.min(currentQuestionIndex + 1, totalRounds) }}
            </div>
          </div>
        </div>
      </header>

      <div
        v-if="isSettingsOpen"
        class="settings-overlay"
        @pointerdown="closeSettings"
      >
        <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Ayarlar">
          <h2>Ayarlar</h2>
          <p>Devam etmek icin sayfada herhangi bir yere tikla.</p>
        </div>
      </div>

      <div v-if="isCompletionPanelVisible" class="completion-overlay">
        <div
          class="completion-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Oyun tamamlandı"
        >
          <img :src="congratsImage" alt="Tebrikler" class="completion-image" />
          <div
            class="completion-stars"
            :style="{
              left: `${completionLayout.stars.x}px`,
              top: `${completionLayout.stars.y}px`,
            }"
            aria-hidden="true"
          >
            <img
              v-for="star in totalRounds"
              :key="`completion-star-${star}`"
              :src="starImage"
              alt=""
              class="completion-star"
            />
          </div>
          <p
            class="completion-message"
            :style="{
              left: `${completionLayout.title.x}px`,
              top: `${completionLayout.title.y}px`,
            }"
          >
            {{ completionTitleText }}
          </p>
          <p
            class="completion-subtitle"
            :style="{
              left: `${completionLayout.body.x}px`,
              top: `${completionLayout.body.y}px`,
            }"
          >
            <span v-for="line in completionBodyText" :key="line">{{ line }}</span>
          </p>
          <div class="completion-divider" aria-hidden="true">
            <span class="completion-divider-line"></span>
            <img :src="anchorImage" alt="" class="completion-divider-icon" />
            <span class="completion-divider-line"></span>
          </div>
          <div
            class="completion-play-again"
            :style="{
              left: `${completionLayout.playAgain.x}px`,
              top: `${completionLayout.playAgain.y}px`,
              width: `${completionLayout.playAgain.width}px`,
            }"
          >
            <button
              type="button"
              class="completion-play-again-button"
              aria-label="Tekrar oyna"
              @click="handlePlayAgainClick"
            >
              <img :src="playAgainImage" alt="" aria-hidden="true" />
            </button>
          </div>
          <div
            class="completion-home"
            :style="{
              left: `${completionLayout.home.x}px`,
              top: `${completionLayout.home.y}px`,
              width: `${completionLayout.home.width}px`,
            }"
          >
            <button
              type="button"
              class="completion-home-button"
              aria-label="Ana sayfa"
              @click="handleHomeClick"
            >
              <img :src="homeImage" alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        class="game-title"
        :style="{
          left: `${gameTitleLayout.x}%`,
          top: `${gameTitleLayout.y}%`,
          width: `${gameTitleLayout.width}px`,
        }"
      >
        <img :src="gameTitleImage" alt="Kelime Limanı" />
      </div>

      <div
        v-for="(rope, ropeIndex) in panelRopeLayouts"
        :key="rope.id"
        class="panel-rope"
        :style="{
          left: getPanelRopeLeft(rope, ropeIndex),
          top: `${rope.y}%`,
          width: `${rope.height * 0.3}px`,
          height: `${rope.height}px`,
        }"
      >
        <img :src="panelRopeImage" alt="" aria-hidden="true" />
      </div>

      <div
        class="question-area"
        :style="{
          left: `${woodPanelLayout.x}%`,
          top: `${woodPanelLayout.y}%`,
          width: `${woodPanelLayout.width}px`,
          height: `${woodPanelLayout.height + woodPanelHeightAdjustment}px`,
        }"
      >
        <div class="demo-question">
          <img
            :src="woodPanelImage"
            class="wood-panel-image"
            alt=""
            aria-hidden="true"
          />
          <img
            :src="anchorImage"
            class="question-anchor question-anchor-left"
            alt=""
            aria-hidden="true"
          />
          <div class="question-prompt">
            <span>
              {{ isGameComplete ? 'Muhteşem bir iş çıkardın!' : 'Haydi birlikte düşünelim!' }}
            </span>
          </div>
          <strong v-if="!isGameComplete">
            “{{ currentQuestion.word }}” kelimesinin zıt anlamlısı hangi sandıkta?
          </strong>
          <strong v-else>Altı yıldızın hepsini topladın!</strong>
          <img
            :src="anchorImage"
            class="question-anchor question-anchor-right"
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>

      <div
        class="question-stars"
        :style="{
          left: `${starGroupLayout.x}%`,
          top: `${starGroupLayout.y - starGroupVisualOffsetY}%`,
        }"
        :aria-label="`${solvedCount} / ${totalRounds} yıldız`"
      >
        <img
          v-for="star in totalRounds"
          :key="star"
          :ref="(element) => setStarSlotElement(element, star - 1)"
          :src="star <= solvedCount ? starImage : emptyStarImage"
          :class="{
            pulsing: pulsingStarIndexSet.has(star - 1),
            'final-burst': isFinalStarBurst,
          }"
          alt=""
          aria-hidden="true"
        />
      </div>

      <img
        v-if="flyingStar"
        :key="flyingStar.id"
        :src="starImage"
        alt=""
        class="flying-star"
        :style="{
          left: `${flyingStar.x}px`,
          top: `${flyingStar.y}px`,
          '--star-delta-x': `${flyingStar.deltaX}px`,
          '--star-delta-y': `${flyingStar.deltaY}px`,
        }"
        aria-hidden="true"
        @animationend="finishStarFlight"
      />

      <div
        v-for="shadow in mascotShadows"
        :key="shadow.id"
        class="editable-shadow mascot-shadow"
        :style="{
          left: `calc(${mascotLayout.x}% + ${shadow.x}px)`,
          top: `calc(${mascotLayout.y}% + ${mascotVisualOffsetY + shadow.y - mascotShadowVisualOffsetY}px)`,
          width: `${shadow.width}px`,
          height: `${shadow.height}px`,
        }"
      >
        <span
          class="shadow-visual"
          :style="{ opacity: shadow.opacity }"
          aria-hidden="true"
        ></span>
      </div>

      <div
        ref="mascotRef"
        class="mascot"
        :style="{
          left: `${mascotLayout.x}%`,
          top: `${mascotLayout.y}%`,
          width: `${mascotLayout.width}px`,
        }"
      >
        <div
          ref="mascotVisualRef"
          class="mascot-visual"
          :style="{ transform: `translateY(${mascotVisualOffsetY}px)` }"
        >
          <img :src="mascotImage" alt="Maskot" draggable="false" />
        </div>
      </div>

      <div
        v-for="shadow in contentShadows"
        :key="shadow.id"
        class="editable-shadow"
        :style="{
          left: `${shadow.x}%`,
          top: `${shadow.y}%`,
          width: `${shadow.width}px`,
          height: `${shadow.height}px`,
        }"
      >
        <span
          class="shadow-visual"
          :style="{ opacity: shadow.opacity }"
          aria-hidden="true"
        ></span>
      </div>

      <div class="chest-grid" aria-label="Sandıklar">
        <div
          v-for="(chest, index) in chestImages"
          :key="chest"
          :ref="(element) => setChestElement(element, index)"
          class="chest-slot clickable"
          :style="{
            translate: `${getChestPosition(index + 1).x}px ${getChestPosition(index + 1).y}px`,
          }"
          @click="openChest(index + 1)"
        >
          <div
            class="chest-stack"
            :class="{ 'wrong-answer': wrongChestId === index + 1 }"
            @animationend="finishWrongChestAnimation(index + 1)"
          >
            <div
              v-for="shadow in getChestShadowEntries(index + 1)"
              :key="shadow.id"
              class="editable-shadow chest-shadow"
              :style="{
                left: `${shadow.x}px`,
                top: `${shadow.y}px`,
                width: `${shadow.width}px`,
                height: `${shadow.height}px`,
              }"
            >
              <span
                class="shadow-visual"
                :style="{ opacity: shadow.opacity }"
                aria-hidden="true"
              ></span>
            </div>
            <img
              :src="chestOpenStates[index] ? chestOpenImages[index] : chest"
              :alt="`${index + 1}. sandık`"
              class="chest-image"
            />
            <div
              v-for="area in getTextAreaEntries(index + 1)"
              :key="area.id"
              class="editable-text-area"
              :style="{
                left: `${area.x}px`,
                top: `${area.y}px`,
                width: `${area.width}px`,
                height: `${area.height}px`,
                transform: `rotate(${area.rotation}deg)`,
              }"
            >
              <span>{{ currentQuestion.answers[index] }}</span>
            </div>
          </div>
        </div>
      </div>

      </div>
    </main>
  </div>
</template>

<style scoped src="./styles/app.css"></style>
