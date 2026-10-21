/**
 * app.js - DOF Simulator for Fotografiske Signaler
 * Styrer tilstand, event listeners, kontroller, PWA og UI-opdateringer
 */

(function () {
  'use strict';

  // Standard fototilstand
  const state = {
    sensor: 'full_frame',
    focalLength: 50, // mm
    aperture: 2.8,   // f-stop
    distance: 2.0,   // meter
    activeTab: 'diagram', // 'diagram' | 'evf'
    nightMode: false,
    peaking: false,
    grid: true,
    customCoc: null
  };

  // Fotografiske presets / scenarier
  const PRESETS = [
    {
      id: 'portrait',
      name: '👤 Klassisk Portræt',
      sub: '85mm f/1.8 • FF • 2,0 m',
      params: { sensor: 'full_frame', focalLength: 85, aperture: 1.8, distance: 2.0 },
      desc: 'Klassisk portræt med perfekt baggrundsadskillelse og fokus på øjet.'
    },
    {
      id: 'landscape',
      name: '🏞️ Landskab (Hyperfokal)',
      sub: '24mm f/8 • FF • Hyperfokal',
      params: { sensor: 'full_frame', focalLength: 24, aperture: 8.0, distance: 'hyperfocal' },
      desc: 'Maksimal skarphed fra forgrundssten til fjerne bjergtinder.'
    },
    {
      id: 'macro',
      name: '🌿 Makro / Blomst',
      sub: '100mm f/2.8 • FF • 0,35 m',
      params: { sensor: 'full_frame', focalLength: 100, aperture: 2.8, distance: 0.35 },
      desc: 'Ekstremt smal dybdeskarphed (få millimeter) til insekter og detaljer.'
    },
    {
      id: 'street',
      name: '🏙️ Gadefoto / Zone',
      sub: '35mm f/5.6 • APS-C • 3,0 m',
      params: { sensor: 'apsc_sony_nikon_fuji', focalLength: 35, aperture: 5.6, distance: 3.0 },
      desc: 'Klassisk gadefotografi-zone: alt mellem ca. 2m og 6m holdes skarpt.'
    },
    {
      id: 'wildlife',
      name: '🦅 Fugle & Wildlife',
      sub: '400mm f/4 • FF • 15,0 m',
      params: { sensor: 'full_frame', focalLength: 400, aperture: 4.0, distance: 15.0 },
      desc: 'Teleobjektiv med smal dybdeskarphed der isolerer dyret fra baggrunden.'
    },
    {
      id: 'phone',
      name: '📱 Mobil Snapshot',
      sub: '24mm ækv. f/1.8 • 1/1.3" • 1,5 m',
      params: { sensor: 'phone_main', focalLength: 6.8, aperture: 1.8, distance: 1.5 },
      desc: 'Smartphones har pga. den korte fysiske brændvidde en enorm dybdeskarphed.'
    },
    {
      id: 'cinema',
      name: '🎬 Film / Cinematisk',
      sub: '50mm f/1.4 • FF • 2,5 m',
      params: { sensor: 'full_frame', focalLength: 50, aperture: 1.4, distance: 2.5 },
      desc: 'Bløde overgange og organisk bokeh til filmiske portrætter.'
    }
  ];

  let visualizer = null;
  let deferredPrompt = null;

  // DOM referencer
  const dom = {};

  function initDOM() {
    dom.sensorSelect = document.getElementById('sensorSelect');
    dom.sensorBadge = document.getElementById('sensorBadge');
    dom.sensorCocInfo = document.getElementById('sensorCocInfo');

    dom.focalSlider = document.getElementById('focalSlider');
    dom.focalInput = document.getElementById('focalInput');
    dom.focalDisplay = document.getElementById('focalDisplay');
    dom.focalEquiv = document.getElementById('focalEquiv');

    dom.apertureSlider = document.getElementById('apertureSlider');
    dom.apertureDisplay = document.getElementById('apertureDisplay');
    dom.apertureButtons = document.querySelectorAll('.f-stop-btn');

    dom.distanceSlider = document.getElementById('distanceSlider');
    dom.distanceInput = document.getElementById('distanceInput');
    dom.distanceDisplay = document.getElementById('distanceDisplay');
    dom.btnDistanceMinus = document.getElementById('btnDistMinus');
    dom.btnDistancePlus = document.getElementById('btnDistPlus');
    dom.btnSetHyperfocal = document.getElementById('btnSetHyperfocal');

    // Nøgletal
    dom.totalDofValue = document.getElementById('totalDofValue');
    dom.nearLimitValue = document.getElementById('nearLimitValue');
    dom.farLimitValue = document.getElementById('farLimitValue');
    dom.hyperfocalValue = document.getElementById('hyperfocalValue');

    // Dybde-fordeling
    dom.depthFrontVal = document.getElementById('depthFrontVal');
    dom.depthRearVal = document.getElementById('depthRearVal');
    dom.dofBarFront = document.getElementById('dofBarFront');
    dom.dofBarRear = document.getElementById('dofBarRear');
    dom.dofPercentFront = document.getElementById('dofPercentFront');
    dom.dofPercentRear = document.getElementById('dofPercentRear');

    // Dybde data
    dom.diffractionBadge = document.getElementById('diffractionBadge');
    dom.diffractionDesc = document.getElementById('diffractionDesc');
    dom.bokehBadge = document.getElementById('bokehBadge');
    dom.bokehDesc = document.getElementById('bokehDesc');
    dom.magnificationVal = document.getElementById('magnificationVal');
    dom.equiv35Val = document.getElementById('equiv35Val');

    // Presets
    dom.presetsBar = document.getElementById('presetsBar');

    // Topbar kontroller
    dom.btnNightMode = document.getElementById('btnNightMode');
    dom.btnReset = document.getElementById('btnReset');
    dom.btnGuide = document.getElementById('btnGuide');
    dom.btnPeaking = document.getElementById('btnPeaking');
    dom.btnGrid = document.getElementById('btnGrid');

    // Tab skifter
    dom.tabBtns = document.querySelectorAll('.vis-tab-btn');
    dom.visDiagramCard = document.getElementById('visDiagramCard');
    dom.visEvfCard = document.getElementById('visEvfCard');

    // Modaler & banners
    dom.guideModal = document.getElementById('guideModal');
    dom.btnCloseGuide = document.getElementById('btnCloseGuide');
    dom.pwaInstallBanner = document.getElementById('pwaInstallBanner');
    dom.btnPwaInstall = document.getElementById('btnPwaInstall');
    dom.btnPwaDismiss = document.getElementById('btnPwaDismiss');
  }

  /**
   * Initialisering
   */
  function init() {
    initDOM();
    initVisualizer();
    renderPresetsBar();
    initNightMode();
    bindEvents();
    initPwa();

    // Hent gemte værdier fra localStorage hvis tilgængelige
    loadSavedSettings();

    // Første beregning og rendering
    update();
  }

  function initVisualizer() {
    const svg = document.getElementById('dofSvgDiagram');
    const evf = document.getElementById('evfViewfinder');
    visualizer = new DofVisualizer({
      svgDiagram: svg,
      evfContainer: evf
    });

    visualizer.onDistanceChange((newDist) => {
      state.distance = parseFloat(newDist.toFixed(2));
      syncDistanceInputs();
      update();
    });
  }

  function renderPresetsBar() {
    if (!dom.presetsBar) return;
    let html = '';
    PRESETS.forEach(p => {
      html += `
        <button type="button" class="preset-chip" data-preset-id="${p.id}" title="${p.desc}">
          <span class="preset-chip-title">${p.name}</span>
          <span class="preset-chip-sub">${p.sub}</span>
        </button>
      `;
    });
    dom.presetsBar.innerHTML = html;

    dom.presetsBar.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.presetId);
      });
    });
  }

  function applyPreset(presetId) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    state.sensor = preset.params.sensor;
    state.focalLength = preset.params.focalLength;
    state.aperture = preset.params.aperture;

    if (preset.params.distance === 'hyperfocal') {
      // Beregn H først
      const tempRes = DofEngine.calculateDOF(state);
      state.distance = parseFloat(tempRes.hyperfocalM.toFixed(2));
    } else {
      state.distance = preset.params.distance;
    }

    // Fremhæv aktiv preset chip
    dom.presetsBar.querySelectorAll('.preset-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.presetId === presetId);
    });

    syncControls();
    update();
  }

  function initNightMode() {
    const saved = localStorage.getItem('fs_night_mode');
    if (saved === 'true') {
      state.nightMode = true;
      document.body.classList.add('theme-night-red');
      updateThemeColor('#080000');
    }
  }

  function toggleNightMode() {
    state.nightMode = !state.nightMode;
    document.body.classList.toggle('theme-night-red', state.nightMode);
    localStorage.setItem('fs_night_mode', state.nightMode ? 'true' : 'false');
    updateThemeColor(state.nightMode ? '#080000' : '#07080a');
  }

  function updateThemeColor(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
  }

  function bindEvents() {
    // Sensor valg
    if (dom.sensorSelect) {
      dom.sensorSelect.addEventListener('change', (e) => {
        state.sensor = e.target.value;
        update();
      });
    }

    // Brændvidde slider & input
    if (dom.focalSlider) {
      dom.focalSlider.addEventListener('input', (e) => {
        state.focalLength = Number(e.target.value);
        if (dom.focalInput) dom.focalInput.value = state.focalLength;
        update();
      });
    }

    if (dom.focalInput) {
      dom.focalInput.addEventListener('change', (e) => {
        let val = Math.max(8, Math.min(800, Number(e.target.value) || 50));
        state.focalLength = val;
        if (dom.focalSlider) dom.focalSlider.value = val;
        update();
      });
    }

    // Hurtigvalg af brændvidder
    document.querySelectorAll('.focal-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mm = Number(btn.dataset.focal);
        state.focalLength = mm;
        if (dom.focalSlider) dom.focalSlider.value = mm;
        if (dom.focalInput) dom.focalInput.value = mm;
        update();
      });
    });

    // Blænde slider
    if (dom.apertureSlider) {
      dom.apertureSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.aperture = val;
        updateApertureButtonsState();
        update();
      });
    }

    // Blænde knapper (f/1.4, f/2.8 osv)
    if (dom.apertureButtons) {
      dom.apertureButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const f = Number(btn.dataset.aperture);
          state.aperture = f;
          if (dom.apertureSlider) dom.apertureSlider.value = f;
          updateApertureButtonsState();
          update();
        });
      });
    }

    // Afstand slider (ikke-lineær)
    if (dom.distanceSlider) {
      dom.distanceSlider.addEventListener('input', (e) => {
        const sliderVal = Number(e.target.value);
        // Konverter slider (0-1000) til meter med kubisk/eksponentiel kurve
        state.distance = sliderToDistance(sliderVal);
        syncDistanceInputs(false);
        update();
      });
    }

    if (dom.distanceInput) {
      dom.distanceInput.addEventListener('change', (e) => {
        let val = Math.max(0.1, Math.min(200, parseFloat(e.target.value) || 2.0));
        state.distance = parseFloat(val.toFixed(2));
        syncDistanceInputs(true);
        update();
      });
    }

    // Justeringstaster -/+ for afstand
    if (dom.btnDistanceMinus) {
      dom.btnDistanceMinus.addEventListener('click', () => {
        const step = state.distance <= 1.0 ? 0.05 : (state.distance <= 5 ? 0.25 : 1.0);
        state.distance = Math.max(0.1, parseFloat((state.distance - step).toFixed(2)));
        syncDistanceInputs();
        update();
      });
    }

    if (dom.btnDistancePlus) {
      dom.btnDistancePlus.addEventListener('click', () => {
        const step = state.distance <= 1.0 ? 0.05 : (state.distance <= 5 ? 0.25 : 1.0);
        state.distance = parseFloat((state.distance + step).toFixed(2));
        syncDistanceInputs();
        update();
      });
    }

    // Sæt til hyperfokaldistance
    if (dom.btnSetHyperfocal) {
      dom.btnSetHyperfocal.addEventListener('click', () => {
        const calc = DofEngine.calculateDOF(state);
        state.distance = parseFloat(calc.hyperfocalM.toFixed(2));
        syncDistanceInputs();
        update();
      });
    }

    // Afstands hurtigknapper
    document.querySelectorAll('.dist-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.dist;
        if (val === 'hyperfocal') {
          const calc = DofEngine.calculateDOF(state);
          state.distance = parseFloat(calc.hyperfocalM.toFixed(2));
        } else {
          state.distance = parseFloat(val);
        }
        syncDistanceInputs();
        update();
      });
    });

    // Topbar knapper
    if (dom.btnNightMode) {
      dom.btnNightMode.addEventListener('click', toggleNightMode);
    }

    if (dom.btnReset) {
      dom.btnReset.addEventListener('click', () => {
        state.sensor = 'full_frame';
        state.focalLength = 50;
        state.aperture = 2.8;
        state.distance = 2.0;
        syncControls();
        update();
      });
    }

    if (dom.btnPeaking) {
      dom.btnPeaking.addEventListener('click', () => {
        const active = visualizer.toggleFocusPeaking();
        dom.btnPeaking.classList.toggle('active', active);
      });
    }

    if (dom.btnGrid) {
      dom.btnGrid.addEventListener('click', () => {
        const active = visualizer.toggleGrid();
        dom.btnGrid.classList.toggle('active', active);
      });
    }

    // Visualiserings-faner
    if (dom.tabBtns) {
      dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          state.activeTab = tab;
          dom.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
          if (dom.visDiagramCard) dom.visDiagramCard.classList.toggle('hidden', tab !== 'diagram');
          if (dom.visEvfCard) dom.visEvfCard.classList.toggle('hidden', tab !== 'evf');
        });
      });
    }

    // Guide modal
    if (dom.btnGuide) {
      dom.btnGuide.addEventListener('click', () => {
        if (dom.guideModal) dom.guideModal.classList.add('open');
      });
    }

    if (dom.btnCloseGuide) {
      dom.btnCloseGuide.addEventListener('click', () => {
        if (dom.guideModal) dom.guideModal.classList.remove('open');
      });
    }

    if (dom.guideModal) {
      dom.guideModal.addEventListener('click', (e) => {
        if (e.target === dom.guideModal) {
          dom.guideModal.classList.remove('open');
        }
      });
    }
  }

  /**
   * Konvertering for afstandsslider (0-1000) med behagelig dynamik
   */
  function sliderToDistance(val) {
    const t = val / 1000.0;
    // Kubisk kurve: t=0 -> 0.15m, t=0.5 -> 2.5m, t=1.0 -> 50m
    const dist = 0.15 + (Math.pow(t, 2.8) * 49.85);
    return parseFloat(dist.toFixed(dist < 1 ? 2 : (dist < 10 ? 2 : 1)));
  }

  function distanceToSlider(dist) {
    const d = Math.max(0.15, Math.min(50, dist));
    const t = Math.pow((d - 0.15) / 49.85, 1 / 2.8);
    return Math.round(t * 1000);
  }

  function syncDistanceInputs(syncSlider = true) {
    if (dom.distanceInput) {
      dom.distanceInput.value = state.distance;
    }
    if (syncSlider && dom.distanceSlider) {
      dom.distanceSlider.value = distanceToSlider(state.distance);
    }
    if (dom.distanceDisplay) {
      dom.distanceDisplay.textContent = DofEngine.formatDistance(state.distance);
    }
  }

  function syncControls() {
    if (dom.sensorSelect) dom.sensorSelect.value = state.sensor;
    if (dom.focalSlider) dom.focalSlider.value = state.focalLength;
    if (dom.focalInput) dom.focalInput.value = state.focalLength;
    if (dom.apertureSlider) dom.apertureSlider.value = state.aperture;
    syncDistanceInputs();
    updateApertureButtonsState();
    updateFocalButtonsState();
  }

  function updateApertureButtonsState() {
    if (!dom.apertureButtons) return;
    dom.apertureButtons.forEach(btn => {
      const f = Number(btn.dataset.aperture);
      btn.classList.toggle('active', Math.abs(f - state.aperture) < 0.05);
    });
  }

  function updateFocalButtonsState() {
    document.querySelectorAll('.focal-quick-btn').forEach(btn => {
      const mm = Number(btn.dataset.focal);
      btn.classList.toggle('active', Math.abs(mm - state.focalLength) < 1);
    });
  }

  /**
   * Hovedopdatering: beregner optik og opdaterer alle UI-elementer
   */
  function update() {
    // Kør de optiske beregninger
    const result = DofEngine.calculateDOF(state);

    // Opdater tekstindstillinger
    if (dom.focalDisplay) {
      dom.focalDisplay.textContent = `${result.focalLengthMm} mm`;
    }
    if (dom.focalEquiv) {
      dom.focalEquiv.textContent = `${result.equivFocalLength} mm (35mm ækv.)`;
    }
    if (dom.apertureDisplay) {
      dom.apertureDisplay.textContent = `f/${result.aperture.toFixed(1).replace('.0', '')}`;
    }
    if (dom.distanceDisplay) {
      dom.distanceDisplay.textContent = DofEngine.formatDistance(result.distanceM);
    }

    // Sensor badge & CoC
    if (dom.sensorBadge) {
      dom.sensorBadge.textContent = `${result.sensor.shortName} • CoC: ${result.cocMm}mm`;
    }

    // Nøgletal
    if (dom.totalDofValue) {
      dom.totalDofValue.textContent = result.isInfinity ? '∞ (Uendelig)' : DofEngine.formatDistance(result.totalDofM);
    }
    if (dom.nearLimitValue) {
      dom.nearLimitValue.textContent = DofEngine.formatDistance(result.nearLimitM);
    }
    if (dom.farLimitValue) {
      dom.farLimitValue.textContent = result.isInfinity ? '∞ (Uendelig)' : DofEngine.formatDistance(result.farLimitM);
    }
    if (dom.hyperfocalValue) {
      dom.hyperfocalValue.textContent = DofEngine.formatDistance(result.hyperfocalM);
    }

    // Fordeling foran & bagved
    if (dom.depthFrontVal) {
      dom.depthFrontVal.textContent = DofEngine.formatDistance(result.depthInFrontM);
    }
    if (dom.depthRearVal) {
      dom.depthRearVal.textContent = result.isInfinity ? '∞' : DofEngine.formatDistance(result.depthBehindM);
    }
    if (dom.dofBarFront) {
      dom.dofBarFront.style.width = `${result.frontPercent}%`;
    }
    if (dom.dofBarRear) {
      dom.dofBarRear.style.width = `${result.rearPercent}%`;
    }
    if (dom.dofPercentFront) {
      dom.dofPercentFront.textContent = result.isInfinity ? 'N/A' : `${Math.round(result.frontPercent)}% foran`;
    }
    if (dom.dofPercentRear) {
      dom.dofPercentRear.textContent = result.isInfinity ? '100% (uendelig)' : `${Math.round(result.rearPercent)}% bag`;
    }

    // Diffraktion
    if (dom.diffractionBadge) {
      dom.diffractionBadge.textContent = result.diffractionStatus.label;
      dom.diffractionBadge.className = `metric-badge ${result.diffractionStatus.badgeClass}`;
    }
    if (dom.diffractionDesc) {
      dom.diffractionDesc.textContent = `${result.diffractionStatus.desc} (Airy disk: ${result.airyDiskUm.toFixed(1)} µm vs sensor CoC: ${(result.cocMm * 1000).toFixed(0)} µm)`;
    }

    // Bokeh og sløring
    if (dom.bokehBadge) {
      dom.bokehBadge.textContent = result.bokehQuality.label;
    }
    if (dom.bokehDesc) {
      dom.bokehDesc.textContent = result.bokehQuality.desc;
    }

    // Forstørrelsesgrad & 35mm ækvivalens
    if (dom.magnificationVal) {
      if (result.magnification > 0.001) {
        const inv = (1 / result.magnification).toFixed(1);
        dom.magnificationVal.textContent = `1:${inv}`;
      } else {
        dom.magnificationVal.textContent = '< 1:100';
      }
    }
    if (dom.equiv35Val) {
      dom.equiv35Val.textContent = `${result.equivFocalLength}mm f/${result.equivAperture}`;
    }

    // Opdater grafiske visualiseringer
    if (visualizer) {
      visualizer.render(result);
    }

    // Gem i localStorage
    saveCurrentSettings();
  }

  function saveCurrentSettings() {
    try {
      localStorage.setItem('fs_dof_state', JSON.stringify({
        sensor: state.sensor,
        focalLength: state.focalLength,
        aperture: state.aperture,
        distance: state.distance
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }

  function loadSavedSettings() {
    try {
      const saved = localStorage.getItem('fs_dof_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sensor) state.sensor = parsed.sensor;
        if (parsed.focalLength) state.focalLength = Number(parsed.focalLength);
        if (parsed.aperture) state.aperture = Number(parsed.aperture);
        if (parsed.distance) state.distance = Number(parsed.distance);
        syncControls();
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * PWA Service Worker og installation
   */
  function initPwa() {
    // Registrer Service Worker for offline funktion
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('DOF Simulator PWA klar (offline mode)', reg.scope);
          })
          .catch((err) => {
            console.warn('Service worker fejl:', err);
          });
      });
    }

    // Opsnap PWA installationsprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (dom.pwaInstallBanner) {
        dom.pwaInstallBanner.style.display = 'flex';
      }
    });

    if (dom.btnPwaInstall) {
      dom.btnPwaInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('Brugeren installerede appen');
        }
        deferredPrompt = null;
        if (dom.pwaInstallBanner) dom.pwaInstallBanner.style.display = 'none';
      });
    }

    if (dom.btnPwaDismiss) {
      dom.btnPwaDismiss.addEventListener('click', () => {
        if (dom.pwaInstallBanner) dom.pwaInstallBanner.style.display = 'none';
      });
    }
  }

  // Kør når DOM er indlæst
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
