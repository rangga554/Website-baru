# ZIP → APK Builder

## Kebutuhan server
- Node.js 20+
- Java JDK 17+ (sesuai project Android)
- Project ZIP harus merupakan project Android/Gradle yang memiliki `gradlew`/`gradlew.bat`.
- Linux server: `unzip`, Android SDK/Build Tools yang sesuai project.

## Jalankan
```bash
npm install
npm start
```
Buka `http://localhost:3000`.

## Fitur
- Upload ZIP
- Nama aplikasi
- Package name
- Upload icon
- Build `assembleDebug`
- Download APK

## Catatan
Patch package/icon paling aman untuk project Android standar. Project Flutter, React Native, Capacitor, Unity, atau project web harus diberi adapter build tersendiri.
Untuk production, tambahkan authentication, job queue, batas resource, sandbox/container, antivirus/scanning, dan cleanup build.
