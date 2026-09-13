# ZIP → APK Builder — fixed

Versi ini memperbaiki error routing Express 5 dan disiapkan untuk server yang mempunyai Java + Android SDK.

## Penting: jangan deploy backend Gradle ke Vercel
Vercel cocok untuk frontend/serverless API ringan, bukan sebagai environment Android SDK untuk menjalankan Gradle. Deploy project ini sebagai **Docker/Web Service** (contohnya Render) atau VPS yang punya Docker.

## Lokal
Kebutuhan: Docker Desktop.
```bash
docker build -t zip-apk-builder .
docker run --rm -p 3000:3000 zip-apk-builder
```
Buka `http://localhost:3000`.

## Render
1. Push folder ini ke GitHub.
2. Buat Web Service dari repository.
3. Pilih Docker.
4. Deploy.
`render.yaml` sudah disediakan sebagai contoh konfigurasi.

## Yang didukung
- Android/Gradle project dengan `gradlew` / `gradlew.bat`
- Nama aplikasi
- Package name
- Icon PNG/JPG/WEBP
- Build `assembleDebug`
- Download APK

## Catatan keamanan production
Jalankan build di container terisolasi, beri CPU/RAM/timeout limit, rate limit dan authentication. Jangan menjalankan ZIP pengguna dengan hak root atau akses ke secret server.
