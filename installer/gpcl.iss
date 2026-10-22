; GoodPlanCraftLauncher installer (Inno Setup 6.5+).
; Build with scripts/build-installer.mjs, which injects the version from package.json.

#define AppName "GoodPlanCraftLauncher"
#define AppExeName "GoodPlanCraftLauncher.exe"
#define AppPublisher "CaelLab"
#define AppContact "gamets@caellab.com"
#define AppURL "https://gamets.caellab.com/gpcl/"
#define GroupName "CaelLab"

; GUID electron-builder derives from appId (com.caellab.gamets.gpcl) for its NSIS
; installer; used to take over an existing NSIS install and to refuse a leftover
; per-machine one.
#define OldNsGuid "3ba2ea27-c03b-5187-9f73-05821ec8353b"

#ifndef AppVersion
  #error AppVersion is not defined (pass /DAppVersion=x.y.z)
#endif
#ifndef VersionInfoVersion
  #define VersionInfoVersion "0.0.0.0"
#endif
#ifndef PayloadDir
  #define PayloadDir "..\release\win-unpacked"
#endif
#ifndef InnoOutputDir
  #define InnoOutputDir "..\release"
#endif
#ifndef InnoOutputName
  #define InnoOutputName "GPCL-" + AppVersion + "-Setup"
#endif

