<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const isCollapsed = ref(false)
const showEditorTools = false
const showTextAreaEditorTools = false
const showShadowEditorTools = false
const showMascotEditorTools = false
const showMascotControls = showEditorTools || showMascotEditorTools
const mascotShadowVisualOffsetY = 18
const starGroupVisualOffsetY = 1.4
const showLayoutEditorTools = false
const showPanelRopeEditorTools = false
const showSeaLabelEditorTools = false
const chestOpenStates = ref([false, false, false, false, false, false])
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
const completionLayoutStorageKey = 'takim-macerasi-completion-layout-v6'
const completionTitleText = 'Harika!'
const completionBodyText = ['Tüm yıldızları topladın!', "Kelime Limanı'nı başarıyla", 'tamamladın.']

const journeyItems = [
  { label: 'Oyun Adası', icon: 'gamepad' },
  { label: 'Sayılar Şehri', icon: 'calculator' },
  { label: 'Keşif Ormanı', icon: 'mini-compass' },
  { label: 'Masal Köyü', icon: 'book' },
]

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

type Question = {
  word: string
  answers: string[]
  correctChestId: number
}

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

const questions: Question[] = [
  {
    word: 'Küçük',
    answers: ['Büyük', 'Uzak', 'Fakir', 'Hızlı', 'Kalın', 'Gece'],
    correctChestId: 1,
  },
  {
    word: 'Uzun',
    answers: ['Ağır', 'İnce', 'Kısa', 'Soğuk', 'Eski', 'Dar'],
    correctChestId: 3,
  },
  {
    word: 'Hızlı',
    answers: ['Erken', 'Güçlü', 'Sessiz', 'Yakın', 'Yavaş', 'Koyu'],
    correctChestId: 5,
  },
  {
    word: 'Gece',
    answers: ['Akşam', 'Gündüz', 'Yaz', 'Sabah', 'Kış', 'Öğle'],
    correctChestId: 2,
  },
  {
    word: 'Açık',
    answers: ['Dar', 'Derin', 'Boş', 'Kalın', 'Eski', 'Kapalı'],
    correctChestId: 6,
  },
  {
    word: 'Zengin',
    answers: ['Yavaş', 'Uzak', 'Genç', 'Fakir', 'Tatlı', 'İnce'],
    correctChestId: 4,
  },
]

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
let finalStarCelebrationRunId = 0
let finalStarCelebrationTimeoutIds: number[] = []

function normalizeCompletionActionWidth(width: number | undefined, fallback: number) {
  if (!Number.isFinite(width)) return fallback
  return Math.max(72, Math.min(width ?? fallback, 92))
}

function loadCompletionLayout(): CompletionLayout {
  const defaultLayout: CompletionLayout = {
    stars: { x: 64, y: 138 },
    title: { x: 102, y: 224 },
    body: { x: 57, y: 306 },
    playAgain: { x: 95, y: 500, width: 86 },
    home: { x: 224, y: 500, width: 86 },
  }

  try {
    const savedLayout = localStorage.getItem(completionLayoutStorageKey)
    if (savedLayout) {
      const parsedLayout = JSON.parse(savedLayout) as Partial<CompletionLayout>
      return {
        stars: {
          ...defaultLayout.stars,
          ...parsedLayout.stars,
        },
        title: {
          ...defaultLayout.title,
          ...parsedLayout.title,
        },
        body: {
          ...defaultLayout.body,
          ...parsedLayout.body,
        },
        playAgain: {
          ...defaultLayout.playAgain,
          ...parsedLayout.playAgain,
          width: normalizeCompletionActionWidth(
            parsedLayout.playAgain?.width,
            defaultLayout.playAgain.width,
          ),
        },
        home: {
          ...defaultLayout.home,
          ...parsedLayout.home,
          width: normalizeCompletionActionWidth(
            parsedLayout.home?.width,
            defaultLayout.home.width,
          ),
        },
      }
    }
  } catch {
    localStorage.removeItem(completionLayoutStorageKey)
  }

  return defaultLayout
}

const completionLayout: CompletionLayout = loadCompletionLayout()

function resetGameProgress() {
  chestOpenStates.value = [false, false, false, false, false, false]
  score.value = 0
  solvedCount.value = 0
  currentQuestionIndex.value = 0
  isAnswerLocked.value = false
  isGameComplete.value = false
  wrongChestId.value = null
  flyingStar.value = null
  isCompletionPanelVisible.value = false
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

const shadowStorageKey = 'takim-macerasi-shadow-layout-v5'
const textAreaStorageKey = 'takim-macerasi-text-area-layout-v2'
const textAreaVisualVersionKey = 'takim-macerasi-text-area-visual-version'
const chestPositionStorageKey = 'takim-macerasi-chest-position-layout'
const mascotStorageKey = 'takim-macerasi-mascot-layout-v3'
const woodPanelStorageKey = 'takim-macerasi-wood-panel-layout'
const gameTitleStorageKey = 'takim-macerasi-game-title-layout'
const panelRopeStorageKey = 'takim-macerasi-panel-rope-layout-v2'
const starGroupStorageKey = 'takim-macerasi-star-group-layout-v3'
const seaLabelStorageKey = 'takim-macerasi-sea-label-layout-v2'
const contentRef = ref<HTMLElement | null>(null)
const gameStageRef = ref<HTMLElement | null>(null)
const mascotRef = ref<HTMLElement | null>(null)
const mascotVisualRef = ref<HTMLElement | null>(null)
const gameStageScale = ref(1)
let contentResizeObserver: ResizeObserver | null = null

const gameStageStyle = computed(() => ({
  width: `${100 / gameStageScale.value}%`,
  height: `${100 / gameStageScale.value}%`,
  backgroundImage: `url(${backgroundImage})`,
  transform: `scale(${gameStageScale.value})`,
}))

function createDefaultChestShadows(startId = 1): ShadowItem[] {
  return chestImages.map((_, index) => ({
    id: startId + index,
    chestId: index + 1,
    anchor: 'chest' as const,
    x: 5,
    y: 112,
    width: 140,
    height: 28,
    opacity: 0.72,
  }))
}

function updateGameStageScale() {
  const content = contentRef.value
  if (!content) return

  const collapsedSidebarWidth = window.innerWidth <= 600 ? 78 : 90
  const designWidth = Math.max(1, window.innerWidth - collapsedSidebarWidth)
  gameStageScale.value = Math.min(1, content.clientWidth / designWidth)
}

function loadShadows(): ShadowItem[] {
  try {
    const savedShadows = localStorage.getItem(shadowStorageKey)
    if (savedShadows) {
      const parsedShadows = JSON.parse(savedShadows) as ShadowItem[]
      if (Array.isArray(parsedShadows)) {
        const normalizedShadows = parsedShadows.map((shadow) => ({
          ...shadow,
          opacity: typeof shadow.opacity === 'number' ? shadow.opacity : 0.55,
        }))
        const maxShadowId = Math.max(0, ...normalizedShadows.map((shadow) => shadow.id))
        const missingChestShadows = createDefaultChestShadows(maxShadowId + 1).filter(
          (defaultShadow) =>
            !normalizedShadows.some(
              (shadow) =>
                shadow.anchor === 'chest' && shadow.chestId === defaultShadow.chestId,
            ),
        )
        return [...normalizedShadows, ...missingChestShadows]
      }
    }
  } catch {
    localStorage.removeItem(shadowStorageKey)
  }

  return createDefaultChestShadows()
}

const shadows = ref<ShadowItem[]>(loadShadows())
const contentShadows = computed(() =>
  shadows.value.filter((shadow) => shadow.anchor === 'content'),
)
const mascotShadows = computed(() =>
  shadows.value.filter((shadow) => shadow.anchor === 'mascot'),
)
const selectedShadowId = ref<number | null>(null)
const selectedShadow = computed(() =>
  shadows.value.find((shadow) => shadow.id === selectedShadowId.value),
)
let nextShadowId = Math.max(0, ...shadows.value.map((shadow) => shadow.id)) + 1

if (shadows.value.length === 0) {
  shadows.value = createDefaultChestShadows()
  nextShadowId = Math.max(0, ...shadows.value.map((shadow) => shadow.id)) + 1
}

watch(
  shadows,
  (currentShadows) => {
    localStorage.setItem(shadowStorageKey, JSON.stringify(currentShadows))
  },
  { deep: true },
)

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

function addShadow() {
  const offset = ((nextShadowId - 1) % 6) * 2
  const shadow = {
    id: nextShadowId++,
    x: 42 + offset,
    y: 76 + offset,
    width: 150,
    height: 34,
    opacity: 0.55,
    anchor: 'content' as const,
  }

  shadows.value.push(shadow)
  selectedShadowId.value = shadow.id
  selectedTextAreaId.value = null
}

function deleteSelectedShadow() {
  if (selectedShadowId.value === null) return

  shadows.value = shadows.value.filter(
    (shadow) => shadow.id !== selectedShadowId.value,
  )
  selectedShadowId.value = null
}

function resetAllShadows() {
  shadows.value = createDefaultChestShadows()
  selectedShadowId.value = null
  selectedTextAreaId.value = null
  nextShadowId = Math.max(0, ...shadows.value.map((shadow) => shadow.id)) + 1
}

function startShadowDrag(event: PointerEvent, shadow: ShadowItem) {
  if (!showShadowEditorTools) return

  const content = gameStageRef.value
  if (!content) return

  event.preventDefault()
  selectedShadowId.value = shadow.id
  selectedTextAreaId.value = null

  const referenceElement =
    shadow.anchor === 'chest' && shadow.chestId
      ? chestElements[shadow.chestId - 1]
      : shadow.anchor === 'mascot'
        ? mascotVisualRef.value ?? mascotRef.value
      : content
  if (!referenceElement) return

  const referenceRect = referenceElement.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = shadow.x
  const startY = shadow.y

  const moveShadow = (moveEvent: PointerEvent) => {
    if (shadow.anchor === 'chest' || shadow.anchor === 'mascot') {
      shadow.x =
        startX + (moveEvent.clientX - startPointerX) / gameStageScale.value
      shadow.y =
        startY + (moveEvent.clientY - startPointerY) / gameStageScale.value
      return
    }

    const maxX = 100 - (shadow.width / referenceRect.width) * 100
    const maxY = 100 - (shadow.height / referenceRect.height) * 100

    shadow.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / referenceRect.width) * 100,
      0,
      maxX,
    )
    shadow.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / referenceRect.height) * 100,
      0,
      maxY,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveShadow)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveShadow)
  window.addEventListener('pointerup', stopDragging)
}

