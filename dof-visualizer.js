/**
 * dof-visualizer.js - Grafisk repræsentation af dybdeskarphed
 * Skabt til DOF Simulator af Fotografiske Signaler
 *
 * Indeholder to synkroniserede visninger:
 * 1. Optisk Målestok-diagram (Top-down optisk strålevej, nærgrænse, fjerneste grænse, fokuszone)
 * 2. Simuleret EVF Søger (Gennem søgeren med ægte optisk sløring, bokeh-cirkler og focus peaking)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DofVisualizer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Klasse til håndtering af de grafiske DOF-repræsentationer
   */
  class Visualizer {
    constructor(elements) {
      this.svgDiagram = elements.svgDiagram;
      this.evfContainer = elements.evfContainer;
      this.peakingEnabled = false;
      this.gridEnabled = true;

      this.currentData = null;
      this.initEvents();
    }

    initEvents() {
      // Touch/drag på diagrammet for direkte afstandsregulering
      if (this.svgDiagram) {
        let isDragging = false;

        const handlePointer = (e) => {
          if (!this.currentData || !this.onDistanceChangeCallback) return;
          const rect = this.svgDiagram.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
          const normalizedX = x / rect.width;

          // Konverter skærm-x tilbage til afstand via den adaptive skala
          const dist = this.xToDistance(normalizedX);
          if (dist > 0) {
            this.onDistanceChangeCallback(dist);
          }
        };

        this.svgDiagram.addEventListener('mousedown', (e) => {
          isDragging = true;
          handlePointer(e);
        });

        window.addEventListener('mousemove', (e) => {
          if (isDragging) handlePointer(e);
        });

        window.addEventListener('mouseup', () => {
          isDragging = false;
        });

        this.svgDiagram.addEventListener('touchstart', (e) => {
          isDragging = true;
          handlePointer(e);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (isDragging) handlePointer(e);
        }, { passive: true });

        window.addEventListener('touchend', () => {
          isDragging = false;
        });
      }
    }

    /**
     * Sæt callback til afstandsændring ved træk i diagrammet
     */
    onDistanceChange(callback) {
      this.onDistanceChangeCallback = callback;
    }

    /**
     * Skifter focus peaking til/fra
     */
    toggleFocusPeaking(state) {
      this.peakingEnabled = (state !== undefined) ? state : !this.peakingEnabled;
      if (this.evfContainer) {
        this.evfContainer.classList.toggle('peaking-active', this.peakingEnabled);
      }
      return this.peakingEnabled;
    }

    /**
     * Skifter 3x3 kompositionsgitter
     */
    toggleGrid(state) {
      this.gridEnabled = (state !== undefined) ? state : !this.gridEnabled;
      const grid = document.getElementById('evfGridOverlay');
      if (grid) {
        grid.style.display = this.gridEnabled ? 'block' : 'none';
      }
      return this.gridEnabled;
    }

    /**
     * Adaptiv ikke-lineær skaleringsfunktion
     * Gør det muligt at se både makro (cm) og landskab (m) tydeligt på samme diagram
     */
    getDisplayMaxDistance(s, H, Df) {
      if (Df === Infinity || Df > 100) {
        // Hvis uendelig, baser skalaen på H eller s
        return Math.max(s * 2.2, Math.min(H * 1.4, 60));
      }
      return Math.max(Df * 1.35, s * 1.5, 1.0);
    }

    distanceToX(dist, maxDist) {
      if (dist <= 0) return 0.08;
      // Dæmpet kvadratrodsskala for fantastisk balance mellem makro & tele
      const norm = Math.min(1.0, dist / maxDist);
      const curved = Math.pow(norm, 0.72);
      // Kortlæg fra 10% (kamera) til 95% (højre kant)
      return 0.10 + (curved * 0.85);
    }

    xToDistance(normalizedX) {
      const maxDist = this.lastMaxDist || 10;
      const t = Math.max(0, Math.min(1, (normalizedX - 0.10) / 0.85));
      const dist = Math.pow(t, 1 / 0.72) * maxDist;
      return Math.max(0.1, dist);
    }

    /**
     * Hovedopdateringsmetode til rendering
     */
    render(dofData) {
      this.currentData = dofData;
      this.renderOpticalDiagram(dofData);
      this.renderEvfViewfinder(dofData);
      this.renderIrisPreview(dofData);
    }

    /**
     * Tegner det top-down optiske diagram i SVG
     */
    renderOpticalDiagram(data) {
      if (!this.svgDiagram) return;

      const {
        focalLengthMm,
        aperture,
        distanceM,
        hyperfocalM,
        nearLimitM,
        farLimitM,
        totalDofM,
        isInfinity,
        sensor
      } = data;

      const maxDist = this.getDisplayMaxDistance(distanceM, hyperfocalM, farLimitM);
      this.lastMaxDist = maxDist;

      const width = 1000;
      const height = 240;
      const centerY = 115;

      const cameraX = 80;
      const subjX = this.distanceToX(distanceM, maxDist) * width;
      const nearX = Math.max(cameraX + 8, this.distanceToX(nearLimitM, maxDist) * width);
      const isFarInfinite = (farLimitM === Infinity || farLimitM > maxDist);
      const farX = isFarInfinite ? (width - 25) : (this.distanceToX(farLimitM, maxDist) * width);
      const hyperX = (hyperfocalM <= maxDist) ? (this.distanceToX(hyperfocalM, maxDist) * width) : null;

      // Generer målestoks-ticks
      const ticks = this.generateScaleTicks(maxDist);
      let ticksSvg = '';
      ticks.forEach(t => {
        const tx = this.distanceToX(t.val, maxDist) * width;
        ticksSvg += `
          <line x1="${tx}" y1="180" x2="${tx}" y2="192" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />
          <text x="${tx}" y="208" font-size="11" font-family="ui-monospace, monospace" fill="#94a3b8" text-anchor="middle">${t.label}</text>
        `;
      });

      // Lysstråle kegle (Field of view ray cone)
      const beamHalfHeight = 75;
      const raysSvg = `
        <polygon points="${cameraX},${centerY} ${width - 20},${centerY - beamHalfHeight} ${width - 20},${centerY + beamHalfHeight}" fill="url(#rayGrad)" opacity="0.45" />
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 20}" y2="${centerY - beamHalfHeight}" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1.2" stroke-dasharray="3 3"/>
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 20}" y2="${centerY + beamHalfHeight}" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1.2" stroke-dasharray="3 3"/>
        <!-- Optisk optisk centerlinie -->
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 15}" y2="${centerY}" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="2 4"/>
      `;

      // DOF Focus Zone (Det skarpe område)
      const dofWidth = Math.max(3, farX - nearX);
      const dofZoneSvg = `
        <defs>
          <linearGradient id="dofZoneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
            <stop offset="50%" stop-color="#10b981" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="${isFarInfinite ? '#38bdf8' : '#10b981'}" stop-opacity="${isFarInfinite ? '0.2' : '0.25'}"/>
          </linearGradient>
          <linearGradient id="rayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.04"/>
          </linearGradient>
        </defs>

        <!-- Uskarp forgrund skygge -->
        <rect x="${cameraX + 5}" y="35" width="${Math.max(0, nearX - cameraX - 5)}" height="135" fill="rgba(239, 68, 68, 0.06)" />

        <!-- Skarp DOF bælte -->
        <rect x="${nearX}" y="35" width="${dofWidth}" height="135" fill="url(#dofZoneGrad)" rx="3"/>
        <line x1="${nearX}" y1="35" x2="${nearX}" y2="170" stroke="#10b981" stroke-width="2.5" />
        <line x1="${farX}" y1="35" x2="${farX}" y2="170" stroke="${isFarInfinite ? '#38bdf8' : '#10b981'}" stroke-width="2.5" ${isFarInfinite ? 'stroke-dasharray="5 4"' : ''}/>

        ${isFarInfinite ? `
          <!-- Pil mod uendelig -->
          <polygon points="${width - 25},${centerY - 8} ${width - 12},${centerY} ${width - 25},${centerY + 8}" fill="#38bdf8" opacity="0.8"/>
        ` : ''}
      `;

      // Tekst og etiketter på diagram
      const dofLabelText = isInfinity ? 'DOF: ∞ (Uendelig)' : `DOF: ${DofEngine.formatDistance(totalDofM)}`;
      const dofMidX = nearX + (dofWidth / 2);

      const labelsSvg = `
        <!-- Nærgrænse label -->
        <g transform="translate(${nearX}, 28)">
          <rect x="-35" y="-18" width="70" height="20" rx="4" fill="#0f172a" stroke="#10b981" stroke-width="1.2" opacity="0.95"/>
          <text x="0" y="-4" font-size="10" font-weight="700" font-family="ui-monospace, monospace" fill="#10b981" text-anchor="middle">
            Dn: ${DofEngine.formatDistance(nearLimitM)}
          </text>
        </g>

        <!-- Motiv markør og label -->
        <g transform="translate(${subjX}, ${centerY})">
          <!-- Lodret motivlinie -->
          <line x1="0" y1="-80" x2="0" y2="60" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="4 2"/>
          <!-- Motiv ikon / trådkors -->
          <circle cx="0" cy="0" r="14" fill="#1e293b" stroke="#f59e0b" stroke-width="2.5"/>
          <circle cx="0" cy="0" r="4" fill="#f59e0b"/>
          <line x1="-18" y1="0" x2="18" y2="0" stroke="#f59e0b" stroke-width="1.5"/>
          <line x1="0" y1="-18" x2="0" y2="18" stroke="#f59e0b" stroke-width="1.5"/>
          
          <!-- Motiv afstandsbadge -->
          <rect x="-42" y="-105" width="84" height="22" rx="5" fill="#f59e0b" />
          <text x="0" y="-90" font-size="11" font-weight="800" font-family="-apple-system, sans-serif" fill="#07080a" text-anchor="middle">
            MOTIV ${DofEngine.formatDistance(distanceM)}
          </text>
        </g>

        <!-- Fjerneste grænse label -->
        <g transform="translate(${farX}, 28)">
          <rect x="-36" y="-18" width="72" height="20" rx="4" fill="#0f172a" stroke="${isFarInfinite ? '#38bdf8' : '#10b981'}" stroke-width="1.2" opacity="0.95"/>
          <text x="0" y="-4" font-size="10" font-weight="700" font-family="ui-monospace, monospace" fill="${isFarInfinite ? '#38bdf8' : '#10b981'}" text-anchor="middle">
            Df: ${isFarInfinite ? '∞' : DofEngine.formatDistance(farLimitM)}
          </text>
        </g>

        <!-- DOF bredde badge i toppen af zonen -->
        ${dofWidth > 55 ? `
          <g transform="translate(${dofMidX}, 65)">
            <rect x="-50" y="-12" width="100" height="22" rx="11" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="1.2"/>
            <text x="0" y="3" font-size="11" font-weight="800" font-family="-apple-system, sans-serif" fill="#10b981" text-anchor="middle">${dofLabelText}</text>
          </g>
        ` : ''}

        <!-- Hyperfokal indikator -->
        ${hyperX ? `
          <g transform="translate(${hyperX}, 168)">
            <polygon points="0,0 -5,8 5,8" fill="#38bdf8"/>
            <text x="0" y="20" font-size="9" font-family="ui-monospace, monospace" fill="#38bdf8" text-anchor="middle" font-weight="700">H: ${DofEngine.formatDistance(hyperfocalM)}</text>
          </g>
        ` : ''}
      `;

      // Kamera ikon
      const cameraSvg = `
        <g transform="translate(18, ${centerY - 32})">
          <!-- Hus -->
          <rect x="0" y="10" width="48" height="44" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1.8"/>
          <rect x="14" y="3" width="20" height="8" rx="2" fill="#334155"/>
          <circle cx="24" cy="32" r="14" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
          <!-- Objektivstuds -->
          <rect x="46" y="20" width="16" height="24" rx="2" fill="#334155" stroke="#64748b" stroke-width="1.2"/>
          <!-- Sensorlinie rød/hvid -->
          <line x1="24" y1="14" x2="24" y2="50" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
          <text x="24" y="68" font-size="9" font-family="-apple-system, sans-serif" fill="#94a3b8" text-anchor="middle" font-weight="600">0 m</text>
        </g>
      `;

      // Målestok bundlinie
      const baselineSvg = `
        <line x1="${cameraX}" y1="180" x2="${width - 15}" y2="180" stroke="rgba(255,255,255,0.3)" stroke-width="1.8"/>
      `;

      this.svgDiagram.innerHTML = `
        <rect width="100%" height="100%" fill="#070a0f" rx="10"/>
        ${raysSvg}
        ${dofZoneSvg}
        ${baselineSvg}
        ${ticksSvg}
        ${labelsSvg}
        ${cameraSvg}
      `;
    }

    /**
     * Genererer fornuftige intervaller på målestokken
     */
    generateScaleTicks(maxDist) {
      const ticks = [];
      if (maxDist <= 1.0) {
        // Makro: 10cm, 25cm, 50cm, 75cm, 1m
        [0.1, 0.25, 0.5, 0.75, 1.0].forEach(v => {
          if (v <= maxDist * 1.05) ticks.push({ val: v, label: (v * 100).toFixed(0) + ' cm' });
        });
      } else if (maxDist <= 5.0) {
        // Nærportræt: 0.5m, 1m, 2m, 3m, 4m, 5m
        [0.5, 1.0, 2.0, 3.0, 4.0, 5.0].forEach(v => {
          if (v <= maxDist * 1.05) ticks.push({ val: v, label: v + ' m' });
        });
      } else if (maxDist <= 20.0) {
        [1.0, 3.0, 5.0, 10.0, 15.0, 20.0].forEach(v => {
          if (v <= maxDist * 1.05) ticks.push({ val: v, label: v + ' m' });
        });
      } else if (maxDist <= 60.0) {
        [2.0, 5.0, 10.0, 20.0, 40.0, 60.0].forEach(v => {
          if (v <= maxDist * 1.05) ticks.push({ val: v, label: v + ' m' });
        });
      } else {
        [5.0, 15.0, 30.0, 60.0, 100.0].forEach(v => {
          if (v <= maxDist * 1.05) ticks.push({ val: v, label: v + ' m' });
        });
      }
      return ticks;
    }

    /**
     * Renderer den simulerede EVF søger med realistisk dybdeskarphed
     */
    renderEvfViewfinder(data) {
      if (!this.evfContainer) return;

      const {
        focalLengthMm,
        aperture,
        distanceM,
        nearLimitM,
        farLimitM,
        blurToCocRatio,
        bokehQuality
      } = data;

      // 1. Beregn fysisk sløringscirkel for de tre planer:
      // - Forgrund (ca. 45% af motivafstanden)
      const fgDist = Math.max(0.15, distanceM * 0.45);
      const fgBlurMm = DofEngine.calculateBlurCircleAtDistance(fgDist, distanceM, focalLengthMm, aperture);

      // - Motiv (i skarp fokus)
      const subjBlurMm = 0;

      // - Baggrund (ca. 3.5x motivafstanden op til uendelig)
      const bgDist = Math.max(15, distanceM * 4.0);
      const bgBlurMm = DofEngine.calculateBlurCircleAtDistance(bgDist, distanceM, focalLengthMm, aperture);

      // Skaler millimeter CoC til CSS pixel blur (1mm blur ≈ 40-60px i søgeren)
      const pxScale = 38.0;
      const fgBlurPx = Math.min(30, (fgBlurMm * pxScale)).toFixed(1);
      const bgBlurPx = Math.min(32, (bgBlurMm * pxScale)).toFixed(1);

      // Opdater DOM-elementerne i EVF søgeren
      const fgElem = document.getElementById('evfLayerForeground');
      const subjElem = document.getElementById('evfLayerSubject');
      const bgElem = document.getElementById('evfLayerBackground');
      const bokehBallsWrap = document.getElementById('evfBokehOverlay');
      const peakingGlow = document.getElementById('evfPeakingSubject');

      if (fgElem) {
        fgElem.style.filter = `blur(${fgBlurPx}px)`;
        fgElem.style.opacity = fgBlurPx > 15 ? '0.6' : '0.9';
      }

      if (bgElem) {
        bgElem.style.filter = `blur(${bgBlurPx}px)`;
      }

      // Motivet er skarpt fokuseret
      if (subjElem) {
        // Hvis motivet er indenfor rimelig afstand
        subjElem.style.filter = 'blur(0px)';
      }

      // Peaking highlighter motivet hvis slået til
      if (peakingGlow) {
        peakingGlow.style.opacity = this.peakingEnabled ? '0.85' : '0';
      }

      // Render realistiske lysende bokeh-bolde hvis baggrunden har høj sløring
      if (bokehBallsWrap) {
        const bokehCount = Math.min(18, Math.floor(blurToCocRatio * 0.9));
        if (bokehCount >= 3) {
          bokehBallsWrap.style.display = 'block';
          const ballSize = Math.max(18, Math.min(65, bgBlurMm * 80));
          this.renderBokehBalls(bokehBallsWrap, bokehCount, ballSize);
        } else {
          bokehBallsWrap.style.display = 'none';
          bokehBallsWrap.innerHTML = '';
        }
      }

      // Opdater EVF OSD (On-Screen Display) telemetry
      const osdShutter = document.getElementById('evfOsdShutter');
      const osdAperture = document.getElementById('evfOsdAperture');
      const osdIso = document.getElementById('evfOsdIso');
      const osdDist = document.getElementById('evfOsdDist');
      const osdFocal = document.getElementById('evfOsdFocal');
      const osdBokehLabel = document.getElementById('evfBokehQualityLabel');

      if (osdAperture) osdAperture.textContent = `f/${aperture.toFixed(1).replace('.0', '')}`;
      if (osdDist) osdDist.textContent = DofEngine.formatDistance(distanceM);
      if (osdFocal) osdFocal.textContent = `${focalLengthMm}mm`;
      if (osdBokehLabel) osdBokehLabel.textContent = bokehQuality.label;

      // Anslå realistisk lukkertid ved ISO 100 dagslys
      if (osdShutter) {
        const estSec = (aperture * aperture) / 100.0;
        let shutterText = '1/500s';
        if (estSec < 0.0005) shutterText = '1/4000s';
        else if (estSec < 0.001) shutterText = '1/2000s';
        else if (estSec < 0.002) shutterText = '1/1000s';
        else if (estSec < 0.004) shutterText = '1/500s';
        else if (estSec < 0.008) shutterText = '1/250s';
        else if (estSec < 0.016) shutterText = '1/125s';
        else if (estSec < 0.033) shutterText = '1/60s';
        else shutterText = '1/30s';
        osdShutter.textContent = shutterText;
      }
    }

    /**
     * Tegner lysende cirkulære bokeh-bobler på baggrunden
     */
    renderBokehBalls(container, count, size) {
      if (!this.cachedBokehPositions || this.cachedBokehPositions.length !== count) {
        this.cachedBokehPositions = [];
        for (let i = 0; i < count; i++) {
          this.cachedBokehPositions.push({
            x: 10 + (Math.sin(i * 1.9) * 0.5 + 0.5) * 80,
            y: 8 + (Math.cos(i * 2.3) * 0.5 + 0.5) * 55,
            scale: 0.6 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.8,
            color: ['#fbbf24', '#f59e0b', '#38bdf8', '#e2e8f0', '#ffffff'][i % 5]
          });
        }
      }

      let html = '';
      this.cachedBokehPositions.forEach(b => {
        const s = size * b.scale;
        html += `
          <div class="bokeh-ball" style="
            left: ${b.x}%;
            top: ${b.y}%;
            width: ${s}px;
            height: ${s}px;
            border-color: ${b.color};
            box-shadow: 0 0 ${s * 0.4}px ${b.color};
          "></div>
        `;
      });
      container.innerHTML = html;
    }

    /**
     * Viser blændeåbningen (fysisk iris) grafisk
     */
    renderIrisPreview(data) {
      const irisSvg = document.getElementById('apertureIrisSvg');
      if (!irisSvg) return;

      const { aperture, pupilDiameterMm } = data;
      // Normaliser åbning (f/1.2 er ca 90% af cirklen, f/32 er ca 6%)
      const maxOpening = 48; // radius i svg
      const minOpening = 4;
      // Logaritmisk åbningsradius
      const norm = Math.max(0.04, Math.min(1.0, 1.4 / aperture));
      const radius = minOpening + (Math.sqrt(norm) * (maxOpening - minOpening));

      const pupilText = document.getElementById('aperturePupilDiameter');
      if (pupilText) {
        pupilText.textContent = `${pupilDiameterMm.toFixed(1).replace('.', ',')} mm`;
      }

      irisSvg.innerHTML = `
        <!-- Ydre objektivring -->
        <circle cx="55" cy="55" r="50" fill="#0f172a" stroke="#334155" stroke-width="2.5"/>
        <circle cx="55" cy="55" r="47" fill="#070a0f" stroke="#1e293b" stroke-width="1.5"/>
        
        <!-- Blændelameller mørk baggrund -->
        <circle cx="55" cy="55" r="46" fill="#151d2f" opacity="0.95"/>
        
        <!-- Lys gennem blændeåbning -->
        <circle cx="55" cy="55" r="${radius}" fill="#fbbf24" opacity="0.85" filter="drop-shadow(0 0 6px #f59e0b)"/>
        <polygon points="${this.getAperturePolygonPoints(55, 55, radius, 8)}" fill="#ffffff" opacity="0.9"/>
      `;
    }

    getAperturePolygonPoints(cx, cy, r, blades) {
      const pts = [];
      for (let i = 0; i < blades; i++) {
        const angle = (i * 2 * Math.PI) / blades;
        const x = cx + (r * Math.cos(angle));
        const y = cy + (r * Math.sin(angle));
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(' ');
    }
  }

  return Visualizer;
}));
