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
        return Math.max(s * 2.2, Math.min(H * 1.4, 60));
      }
      return Math.max(Df * 1.35, s * 1.5, 1.0);
    }

    distanceToX(dist, maxDist) {
      if (dist <= 0) return 0.08;
      const norm = Math.min(1.0, dist / maxDist);
      const curved = Math.pow(norm, 0.72);
      return 0.10 + (curved * 0.85);
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
     * Tegner det top-down optiske diagram i SVG (ren visualisering, optimeret højde 165px)
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
        isInfinity
      } = data;

      const maxDist = this.getDisplayMaxDistance(distanceM, hyperfocalM, farLimitM);
      this.lastMaxDist = maxDist;

      const width = 1000;
      const height = 165;
      const centerY = 72;
      const baselineY = 125;

      const cameraX = 75;
      const subjX = this.distanceToX(distanceM, maxDist) * width;
      const nearX = Math.max(cameraX + 8, this.distanceToX(nearLimitM, maxDist) * width);
      const isFarInfinite = (farLimitM === Infinity || farLimitM > maxDist);
      const farX = isFarInfinite ? (width - 20) : (this.distanceToX(farLimitM, maxDist) * width);
      const hyperX = (hyperfocalM <= maxDist) ? (this.distanceToX(hyperfocalM, maxDist) * width) : null;

      // Generer målestoks-ticks
      const ticks = this.generateScaleTicks(maxDist);
      let ticksSvg = '';
      ticks.forEach(t => {
        const tx = this.distanceToX(t.val, maxDist) * width;
        ticksSvg += `
          <line x1="${tx}" y1="${baselineY}" x2="${tx}" y2="${baselineY + 7}" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />
          <text x="${tx}" y="${baselineY + 20}" font-size="10.5" font-family="ui-monospace, monospace" fill="#94a3b8" text-anchor="middle">${t.label}</text>
        `;
      });

      // Lysstråle kegle
      const beamHalfHeight = 46;
      const raysSvg = `
        <polygon points="${cameraX},${centerY} ${width - 15},${centerY - beamHalfHeight} ${width - 15},${centerY + beamHalfHeight}" fill="url(#rayGrad)" opacity="0.4" />
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 15}" y2="${centerY - beamHalfHeight}" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1" stroke-dasharray="3 3"/>
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 15}" y2="${centerY + beamHalfHeight}" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1" stroke-dasharray="3 3"/>
        <line x1="${cameraX}" y1="${centerY}" x2="${width - 10}" y2="${centerY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2 4"/>
      `;

      // DOF Focus Zone
      const dofWidth = Math.max(3, farX - nearX);
      const dofZoneSvg = `
        <defs>
          <linearGradient id="dofZoneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
            <stop offset="50%" stop-color="#10b981" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="${isFarInfinite ? '#38bdf8' : '#10b981'}" stop-opacity="${isFarInfinite ? '0.2' : '0.25'}"/>
          </linearGradient>
          <linearGradient id="rayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.03"/>
          </linearGradient>
        </defs>

        <!-- Uskarp forgrund skygge -->
        <rect x="${cameraX + 5}" y="24" width="${Math.max(0, nearX - cameraX - 5)}" height="100" fill="rgba(239, 68, 68, 0.05)" />

        <!-- Skarp DOF bælte -->
        <rect x="${nearX}" y="24" width="${dofWidth}" height="100" fill="url(#dofZoneGrad)" rx="3"/>
        <line x1="${nearX}" y1="24" x2="${nearX}" y2="${baselineY}" stroke="#10b981" stroke-width="2.2" />
        <line x1="${farX}" y1="24" x2="${farX}" y2="${baselineY}" stroke="${isFarInfinite ? '#38bdf8' : '#10b981'}" stroke-width="2.2" ${isFarInfinite ? 'stroke-dasharray="5 3"' : ''}/>

        ${isFarInfinite ? `
          <polygon points="${width - 20},${centerY - 6} ${width - 8},${centerY} ${width - 20},${centerY + 6}" fill="#38bdf8" opacity="0.85"/>
        ` : ''}
      `;

      const dofLabelText = isInfinity ? 'DOF: ∞' : `DOF: ${DofEngine.formatDistance(totalDofM)}`;
      const dofMidX = nearX + (dofWidth / 2);

      const labelsSvg = `
        <!-- Nærgrænse label -->
        <g transform="translate(${nearX}, 20)">
          <rect x="-30" y="-15" width="60" height="17" rx="3" fill="#0f172a" stroke="#10b981" stroke-width="1.1" opacity="0.95"/>
          <text x="0" y="-3" font-size="9" font-weight="700" font-family="ui-monospace, monospace" fill="#10b981" text-anchor="middle">
            Dn: ${DofEngine.formatDistance(nearLimitM)}
          </text>
        </g>

        <!-- Motiv markør og label -->
        <g transform="translate(${subjX}, ${centerY})">
          <line x1="0" y1="-50" x2="0" y2="52" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 2"/>
          <circle cx="0" cy="0" r="11" fill="#1e293b" stroke="#f59e0b" stroke-width="2.2"/>
          <circle cx="0" cy="0" r="3.5" fill="#f59e0b"/>
          <line x1="-14" y1="0" x2="14" y2="0" stroke="#f59e0b" stroke-width="1.2"/>
          <line x1="0" y1="-14" x2="0" y2="14" stroke="#f59e0b" stroke-width="1.2"/>
          
          <rect x="-36" y="-68" width="72" height="18" rx="4" fill="#f59e0b" />
          <text x="0" y="-55" font-size="9.5" font-weight="800" font-family="-apple-system, sans-serif" fill="#07080a" text-anchor="middle">
            ${DofEngine.formatDistance(distanceM)}
          </text>
        </g>

        <!-- Fjerneste grænse label -->
        <g transform="translate(${farX}, 20)">
          <rect x="-30" y="-15" width="60" height="17" rx="3" fill="#0f172a" stroke="${isFarInfinite ? '#38bdf8' : '#10b981'}" stroke-width="1.1" opacity="0.95"/>
          <text x="0" y="-3" font-size="9" font-weight="700" font-family="ui-monospace, monospace" fill="${isFarInfinite ? '#38bdf8' : '#10b981'}" text-anchor="middle">
            Df: ${isFarInfinite ? '∞' : DofEngine.formatDistance(farLimitM)}
          </text>
        </g>

        <!-- DOF bredde badge -->
        ${dofWidth > 60 ? `
          <g transform="translate(${dofMidX}, 48)">
            <rect x="-42" y="-10" width="84" height="19" rx="9" fill="rgba(16, 185, 129, 0.22)" stroke="#10b981" stroke-width="1.1"/>
            <text x="0" y="3" font-size="10" font-weight="800" font-family="-apple-system, sans-serif" fill="#10b981" text-anchor="middle">${dofLabelText}</text>
          </g>
        ` : ''}

        <!-- Hyperfokal indikator -->
        ${hyperX ? `
          <g transform="translate(${hyperX}, ${baselineY - 2})">
            <polygon points="0,0 -4,7 4,7" fill="#38bdf8"/>
            <text x="0" y="16" font-size="8" font-family="ui-monospace, monospace" fill="#38bdf8" text-anchor="middle" font-weight="700">H: ${DofEngine.formatDistance(hyperfocalM)}</text>
          </g>
        ` : ''}
      `;

      // Kamera ikon
      const cameraSvg = `
        <g transform="translate(16, ${centerY - 22})">
          <rect x="0" y="6" width="38" height="34" rx="5" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
          <rect x="11" y="1" width="16" height="6" rx="2" fill="#334155"/>
          <circle cx="19" cy="23" r="10" fill="#0f172a" stroke="#64748b" stroke-width="1.3"/>
          <rect x="36" y="14" width="13" height="18" rx="2" fill="#334155" stroke="#64748b" stroke-width="1"/>
          <line x1="19" y1="9" x2="19" y2="37" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
          <text x="19" y="50" font-size="8.5" font-family="-apple-system, sans-serif" fill="#94a3b8" text-anchor="middle" font-weight="600">0 m</text>
        </g>
      `;

      // Målestok bundlinie
      const baselineSvg = `
        <line x1="${cameraX}" y1="${baselineY}" x2="${width - 15}" y2="${baselineY}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      `;

      this.svgDiagram.innerHTML = `
        <rect width="100%" height="100%" fill="#070a0f" rx="8"/>
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
