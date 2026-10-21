# DOF Simulator – af Fotografiske Signaler 📸✨

En lynhurtig, professionel og mobil-optimeret **Progressive Web App (PWA)** skabt til fotografer, der ønsker at beregne, visualisere og mestre **dybdeskarphed (DOF)**, **hyperfokal afstand**, **bokeh** og **diffraktionsgrænser** i felten.

Bygget i samme æstetiske **Kamera-EVF (Elektronisk Søger) feltværktøjs-stil** og branding som [FotoVejr](https://github.com/AdamBindslev/Fotovejr) fra [Fotografiske Signaler](https://fotografiskesignaler.dk).

---

## 🌟 Nøglefunktioner for fotografer

1. **📷 Valg af Sensorstørrelse & CoC (Circle of Confusion)**:
   - Fuld understøttelse af:
     - **Mellemformat 44×33mm** (Fujifilm GFX, Hasselblad – crop 0.79×, CoC 0.038 mm)
     - **Full Frame / 35mm** (Sony, Canon, Nikon, Leica – crop 1.0×, CoC 0.029 mm)
     - **APS-C 1.5×** (Fujifilm X, Sony E, Nikon DX – crop 1.53×, CoC 0.019 mm)
     - **APS-C Canon 1.6×** (Canon EOS R/D – crop 1.62×, CoC 0.018 mm)
     - **Micro Four Thirds [MFT 2.0×]** (OM System, Panasonic Lumix G – CoC 0.015 mm)
     - **1" Sensor [2.7×]** (Sony RX100, ZV-1 – CoC 0.011 mm)
     - **Smartphones** (1/1.3" sensorer på iPhone Pro & Galaxy Ultra samt 1/2.55" sensorer)

2. **🔍 Præcisionskontrol af Brændvidde & Blænde**:
   - **Brændvidde (10mm – 600mm)**: Hurtigtaster til klassiske brændvidder (16, 24, 35, 50, 85, 105, 135, 200, 400 mm) samt skyder og direkte mm-tastaturinput. Viser automatisk 35mm FoV-ækvivalent synsvinkel.
   - **Blænde (f/1.2 – f/32)**: Fuld- og tredjedels f-stop klynge samt animeret forhåndsvisning af objektivets faktiske fysiske blændeåbning og indgangspupildiameter ($D = f / N$).

3. **📏 Afstand & ⚡ Hyperfokal Hurtigtast**:
   - Afstandsstyring fra makronærgrænse (0,15 m) til landskab (50+ m).
   - Finjusteringstaster (`−` og `+`) til millimeterpræcis kontrol.
   - **⚡ Hyperfokal-knap**: Med ét tryk sættes fokusafstanden automatisk præcist til hyperfokaldistancen for den valgte brændvidde og blænde, hvilket maksimerer dybdeskarpheden helt ud til uendeligt.

4. **📐 To Synkroniserede Grafiske Repræsentationer**:
   - **1. Optisk Målestok-Diagram (Top-Down SVG)**:
     - Viser kamera, lyskegle, nærgrænse ($D_n$), motivplan ($s$), fjerneste grænse ($D_f$) og hyperfokalpunkt ($H$).
     - Dynamisk adaptiv målestok, som automatisk zoomer fra millimeter/centimeter (makro) til meter (landskab).
     - **Træk-funktion**: Tryk og træk direkte på målestokken for at justere afstanden interaktivt!
   - **2. Simuleret EVF Kamera-søger (Gennem Søgeren)**:
     - Realistisk 3-lags visning af forgrund, skarpt motiv og baggrund.
     - Beregner reel optisk sløring via geometrisk optik ($c_{\text{plane}}$).
     - Fysisk rendering af bløde lysende bokeh-bolde ved store blændeåbninger og tele.
     - **Focus Peaking**: Tryk på peaking-ikonet i EVF-topbaren for at fremhæve de knivskarpe konturer med neon-markering (ligesom på moderne spejlløse kameraer som Sony, Fuji, Nikon og Canon).
     - **3×3 Gitterlinjer**: Slå kompositionsgitteret til og fra med et enkelt tryk.

5. **🔬 Dybdegående Fotografiske Detaljer (Lag 2)**:
   - **Dybdefordeling**: Visuel fordelingsbjælke, der viser præcis fordeling foran og bagved motivet (f.eks. 33% / 67% ved portræt og 50% / 50% ved makro).
   - **Diffraktionsanalyse (Airy Disk)**: Sammenligner den optiske Airy-disk ($d_{\text{Airy}} \approx 2.44 \cdot \lambda \cdot N$) med sensorens spredningscirkel og advarer, hvis en lille blænde (f.eks. f/16 eller f/22) reducerer skarpheden.
   - **Forstørrelsesgrad ($m$)**: Nøjagtigt makroforhold (f.eks. 1:1, 1:4, 1:39).
   - **35mm DOF-ækvivalent**: Se f.eks. hvordan et 25mm f/1.4 objektiv på Micro Four Thirds svarer til et 50mm f/2.8 på Full Frame.

6. **🔴 Rød Astro Nattilstand (Red Night Mode)**:
   - Ét tryk på **ASTRO** forvandler interfacet til en krystalklar dybrød monokrom farvepalet, præcis som i FotoVejr.
   - Skåner fotografens rhodopsin og nattesyn under mørke natteoptagelser og astrofotografering.

7. **📱 PWA & 100% Offline i felten**:
   - Installeres direkte på telefonen som et app-ikon uden brug af App Store eller Google Play.
   - Service Worker (`sw.js`) cacher alle aktiver, så appen fungerer 100% pålideligt uden mobildækning ude i naturen.

---

## 📲 Sådan installeres appen på mobilen (PWA)

### iPhone / iPad (Safari)
1. Åbn websiden i **Safari**.
2. Tryk på **Del-knappen** (firkanten med pil op).
3. Rul ned og vælg **"Føj til hjemmeskærm"**.
4. Appen installeres med app-ikonet og åbner i fuld skærm uden browserbjælker.

### Android (Chrome)
1. Åbn websiden i **Chrome**.
2. Tryk på de **3 prikker** øverst til højre (eller tryk på banneret "Installer DOF Simulator").
3. Vælg **"Føj til startskærm"** eller **"Installer app"**.

---

## 🧮 Optiske Formler

Dybdeskarphedsberegningerne i DOF Simulator bygger på klassisk geometrisk optik:

- **Hyperfokal afstand ($H$)**:
  $$H = \frac{f^2}{N \cdot c} + f$$
- **Nærgrænse ($D_n$)**:
  $$D_n = \frac{s \cdot (H - f)}{H + s - 2f}$$
- **Fjerneste grænse ($D_f$)**:
  $$D_f = \begin{cases} \infty & \text{hvis } s \ge H \\ \frac{s \cdot (H - f)}{H - s} & \text{hvis } s < H \end{cases}$$
- **Airy Disk diameter ($d_{\text{Airy}}$)**:
  $$d_{\text{Airy}} \approx 2.44 \cdot \lambda \cdot N \quad (\lambda = 550\text{ nm})$$

Hvor:
- $f$ = objektivets brændvidde (m)
- $N$ = blændetal / f-stop
- $s$ = fokusafstand til motivet (m)
- $c$ = sensorens spredningscirkel (CoC, m)

---

## 🖤 Branding & Design

Designet og udviklet i stilen fra [Fotografiske Signaler](https://fotografiskesignaler.dk) og [FotoVejr](https://github.com/AdamBindslev/Fotovejr) af Adam Bindslev.