function startShadowResize(event: PointerEvent, shadow: ShadowItem) {
  event.preventDefault()
  selectedShadowId.value = shadow.id
  selectedTextAreaId.value = null

  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startWidth = shadow.width
  const startHeight = shadow.height

  const resizeShadow = (moveEvent: PointerEvent) => {
    shadow.width = clamp(startWidth + moveEvent.clientX - startPointerX, 40, 500)
    shadow.height = clamp(startHeight + moveEvent.clientY - startPointerY, 10, 180)
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeShadow)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeShadow)
  window.addEventListener('pointerup', stopResizing)
}

function loadTextAreas(): TextAreaItem[] {
  try {
    const savedTextAreas = localStorage.getItem(textAreaStorageKey)
    if (savedTextAreas) {
      const parsedTextAreas = JSON.parse(savedTextAreas) as TextAreaItem[]
      if (Array.isArray(parsedTextAreas)) return parsedTextAreas
    }
  } catch {
    localStorage.removeItem(textAreaStorageKey)
  }

  return [
    { id: 1, chestId: 1, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
    { id: 2, chestId: 2, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
    { id: 3, chestId: 3, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
    { id: 4, chestId: 4, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
    { id: 5, chestId: 5, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
    { id: 6, chestId: 6, x: 25, y: 60, width: 100, height: 42, rotation: 0, anchor: 'chest' },
  ]
}

const textAreas = ref<TextAreaItem[]>(loadTextAreas())
const selectedTextAreaId = ref<number | null>(null)
const selectedTextArea = computed(() =>
  textAreas.value.find((area) => area.id === selectedTextAreaId.value),
)
const textAreaByChestId = computed(() =>
  new Map(textAreas.value.map((area) => [area.chestId, area])),
)
const canAddTextArea = computed(() => textAreas.value.length < chestImages.length)
let nextTextAreaId = Math.max(0, ...textAreas.value.map((area) => area.id)) + 1

watch(
  textAreas,
  (currentTextAreas) => {
    localStorage.setItem(textAreaStorageKey, JSON.stringify(currentTextAreas))
  },
  { deep: true },
)

function addTextArea() {
  const usedChestIds = new Set(textAreas.value.map((area) => area.chestId))
  const chestId = chestImages.findIndex((_, index) => !usedChestIds.has(index + 1)) + 1
  if (chestId === 0) return

  const offset = (chestId - 1) * 2
  const area = {
    id: nextTextAreaId++,
    chestId,
    x: 16 + offset,
    y: 10 + offset,
    width: 140,
    height: 44,
    rotation: 0,
    anchor: 'chest' as const,
  }

  textAreas.value.push(area)
  selectedTextAreaId.value = area.id
  selectedShadowId.value = null
}

function deleteSelectedTextArea() {
  if (selectedTextAreaId.value === null) return

  textAreas.value = textAreas.value.filter(
    (area) => area.id !== selectedTextAreaId.value,
  )
  selectedTextAreaId.value = null
}

function startTextAreaDrag(event: PointerEvent, area: TextAreaItem) {
  if (!showTextAreaEditorTools) return

  const chestElement = chestElements[area.chestId - 1]
  if (!chestElement) return

  event.preventDefault()
  selectedTextAreaId.value = area.id
  selectedShadowId.value = null

  if (area.anchor !== 'chest') return

  const chestRect = chestElement.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = area.x
  const startY = area.y

  const moveTextArea = (moveEvent: PointerEvent) => {
    const maxX = chestRect.width - area.width
    const maxY = chestRect.height - area.height

    area.x = clamp(startX + moveEvent.clientX - startPointerX, -area.width * 0.35, maxX + area.width * 0.35)
    area.y = clamp(startY + moveEvent.clientY - startPointerY, -area.height, maxY + area.height * 0.5)
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveTextArea)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveTextArea)
  window.addEventListener('pointerup', stopDragging)
}

function startTextAreaResize(event: PointerEvent, area: TextAreaItem) {
  event.preventDefault()
  selectedTextAreaId.value = area.id

  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startWidth = area.width
  const startHeight = area.height

  const resizeTextArea = (moveEvent: PointerEvent) => {
    area.width = clamp(startWidth + moveEvent.clientX - startPointerX, 60, 360)
    area.height = clamp(startHeight + moveEvent.clientY - startPointerY, 24, 140)
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeTextArea)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeTextArea)
  window.addEventListener('pointerup', stopResizing)
}

function clearEditorSelection() {
  selectedShadowId.value = null
  selectedTextAreaId.value = null
}

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
  try {
    const savedLayout = localStorage.getItem(mascotStorageKey)
    if (savedLayout) return JSON.parse(savedLayout) as MascotLayout
  } catch {
    localStorage.removeItem(mascotStorageKey)
  }

  return { x: 3, y: 61, width: 180 }
}

const mascotLayout = ref<MascotLayout>(loadMascotLayout())
const isMascotEditMode = ref(false)

watch(
  mascotLayout,
  (currentLayout) => {
    localStorage.setItem(mascotStorageKey, JSON.stringify(currentLayout))
  },
  { deep: true },
)

function toggleMascotEditMode() {
  isMascotEditMode.value = !isMascotEditMode.value
  isChestEditMode.value = false
  clearEditorSelection()
}

function startMascotDrag(event: PointerEvent) {
  const content = gameStageRef.value
  if (!content || !isMascotEditMode.value) return

  event.preventDefault()

  const contentRect = content.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = mascotLayout.value.x
  const startY = mascotLayout.value.y

  const moveMascot = (moveEvent: PointerEvent) => {
    const maxX = 100 - (mascotLayout.value.width / contentRect.width) * 100

    mascotLayout.value.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / contentRect.width) * 100,
      0,
      maxX,
    )
    mascotLayout.value.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / contentRect.height) * 100,
      0,
      92,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveMascot)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveMascot)
  window.addEventListener('pointerup', stopDragging)
}

function startMascotResize(event: PointerEvent) {
  if (!isMascotEditMode.value) return

  event.preventDefault()
  const startPointerX = event.clientX
  const startWidth = mascotLayout.value.width

  const resizeMascot = (moveEvent: PointerEvent) => {
    mascotLayout.value.width = clamp(
      startWidth + moveEvent.clientX - startPointerX,
      70,
      500,
    )
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeMascot)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeMascot)
  window.addEventListener('pointerup', stopResizing)
}

function resetMascotLayout() {
  mascotLayout.value = { x: 3, y: 61, width: 180 }
}

function loadWoodPanelLayout(): WoodPanelLayout {
  try {
    const savedLayout = localStorage.getItem(woodPanelStorageKey)
    if (savedLayout) {
      const parsedLayout = JSON.parse(savedLayout) as Partial<WoodPanelLayout>
      const width = parsedLayout.width ?? 640
      return {
        x: parsedLayout.x ?? 50,
        y: parsedLayout.y ?? 15,
        width,
        height: parsedLayout.height ?? width * (311 / 805),
      }
    }
  } catch {
    localStorage.removeItem(woodPanelStorageKey)
  }

  return { x: 50, y: 15, width: 640, height: 640 * (311 / 805) }
}

const woodPanelLayout = ref<WoodPanelLayout>(loadWoodPanelLayout())
const isWoodPanelEditMode = ref(false)

watch(
  woodPanelLayout,
  (currentLayout) => {
    localStorage.setItem(woodPanelStorageKey, JSON.stringify(currentLayout))
  },
  { deep: true },
)

function toggleWoodPanelEditMode() {
  isWoodPanelEditMode.value = !isWoodPanelEditMode.value
}

function startWoodPanelDrag(event: PointerEvent) {
  const content = gameStageRef.value
  if (!content || !showLayoutEditorTools || !isWoodPanelEditMode.value) return

  event.preventDefault()

  const contentRect = content.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = woodPanelLayout.value.x
  const startY = woodPanelLayout.value.y

  const moveWoodPanel = (moveEvent: PointerEvent) => {
    woodPanelLayout.value.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / contentRect.width) * 100,
      0,
      100,
    )
    woodPanelLayout.value.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / contentRect.height) * 100,
      0,
      75,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveWoodPanel)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveWoodPanel)
  window.addEventListener('pointerup', stopDragging)
}

function startWoodPanelResize(event: PointerEvent) {
  if (!showLayoutEditorTools || !isWoodPanelEditMode.value) return

  event.preventDefault()
  const startPointerX = event.clientX
  const startWidth = woodPanelLayout.value.width

  const resizeWoodPanel = (moveEvent: PointerEvent) => {
    woodPanelLayout.value.width = clamp(
      startWidth + moveEvent.clientX - startPointerX,
      380,
      900,
    )
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeWoodPanel)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeWoodPanel)
  window.addEventListener('pointerup', stopResizing)
}

function startWoodPanelHeightResize(event: PointerEvent) {
  if (!showLayoutEditorTools || !isWoodPanelEditMode.value) return

  event.preventDefault()
  const startPointerY = event.clientY
  const startHeight = woodPanelLayout.value.height

  const resizeWoodPanelHeight = (moveEvent: PointerEvent) => {
    woodPanelLayout.value.height = clamp(
      startHeight + moveEvent.clientY - startPointerY,
      160,
      520,
    )
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeWoodPanelHeight)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeWoodPanelHeight)
  window.addEventListener('pointerup', stopResizing)
}

