# ZIP → APK Builder — Fixed

## Kenapa error JSON sebelumnya?
Frontend lama langsung menjalankan `response.json()`. Saat Vercel mengembalikan halaman/error teks, browser mencoba membaca teks tersebut sebagai JSON sehingga muncul `Unexpected token ... is not valid JSON`. Frontend versi ini membaca respons dengan aman dan menampilkan error server sebenarnya.

## Arsitektur yang benar
**Frontend** boleh di Vercel. **Backend build APK** harus berjalan di Docker/Web Service/VPS yang memiliki Java, Android SDK dan Gradle. Jangan menjalankan proses Gradle/Android SDK di Vercel Serverless.

## Backend
- Node.js 20+
- Dockerfile sudah disediakan
- Java + Android SDK
- POST `/api/build`
- GET `/health`

## Frontend
Edit `public/config.js` jika backend berada di domain berbeda:
```js
window.BUILDER_API_URL = "https://DOMAIN-BACKEND-KAMU";
```
Jika frontend dan backend satu server, biarkan kosong.

## Catatan project
ZIP harus berupa project Android/Gradle yang mempunyai `gradlew` atau `gradlew.bat`. Flutter/React Native/Capacitor/Unity membutuhkan adapter build masing-masing.
