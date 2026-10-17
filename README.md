# OSTİM Mobile (Öğrenci Portalı)

> Modern, açık kaynaklı ve 100% istemci taraflı (sunucusuz) OSTİM Teknik Üniversitesi Öğrenci Bilgi Sistemi (OBS) ve LMS mobil istemcisi.

![API Canary Status](https://img.shields.io/badge/API%20Canary-Operational-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-orange)

---

## 🌟 Neden Bu Uygulama?

Resmi Proliz uygulamasının yavaşlığı, karmaşık arayüzü ve çevrimdışı çalışamama problemlerine çözüm olarak geliştirildi:

- ⚡ **Anında Açılış & Çevrimdışı Mod:** Bodrum katlardaki amfilerde internet çekmese bile ders programınız ve notlarınız anında elinizin altında.
- 📅 **Modern Haftalık Takvim:** Hangi gün hangi derslikte olduğunuzu gösteren sade ve hızlı arayüz.
- 💡 **"What-If" Not Simülatörü:** Henüz açıklanmamış final sınavları için tahmini notunuzu girip dönem ortalamanızı (AGNO) anında simüle edin.
- ⏱️ **Devamsızlık Erken Uyarı Sistemi:** Kalan devamsızlık saatlerinizi görsel renk skalasıyla (%75 kritik sınır) takip edin.
- 🔒 **Sıfır Sunucu (100% Gizlilik):** Kullanıcı adı ve şifreniz hiçbir aracı sunucuya gitmez. Uygulama doğrudan telefonunuzdan üniversite sunucusuyla iletişim kurar.

---

## 🏗️ Mimari & Güvenlik Modeli

```
+-----------------------------------------------------------+
|                   Öğrencinin Cihazı                       |
|                                                           |
|  [ Modern React Native / Expo Arayüzü ]                   |
|       |                                                   |
|  [ Cihaz İçi Şifreleme & Token Depolama ]                 |
+-------+----------------------------------+----------------+
        | (Doğrudan HTTPS)                 | (Doğrudan HTTPS)
        v                                  v
+-----------------------+        +--------------------------+
| obs.ostimteknik.edu.tr|        | lmsclus.ostimteknik.edu.tr|
|   (Üniversite OBS)    |        |     (Moodle LMS)         |
+-----------------------+        +--------------------------+
```

### Dinamik Anahtar Rotasyonu (`config.enc`)
Üniversite API anahtarlarını değiştirdiğinde yeni bir APK derlemeye gerek kalmaz:
1. Uygulama GitHub üzerindeki `config.enc` dosyasını arka planda kontrol eder.
2. `config.enc` şifreli olup GitHub üzerinde hiçbir açık metin anahtar barındırmaz.
3. Anahtar güncellendiğinde tüm kullanıcıların uygulamaları anında yeni anahtarlarla çalışmaya devam eder.

---

## 🚀 Geliştirici Kurulumu

Projeyi yerel ortamınızda çalıştırmak için:

```bash
# 1. Bağımlılıkları yükleyin
bun install

# 2. Örnek ortam dosyasını kopyalayın
cp .env.example .env

# 3. Geliştirici sunucusunu başlatın
bun start
```

### Şifreli Konfigürasyon Üretimi
`.env` dosyanızdaki değerlerle `config.enc` dosyasını güncellemek için:

```bash
bun run tools/encrypt-config.ts
```

### API Canary Health Check Testi
Üniversite uç noktalarının çalışır durumda olduğunu ve şemanın değişmediğini test etmek için:

```bash
bun run tools/canary-check.ts
```

---

## 🛡️ GitHub Actions Entegrasyonu

Depoda hazır bulunan `.github/workflows/api-canary.yml` iş akışı, her 12 saatte bir üniversite API'sini otomatik olarak sorgular ve olası bir kesinti ya da şema değişikliğinde sizi anında uyarır.