function resetWoodPanelLayout() {
  woodPanelLayout.value = {
    x: 50,
    y: 15,
    width: 640,
    height: 640 * (311 / 805),
  }
}

function loadGameTitleLayout(): GameTitleLayout {
  try {
    const savedLayout = localStorage.getItem(gameTitleStorageKey)
    if (savedLayout) return JSON.parse(savedLayout) as GameTitleLayout
  } catch {
    localStorage.removeItem(gameTitleStorageKey)
  }

  return { x: 50, y: 8, width: 500 }
}

const gameTitleLayout = ref<GameTitleLayout>(loadGameTitleLayout())
const isGameTitleEditMode = ref(false)

watch(
  gameTitleLayout,
  (currentLayout) => {
    localStorage.setItem(gameTitleStorageKey, JSON.stringify(currentLayout))
  },
  { deep: true },
)

function toggleGameTitleEditMode() {
  isGameTitleEditMode.value = !isGameTitleEditMode.value
}

function startGameTitleDrag(event: PointerEvent) {
  const content = gameStageRef.value
  if (!content || !showLayoutEditorTools || !isGameTitleEditMode.value) return

  event.preventDefault()

  const contentRect = content.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = gameTitleLayout.value.x
  const startY = gameTitleLayout.value.y

  const moveGameTitle = (moveEvent: PointerEvent) => {
    gameTitleLayout.value.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / contentRect.width) * 100,
      0,
      100,
    )
    gameTitleLayout.value.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / contentRect.height) * 100,
      0,
      35,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveGameTitle)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveGameTitle)
  window.addEventListener('pointerup', stopDragging)
}

function startGameTitleResize(event: PointerEvent) {
  if (!showLayoutEditorTools || !isGameTitleEditMode.value) return

  event.preventDefault()
  const startPointerX = event.clientX
  const startWidth = gameTitleLayout.value.width

  const resizeGameTitle = (moveEvent: PointerEvent) => {
    gameTitleLayout.value.width = clamp(
      startWidth + moveEvent.clientX - startPointerX,
      180,
      800,
    )
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizeGameTitle)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizeGameTitle)
  window.addEventListener('pointerup', stopResizing)
}

function resetGameTitleLayout() {
  gameTitleLayout.value = { x: 50, y: 8, width: 500 }
}

function loadPanelRopeLayouts(): PanelRopeLayout[] {
  try {
    const savedLayouts = localStorage.getItem(panelRopeStorageKey)
    if (savedLayouts) return JSON.parse(savedLayouts) as PanelRopeLayout[]
  } catch {
    localStorage.removeItem(panelRopeStorageKey)
  }

  return [
    { id: 1, x: 32, y: 0, height: 185 },
    { id: 2, x: 68, y: 0, height: 185 },
    { id: 3, x: 86.5, y: 9.5, height: 55 },
    { id: 4, x: 93, y: 9.5, height: 55 },
  ]
}

const panelRopeLayouts = ref<PanelRopeLayout[]>(loadPanelRopeLayouts())
const isPanelRopeEditMode = ref(true)

watch(
  panelRopeLayouts,
  (currentLayouts) => {
    localStorage.setItem(panelRopeStorageKey, JSON.stringify(currentLayouts))
  },
  { deep: true },
)

function togglePanelRopeEditMode() {
  isPanelRopeEditMode.value = !isPanelRopeEditMode.value
}

function addPanelRope() {
  const nextId =
    Math.max(0, ...panelRopeLayouts.value.map((rope) => rope.id)) + 1
  const horizontalOffset = ((nextId - 1) % 4) * 8

  panelRopeLayouts.value.push({
    id: nextId,
    x: clamp(24 + horizontalOffset, 6, 94),
    y: 0,
    height: 185,
  })

  isPanelRopeEditMode.value = true
}

function startPanelRopeDrag(event: PointerEvent, rope: PanelRopeLayout) {
  const content = gameStageRef.value
  if (!content || !showPanelRopeEditorTools || !isPanelRopeEditMode.value) return

  event.preventDefault()

  const contentRect = content.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = rope.x
  const startY = rope.y

  const movePanelRope = (moveEvent: PointerEvent) => {
    rope.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / contentRect.width) * 100,
      0,
      100,
    )
    rope.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / contentRect.height) * 100,
      0,
      90,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', movePanelRope)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', movePanelRope)
  window.addEventListener('pointerup', stopDragging)
}

function startPanelRopeResize(event: PointerEvent, rope: PanelRopeLayout) {
  if (!showPanelRopeEditorTools || !isPanelRopeEditMode.value) return

  event.preventDefault()
  const startPointerY = event.clientY
  const startHeight = rope.height

  const resizePanelRope = (moveEvent: PointerEvent) => {
    rope.height = clamp(
      startHeight + moveEvent.clientY - startPointerY,
      80,
      650,
    )
  }

  const stopResizing = () => {
    window.removeEventListener('pointermove', resizePanelRope)
    window.removeEventListener('pointerup', stopResizing)
  }

  window.addEventListener('pointermove', resizePanelRope)
  window.addEventListener('pointerup', stopResizing)
}

function resetPanelRopeLayouts() {
  panelRopeLayouts.value = [
    { id: 1, x: 32, y: 0, height: 185 },
    { id: 2, x: 68, y: 0, height: 185 },
    { id: 3, x: 86.5, y: 9.5, height: 55 },
    { id: 4, x: 93, y: 9.5, height: 55 },
  ]
}

function loadSeaLabelLayout(): SeaLabelLayout {
  try {
    const savedLayout = localStorage.getItem(seaLabelStorageKey)
    if (savedLayout) return JSON.parse(savedLayout) as SeaLabelLayout
  } catch {
    localStorage.removeItem(seaLabelStorageKey)
  }

  return { x: 0, y: 0 }
}

const seaLabelLayout = ref<SeaLabelLayout>(loadSeaLabelLayout())

watch(
  seaLabelLayout,
  (currentLayout) => {
    localStorage.setItem(seaLabelStorageKey, JSON.stringify(currentLayout))
  },
  { deep: true },
)

function startSeaLabelDrag(event: PointerEvent) {
  if (!showSeaLabelEditorTools) return

  event.preventDefault()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = seaLabelLayout.value.x
  const startY = seaLabelLayout.value.y

  const moveSeaLabel = (moveEvent: PointerEvent) => {
    seaLabelLayout.value.x = clamp(
      startX + moveEvent.clientX - startPointerX,
      -220,
      220,
    )
    seaLabelLayout.value.y = clamp(
      startY + moveEvent.clientY - startPointerY,
      -160,
      220,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveSeaLabel)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveSeaLabel)
  window.addEventListener('pointerup', stopDragging)
}

function resetSeaLabelLayout() {
  seaLabelLayout.value = { x: 0, y: 0 }
}

function loadStarGroupLayout(): StarGroupLayout {
  try {
    const savedLayout = localStorage.getItem(starGroupStorageKey)
    if (savedLayout) return JSON.parse(savedLayout) as StarGroupLayout
  } catch {
    localStorage.removeItem(starGroupStorageKey)
  }

  return { x: 50, y: 40.5 }
}

const starGroupLayout = ref<StarGroupLayout>(loadStarGroupLayout())
const isStarGroupEditMode = ref(false)

watch(
  starGroupLayout,
  (currentLayout) => {
    localStorage.setItem(starGroupStorageKey, JSON.stringify(currentLayout))
  },
  { deep: true },
)

function toggleStarGroupEditMode() {
  isStarGroupEditMode.value = !isStarGroupEditMode.value
}

function startStarGroupDrag(event: PointerEvent) {
  const content = gameStageRef.value
  if (!content || !showLayoutEditorTools || !isStarGroupEditMode.value) return

  event.preventDefault()

  const contentRect = content.getBoundingClientRect()
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = starGroupLayout.value.x
  const startY = starGroupLayout.value.y

  const moveStarGroup = (moveEvent: PointerEvent) => {
    starGroupLayout.value.x = clamp(
      startX + ((moveEvent.clientX - startPointerX) / contentRect.width) * 100,
      0,
      100,
    )
    starGroupLayout.value.y = clamp(
      startY + ((moveEvent.clientY - startPointerY) / contentRect.height) * 100,
      0,
      95,
    )
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveStarGroup)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveStarGroup)
  window.addEventListener('pointerup', stopDragging)
}

function resetStarGroupLayout() {
  starGroupLayout.value = { x: 50, y: 40.5 }
}

function loadChestPositions(): Record<number, ChestPosition> {
  const defaultPositions = Object.fromEntries(
    chestImages.map((_, index) => [index + 1, { x: 0, y: 0 }]),
  )

  try {
    const savedPositions = localStorage.getItem(chestPositionStorageKey)
    if (savedPositions) {
      return {
        ...defaultPositions,
        ...(JSON.parse(savedPositions) as Record<number, ChestPosition>),
      }
    }
  } catch {
    localStorage.removeItem(chestPositionStorageKey)
  }

  return defaultPositions
}

const chestPositions = ref<Record<number, ChestPosition>>(loadChestPositions())
const isChestEditMode = ref(false)
const selectedChestId = ref<number | null>(null)

watch(
  chestPositions,
  (currentPositions) => {
    localStorage.setItem(chestPositionStorageKey, JSON.stringify(currentPositions))
  },
  { deep: true },
)

function toggleChestEditMode() {
  isChestEditMode.value = !isChestEditMode.value
  isMascotEditMode.value = false
  selectedChestId.value = null
  clearEditorSelection()
}