[Setup]
AppId={{2F979A9F-5DC0-4B20-B21F-3C94A0803BAC}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
AppComments={#AppName} - Minecraft launcher
AppContact={#AppContact}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#GroupName}
DisableProgramGroupPage=yes
ShowLanguageDialog=no
PrivilegesRequired=lowest
MinVersion=10.0
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#InnoOutputDir}
OutputBaseFilename={#InnoOutputName}
SetupIconFile=..\icon.ico
UninstallDisplayName={#AppName} {#AppVersion}
UninstallDisplayIcon={app}\{#AppExeName}
DisableWelcomePage=no
WizardStyle=dynamic includetitlebar
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoVersion={#VersionInfoVersion}
VersionInfoTextVersion={#AppVersion}
VersionInfoCopyright=Copyright (C) 2026 Yunyun(云云) by CaelLab, https://gamets.caellab.com/gpcl/

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "lang\ChineseSimplified.isl"
Name: "chinesetraditional"; MessagesFile: "lang\ChineseTraditional.isl"
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "armenian"; MessagesFile: "compiler:Languages\Armenian.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "bulgarian"; MessagesFile: "compiler:Languages\Bulgarian.isl"
Name: "catalan"; MessagesFile: "compiler:Languages\Catalan.isl"
Name: "corsican"; MessagesFile: "compiler:Languages\Corsican.isl"
Name: "czech"; MessagesFile: "compiler:Languages\Czech.isl"
Name: "danish"; MessagesFile: "compiler:Languages\Danish.isl"
Name: "dutch"; MessagesFile: "compiler:Languages\Dutch.isl"
Name: "farsi"; MessagesFile: "lang\Farsi.isl"
Name: "finnish"; MessagesFile: "compiler:Languages\Finnish.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "greek"; MessagesFile: "lang\Greek.isl"
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"
Name: "hindi"; MessagesFile: "lang\Hindi.isl"
Name: "hungarian"; MessagesFile: "compiler:Languages\Hungarian.isl"
Name: "indonesian"; MessagesFile: "lang\Indonesian.isl"
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "malaysian"; MessagesFile: "lang\Malaysian.isl"
Name: "norwegian"; MessagesFile: "compiler:Languages\Norwegian.isl"
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "slovak"; MessagesFile: "compiler:Languages\Slovak.isl"
Name: "slovenian"; MessagesFile: "compiler:Languages\Slovenian.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "swedish"; MessagesFile: "compiler:Languages\Swedish.isl"
Name: "tamil"; MessagesFile: "compiler:Languages\Tamil.isl"
Name: "thai"; MessagesFile: "compiler:Languages\Thai.isl"
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
Name: "ukrainian"; MessagesFile: "compiler:Languages\Ukrainian.isl"
Name: "vietnamese"; MessagesFile: "lang\Vietnamese.isl"
Name: "bengali"; MessagesFile: "lang\Bengali.isl"

[CustomMessages]
english.WelcomeExtra={#AppName} is a lightweight Minecraft launcher with account login, version management and one-click Forge / Fabric / OptiFine installs. Developed and maintained by CaelLab, released under the CaelLab BY-SA Code License v3. Project page: {#AppURL}
english.UpgradeNotice=An existing {#AppName} installation was found. Setup will upgrade it in place: same folder, your versions and settings are kept.
english.AllUsersBlocked=A per-machine installation of an older version was found. Uninstall it from Windows Settings > Apps first, then run this installer again.
chinesesimplified.WelcomeExtra={#AppName} 是一款轻量高效的 Minecraft 启动器，支持正版登录、版本管理与 Forge / Fabric / OptiFine 一键安装。由虚舟实验室（CaelLab）开发并维护，以 CaelLab BY-SA Code License v3 开源。项目主页：{#AppURL}
chinesesimplified.UpgradeNotice=检测到本机已有的 {#AppName}（旧安装器安装）。将就地升级：安装目录不变，你的游戏版本和设置都会保留。
chinesesimplified.AllUsersBlocked=检测到为「所有用户」安装的旧版本。请先在 Windows 的「设置 → 应用」里卸载它，再运行本安装程序。
chinesetraditional.WelcomeExtra={#AppName} 是一款輕量高效的 Minecraft 啟動器，支援正版登入、版本管理與 Forge / Fabric / OptiFine 一鍵安裝。由虛舟實驗室（CaelLab）開發並維護，以 CaelLab BY-SA Code License v3 開源。專案首頁：{#AppURL}
chinesetraditional.UpgradeNotice=偵測到本機已有的 {#AppName}（舊安裝程式安裝）。將就地升級：安裝目錄不變，你的遊戲版本與設定都會保留。
chinesetraditional.AllUsersBlocked=偵測到為「所有使用者」安裝的舊版本。請先在 Windows 的「設定 → 應用程式」中解除安裝，再執行本安裝程式。
arabic.WelcomeExtra={#AppName} هو مشغّل Minecraft خفيف يتيح تسجيل الدخول إلى الحساب وإدارة الإصدارات وتثبيت Forge / Fabric / OptiFine بنقرة واحدة. طوّرته وصانته CaelLab، ويُصدر بموجب رخصة CaelLab BY-SA Code License v3. صفحة المشروع: {#AppURL}
arabic.UpgradeNotice=تم العثور على تثبيت موجود لـ {#AppName}. سيقوم برنامج الإعداد بترقيته في مكانه: المجلد نفسه، مع الاحتفاظ بإصداراتك وإعداداتك.
arabic.AllUsersBlocked=تم العثور على تثبيت قديم لهذا الجهاز بأكمله (لجميع المستخدمين). قم بإلغاء تثبيته أولًا من "الإعدادات > التطبيقات" في Windows، ثم شغّل برنامج الإعداد هذا مرة أخرى.
armenian.WelcomeExtra={#AppName}-ը թեթև Minecraft գործարկիչ է՝ հաշվի մուտքով, տարբերակների կառավարմամբ և Forge / Fabric / OptiFine-ի մեկ սեղմումով տեղադրմամբ։ Մշակվել և պահպանվում է CaelLab-ի կողմից, թողարկվում է CaelLab BY-SA Code License v3 արտոնագրով։ Ծրագրի էջը՝ {#AppURL}
armenian.UpgradeNotice=Հայտնաբերվել է {#AppName}-ի առկա տեղադրում։ Տեղադրիչը կթարմացնի այն տեղում՝ նույն պանակում, ձեր տարբերակներն ու կարգավորումները կպահպանվեն։
armenian.AllUsersBlocked=Հայտնաբերվել է հին տարբերակի տեղադրում բոլոր օգտատերերի համար։ Նախ հեռացրեք այն Windows-ի «Կարգավորումներ > Հավելվածներ»-ից, ապա նորից գործարկեք այս տեղադրիչը։
brazilianportuguese.WelcomeExtra=O {#AppName} é um launcher leve de Minecraft com login de conta, gerenciamento de versões e instalação de Forge / Fabric / OptiFine com um clique. Desenvolvido e mantido pela CaelLab, distribuído sob a CaelLab BY-SA Code License v3. Página do projeto: {#AppURL}
brazilianportuguese.UpgradeNotice=Foi encontrada uma instalação existente do {#AppName}. O instalador fará a atualização no mesmo local: mesma pasta, suas versões e configurações serão mantidas.
brazilianportuguese.AllUsersBlocked=Foi encontrada uma instalação da versão antiga para todos os usuários do computador. Desinstale-a primeiro em Configurações > Aplicativos do Windows e depois execute este instalador novamente.
bulgarian.WelcomeExtra={#AppName} е лек стартер за Minecraft с вход в акаунт, управление на версии и инсталиране на Forge / Fabric / OptiFine с едно щракване. Разработен и поддържан от CaelLab, разпространява се под CaelLab BY-SA Code License v3. Страница на проекта: {#AppURL}
bulgarian.UpgradeNotice=Открито е съществуващо инсталиране на {#AppName}. Програмата за инсталиране ще го надгради на място: същата папка, вашите версии и настройки се запазват.
bulgarian.AllUsersBlocked=Открито е инсталиране на по-стара версия за всички потребители. Първо я деинсталирайте от „Настройки > Приложения“ в Windows, след което стартирайте този инсталатор отново.
catalan.WelcomeExtra={#AppName} és un llançador lleuger de Minecraft amb inici de sessió, gestió de versions i instal·lació de Forge / Fabric / OptiFine amb un sol clic. Desenvolupat i mantingut per CaelLab, publicat sota la CaelLab BY-SA Code License v3. Pàgina del projecte: {#AppURL}
catalan.UpgradeNotice=S'ha trobat una instal·lació existent de {#AppName}. L'instal·lador l'actualitzarà al mateix lloc: mateixa carpeta, les teves versions i la configuració es conserven.
catalan.AllUsersBlocked=S'ha trobat una instal·lació d'una versió anterior per a tots els usuaris. Desinstal·la-la primer a Configuració > Aplicacions del Windows i torna a executar aquest instal·lador.
corsican.WelcomeExtra={#AppName} hè un lanciatore liggeru di Minecraft cù a cunnessione à u contu, a gestione di e versioni è l'installazione di Forge / Fabric / OptiFine in un solu clic. Sviluppatu è mantenutu da CaelLab, publicatu sottu a CaelLab BY-SA Code License v3. Pagina di u prugettu: {#AppURL}
corsican.UpgradeNotice=Hè stata trovata un'installazione esistente di {#AppName}. U stallatore a metterà à ghjornu in u listessu locu: listessa cartulare, e vostre versioni è i parametri sò cunservati.
corsican.AllUsersBlocked=Hè stata trovata un'installazione di una versione più vechja per tutti l'utilizatori. Disinstallatela prima da "Parametri > App" di Windows, dopu avviate torna stu stallatore.
czech.WelcomeExtra={#AppName} je odlehčený spouštěč Minecraftu s přihlášením k účtu, správou verzí a instalací Forge / Fabric / OptiFine jedním kliknutím. Vyvíjí a spravuje jej CaelLab, vydává se pod licencí CaelLab BY-SA Code License v3. Stránka projektu: {#AppURL}
czech.UpgradeNotice=Byla nalezena existující instalace {#AppName}. Instalace ji aktualizuje na místě: stejná složka, vaše verze a nastavení zůstanou zachovány.
czech.AllUsersBlocked=Byla nalezena instalace starší verze pro všechny uživatele. Nejprve ji odinstalujte v Windows v nabídce Nastavení > Aplikace a poté tento instalátor spusťte znovu.
danish.WelcomeExtra={#AppName} er en letvægts Minecraft-launcher med kontologin, versionsstyring og installation af Forge / Fabric / OptiFine med ét klik. Udvikles og vedligeholdes af CaelLab og udgives under CaelLab BY-SA Code License v3. Projektets side: {#AppURL}
danish.UpgradeNotice=Der blev fundet en eksisterende installation af {#AppName}. Installationen opgraderer den på stedet: samme mappe, dine versioner og indstillinger bevares.
danish.AllUsersBlocked=Der blev fundet en installation af en ældre version for alle brugere. Afinstaller den først i Windows under Indstillinger > Apps, og kør derefter dette installationsprogram igen.
dutch.WelcomeExtra={#AppName} is een lichtgewicht Minecraft-launcher met accountaanmelding, versiebeheer en installatie van Forge / Fabric / OptiFine met één klik. Ontwikkeld en onderhouden door CaelLab, uitgegeven onder de CaelLab BY-SA Code License v3. Projectpagina: {#AppURL}
dutch.UpgradeNotice=Er is een bestaande installatie van {#AppName} gevonden. Setup werkt deze ter plaatse bij: dezelfde map, je versies en instellingen blijven behouden.
dutch.AllUsersBlocked=Er is een installatie van een oudere versie voor alle gebruikers gevonden. Verwijder deze eerst via Windows Instellingen > Apps en voer dit installatieprogramma daarna opnieuw uit.
farsi.WelcomeExtra={#AppName} یک لانچر سبک برای Minecraft با ورود به حساب، مدیریت نسخه‌ها و نصب یک‌کلیکی Forge / Fabric / OptiFine است. توسط CaelLab توسعه و نگهداری می‌شود و تحت CaelLab BY-SA Code License v3 منتشر شده است. صفحه پروژه: {#AppURL}
farsi.UpgradeNotice=یک نصب موجود از {#AppName} پیدا شد. برنامه نصب آن را در همان محل ارتقا می‌دهد: همان پوشه، نسخه‌ها و تنظیمات شما حفظ می‌شوند.
farsi.AllUsersBlocked=نصب نسخه قدیمی برای همه کاربران پیدا شد. ابتدا آن را از «تنظیمات > برنامه‌ها» در Windows حذف کنید، سپس این برنامه نصب را دوباره اجرا کنید.
finnish.WelcomeExtra={#AppName} on kevyt Minecraft-käynnistin, jossa on tilille kirjautuminen, versioiden hallinta ja Forge / Fabric / OptiFine -asennus yhdellä napsautuksella. Kehittäjä ja ylläpitäjä: CaelLab, julkaistu CaelLab BY-SA Code License v3 -lisenssillä. Projektisivu: {#AppURL}
finnish.UpgradeNotice={#AppName}-asennus löytyi jo. Asennusohjelma päivittää sen paikan päällä: sama kansio, versionsi ja asetuksesi säilyvät.
finnish.AllUsersBlocked=Löytyi kaikille käyttäjille tehty vanhemman version asennus. Poista se ensin Windowsin kohdasta Asetukset > Sovellukset ja suorita sitten tämä asennusohjelma uudelleen.
french.WelcomeExtra={#AppName} est un lanceur Minecraft léger avec connexion au compte, gestion des versions et installation de Forge / Fabric / OptiFine en un clic. Développé et maintenu par CaelLab, publié sous la CaelLab BY-SA Code License v3. Page du projet : {#AppURL}
french.UpgradeNotice=Une installation existante de {#AppName} a été détectée. Le programme d'installation va la mettre à niveau sur place : même dossier, vos versions et vos paramètres sont conservés.
french.AllUsersBlocked=Une installation d'une version plus ancienne pour tous les utilisateurs a été détectée. Désinstallez-la d'abord dans Paramètres > Applications de Windows, puis relancez ce programme d'installation.
german.WelcomeExtra={#AppName} ist ein schlanker Minecraft-Launcher mit Kontoanmeldung, Versionsverwaltung und Ein-Klick-Installation von Forge / Fabric / OptiFine. Entwickelt und gepflegt von CaelLab, veröffentlicht unter der CaelLab BY-SA Code License v3. Projektseite: {#AppURL}
german.UpgradeNotice=Eine vorhandene Installation von {#AppName} wurde gefunden. Setup führt ein direktes Upgrade durch: gleicher Ordner, deine Versionen und Einstellungen bleiben erhalten.
german.AllUsersBlocked=Es wurde eine Installation einer älteren Version für alle Benutzer gefunden. Deinstalliere sie zuerst unter Windows unter Einstellungen > Apps und starte dieses Setup dann erneut.
greek.WelcomeExtra=Το {#AppName} είναι ένας ελαφρύς εκκινητής Minecraft με σύνδεση λογαριασμού, διαχείριση εκδόσεων και εγκατάσταση Forge / Fabric / OptiFine με ένα κλικ. Αναπτύσσεται και συντηρείται από την CaelLab και διανέμεται υπό την CaelLab BY-SA Code License v3. Σελίδα έργου: {#AppURL}
greek.UpgradeNotice=Βρέθηκε υπάρχουσα εγκατάσταση του {#AppName}. Η εγκατάσταση θα το αναβαθμίσει επιτόπου: ίδιος φάκελος, οι εκδόσεις και οι ρυθμίσεις σας διατηρούνται.
greek.AllUsersBlocked=Βρέθηκε εγκατάσταση παλαιότερης έκδοσης για όλους τους χρήστες. Απεγκαταστήστε την πρώτα από τις Ρυθμίσεις > Εφαρμογές των Windows και έπειτα εκτελέστε ξανά αυτό το πρόγραμμα εγκατάστασης.
hebrew.WelcomeExtra={#AppName} הוא משגר Minecraft קליל עם התחברות לחשבון, ניהול גרסאות והתקנת Forge / Fabric / OptiFine בלחיצה אחת. פותח ומתוחזק על ידי CaelLab, מופץ תחת CaelLab BY-SA Code License v3. עמוד הפרויקט: {#AppURL}
hebrew.UpgradeNotice=נמצאה התקנה קיימת של {#AppName}. תוכנית ההתקנה תשדרג אותה במקום: אותה תיקייה, הגרסאות וההגדרות שלך נשמרות.
hebrew.AllUsersBlocked=נמצאה התקנה של גרסה ישנה יותר עבור כל המשתמשים. הסר אותה תחילה דרך 'הגדרות > אפליקציות' ב-Windows, ולאחר מכן הפעל שוב את תוכנית ההתקנה.
hindi.WelcomeExtra={#AppName} एक हल्का Minecraft लॉन्चर है जिसमें खाता लॉगिन, संस्करण प्रबंधन और Forge / Fabric / OptiFine की एक-क्लिक इंस्टॉल सुविधा है। इसे CaelLab द्वारा विकसित और अनुरक्षित किया जाता है तथा CaelLab BY-SA Code License v3 के अंतर्गत जारी किया जाता है। परियोजना पृष्ठ: {#AppURL}
hindi.UpgradeNotice={#AppName} का मौजूदा इंस्टॉलेशन मिला है। सेटअप इसे उसी स्थान पर अपग्रेड करेगा: वही फ़ोल्डर, आपके संस्करण और सेटिंग्स सुरक्षित रहेंगे।
hindi.AllUsersBlocked=पुराने संस्करण का सभी उपयोगकर्ताओं के लिए किया गया इंस्टॉलेशन मिला है। पहले इसे Windows की सेटिंग्स > ऐप्स से अनइंस्टॉल करें, फिर यह इंस्टॉलर दोबारा चलाएँ।
hungarian.WelcomeExtra=A {#AppName} egy könnyűsúlyú Minecraft-indító fiókbejelentkezéssel, verziókezeléssel és egykattintásos Forge / Fabric / OptiFine telepítéssel. A CaelLab fejleszti és tartja karban, a CaelLab BY-SA Code License v3 alatt jelenik meg. Projektoldal: {#AppURL}
hungarian.UpgradeNotice=Meglévő {#AppName}-telepítést találtunk. A telepítő a helyszínen frissíti: ugyanaz a mappa, a verzióid és a beállításaid megmaradnak.
hungarian.AllUsersBlocked=Egy régebbi verzió minden felhasználóra kiterjedő telepítését találtuk. Először távolítsd el a Windows Gépház > Alkalmazások menüjében, majd indítsd újra ezt a telepítőt.
indonesian.WelcomeExtra={#AppName} adalah peluncur Minecraft ringan dengan login akun, pengelolaan versi, dan pemasangan Forge / Fabric / OptiFine sekali klik. Dikembangkan dan dikelola oleh CaelLab, dirilis di bawah CaelLab BY-SA Code License v3. Halaman proyek: {#AppURL}
indonesian.UpgradeNotice=Ditemukan pemasangan {#AppName} yang sudah ada. Program pemasang akan meningkatkannya di tempat: folder sama, versi dan pengaturan Anda tetap tersimpan.
indonesian.AllUsersBlocked=Ditemukan pemasangan versi lama untuk semua pengguna. Copot pemasangannya dulu melalui Pengaturan > Aplikasi di Windows, lalu jalankan pemasang ini lagi.
italian.WelcomeExtra={#AppName} è un launcher Minecraft leggero con accesso all'account, gestione delle versioni e installazione di Forge / Fabric / OptiFine con un clic. Sviluppato e mantenuto da CaelLab, distribuito con la CaelLab BY-SA Code License v3. Pagina del progetto: {#AppURL}
italian.UpgradeNotice=È stata trovata un'installazione esistente di {#AppName}. Il programma di installazione la aggiornerà sul posto: stessa cartella, le tue versioni e impostazioni vengono conservate.
italian.AllUsersBlocked=È stata trovata un'installazione di una versione precedente per tutti gli utenti. Disinstallala prima da Impostazioni > App di Windows, poi esegui di nuovo questo programma di installazione.
japanese.WelcomeExtra={#AppName} は、アカウントログイン、バージョン管理、Forge / Fabric / OptiFine のワンクリックインストールに対応した軽量な Minecraft ランチャーです。CaelLab が開発・保守し、CaelLab BY-SA Code License v3 で公開されています。プロジェクトページ：{#AppURL}
japanese.UpgradeNotice=既存の {#AppName} のインストールが見つかりました。セットアップはそのまま上書きアップグレードします。同じフォルダのままで、バージョンと設定は保持されます。
japanese.AllUsersBlocked=すべてのユーザー向けにインストールされた古いバージョンが見つかりました。まず Windows の「設定 > アプリ」からアンインストールしてから、このインストーラーを再度実行してください。
korean.WelcomeExtra={#AppName}은(는) 계정 로그인, 버전 관리, Forge / Fabric / OptiFine 원클릭 설치를 지원하는 가벼운 Minecraft 런처입니다. CaelLab이 개발·유지하며 CaelLab BY-SA Code License v3로 배포됩니다. 프로젝트 페이지: {#AppURL}
korean.UpgradeNotice=기존 {#AppName} 설치가 발견되었습니다. 설치 프로그램이 같은 위치에서 업그레이드합니다. 폴더는 그대로이고 버전과 설정이 유지됩니다.
korean.AllUsersBlocked=모든 사용자용으로 설치된 이전 버전이 발견되었습니다. 먼저 Windows의 설정 > 앱에서 제거한 다음 이 설치 프로그램을 다시 실행하세요.
malaysian.WelcomeExtra={#AppName} ialah pelancar Minecraft ringan dengan log masuk akaun, pengurusan versi dan pemasangan Forge / Fabric / OptiFine sekali klik. Dibangunkan dan diselenggara oleh CaelLab, dikeluarkan di bawah CaelLab BY-SA Code License v3. Halaman projek: {#AppURL}
malaysian.UpgradeNotice=Pemasangan {#AppName} sedia ada ditemui. Program pemasang akan menaik tarafnya di tempat yang sama: folder sama, versi dan tetapan anda dikekalkan.
malaysian.AllUsersBlocked=Pemasangan versi lama untuk semua pengguna ditemui. Nyahpasangnya dahulu melalui Tetapan > Apl dalam Windows, kemudian jalankan pemasang ini sekali lagi.
norwegian.WelcomeExtra={#AppName} er en lettvekts Minecraft-launcher med kontopålogging, versjonsbehandling og installasjon av Forge / Fabric / OptiFine med ett klikk. Utvikles og vedlikeholdes av CaelLab og gis ut under CaelLab BY-SA Code License v3. Prosjektside: {#AppURL}
norwegian.UpgradeNotice=Det ble funnet en eksisterende {#AppName}-installasjon. Installasjonen oppgraderer den på stedet: samme mappe, versjonene og innstillingene dine beholdes.
norwegian.AllUsersBlocked=Det ble funnet en installasjon av en eldre versjon for alle brukere. Avinstaller den først i Windows under Innstillinger > Apper, og kjør deretter dette installasjonsprogrammet på nytt.
polish.WelcomeExtra={#AppName} to lekki launcher Minecrafta z logowaniem na konto, zarządzaniem wersjami i instalacją Forge / Fabric / OptiFine jednym kliknięciem. Rozwijany i utrzymywany przez CaelLab, wydawany na licencji CaelLab BY-SA Code License v3. Strona projektu: {#AppURL}
polish.UpgradeNotice=Znaleziono istniejącą instalację {#AppName}. Instalator zaktualizuje ją w tym samym miejscu: ten sam folder, Twoje wersje i ustawienia zostaną zachowane.
polish.AllUsersBlocked=Znaleziono instalację starszej wersji dla wszystkich użytkowników. Najpierw odinstaluj ją w Windows w Ustawienia > Aplikacje, a następnie uruchom ponownie ten instalator.
portuguese.WelcomeExtra=O {#AppName} é um launcher leve de Minecraft com início de sessão, gestão de versões e instalação de Forge / Fabric / OptiFine com um clique. Desenvolvido e mantido pela CaelLab, distribuído ao abrigo da CaelLab BY-SA Code License v3. Página do projeto: {#AppURL}
portuguese.UpgradeNotice=Foi encontrada uma instalação existente do {#AppName}. O instalador irá atualizá-la no local: mesma pasta, as suas versões e definições são mantidas.
portuguese.AllUsersBlocked=Foi encontrada uma instalação de uma versão anterior para todos os utilizadores. Desinstale-a primeiro em Definições > Aplicações do Windows e volte a executar este instalador.
russian.WelcomeExtra={#AppName} — лёгкий лаунчер Minecraft с входом в аккаунт, управлением версиями и установкой Forge / Fabric / OptiFine в один клик. Разрабатывается и поддерживается CaelLab, распространяется по лицензии CaelLab BY-SA Code License v3. Страница проекта: {#AppURL}
russian.UpgradeNotice=Обнаружена установленная версия {#AppName}. Программа установки обновит её на месте: та же папка, ваши версии и настройки сохранятся.
russian.AllUsersBlocked=Обнаружена установка старой версии для всех пользователей. Сначала удалите её в Windows через «Параметры > Приложения», затем снова запустите этот установщик.
slovak.WelcomeExtra={#AppName} je odľahčený spúšťač Minecraftu s prihlásením k účtu, správou verzií a inštaláciou Forge / Fabric / OptiFine jedným kliknutím. Vyvíja a spravuje ho CaelLab, vydáva sa pod licenciou CaelLab BY-SA Code License v3. Stránka projektu: {#AppURL}
slovak.UpgradeNotice=Našla sa existujúca inštalácia {#AppName}. Inštalátor ju aktualizuje na mieste: rovnaký priečinok, vaše verzie a nastavenia zostanú zachované.
slovak.AllUsersBlocked=Našla sa inštalácia staršej verzie pre všetkých používateľov. Najprv ju odinštalujte v Windows v časti Nastavenia > Aplikácie a potom tento inštalátor spustite znova.
slovenian.WelcomeExtra={#AppName} je privlažen zaganjalnik za Minecraft s prijavo v račun, upravljanjem različic in namestitvijo Forge / Fabric / OptiFine z enim klikom. Razvija in vzdržuje ga CaelLab, izdaja pa se pod licenco CaelLab BY-SA Code License v3. Stran projekta: {#AppURL}
slovenian.UpgradeNotice=Najdena je bila obstoječa namestitev {#AppName}. Namestitveni program jo bo nadgradil na mestu: ista mapa, vaše različice in nastavitve se ohranijo.
slovenian.AllUsersBlocked=Najdena je bila namestitev starejše različice za vse uporabnike. Najprej jo odstranite v Windows v Nastavitve > Aplikacije, nato znova zaženite ta namestitveni program.
spanish.WelcomeExtra={#AppName} es un lanzador de Minecraft ligero con inicio de sesión, gestión de versiones e instalación de Forge / Fabric / OptiFine con un clic. Desarrollado y mantenido por CaelLab, publicado bajo la CaelLab BY-SA Code License v3. Página del proyecto: {#AppURL}
spanish.UpgradeNotice=Se ha encontrado una instalación existente de {#AppName}. El instalador la actualizará en el mismo sitio: misma carpeta, tus versiones y ajustes se conservan.
spanish.AllUsersBlocked=Se ha encontrado una instalación de una versión anterior para todos los usuarios. Desinstálala primero en Configuración > Aplicaciones de Windows y vuelve a ejecutar este instalador.
swedish.WelcomeExtra={#AppName} är en lättviktig Minecraft-launcher med kontoinloggning, versionshantering och installation av Forge / Fabric / OptiFine med ett klick. Utvecklas och underhålls av CaelLab och ges ut under CaelLab BY-SA Code License v3. Projektsida: {#AppURL}
swedish.UpgradeNotice=En befintlig installation av {#AppName} hittades. Installationsprogrammet uppgraderar den på plats: samma mapp, dina versioner och inställningar behålls.
swedish.AllUsersBlocked=En installation av en äldre version för alla användare hittades. Avinstallera den först i Windows under Inställningar > Appar och kör sedan det här installationsprogrammet igen.
tamil.WelcomeExtra={#AppName} என்பது கணக்கு உள்நுழைவு, பதிப்பு மேலாண்மை மற்றும் Forge / Fabric / OptiFine ஒரே கிளிக்கில் நிறுவல் ஆகியவற்றைக் கொண்ட இலகுவான Minecraft துவக்கி. CaelLab ஆல் உருவாக்கப்பட்டு பராமரிக்கப்படுகிறது, CaelLab BY-SA Code License v3 இன் கீழ் வெளியிடப்படுகிறது. திட்டப் பக்கம்: {#AppURL}
tamil.UpgradeNotice=ஏற்கனவே உள்ள {#AppName} நிறுவல் கண்டறியப்பட்டது. அமைப்பான் அதை அதே இடத்தில் மேம்படுத்தும்: அதே கோப்புறை, உங்கள் பதிப்புகளும் அமைப்புகளும் பாதுகாக்கப்படும்.
tamil.AllUsersBlocked=அனைத்துப் பயனர்களுக்கும் நிறுவப்பட்ட பழைய பதிப்பு கண்டறியப்பட்டது. முதலில் Windows இன் அமைப்புகள் > பயன்பாடுகள் என்பதில் அதை நிறுவல் நீக்கி, பிறகு இந்த நிறுவலியை மீண்டும் இயக்கவும்.
thai.WelcomeExtra={#AppName} เป็นตัวเรียกเกม Minecraft ขนาดเบาที่มีการเข้าสู่ระบบบัญชี จัดการเวอร์ชัน และติดตั้ง Forge / Fabric / OptiFine ได้ในคลิกเดียว พัฒนาและดูแลโดย CaelLab เผยแพร่ภายใต้ CaelLab BY-SA Code License v3 หน้าโครงการ: {#AppURL}
thai.UpgradeNotice=พบการติดตั้ง {#AppName} ที่มีอยู่แล้ว ตัวติดตั้งจะอัปเกรดในตำแหน่งเดิม: โฟลเดอร์เดิม เวอร์ชันและการตั้งค่าของคุณจะยังคงอยู่
thai.AllUsersBlocked=พบการติดตั้งเวอร์ชันเก่าสำหรับผู้ใช้ทุกคน กรุณาถอนการติดตั้งก่อนที่ การตั้งค่า > แอป ของ Windows แล้วเรียกใช้ตัวติดตั้งนี้อีกครั้ง
turkish.WelcomeExtra={#AppName}, hesap girişi, sürüm yönetimi ve tek tıkla Forge / Fabric / OptiFine kurulumu sunan hafif bir Minecraft başlatıcısıdır. CaelLab tarafından geliştirilip sürdürülmekte ve CaelLab BY-SA Code License v3 ile yayımlanmaktadır. Proje sayfası: {#AppURL}
turkish.UpgradeNotice=Mevcut bir {#AppName} kurulumu bulundu. Kurulum, aynı klasörde yerinde yükseltme yapacak; sürümleriniz ve ayarlarınız korunacaktır.
turkish.AllUsersBlocked=Tüm kullanıcılar için yapılmış eski bir sürüm kurulumu bulundu. Önce Windows'ta Ayarlar > Uygulamalar bölümünden kaldırın, ardından bu kurulum programını yeniden çalıştırın.
ukrainian.WelcomeExtra={#AppName} — легкий лаунчер Minecraft із входом в акаунт, керуванням версіями та встановленням Forge / Fabric / OptiFine в один клік. Розробляється й підтримується CaelLab, розповсюджується за ліцензією CaelLab BY-SA Code License v3. Сторінка проєкту: {#AppURL}
ukrainian.UpgradeNotice=Виявлено наявне встановлення {#AppName}. Програма встановлення оновить його на місці: та сама тека, ваші версії та налаштування збережуться.
ukrainian.AllUsersBlocked=Виявлено встановлення старої версії для всіх користувачів. Спершу видаліть його в Windows через «Параметри > Програми», а потім знову запустіть цю програму встановлення.
vietnamese.WelcomeExtra={#AppName} là trình khởi chạy Minecraft nhẹ với đăng nhập tài khoản, quản lý phiên bản và cài đặt Forge / Fabric / OptiFine chỉ bằng một cú nhấp. Được phát triển và duy trì bởi CaelLab, phát hành theo CaelLab BY-SA Code License v3. Trang dự án: {#AppURL}
vietnamese.UpgradeNotice=Đã tìm thấy bản cài đặt {#AppName} hiện có. Trình cài đặt sẽ nâng cấp tại chỗ: cùng thư mục, các phiên bản và cài đặt của bạn được giữ nguyên.
vietnamese.AllUsersBlocked=Đã tìm thấy bản cài đặt phiên bản cũ cho tất cả người dùng. Hãy gỡ cài đặt trong Cài đặt > Ứng dụng của Windows trước, sau đó chạy lại trình cài đặt này.
bengali.WelcomeExtra={#AppName} একটি হালকা Minecraft লঞ্চার, যেখানে অ্যাকাউন্ট লগইন, ভার্সন ব্যবস্থাপনা এবং এক ক্লিকে Forge / Fabric / OptiFine ইনস্টল করার সুবিধা আছে। এটি CaelLab দ্বারা বিকাশ ও রক্ষণাবেক্ষণ করা হয় এবং CaelLab BY-SA Code License v3 এর অধীনে প্রকাশিত। প্রকল্প পৃষ্ঠা: {#AppURL}
bengali.UpgradeNotice=বিদ্যমান {#AppName} ইনস্টলেশন পাওয়া গেছে। সেটআপ এটিকে একই জায়গায় আপগ্রেড করবে: একই ফোল্ডার, আপনার ভার্সন ও সেটিংস সংরক্ষিত থাকবে।
bengali.AllUsersBlocked=সবার জন্য ইনস্টল করা পুরোনো একটি ভার্সন পাওয়া গেছে। প্রথমে Windows-এর সেটিংস > অ্যাপ থেকে এটি আনইনস্টল করুন, তারপর এই ইনস্টলারটি আবার চালান।

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#AppExeName}"; Flags: nowait; Check: RelaunchAfterSilentInstall

[Code]
var
  OldInstallDir: String;

function RelaunchAfterSilentInstall: Boolean;
begin
  Result := WizardSilent and (ExpandConstant('{param:RELAUNCH|0}') = '1');
end;

function OldNsKey: String;
begin
  Result := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#OldNsGuid}';
end;

function OldNsInstallPresent: Boolean;
begin
  Result := RegKeyExists(HKEY_CURRENT_USER, OldNsKey);
end;

function OpenProcess(dwDesiredAccess: Cardinal; bInheritHandle: Boolean; dwProcessId: Cardinal): Cardinal;
  external 'OpenProcess@kernel32.dll stdcall';
function WaitForSingleObject(hHandle: Cardinal; dwMilliseconds: Cardinal): Cardinal;
  external 'WaitForSingleObject@kernel32.dll stdcall';
function CloseHandle(hObject: Cardinal): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';

// Waits for the launcher (passed as /WAITPID=) to finish exiting before touching
// its files. Restart Manager cannot reliably close an Electron process that is
// already in its quit sequence, so the launcher spawns Setup and then exits.
procedure WaitForLauncherExit;
var
  WaitPid: Integer;
  ProcHandle: Cardinal;
begin
  WaitPid := StrToIntDef(ExpandConstant('{param:WAITPID|0}'), 0);
  if WaitPid <= 0 then Exit;
  ProcHandle := OpenProcess($00100000, False, WaitPid);
  if ProcHandle <> 0 then
  begin
    WaitForSingleObject(ProcHandle, 120000);
    CloseHandle(ProcHandle);
  end;
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  WaitForLauncherExit;
  if OldNsInstallPresent then
    RegQueryStringValue(HKEY_CURRENT_USER, 'Software\{#OldNsGuid}', 'InstallLocation', OldInstallDir)
  else if RegKeyExists(HKEY_LOCAL_MACHINE, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#OldNsGuid}') then
  begin
    SuppressibleMsgBox(ExpandConstant('{cm:AllUsersBlocked}'), mbCriticalError, MB_OK, IDOK);
    Result := False;
  end;
end;

procedure InitializeWizard;
begin
  if OldNsInstallPresent and (OldInstallDir <> '') and DirExists(OldInstallDir) then
    WizardForm.DirEdit.Text := OldInstallDir;

  WizardForm.WelcomeLabel2.Caption := WizardForm.WelcomeLabel2.Caption + #13#10#13#10 +
    ExpandConstant('{cm:WelcomeExtra}');
  if OldNsInstallPresent then
    WizardForm.WelcomeLabel2.Caption := WizardForm.WelcomeLabel2.Caption + #13#10#13#10 +
      ExpandConstant('{cm:UpgradeNotice}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssInstall) and OldNsInstallPresent then
  begin
    RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, OldNsKey);
    RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, 'Software\{#OldNsGuid}');
    DeleteFile(ExpandConstant('{app}\Uninstall {#AppName}.exe'));
  end;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Upgrading an NSIS install must reuse the old directory; changing it leaves an orphaned install.
  Result := (PageID = wpSelectDir) and OldNsInstallPresent and (OldInstallDir <> '');
end;
