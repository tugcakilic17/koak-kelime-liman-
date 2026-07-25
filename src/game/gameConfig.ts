export const CHEST_COUNT = 6

export type ChestId = 1 | 2 | 3 | 4 | 5 | 6

export type Question = {
  word: string
  answers: readonly [string, string, string, string, string, string]
  correctChestId: ChestId
}

export const questions = [
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
] as const satisfies readonly Question[]

export const journeyItems = [
  { label: 'Oyun Adası', icon: 'gamepad' },
  { label: 'Sayılar Şehri', icon: 'calculator' },
  { label: 'Keşif Ormanı', icon: 'mini-compass' },
  { label: 'Masal Köyü', icon: 'book' },
] as const

export const completionCopy = {
  title: 'Harika!',
  body: ['Tüm yıldızları topladın!', "Kelime Limanı'nı başarıyla", 'tamamladın.'],
} as const