function startChestDrag(event: PointerEvent, chestId: number) {
  if (!isChestEditMode.value) return

  event.preventDefault()
  selectedChestId.value = chestId

  const position = chestPositions.value[chestId] ?? { x: 0, y: 0 }
  chestPositions.value[chestId] = position
  const startPointerX = event.clientX
  const startPointerY = event.clientY
  const startX = position.x
  const startY = position.y

  const moveChest = (moveEvent: PointerEvent) => {
    position.x = startX + moveEvent.clientX - startPointerX
    position.y = startY + moveEvent.clientY - startPointerY
  }

  const stopDragging = () => {
    window.removeEventListener('pointermove', moveChest)
    window.removeEventListener('pointerup', stopDragging)
  }

  window.addEventListener('pointermove', moveChest)
  window.addEventListener('pointerup', stopDragging)
}

function resetSelectedChestPosition() {
  if (selectedChestId.value === null) return
  chestPositions.value[selectedChestId.value] = { x: 0, y: 0 }
}

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

  shadows.value = shadows.value.map((shadow) => {
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

  selectedShadowId.value = null
}

function migrateMascotShadows() {
  const content = gameStageRef.value
  const mascot = mascotVisualRef.value ?? mascotRef.value
  if (!content || !mascot) return

  const contentRect = content.getBoundingClientRect()
  const mascotRect = mascot.getBoundingClientRect()
  const scale = gameStageScale.value
  let hasChanges = false

  shadows.value = shadows.value.flatMap((shadow) => {
    if (shadow.anchor === 'chest' || shadow.anchor === 'mascot') return shadow

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
      hasChanges = true
      return []
    }

    hasChanges = true
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

  if (hasChanges) selectedShadowId.value = null
}

function migrateLegacyTextAreas() {
  const content = gameStageRef.value
  if (!content) return

  const contentRect = content.getBoundingClientRect()
  let hasChanges = false

  textAreas.value = textAreas.value.map((area) => {
    if (area.anchor === 'chest') return area

    const chestElement = chestElements[area.chestId - 1]
    if (!chestElement) return area

    const chestRect = chestElement.getBoundingClientRect()
    hasChanges = true

    return {
      ...area,
      x: (area.x / 100) * contentRect.width - (chestRect.left - contentRect.left),
      y: (area.y / 100) * contentRect.height - (chestRect.top - contentRect.top),
      anchor: 'chest',
    }
  })

  if (!hasChanges) return

  selectedTextAreaId.value = null
}

function improveTextAreaPresentation() {
  if (localStorage.getItem(textAreaVisualVersionKey) === '1') return

  textAreas.value.forEach((area) => {
    const chestElement = chestElements[area.chestId - 1]
    if (!chestElement) return

    area.x = (chestElement.clientWidth - area.width) / 2
    if (area.rotation === 5) area.rotation = 0
  })

  selectedTextAreaId.value = null
  localStorage.setItem(textAreaVisualVersionKey, '1')
}

function setChestElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) chestElements[index] = element
}

function setStarSlotElement(element: unknown, index: number) {
  if (element instanceof HTMLElement) starSlotElements[index] = element
}

function openChest(chestId: number) {
  if (
    isChestEditMode.value ||
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
  score.value += 10
  solvedCount.value += 1
  triggerStarPulse(solvedIndex)
  window.setTimeout(() => advanceToNextQuestion(chestIndex), 380)
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

  for (let index = 0; index < 6; index += 1) {
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
  }, finalStarPulseDelayMs + 6 * finalStarPulseStepMs)

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return
    isFinalStarBurst.value = false
  }, finalStarPulseDelayMs + 6 * finalStarPulseStepMs + finalStarBurstDurationMs)

  scheduleFinalStarCelebrationTimeout(() => {
    if (celebrationRunId !== finalStarCelebrationRunId) return
    isCompletionPanelVisible.value = true
  }, finalStarPulseDelayMs + 6 * finalStarPulseStepMs + finalStarBurstDurationMs + 140)
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
  updateGameStageScale()
  contentResizeObserver = new ResizeObserver(updateGameStageScale)
  if (contentRef.value) contentResizeObserver.observe(contentRef.value)
  window.addEventListener('resize', updateGameStageScale)

  await nextTick()
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

  clearFinalStarCelebrationState()
})
</script>

