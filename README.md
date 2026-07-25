# Kelime Limanı

Vue 3, TypeScript ve Vite ile geliştirilmiş altı turluk zıt anlamlı kelime oyunu.

## Geliştirme

```sh
npm install
npm run dev
```

Uygulama varsayılan olarak `http://127.0.0.1:5173` adresinde çalışır.

## Doğrulama

```sh
npm run type-check
npm run build
```

`npm run build`, TypeScript kontrolünü ve üretim derlemesini birlikte çalıştırır.

## Proje Yapısı

- `src/App.vue`: Oyun durumu, animasyon akışı, şablon ve görsel stiller.
- `src/game/gameConfig.ts`: Sorular, cevaplar, menü içeriği ve tur sayısı.
- `src/composables/useGameSounds.ts`: Buton ve yıldız seslerinin yaşam döngüsü.
- `src/utils/storage.ts`: Güvenli `localStorage` okuma ve yazma yardımcıları.
- `assets/`: Oyun görselleri ve ses dosyaları.

## Yerleşim Verileri

Panel, sandık, maskot, halat, yıldız ve diğer sahne konumları daha önce oluşturulan
`localStorage` kayıtlarından okunur. Geçersiz veya bozuk kayıtlar güvenli varsayılan
değerlerle karşılanır. Eski yerleşim biçimleri açılışta dönüştürülür ve yeni biçimde
tekrar kaydedilir.

Tarayıcı verileri temizlendiğinde uygulama kod içindeki varsayılan yerleşime döner.
Yeni bir varsayılan tasarım yayımlanacaksa ilgili varsayılan değerler de kodda
güncellenmelidir.
