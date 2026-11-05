# Homey Control – utan Mac (PWA) v1.0

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
3. Välj **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**.
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

Om detta blockeras krävs en **säker mellanserver** (t.ex. lokalt på en Raspberry Pi/Windows-server via en origin som tillåter anropen), eller att vi använder den **native iOS-appen med byggning/signering via en molntjänst och installation via TestFlight** (Apple Developer-konto krävs för TestFlight-distribution). Öppna inte Homeys API mot internet med port forwarding och lägg aldrig nyckeln direkt i publika filer.

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