<template>
  <div class="app-shell" :class="{ 'is-collapsed': isCollapsed }">
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

    <main
      ref="contentRef"
      class="content"
      :class="{
        'chest-editing': isChestEditMode,
        'mascot-editing': isMascotEditMode,
        'editor-tools-hidden': !showTextAreaEditorTools,
        'shadow-tools-hidden': !showShadowEditorTools,
        'mascot-tools-hidden': !showMascotControls,
      }"
      @pointerdown.self="clearEditorSelection"
    >
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
                  <strong>{{ Math.min(currentQuestionIndex + 1, 6) }}</strong>
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
              :class="{ editing: showSeaLabelEditorTools }"
              :style="{
                backgroundImage: `url(${woodSignImage})`,
                transform: `translate(${seaLabelLayout.x}px, ${seaLabelLayout.y}px)`,
              }"
              @pointerdown="startSeaLabelDrag"
            >
              Açık Deniz · Tur {{ Math.min(currentQuestionIndex + 1, 6) }}
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
              v-for="star in 6"
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
        :class="{ editing: showLayoutEditorTools && isGameTitleEditMode }"
        :style="{
          left: `${gameTitleLayout.x}%`,
          top: `${gameTitleLayout.y}%`,
          width: `${gameTitleLayout.width}px`,
        }"
        @pointerdown="startGameTitleDrag"
      >
        <img :src="gameTitleImage" alt="Kelime Limanı" />
        <button
          v-if="showLayoutEditorTools && isGameTitleEditMode"
          class="game-title-resize-handle"
          type="button"
          aria-label="Kelime Limanı başlığını boyutlandır"
          @pointerdown.stop="startGameTitleResize"
        ></button>
      </div>

      <div
        v-for="rope in panelRopeLayouts"
        :key="rope.id"
        class="panel-rope"
        :class="{ editing: showPanelRopeEditorTools && isPanelRopeEditMode }"
        :style="{
          left: `${rope.x}%`,
          top: `${rope.y}%`,
          width: `${rope.height * 0.3}px`,
          height: `${rope.height}px`,
        }"
        @pointerdown="startPanelRopeDrag($event, rope)"
      >
        <img :src="panelRopeImage" alt="" aria-hidden="true" />
        <span v-if="showPanelRopeEditorTools && isPanelRopeEditMode">Halat {{ rope.id }}</span>
        <button
          v-if="showPanelRopeEditorTools && isPanelRopeEditMode"
          class="panel-rope-resize-handle"
          type="button"
          :aria-label="`${rope.id}. halatın uzunluğunu ayarla`"
          @pointerdown.stop="startPanelRopeResize($event, rope)"
        ></button>
      </div>

      <div
        class="question-area"
        :class="{ editing: showLayoutEditorTools && isWoodPanelEditMode }"
        :style="{
          left: `${woodPanelLayout.x}%`,
          top: `${woodPanelLayout.y}%`,
          width: `${woodPanelLayout.width}px`,
          height: `${woodPanelLayout.height}px`,
        }"
        @pointerdown="startWoodPanelDrag"
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
          <button
            v-if="showLayoutEditorTools && isWoodPanelEditMode"
            class="wood-panel-resize-handle"
            type="button"
            aria-label="Ahşap panelin genişliğini ayarla"
            @pointerdown.stop="startWoodPanelResize"
          ></button>
          <button
            v-if="showLayoutEditorTools && isWoodPanelEditMode"
            class="wood-panel-height-resize-handle"
            type="button"
            aria-label="Ahşap panelin yüksekliğini ayarla"
            @pointerdown.stop="startWoodPanelHeightResize"
          ></button>
        </div>
      </div>

      <div
        class="question-stars"
        :class="{ editing: showLayoutEditorTools && isStarGroupEditMode }"
        :style="{
          left: `${starGroupLayout.x}%`,
          top: `${starGroupLayout.y - starGroupVisualOffsetY}%`,
        }"
        :aria-label="`${solvedCount} / 6 yıldız`"
        @pointerdown="startStarGroupDrag"
      >
        <img
          v-for="star in 6"
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

      <div v-if="showLayoutEditorTools" class="wood-panel-toolbar">
        <button type="button" @click="toggleWoodPanelEditMode">
          {{ isWoodPanelEditMode ? 'Panel Düzenlemeyi Bitir' : 'Paneli Düzenle' }}
        </button>
        <button
          v-if="isWoodPanelEditMode"
          type="button"
          class="reset-wood-panel"
          @click="resetWoodPanelLayout"
        >
          Konumu Sıfırla
        </button>
      </div>

      <div v-if="showLayoutEditorTools" class="game-title-toolbar">
        <button type="button" @click="toggleGameTitleEditMode">
          {{ isGameTitleEditMode ? 'Başlık Düzenlemeyi Bitir' : 'Başlığı Düzenle' }}
        </button>
        <button
          v-if="isGameTitleEditMode"
          type="button"
          class="reset-game-title"
          @click="resetGameTitleLayout"
        >
          Konumu Sıfırla
        </button>
      </div>

      <div v-if="showPanelRopeEditorTools" class="panel-rope-toolbar">
        <button type="button" @click="togglePanelRopeEditMode">
          {{ isPanelRopeEditMode ? 'Halat Düzenlemeyi Bitir' : 'Halatları Düzenle' }}
        </button>
        <button
          v-if="isPanelRopeEditMode"
          type="button"
          @click="addPanelRope"
        >
          Halat Ekle
        </button>
        <button
          v-if="isPanelRopeEditMode"
          type="button"
          class="reset-panel-ropes"
          @click="resetPanelRopeLayouts"
        >
          Konumu Sıfırla
        </button>
      </div>

      <div v-if="showSeaLabelEditorTools" class="sea-label-toolbar">
        <button type="button" @click="resetSeaLabelLayout">
          Etiketi SÄ±fÄ±rla
        </button>
      </div>

      <div v-if="showLayoutEditorTools" class="star-group-toolbar">
        <button type="button" @click="toggleStarGroupEditMode">
          {{ isStarGroupEditMode ? 'Yıldız Düzenlemeyi Bitir' : 'Yıldızları Düzenle' }}
        </button>
        <button
          v-if="isStarGroupEditMode"
          type="button"
          class="reset-star-group"
          @click="resetStarGroupLayout"
        >
          Konumu Sıfırla
        </button>
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
        ref="mascotRef"
        class="mascot"
        :class="{ editing: isMascotEditMode }"
        :style="{
          left: `${mascotLayout.x}%`,
          top: `${mascotLayout.y}%`,
          width: `${mascotLayout.width}px`,
        }"
        @pointerdown="startMascotDrag"
      >
        <div ref="mascotVisualRef" class="mascot-visual">
          <div
            v-for="shadow in mascotShadows"
            :key="shadow.id"
            class="editable-shadow mascot-shadow"
            :class="{ selected: showShadowEditorTools && selectedShadowId === shadow.id }"
            :style="{
              left: `${shadow.x}px`,
              top: `${shadow.y - mascotShadowVisualOffsetY}px`,
              width: `${shadow.width}px`,
              height: `${shadow.height}px`,
            }"
            @pointerdown.stop="startShadowDrag($event, shadow)"
            @click.stop
          >
            <span
              class="shadow-visual"
              :style="{ opacity: shadow.opacity }"
              aria-hidden="true"
            ></span>
            <button
              v-if="showShadowEditorTools && selectedShadowId === shadow.id"
              class="shadow-resize-handle"
              type="button"
              aria-label="Maskot gölgesini boyutlandır"
              @pointerdown.stop="startShadowResize($event, shadow)"
            ></button>
          </div>
          <img :src="mascotImage" alt="Maskot" draggable="false" />
          <button
            v-if="showMascotControls && isMascotEditMode"
            class="mascot-resize-handle"
            type="button"
            aria-label="Maskotu boyutlandır"
            @pointerdown.stop="startMascotResize"
          ></button>
        </div>
      </div>

      <div
        v-for="shadow in contentShadows"
        :key="shadow.id"
        class="editable-shadow"
        :class="{ selected: showShadowEditorTools && selectedShadowId === shadow.id }"
        :style="{
          left: `${shadow.x}%`,
          top: `${shadow.y}%`,
          width: `${shadow.width}px`,
          height: `${shadow.height}px`,
        }"
        @pointerdown="startShadowDrag($event, shadow)"
      >
        <span
          class="shadow-visual"
          :style="{ opacity: shadow.opacity }"
          aria-hidden="true"
        ></span>
        <button
          v-if="showShadowEditorTools && selectedShadowId === shadow.id"
          class="shadow-resize-handle"
          type="button"
          aria-label="Gölgeyi boyutlandır"
          @pointerdown.stop="startShadowResize($event, shadow)"
        ></button>
      </div>

      <div
        class="chest-grid"
        :class="{ editing: isChestEditMode }"
        aria-label="Sandıklar"
      >
        <div
          v-for="(chest, index) in chestImages"
          :key="chest"
          :ref="(element) => setChestElement(element, index)"
          class="chest-slot"
          :class="{
            selected: selectedChestId === index + 1,
            clickable: !isChestEditMode,
          }"
          :style="{
            translate: `${getChestPosition(index + 1).x}px ${getChestPosition(index + 1).y}px`,
          }"
          @pointerdown="startChestDrag($event, index + 1)"
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
              :class="{ selected: showShadowEditorTools && selectedShadowId === shadow.id }"
              :style="{
                left: `${shadow.x}px`,
                top: `${shadow.y}px`,
                width: `${shadow.width}px`,
                height: `${shadow.height}px`,
              }"
              @pointerdown.stop="startShadowDrag($event, shadow)"
              @click.stop
            >
              <span
                class="shadow-visual"
                :style="{ opacity: shadow.opacity }"
                aria-hidden="true"
              ></span>
              <button
                v-if="showShadowEditorTools && selectedShadowId === shadow.id"
                class="shadow-resize-handle"
                type="button"
                aria-label="Gölgeyi boyutlandır"
                @pointerdown.stop="startShadowResize($event, shadow)"
              ></button>
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
              :class="{ selected: selectedTextAreaId === area.id }"
              :style="{
                left: `${area.x}px`,
                top: `${area.y}px`,
                width: `${area.width}px`,
                height: `${area.height}px`,
                transform: `rotate(${area.rotation}deg)`,
              }"
              @pointerdown="startTextAreaDrag($event, area)"
            >
              <span>{{ currentQuestion.answers[index] }}</span>
              <button
                v-if="showTextAreaEditorTools && selectedTextAreaId === area.id"
                class="text-area-resize-handle"
                type="button"
                aria-label="Yazı alanını boyutlandır"
                @pointerdown.stop="startTextAreaResize($event, area)"
              ></button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showShadowEditorTools" class="shadow-toolbar">
        <button type="button" @click="addShadow">+ Gölge Ekle</button>
        <button type="button" class="reset-shadow" @click="resetAllShadows">
          Gölgeleri Geri Getir
        </button>
        <label v-if="selectedShadow" class="opacity-control">
          <span>Açık</span>
          <input
            v-model.number="selectedShadow.opacity"
            type="range"
            min="0.15"
            max="0.95"
            step="0.05"
            aria-label="Gölge koyuluğu"
          />
          <span>Koyu</span>
        </label>
        <button
          type="button"
          class="delete-shadow"
          :disabled="selectedShadowId === null"
          @click="deleteSelectedShadow"
        >
          Seçileni Sil
        </button>
      </div>

      <div v-if="showEditorTools" class="chest-toolbar">
        <button
          type="button"
          :class="{ active: isChestEditMode }"
          @click="toggleChestEditMode"
        >
          {{ isChestEditMode ? 'Düzenlemeyi Bitir' : 'Kasaları Düzenle' }}
        </button>
        <button
          v-if="isChestEditMode"
          type="button"
          class="reset-chest"
          :disabled="selectedChestId === null"
          @click="resetSelectedChestPosition"
        >
          Konumu Sıfırla
        </button>
      </div>

      <div v-if="showMascotEditorTools" class="mascot-toolbar">
        <button
          type="button"
          :class="{ active: isMascotEditMode }"
          @click="toggleMascotEditMode"
        >
          {{ isMascotEditMode ? 'Maskotu Sabitle' : 'Maskotu Düzenle' }}
        </button>
        <button
          v-if="isMascotEditMode"
          type="button"
          class="reset-mascot"
          @click="resetMascotLayout"
        >
          Konumu Sıfırla
        </button>
      </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}

:global(body) {
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.app-shell {
  display: flex;
  min-height: 100vh;
  background: #f7f0e3;
}

.sidebar {
  display: flex;
  width: 260px;
  flex: 0 0 260px;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, #020712 0%, #060812 58%, #130a08 100%);
  color: #f7ead7;
  box-shadow: 14px 0 34px rgba(0, 0, 0, 0.18);
  transition:
    width 320ms ease,
    flex-basis 320ms ease;
}

.brand {
  display: flex;
  min-height: 102px;
  align-items: center;
  padding: 26px 28px 24px;
  white-space: nowrap;
}

.brand-mark {
  flex: 0 0 auto;
  margin-right: 10px;
  color: #ff7a00;
  font-size: 28px;
  line-height: 1;
  text-shadow:
    0 0 8px rgba(255, 122, 0, 0.58),
    0 0 16px rgba(255, 122, 0, 0.3);
}

.brand-text {
  display: flex;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: 0.2px;
}

.brand-orange {
  color: #ff8d1d;
}

.brand-blue {
  margin-left: 3px;
  color: #68a0ff;
}

.menu {
  flex: 1;
  padding: 24px 22px 0;
}

.section-heading,
.friends-section {
  display: flex;
  align-items: center;
}

.section-heading {
  min-height: 32px;
}

.section-title {
  color: #fff8ec;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.chevron {
  margin-left: auto;
  color: #f3e7d5;
  font-size: 14px;
}

.compass-icon {
  position: relative;
  width: 19px;
  height: 19px;
  flex: 0 0 19px;
  margin-right: 18px;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.compass-icon::after,
.mini-compass::after {
  position: absolute;
  top: 3px;
  left: 7px;
  width: 3px;
  height: 9px;
  border-radius: 999px;
  background: #f2c86f;
  content: "";
  transform: rotate(28deg);
  transform-origin: bottom center;
}

.sub-menu {
  margin: 7px 0 0;
  padding: 0 0 0 18px;
  list-style: none;
}

.sub-menu li {
  display: flex;
  min-height: 38px;
  align-items: center;
  color: #b88752;
  font-size: 12px;
  white-space: nowrap;
}

.sub-bullet {
  width: 4px;
  height: 4px;
  margin-right: 13px;
  border-radius: 50%;
  background: rgba(229, 210, 184, 0.68);
}

.item-icon {
  position: relative;
  display: none;
  width: 19px;
  height: 19px;
  color: #a98459;
}

.friends-section {
  min-height: 46px;
  margin-top: 10px;
  color: #bc8851;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.users-icon {
  position: relative;
  width: 29px;
  height: 25px;
  flex: 0 0 29px;
  margin-right: 12px;
}

.users-icon i {
  position: absolute;
  top: 2px;
  width: 7px;
  height: 7px;
  border: 2px solid #d6b07c;
  border-radius: 50%;
}

.users-icon i:nth-child(1) {
  left: 2px;
}

.users-icon i:nth-child(2) {
  left: 10px;
}

.users-icon i:nth-child(3) {
  left: 18px;
}

.users-icon::after {
  position: absolute;
  bottom: 2px;
  left: 1px;
  width: 27px;
  height: 9px;
  border: 2px solid #d6b07c;
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  content: "";
}

.chevron-down {
  color: #d6b07c;
}

.sidebar-footer {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 13px;
  padding: 0 28px;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 165, 74, 0.03), rgba(255, 118, 22, 0.06));
  color: #c88f4c;
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.collapse-icon {
  flex: 0 0 auto;
  font-size: 19px;
  white-space: nowrap;
}

.content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 100vh;
  overflow: hidden;
  background-color: #f7f0e3;
}

