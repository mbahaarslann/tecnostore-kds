# TecnoStore KDS Projesi (Karar Destek Sistemi)

**Ders:** Sunucu Tabanlı Programlama  
**Teslim Eden:** Baha Arslan  
**Konu:** MVC Mimarisi ile RESTful API ve Karar Destek Sistemi Tasarımı

## 1. Projenin Amacı
Bu proje, perakende mağazacılık sektöründe faaliyet gösteren "TecnoStore" adlı kurgusal bir firma için geliştirilmiş bir **Karar Destek Sistemidir (KDS)**. Sistemin teknik amacı; gerçekçi bir veri seti üzerinde, Node.js ve Express çatılarını kullanarak, **MVC (Model-View-Controller)** mimarisine tam uyumlu, ölçeklenebilir ve RESTful bir web uygulaması geliştirmektir.

Sistemin işlevsel amacı ise; yöneticilerin mağaza performanslarını analiz etmelerine, simülasyonlar ("what-if" senaryoları) çalıştırarak geleceğe yönelik stratejik kararlar almalarına olanak tanımaktır.

## 2. Kullanılan Teknolojiler ve Mimari
*   **Backend:** Node.js (Express.js) - MVC Mimarisi
*   **Database:** MySQL (mysql2 modülü ile bağlantı)
*   **Frontend:** EJS (Server-Side Rendering), Bootstrap, Chart.js
*   **Veri Mimarisi:** İlişkisel Veritabanı (RDBMS)

### MVC Yapısı
Proje, katmanlı mimari prensiplerine sıkı sıkıya bağlıdır:
*   **Models (`/models`):** Sadece veritabanı erişiminden (SQL sorguları) sorumludur. İş mantığı içermez.
*   **Controllers (`/controllers`):** İş mantığını (Business Logic) yürütür. Kullanıcıdan gelen isteği alır, Model'den veriyi ister, işler ve View'a gönderir.
*   **Views (`/views`):** Kullanıcı arayüzünü oluşturur.
*   **Routes (`/routes`):** URL yönlendirmelerini controller fonksiyonlarına eşler.

## 3. Özellikler ve Senaryolar
Proje, ders kapsamında istenen "İş kuralı içeren en az 2 özel senaryo" gereksinimini fazlasıyla karşılamaktadır:

### Senaryo 1: Dinamik Pazar Payı Kalibrasyonu
Sistem, her mağazanın cirosuna göre o bölgedeki pazar potansiyelini "Reverse Engineering" yöntemiyle hesaplar. 
*   **Kural:** Gerçek hayatta bir mağazanın pazar payı %100 olamaz. Sistem, mağazaların pazar payını %3 ile %7 arasında gerçekçi bir aralıkta tutacak şekilde veritabanındaki "Toplam Pazar Potansiyeli" alanını otomatik olarak kalibre eder.

### Senaryo 2: Geçmişe Dönük Ürün Satış Kontrolü
Veri üretimi sırasında tutarlılığı sağlamak adına sistem, ürünlerin çıkış yıllarını kontrol eder.
*   **Kural:** 2025 yılında çıkan bir ürünün ("iPhone 16" gibi) 2023 yılındaki satış kayıtlarında yer alması engellenir. Sistem, satış tarihi > ürün çıkış tarihi kontrolünü yapar.

### Senaryo 3: "What-If" Simülasyon Motoru (Örn: Enflasyon ve Zam Etkisi)
Yöneticiler, "Fiyatlara %20 zam yaparsam ve dolar kuru %10 artarsa kârım ne olur?" gibi senaryoları simüle edebilir.
*   **Kural:** Fiyat esnekliği kuralı gereği, zam yapıldığında satış adetleri belirli bir katsayı ile düşürülür (Price Elasticity of Demand).

### Senaryo 4: Şehir ve Kategori Bazlı Detaylı Analiz
Sistem sadece genel bir tahmin yapmakla kalmaz, aynı zamanda **Şehir (Coğrafi)** ve **Ürün Kategorisi** bazında da kırılım sunar.
*   **Özellik:** Bir simülasyon çalıştırılırken belirli bir şehir (Örn: İstanbul) veya kategori (Örn: Telefon) filtrelenebilir. Sonuçlar bu filtrelere göre özelleştirilir.

## 4. Kurulum Adımları

1.  **Gereksinimler:** Node.js ve MySQL sunucusunun kurulu olduğundan emin olun.
2.  **Repo Klonlama:** 
    ```bash
    git clone <repo-url>
    cd <proje-klasoru>
    ```
3.  **Paket Yükleme:**
    ```bash
    npm install
    ```
4.  **Veritabanı Kurulumu:**
    *   MySQL'de `kds_proje` adında bir veritabanı oluşturun.
    *   Projenin kök dizinindeki SQL dosyasını (eğer varsa) veya hoca tarafından sağlanan şemayı import edin.
5.  **Environment Ayarları:**
    *   `.env.example` dosyasının adını `.env` olarak değiştirin.
    *   Veritabanı bilgilerinizi girin:
        ```
        DB_HOST=localhost
        DB_USER=root
        DB_PASS=şifreniz
        DB_NAME=kds_proje
        PORT=3000
        ```
6.  **Projeyi Çalıştırma:**
    ```bash
    npm start
    # veya geliştirme modunda
    npm run dev
    ```
7.  **Tarayıcı:** `http://localhost:3000` adresine gidin.

## 5. API Endpoint Listesi

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| **GET** | `/` | Ana kontrol paneli (Dashboard) ve grafikler. |
| **GET** | `/cografi-analiz` | Harita bazlı analiz ekranı. |
| **GET** | `/simulasyon/yeni` | Yeni simülasyon oluşturma formu. |
| **GET** | `/simulasyon/gecmis` | Kaydedilmiş simülasyonları listeler. |
| **GET** | `/simulasyon/gecmis` | Kaydedilmiş simülasyonları listeler. |
| **GET** | `/simulasyon/duzenle/:id` | Simülasyon düzenleme sayfasını getirir. |
| **POST** | `/simulasyon/hesapla` | Simülasyon parametrelerini alır ve sonuç üretir. |
| **PUT** | `/simulasyon/:id` | Mevcut bir simülasyonun adını ve senaryo tipini günceller. |
| **DELETE**| `/simulasyon/sil/:id` | Simülasyon kaydını siler. |
| **GET** | `/admin/regenerate-data` | 3 yıllık (2023-2025) test verisi üretir. |
| **GET** | `/admin/calibrate-market-share`| Pazar payı verilerini kalibre eder. |
