# Homey Control för iPhone och iPad · v1.1

## Uppdaterat i v1.1

- Saknade PNG-ikoner för iPhone, iPad och PWA-installation har lagts till. Offlineinstallationen kan nu slutföras.
- Flows visas korrekt i listan. Dubbla tryck blockeras medan ett kommando pågår.
- Större tryckytor, tydlig anslutningsstatus även på iPhone, bättre radbrytning och layout i båda iPad-riktningarna.
- Otillgängliga enheter visar rätt status även när gamla sensorvärden finns kvar. Styrning spärras efter ett misslyckat uppdateringsförsök.
- En pågående anslutning kan inte återställa uppgifter efter att du kopplat från.
- Service worker cachar endast appens egna filer och raderar endast appens egna äldre cacheversioner.
- GitHub Actions testar appen och publicerar bara webbappens filer till Pages vid ändringar på `main`.

## Publicering för detta projekt

Projekt: [tonka75/Homey_control_PWA](https://github.com/tonka75/Homey_control_PWA).

1. Öppna [Settings → Pages](https://github.com/tonka75/Homey_control_PWA/settings/pages) och välj **GitHub Actions** under **Source**.
2. Lägg ändringarna på `main`. Arbetsflödet **Verify and deploy GitHub Pages** kör tester och publicerar appen. Du kan även starta det manuellt under [Actions](https://github.com/tonka75/Homey_control_PWA/actions).
3. Öppna [Homey Control](https://tonka75.github.io/Homey_control_PWA/) när körningen är grön.
4. På iPhone/iPad: öppna adressen i Safari → Dela → Lägg till på hemskärmen. Beroende på iOS-version kan alternativet **Öppna som webbapp** visas.

**Status den 5 november 2026:** projektet är privat. GitHub avvisade aktivering av Pages med beskedet att den nuvarande planen inte stöder Pages för detta projekt. Publicering kräver därför antingen en GitHub-plan som stöder privata Pages-projekt eller att ägaren uttryckligen väljer att göra projektet offentligt. Webbplatsadressen ovan är avsedd publiceringsadress, inte en bekräftat publicerad app. Arbetsflödet testar koden men hoppar över själva publiceringen tills Pages har aktiverats.

Alla resurser använder relativa adresser så att appen fungerar i `/Homey_control_PWA/`.

### Verifiering

Kör `node --test tests/*.test.cjs` med Node.js 24. Testerna kontrollerar IP-validering, nyckellagring, API-anrop, partiella behörigheter, Flow-listan, frånkoppling och appikoner.

Version 1.1 har också webbläsartestats med **simulerade** API-svar: anslutning, favoriter, på/av, sökning, Flow-bekräftelse, 16 vy/skärm-kombinationer och offlineöppning. Detta ersätter inte ett test mot din Homey Pro i Safari.

### Första testet med din Homey Pro

1. Anslut telefonen till samma Wi-Fi som Homey. Öppna appens Inställningar.
2. Ange Homeys lokala IP och en ny API-nyckel. Ange nyckeln **bara i appen**.
3. Testa först anslutningen och kontrollera att enheter och rum visas.
4. Prova sedan en vanlig lampa: på/av och dimning. Lägg till den som favorit.
5. Testa ett välkänt Flow och en ljusscen. Kontrollera den verkliga effekten i hemmet.
6. Stäng webbappen och öppna den igen från hemskärmen. Testa iPad både stående och liggande.

Homeys officiella behörigheter omfattar bland annat `homey.device.readonly`, `homey.device.control`, `homey.zone.readonly`, `homey.flow.readonly`, `homey.flow.start`, `homey.mood.readonly` och `homey.mood.set`. Namnen kan presenteras annorlunda i Homeys nyckeldialog. Saknade rättigheter för Flows/scener ger en varning medan enheter fortfarande kan visas.

Appen ansluter direkt till den lokala HTTPS-adress som Homey dokumenterar. GitHub Pages tillhandahåller inte en Homey-proxy. Om Safari blockerar anrop måste nätverks-/CORS-felet undersökas på den faktiska enheten innan anslutningslösningen kan verifieras.

---

Detta är en **installerbar webbapp (Progressive Web App)** för iPhone och iPad, med svenskt gränssnitt och mörkt läge. Den är **inte** en signerad iOS-app/IPA. Den kräver ingen Mac eller Xcode, men för att installera behöver du publicera dess statiska filer via **HTTPS**.

## Funktioner

- Översikt med enheter, tända lampor, Flows, favoriter och ljusscener.
- Automatisk upptäckt av enheter, rum, Flows och ljusscener från Homey (ingen data om ditt hem ligger inbakad i appen).
- Visa sensordata för temperatur, luftfuktighet och elförbrukning där enheten rapporterar det.
- På/av och dimning av vanliga lampor och eluttag samt utvalda värmeenheter, **endast för enheter vars Homey API exponerar dessa funktioner**.
- Starta Flow och Advanced Flow med bekräftelsedialog, aktivera ljusscener.
- Favoriter sparas på enheten. Uppdateringsknapp och uppdatering när appen åter öppnas.
- Ingen telemetri, annonser, externa JS-bibliotek eller förifyllda hemliga nycklar.

## Så publicerar du gratis från en Windows-dator med GitHub Pages

1. Logga in på GitHub och skapa ett nytt **publikt** repository, till exempel `Homey-Control-PWA` (lägg **aldrig** in din API-nyckel i GitHub).
2. Packa upp ZIP-filen. Ladda upp **innehållet** i mappen `HomeyControl_PWA` i repositoryts rot med **Add file → Upload files → Commit changes**. Filerna `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js` och undermappen `icons/` måste ligga direkt i roten.
3. Välj **Settings → Pages → Build and deployment → GitHub Actions** när du använder det medföljande arbetsflödet. Om du publicerar enbart de statiska filerna utan arbetsflödet kan du i stället välja **Deploy from a branch → main / (root)**.
4. När GitHub Pages har publicerats blir adressen vanligtvis `https://DITT-GITHUB-NAMN.github.io/Homey-Control-PWA/`. Kontrollera den faktiska adressen under **Settings → Pages**.
5. Öppna adressen i **Safari på iPhone/iPad → Dela → Lägg till på hemskärmen → Öppna som webbapp → Lägg till**.

Du kan använda annan HTTPS-hosting än GitHub Pages. ZIP-filen går **inte** att installera direkt på iOS från Filer-appen utan hosting.

## Homey-anslutning

1. Anslut iPhone/iPad till **samma Wi-Fi** som din Homey Pro.
2. I Homey Web App (`https://my.homey.app`) gå till **Settings → API Keys**. Skapa en ny API-nyckel med minsta rättigheter för att läsa enheter/rum/Flows/scener och styra enheter, starta Flows och aktivera scener. Klistra **aldrig in din API-nyckel i GitHub, ChatGPT eller delade dokument**.
3. Hitta Homeys lokala IPv4-adress under **Settings → General → System Information**.
4. I den installerade webbappen öppna **Inställningar**, ange IP och API-nyckel och välj **Testa anslutning**.
5. Appen använder `https://192-168-1-100.homey.homeylocal.com` för IP `192.168.1.100` (en adress Homey dokumenterar) och skickar `Authorization: Bearer <din API-nyckel>`.

### Viktig teknisk begränsning: Safari och CORS

En webbapp från GitHub Pages gör **cross-origin**-anrop till Homeys lokala HTTPS-adress. Safari kan blockera detta på grund av **CORS / Private Network Access** trots korrekt IP och API-nyckel. Homeys officiella dokumentation beskriver API-nycklar och lokal HTTPS, men garanterar **inte** att anrop från en fristående PWA-origin tillåts. Vi har inte kunnat verifiera CORS mot din Homey. Appen fångar upp och visar anslutningsfel, men **vi kan inte garantera att Homey-styrningen fungerar förrän den testats i din Safari**.

Om detta blockeras behöver anslutningen felsökas i Safari. En möjlig fortsättning är en separat lokal server som både serverar appen och vidarebefordrar Homey-anrop från samma origin. Den servern ingår inte i denna version. Lägg aldrig API-nyckeln i publika filer.

## Säkerhet

- Webbappens egna filer är statiska och utan backend.
- API-nyckeln stannar på iPhone/iPad (i sessionStorage som standard, i localStorage enbart om du väljer `Kom ihåg`). Detta är **inte** lika säkert som iOS Keychain i den tidigare native appen.
- Nyckeln skickas bara till den angivna Homeys lokala HTTPS-adress. CSP begränsar anslutningar till `*.homey.homeylocal.com`.
- API-data cachas aldrig av appens service worker.
- Inga larmsystem, dörrlås, kamerastreams eller robotgräsklipparkommandon ingår i v1.0.
- Appen har inte testats mot din Homey eller på en fysisk iOS-enhet. Kodkontroller är inte samma sak som ett lyckat integrationstest.

## Viktiga källor

- Homey API-nycklar: https://support.homey.app/hc/en-us/articles/8178797067292-Create-and-use-API-Keys-on-Homey-Pro
- Homey lokala HTTPS-adresser: https://support.homey.app/hc/en-us/articles/22924537226268-Set-up-Local-Users-on-Homey-Pro
- Apples instruktioner för webbappar: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