.game-stage {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  transform-origin: top left;
  will-change: width, height, transform;
}

.game-hud {
  position: absolute;
  top: 0.8%;
  right: 1.2%;
  left: 1.2%;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

.game-title {
  position: absolute;
  z-index: 9;
  max-width: 72vw;
  transform: translate(-50%, -50%);
}

.game-title.editing {
  outline: 2px dashed rgba(255, 255, 255, 0.95);
  outline-offset: 5px;
  cursor: grab;
  touch-action: none;
}

.game-title.editing:active {
  cursor: grabbing;
}

.game-title img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.game-title-resize-handle {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #168bd1;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.4);
  cursor: nwse-resize;
  touch-action: none;
}

.panel-rope {
  position: absolute;
  z-index: 3;
  transform: translateX(-50%);
}

.panel-rope.editing {
  z-index: 12;
  outline: 2px dashed rgba(255, 241, 195, 0.95);
  outline-offset: 4px;
  cursor: grab;
  touch-action: none;
}

.panel-rope.editing:active {
  cursor: grabbing;
}

.panel-rope img {
  position: absolute;
  top: 0;
  left: 50%;
  display: block;
  width: auto;
  height: 100%;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.panel-rope > span {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 2;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(37, 21, 10, 0.84);
  color: #fff1c9;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

.panel-rope-resize-handle {
  position: absolute;
  right: 50%;
  bottom: -10px;
  z-index: 3;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid #fff4cf;
  border-radius: 50%;
  background: #bd782d;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.45);
  transform: translateX(50%);
  cursor: ns-resize;
  touch-action: none;
}

.back-button {
  position: relative;
  display: flex;
  width: clamp(88px, 7.8vw, 112px);
  aspect-ratio: 700 / 355;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff0c2;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: clamp(10.5px, 0.85vw, 13px);
  font-weight: 900;
  cursor: pointer;
  z-index: 10;
  filter: drop-shadow(0 5px 6px rgba(35, 18, 6, 0.34));
  transform: translateY(-30px);
  transition:
    transform 0.18s ease,
    filter 0.18s ease;
}

.back-button:hover {
  filter: drop-shadow(0 9px 12px rgba(35, 18, 6, 0.4));
  transform: translateY(-30px) scale(1.06);
}

.back-button:active {
  transform: translateY(-30px) scale(1.01);
}

.back-button > img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.back-button-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 3%;
  text-shadow: 0 2px 2px rgba(30, 13, 4, 0.9);
}

.back-arrow {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: #ffd27e;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 1px rgba(30, 13, 4, 0.35));
}

.game-stats {
  display: flex;
  align-items: flex-start;
  color: #244d68;
}

.settings-button {
  display: block;
  width: clamp(38px, 3.5vw, 50px);
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 4px 5px rgba(35, 18, 6, 0.28));
  transition:
    transform 0.18s ease,
    filter 0.18s ease;
}

.settings-button:hover {
  transform: translateY(-1px) scale(1.02);
  filter: drop-shadow(0 5px 8px rgba(35, 18, 6, 0.34));
}

.settings-button > img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.settings-button-inline {
  position: absolute;
  top: 50%;
  right: 10%;
  z-index: 2;
  width: clamp(32px, 2.7vw, 40px);
  transform: translateY(-50%);
}

.settings-button-inline:hover {
  transform: translateY(-50%) scale(1.05);
}

.settings-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgba(11, 24, 38, 0.2);
  backdrop-filter: blur(2px);
}

.settings-modal {
  min-width: min(420px, calc(100% - 48px));
  padding: 28px 34px;
  border: 3px solid rgba(186, 119, 45, 0.9);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 247, 220, 0.98), rgba(246, 228, 186, 0.96));
  box-shadow:
    0 18px 42px rgba(17, 32, 46, 0.24),
    inset 0 2px 0 rgba(255, 255, 255, 0.72);
  color: #143f61;
  text-align: center;
}

.settings-modal h2 {
  margin: 0;
  color: #be6c18;
  font-size: clamp(28px, 2.2vw, 38px);
  font-weight: 900;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.5);
}

.settings-modal p {
  margin: 12px 0 0;
  font-size: clamp(14px, 1vw, 18px);
  font-weight: 800;
  line-height: 1.4;
}

.completion-overlay {
  position: absolute;
  inset: 0;
  z-index: 32;
  display: grid;
  place-items: center;
  background: rgba(10, 20, 33, 0.14);
  backdrop-filter: blur(1.2px);
}

.completion-modal {
  position: relative;
  width: min(100%, 406px);
  min-height: 596px;
  text-align: center;
}

.completion-image {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 14px 24px rgba(17, 32, 46, 0.2));
  user-select: none;
  -webkit-user-drag: none;
}

.completion-stars {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: max-content;
}

.completion-star {
  width: 33px;
  height: auto;
  filter: drop-shadow(0 4px 6px rgba(178, 108, 12, 0.28));
}

.completion-star:nth-child(1),
.completion-star:nth-child(6) {
  transform: translateY(4px) rotate(-9deg);
}

.completion-star:nth-child(2),
.completion-star:nth-child(5) {
  transform: translateY(1px) rotate(6deg);
}

.completion-star:nth-child(3) {
  width: 36px;
  transform: translateY(-2px);
}

.completion-star:nth-child(4) {
  width: 36px;
  transform: translateY(-2px);
}

.completion-message {
  position: absolute;
  margin: 0;
  max-width: 220px;
  color: #fff2d3;
  font-size: 36px;
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: 0.01em;
  text-shadow:
    0 2px 0 rgba(111, 57, 9, 0.86),
    0 5px 10px rgba(70, 36, 7, 0.22);
}

.completion-subtitle {
  position: absolute;
  margin: 0;
  width: 292px;
  max-width: 292px;
  color: #fff7e4;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.24;
  letter-spacing: 0.01em;
  text-align: center;
  word-break: normal;
  text-shadow:
    0 2px 0 rgba(111, 57, 9, 0.64),
    0 4px 8px rgba(70, 36, 7, 0.22);
}

.completion-subtitle span {
  display: block;
}

.completion-subtitle span + span {
  margin-top: 6px;
}

.completion-divider {
  position: absolute;
  left: 79px;
  top: 442px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 248px;
  pointer-events: none;
  opacity: 0.94;
}

.completion-divider-line {
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, rgba(139, 84, 22, 0.8) 0 1.5px, transparent 1.5px)
      center / 14px 3px repeat-x;
  filter: drop-shadow(0 1px 0 rgba(255, 215, 145, 0.18));
}

.completion-divider-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  opacity: 0.68;
  filter: sepia(0.92) saturate(0.75) hue-rotate(342deg) brightness(0.74);
}

.completion-play-again {
  position: absolute;
  display: block;
}

.completion-home {
  position: absolute;
  display: block;
}

.completion-play-again-button,
.completion-home-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.completion-play-again-button img,
.completion-home-button img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
  transform: scale(0.88);
  transform-origin: center;
  filter: drop-shadow(0 7px 10px rgba(82, 40, 4, 0.24));
}

.round-badge,
.score-box,
.progress-box {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.68);
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 3px 9px rgba(29, 70, 93, 0.13);
}

.round-badge {
  border: 1px solid #70d0da;
  background: #e4f9f8;
  color: #197782;
}

.score-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.stats-wood-sign {
  position: relative;
  width: clamp(214px, 17vw, 258px);
  aspect-ratio: 700 / 270;
  filter: drop-shadow(0 4px 4px rgba(35, 18, 6, 0.25));
}

.stats-wood-sign > img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.stats-sign-content {
  position: absolute;
  inset: 15% 24% 12% 9%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  color: #fff0c2;
  text-shadow: 0 2px 2px rgba(30, 13, 4, 0.9);
}

.sign-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: clamp(11px, 0.85vw, 14px);
  font-weight: 800;
}

.sign-stat strong {
  color: #ffd067;
  font-size: clamp(15px, 1.1vw, 19px);
  font-weight: 900;
}

.sign-divider {
  width: 2px;
  height: 23px;
  border-radius: 2px;
  background: rgba(255, 216, 143, 0.48);
  box-shadow: 1px 0 0 rgba(45, 20, 6, 0.45);
}

.score-box strong {
  min-width: 18px;
  color: #d26910;
  font-size: 17px;
  font-weight: 900;
}

.progress-box {
  border: 1px solid #f1c351;
  background: #fff7d9;
}

.progress-star {
  color: #f2ac16;
  font-size: 21px;
  line-height: 1;
  filter: drop-shadow(0 2px 1px rgba(151, 92, 4, 0.25));
}

.progress-box strong {
  color: #194565;
  font-size: 15px;
  font-weight: 900;
}

.sea-label {
  display: flex;
  width: clamp(136px, 11.4vw, 166px);
  min-height: 30px;
  align-self: center;
  align-items: center;
  justify-content: center;
  padding: 5px 15px 6px;
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  color: #fff0c2;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: 14.5px;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 2px 2px rgba(30, 13, 4, 0.9);
  filter: drop-shadow(0 3px 5px rgba(35, 18, 6, 0.22));
  cursor: grab;
  touch-action: none;
}

.sea-label.editing {
  outline: 2px dashed rgba(255, 239, 195, 0.78);
  outline-offset: 4px;
}

.sea-label.editing:active {
  cursor: grabbing;
}

.question-area {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  transform: translateX(-50%);
}

.question-area.editing {
  cursor: grab;
  touch-action: none;
}

.question-area.editing:active {
  cursor: grabbing;
}

.demo-question {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 12% 17% 2%;
  border: 0;
  background: transparent;
  color: #fff4d5;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  text-align: center;
}

.question-area.editing .demo-question {
  outline: 2px dashed rgba(255, 243, 191, 0.95);
  outline-offset: 5px;
}

.wood-panel-image {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.demo-question span {
  color: #ffd27c;
  font-size: clamp(12px, 1vw, 16px);
  font-weight: 800;
  text-shadow: 0 2px 2px rgba(29, 12, 4, 0.9);
}

.question-prompt {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(10px, -34px);
}

.question-anchor {
  position: absolute;
  top: 54%;
  z-index: 2;
  display: block;
  width: clamp(31px, 2.6vw, 44px);
  height: auto;
  opacity: 0.9;
  transform: translateY(-50%);
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.question-anchor-left {
  left: 11.5%;
}

.question-anchor-right {
  right: 8.5%;
}

.demo-question strong {
  position: relative;
  z-index: 2;
  font-size: clamp(17px, 1.5vw, 26px);
  font-weight: 900;
  text-shadow: 0 2px 3px rgba(29, 12, 4, 0.95);
  transform: translate(10px, -34px);
}

.wood-panel-resize-handle {
  position: absolute;
  top: 50%;
  right: -10px;
  z-index: 6;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid #fff4cf;
  border-radius: 50%;
  background: #e79a31;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.45);
  transform: translateY(-50%);
  cursor: ew-resize;
  touch-action: none;
}

.wood-panel-height-resize-handle {
  position: absolute;
  bottom: -10px;
  left: 50%;
  z-index: 6;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid #fff4cf;
  border-radius: 50%;
  background: #e79a31;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.45);
  transform: translateX(-50%);
  cursor: ns-resize;
  touch-action: none;
}

.wood-panel-toolbar {
  position: absolute;
  top: 76px;
  right: 18px;
  z-index: 20;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 236, 190, 0.72);
  border-radius: 12px;
  background: rgba(66, 35, 16, 0.88);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.wood-panel-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #e7a348;
  color: #2f210f;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.wood-panel-toolbar .reset-wood-panel {
  background: #fff2c9;
  color: #713c0e;
}

.game-title-toolbar {
  position: absolute;
  top: 134px;
  right: 18px;
  z-index: 20;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(195, 230, 255, 0.78);
  border-radius: 12px;
  background: rgba(7, 63, 101, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.game-title-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #54bdf2;
  color: #0b3048;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.game-title-toolbar .reset-game-title {
  background: #edf8ff;
  color: #174a6d;
}

.panel-rope-toolbar {
  position: absolute;
  top: 184px;
  right: 18px;
  z-index: 20;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 231, 184, 0.75);
  border-radius: 12px;
  background: rgba(74, 42, 21, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.panel-rope-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #d89a51;
  color: #2f210f;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.panel-rope-toolbar .reset-panel-ropes {
  background: #fff0ce;
  color: #6d3b16;
}

.sea-label-toolbar {
  position: absolute;
  top: 244px;
  right: 18px;
  z-index: 20;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 232, 177, 0.78);
  border-radius: 12px;
  background: rgba(86, 53, 25, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.sea-label-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #ffe7b2;
  color: #6d3b16;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.star-group-toolbar {
  position: absolute;
  top: 308px;
  right: 18px;
  z-index: 20;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 238, 163, 0.8);
  border-radius: 12px;
  background: rgba(82, 59, 13, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.star-group-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #f2c14e;
  color: #3d2b08;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.star-group-toolbar .reset-star-group {
  background: #fff7d3;
  color: #6b4b0c;
}

.question-stars {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transform: translateX(-50%);
  transition: transform 320ms ease;
}

.app-shell:not(.is-collapsed) .question-stars {
  transform: translate(-50%, -30px);
}

.question-stars.editing {
  z-index: 12;
  padding: 6px;
  outline: 2px dashed rgba(255, 244, 176, 0.95);
  outline-offset: 4px;
  cursor: grab;
  touch-action: none;
}

.question-stars.editing:active {
  cursor: grabbing;
}

.question-stars img {
  display: block;
  width: clamp(31px, 2.5vw, 42px);
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

.question-stars img.pulsing {
  animation: star-slot-pulse 620ms cubic-bezier(0.22, 0.68, 0.2, 1.08);
}

.question-stars img.final-burst {
  animation: star-final-burst 760ms cubic-bezier(0.2, 0.8, 0.18, 1.12);
}

.flying-star {
  position: absolute;
  z-index: 30;
  display: block;
  width: 56px;
  height: auto;
  pointer-events: none;
  filter: drop-shadow(0 5px 6px rgba(131, 74, 3, 0.35));
  animation: star-flight 1.02s cubic-bezier(0.35, 0.05, 0.2, 1) forwards;
}

@keyframes star-flight {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.25) rotate(-12deg);
  }

  10% {
    opacity: 1;
    transform: translateY(-16px) scale(1.35) rotate(8deg);
  }

  20% {
    transform: translateY(-22px) scale(0.82) rotate(-5deg);
  }

  30% {
    transform: translateY(-20px) scale(1.08) rotate(4deg);
  }

  100% {
    opacity: 1;
    transform:
      translate(var(--star-delta-x), var(--star-delta-y))
      scale(0.75)
      rotate(360deg);
  }
}

@keyframes star-slot-pulse {
  0% {
    transform: scale(1);
    filter: brightness(1) drop-shadow(0 0 0 rgba(255, 226, 120, 0));
  }

  18% {
    transform: scale(0.84);
    filter: brightness(1.02) drop-shadow(0 0 2px rgba(255, 226, 120, 0.18));
  }

  40% {
    transform: scale(1.34);
    filter: brightness(1.22) drop-shadow(0 0 14px rgba(255, 225, 118, 0.88));
  }

  58% {
    transform: scale(0.95);
    filter: brightness(1.1) drop-shadow(0 0 8px rgba(255, 235, 160, 0.62));
  }

  76% {
    transform: scale(1.16);
    filter: brightness(1.16) drop-shadow(0 0 10px rgba(255, 231, 132, 0.7));
  }

  90% {
    transform: scale(1.02);
    filter: brightness(1.04) drop-shadow(0 0 4px rgba(255, 235, 160, 0.3));
  }

  100% {
    transform: scale(1);
    filter: brightness(1) drop-shadow(0 0 0 rgba(255, 226, 120, 0));
  }
}

@keyframes star-final-burst {
  0% {
    transform: scale(1);
    filter: brightness(1) drop-shadow(0 0 0 rgba(255, 226, 120, 0));
  }

  14% {
    transform: scale(0.8);
    filter: brightness(1.04) drop-shadow(0 0 3px rgba(255, 226, 120, 0.2));
  }

  34% {
    transform: scale(1.48);
    filter: brightness(1.28) drop-shadow(0 0 18px rgba(255, 225, 118, 0.95));
  }

  52% {
    transform: scale(0.92);
    filter: brightness(1.12) drop-shadow(0 0 9px rgba(255, 235, 160, 0.62));
  }

  70% {
    transform: scale(1.24);
    filter: brightness(1.2) drop-shadow(0 0 12px rgba(255, 231, 132, 0.78));
  }

  86% {
    transform: scale(1.05);
    filter: brightness(1.08) drop-shadow(0 0 5px rgba(255, 235, 160, 0.34));
  }

  100% {
    transform: scale(1);
    filter: brightness(1) drop-shadow(0 0 0 rgba(255, 226, 120, 0));
  }
}

.mascot {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  touch-action: none;
}

.mascot-visual {
  position: relative;
  width: 100%;
  transform: translateY(22px);
  transform-origin: center bottom;
}

.mascot img {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.mascot-shadow {
  z-index: 1;
}

.mascot.editing {
  outline: 2px dashed rgba(255, 230, 153, 0.95);
  outline-offset: 5px;
  cursor: grab;
  pointer-events: auto;
}

.mascot.editing:active {
  cursor: grabbing;
}

.mascot-resize-handle {
  position: absolute;
  right: -11px;
  bottom: -11px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #e79b31;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.38);
  cursor: nwse-resize;
  touch-action: none;
}

.editable-shadow {
  position: absolute;
  z-index: 1;
  cursor: grab;
  touch-action: none;
}

.chest-shadow {
  z-index: 0;
}

.shadow-visual {
  position: absolute;
  inset: 0;
  display: block;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(20, 12, 5, 0.95) 0%,
    rgba(20, 12, 5, 0.62) 48%,
    rgba(20, 12, 5, 0) 76%
  );
  filter: blur(2px);
  pointer-events: none;
}

.editable-shadow:active {
  cursor: grabbing;
}

.editable-shadow.selected {
  outline: 1px dashed rgba(255, 224, 158, 0.95);
  outline-offset: 4px;
}

.shadow-resize-handle {
  position: absolute;
  right: -9px;
  bottom: -9px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #d68b2c;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.35);
  cursor: nwse-resize;
  touch-action: none;
}

.shadow-toolbar {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  background: rgba(4, 34, 53, 0.78);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.shadow-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #f3b53f;
  color: #172033;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.shadow-toolbar .delete-shadow {
  background: rgba(255, 255, 255, 0.92);
  color: #9b2933;
}

.shadow-toolbar .reset-shadow {
  background: rgba(255, 255, 255, 0.92);
  color: #6a4518;
}

.shadow-toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.opacity-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #283443;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.opacity-control input {
  width: 110px;
  accent-color: #75421e;
  cursor: pointer;
}

.editable-text-area {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #082f4f;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: clamp(17px, 1.35vw, 21px);
  font-weight: 900;
  line-height: 1;
  text-align: center;
  text-shadow: none;
  cursor: grab;
  transform-origin: center;
  touch-action: none;
  user-select: none;
}

.editable-text-area > span {
  display: block;
  width: 100%;
}

.editable-text-area:active {
  cursor: grabbing;
}

.editable-text-area.selected {
  box-shadow: none;
}

.text-area-resize-handle {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #13a7c9;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.35);
  cursor: nwse-resize;
  touch-action: none;
}

.text-area-toolbar {
  position: absolute;
  top: 76px;
  right: 18px;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  background: rgba(5, 67, 82, 0.82);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.text-area-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #53d4e8;
  color: #12333c;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.text-area-toolbar button.active {
  background: #d8fbff;
}

.text-area-toolbar .delete-text-area {
  background: rgba(255, 255, 255, 0.92);
  color: #9b2933;
}

.text-area-toolbar .reset-mascot {
  background: rgba(255, 255, 255, 0.92);
  color: #713c0e;
}

.text-area-toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.rotation-control {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: #17323b;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.rotation-control input {
  width: 100px;
  accent-color: #158ba7;
  cursor: pointer;
}

.rotation-control output {
  width: 27px;
  text-align: right;
}

.chest-toolbar {
  position: absolute;
  top: 134px;
  right: 18px;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  background: rgba(91, 47, 13, 0.84);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.chest-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #e6a94b;
  color: #2f210f;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.chest-toolbar button.active {
  background: #fff2c9;
  color: #713c0e;
}

.chest-toolbar .reset-chest {
  background: rgba(255, 255, 255, 0.92);
  color: #713c0e;
}

.chest-toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.mascot-toolbar {
  position: absolute;
  top: 250px;
  right: 18px;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  background: rgba(96, 43, 24, 0.86);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.mascot-toolbar button {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #f1bd66;
  color: #3b2415;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.mascot-toolbar button.active {
  background: #fff2c9;
}

.mascot-toolbar .reset-mascot {
  background: rgba(255, 255, 255, 0.92);
  color: #713c0e;
}

.chest-editing .editable-shadow,
.chest-editing .editable-text-area {
  pointer-events: none;
}

.mascot-editing .editable-shadow,
.mascot-editing .editable-text-area,
.mascot-editing .chest-grid {
  pointer-events: none;
}

.chest-grid {
  position: absolute;
  bottom: 3%;
  left: 50%;
  z-index: 2;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(3, clamp(128px, 11.8vw, 190px));
  grid-auto-rows: clamp(87px, 8.1vw, 130px);
  column-gap: clamp(18px, 2.2vw, 38px);
  row-gap: 0;
  transform: translateX(-50%);
}

.chest-grid.editing {
  pointer-events: auto;
}

.chest-slot {
  position: relative;
  width: 100%;
  height: 100%;
}

.chest-stack {
  --chest-base-transform: translateY(0) scale(1);
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  transform: var(--chest-base-transform);
  transform-origin: center bottom;
}

.chest-slot.clickable {
  pointer-events: auto;
  cursor: pointer;
}

.chest-grid.editing .chest-slot {
  cursor: grab;
  touch-action: none;
}

.chest-grid.editing .chest-slot:active {
  cursor: grabbing;
}

.chest-grid.editing .chest-slot.selected .chest-image {
  filter:
    drop-shadow(0 0 3px #ffffff)
    drop-shadow(0 0 8px #ffb52f);
}

.chest-slot:nth-child(-n + 3) {
  z-index: 0;
  background: transparent !important;
  box-shadow: none !important;
  filter: none !important;
  mix-blend-mode: normal !important;
}

.chest-slot:nth-child(-n + 3)::before,
.chest-slot:nth-child(-n + 3)::after,
.chest-slot:nth-child(-n + 3) .chest-stack::before,
.chest-slot:nth-child(-n + 3) .chest-stack::after {
  display: none !important;
  content: none !important;
}

.chest-slot:nth-child(-n + 3) .chest-stack,
.chest-slot:nth-child(-n + 3) .chest-image {
  background: transparent !important;
  box-shadow: none !important;
  filter: none !important;
  mix-blend-mode: normal !important;
}

.chest-slot:nth-child(-n + 3) .chest-stack {
  --chest-base-transform: translateY(-24px) scale(0.88);
}

.chest-slot:nth-child(n + 4) {
  z-index: 1;
}

.chest-image {
  position: absolute;
  top: -20%;
  left: 0;
  z-index: 2;
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.chest-stack.wrong-answer {
  animation: wrong-chest-shake 480ms ease-in-out;
}

@keyframes wrong-chest-shake {
  0%,
  100% {
    transform: var(--chest-base-transform) translate(0, 0) rotate(0);
  }

  16% {
    transform: var(--chest-base-transform) translate(0, -4px) rotate(0);
  }

  32% {
    transform: var(--chest-base-transform) translate(-5px, -4px) rotate(-1deg);
  }

  48% {
    transform: var(--chest-base-transform) translate(5px, -4px) rotate(1deg);
  }

  64% {
    transform: var(--chest-base-transform) translate(-3px, -4px) rotate(-0.6deg);
  }

  80% {
    transform: var(--chest-base-transform) translate(3px, -4px) rotate(0.6deg);
  }
}

.sidebar.collapsed {
  width: 90px;
  flex-basis: 90px;
}

.sidebar.collapsed .brand {
  justify-content: center;
  min-height: 102px;
  padding-inline: 0;
}

.sidebar.collapsed .brand-mark {
  margin: 0;
  font-size: 42px;
}

.sidebar.collapsed .brand-text,
.sidebar.collapsed .section-title,
.sidebar.collapsed .section-heading > .chevron,
.sidebar.collapsed .item-label,
.sidebar.collapsed .sub-bullet,
.sidebar.collapsed .friends-label,
.sidebar.collapsed .friends-section > .chevron,
.sidebar.collapsed .collapse-label {
  display: none;
}

.sidebar.collapsed .menu {
  padding: 14px 0 0;
}

.sidebar.collapsed .section-heading {
  justify-content: center;
  min-height: 54px;
}

.sidebar.collapsed .compass-icon {
  margin: 0;
}

.sidebar.collapsed .sub-menu {
  margin: 3px 0 0;
  padding: 0;
}

.sidebar.collapsed .sub-menu li {
  justify-content: center;
  min-height: 62px;
}

.sidebar.collapsed .item-icon {
  display: block;
}

.gamepad {
  width: 21px;
  height: 13px;
  border: 2px solid #a98459;
  border-radius: 5px;
}

.gamepad::before {
  position: absolute;
  top: 4px;
  left: 3px;
  width: 5px;
  height: 2px;
  background: #a98459;
  box-shadow: 1.5px -1.5px 0 -0.2px #a98459;
  content: "";
}

.gamepad::after {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #a98459;
  content: "";
}

.calculator {
  border: 2px solid #a98459;
  border-radius: 2px;
  background:
    linear-gradient(#a98459, #a98459) 3px 3px / 9px 2px no-repeat,
    radial-gradient(circle, #a98459 0 1px, transparent 1.5px) 2px 7px / 5px 5px;
}

.mini-compass {
  border: 2px solid #a98459;
  border-radius: 50%;
}

.mini-compass::after {
  top: 3px;
  left: 6px;
  background: #a98459;
}

.book {
  border: 2px solid #a98459;
  border-radius: 2px;
}

.book::before {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 2px;
  background: #a98459;
  box-shadow: 0 4px 0 rgba(169, 132, 89, 0.7);
  content: "";
}

.sidebar.collapsed .friends-section {
  justify-content: center;
  min-height: 62px;
  margin-top: 1px;
}

.sidebar.collapsed .users-icon {
  margin: 0;
}

.sidebar.collapsed .sidebar-footer {
  min-height: 90px;
  justify-content: center;
  padding: 0;
}

.editor-tools-hidden .editable-text-area,
.editor-tools-hidden .chest-grid.editing {
  cursor: default;
  pointer-events: none;
}

.shadow-tools-hidden .editable-shadow {
  cursor: default;
  pointer-events: none;
}

.mascot-tools-hidden .mascot.editing {
  cursor: default;
  pointer-events: none;
  outline: none;
}

.editor-tools-hidden .chest-grid.editing .chest-slot.selected .chest-image {
  filter: none;
}

@media (max-width: 600px) {
  .sidebar {
    width: 240px;
    flex-basis: 240px;
  }

  .sidebar.collapsed {
    width: 78px;
    flex-basis: 78px;
  }

  .game-hud {
    right: 2%;
    left: 2%;
  }

  .game-title {
    max-width: 48vw;
  }

  .back-button {
    width: 74px;
    transform: translateY(-20px);
  }

  .back-button:hover {
    transform: translateY(-20px) scale(1.04);
  }

  .back-button:active {
    transform: translateY(-20px) scale(1.01);
  }

  .settings-button {
    width: 36px;
  }

  .settings-button-inline {
    width: 26px;
    right: 11%;
  }

  .back-button-content > span {
    display: none;
  }

  .stats-wood-sign {
    width: 168px;
  }

  .sea-label {
    width: 126px;
    min-height: 26px;
    padding: 4px 11px 5px;
    font-size: 13px;
  }

  .sea-label-toolbar {
    top: 232px;
    right: 10px;
    padding: 6px;
  }

  .sea-label-toolbar button {
    padding: 7px 10px;
    font-size: 12px;
  }

  .game-stats {
    gap: 4px;
    padding: 4px;
  }

  .settings-modal {
    min-width: min(300px, calc(100% - 28px));
    padding: 24px 20px;
    border-radius: 24px;
  }

  .score-box,
  .progress-box {
    padding-inline: 7px;
  }

  .question-area {
    top: 20.5%;
    width: calc(100% - 20px);
  }

  .demo-question {
    padding-inline: 14px;
  }

  .chest-grid {
    grid-template-columns: repeat(3, 105px);
    grid-auto-rows: 72px;
    column-gap: 8px;
  }
}
</style>
