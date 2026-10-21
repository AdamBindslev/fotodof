/**
 * dof-engine.js - Optisk præcisionsberegner for dybdeskarphed
 * Skabt til DOF Simulator af Fotografiske Signaler
 *
 * Fysiske formler baseret på geometrisk optik:
 * - Hyperfokal afstand: H = (f^2 / (N * c)) + f
 * - Nærgrænse: Dn = s * (H - f) / (H + s - 2f)
 * - Fjerneste grænse: Df = s * (H - f) / (H - s)  (eller ∞ hvis s >= H)
 * - Total DOF: Df - Dn
 * - Airy Disk diffraktion: d_Airy ≈ 2.44 * λ * N (λ = 550nm)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DofEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard sensor-formater med reelle fysiske mål og standard Zeiss CoC (d / 1500 - 1730)
  const SENSOR_PRESETS = {
    'medium_format': {
      id: 'medium_format',
      name: 'Mellemformat (44×33mm)',
      shortName: 'MF 44×33',
      width: 43.8,
      height: 32.9,
      cropFactor: 0.79,
      coc: 0.038, // mm
      description: 'Fujifilm GFX, Hasselblad X2D'
    },
    'full_frame': {
      id: 'full_frame',
      name: 'Full Frame / 35mm (36×24mm)',
      shortName: 'Full Frame [FX]',
      width: 36.0,
      height: 24.0,
      cropFactor: 1.0,
      coc: 0.029, // mm (eller 0.030)
      description: 'Sony A7/A9, Canon R5/R6, Nikon Z, Leica M/SL'
    },
    'apsc_sony_nikon_fuji': {
      id: 'apsc_sony_nikon_fuji',
      name: 'APS-C 1.5× (Sony, Nikon, Fuji)',
      shortName: 'APS-C 1.5× [DX]',
      width: 23.5,
      height: 15.6,
      cropFactor: 1.53,
      coc: 0.019, // mm
      description: 'Fujifilm X-T, Sony A6700, Nikon Z50'
    },
    'apsc_canon': {
      id: 'apsc_canon',
      name: 'APS-C Canon 1.6× (Canon EOS R/D)',
      shortName: 'APS-C Canon 1.6×',
      width: 22.2,
      height: 14.8,
      cropFactor: 1.62,
      coc: 0.018, // mm
      description: 'Canon EOS R7, R10, R50, 90D'
    },
    'mft': {
      id: 'mft',
      name: 'Micro Four Thirds (MFT 2.0×)',
      shortName: 'Micro 4/3 [2.0×]',
      width: 17.3,
      height: 13.0,
      cropFactor: 2.0,
      coc: 0.015, // mm
      description: 'OM System, Olympus OM-D, Panasonic Lumix G'
    },
    'one_inch': {
      id: 'one_inch',
      name: '1" Tomme (13.2×8.8mm)',
      shortName: '1" Type [2.7×]',
      width: 13.2,
      height: 8.8,
      cropFactor: 2.73,
      coc: 0.011, // mm
      description: 'Sony RX100, ZV-1, Canon G7X'
    },
    'phone_main': {
      id: 'phone_main',
      name: 'Smartphone Stor Sensor (1/1.3")',
      shortName: 'Mobil 1/1.3"',
      width: 9.6,
      height: 7.2,
      cropFactor: 3.6,
      coc: 0.008, // mm
      description: 'iPhone 15/16 Pro, Samsung S24 Ultra, Pixel 8/9'
    },
    'phone_small': {
      id: 'phone_small',
      name: 'Smartphone Standard (1/2.55")',
      shortName: 'Mobil 1/2.5"',
      width: 5.76,
      height: 4.29,
      cropFactor: 6.0,
      coc: 0.005, // mm
      description: 'Standard ultravidvinkel & ældre smartphones'
    }
  };

  /**
   * Beregner alle optiske DOF-parametre
   *
   * @param {Object} params
   * @param {number} params.focalLength - Brændvidde i millimeter (f.eks. 50)
   * @param {number} params.aperture - Blændetal / f-stop (f.eks. 2.8)
   * @param {number} params.distance - Afstand til motiv i meter (f.eks. 2.5)
   * @param {string|number} params.sensor - Sensor-nøgle eller brugerdefineret CoC i mm
   * @param {number} [params.customCoc] - Valgfri brugerdefineret spredningscirkel i mm
   * @returns {Object} Resultat med alle beregnede værdier
   */
  function calculateDOF(params) {
    const focalLengthMm = Math.max(1, Number(params.focalLength) || 50);
    const aperture = Math.max(0.5, Number(params.aperture) || 2.8);
    const distanceM = Math.max(0.05, Number(params.distance) || 2.0);

    let sensorInfo = SENSOR_PRESETS[params.sensor] || SENSOR_PRESETS['full_frame'];
    let cocMm = params.customCoc ? Number(params.customCoc) : sensorInfo.coc;
    if (!cocMm || cocMm <= 0) cocMm = 0.029;

    // Omregning til meter for præcis intern formelberegning
    const f = focalLengthMm / 1000.0;
    const c = cocMm / 1000.0;
    const N = aperture;
    const s = distanceM;

    // 1. Hyperfokaldistance H (i meter)
    // Eksakt formel: H = (f^2 / (N * c)) + f
    const hyperfocalM = ((f * f) / (N * c)) + f;

    // 2. Nærgrænse Dn (i meter)
    // Dn = s * (H - f) / (H + s - 2f)
    let nearLimitM = 0;
    const nearNumerator = s * (hyperfocalM - f);
    const nearDenominator = hyperfocalM + s - (2 * f);

    if (nearDenominator > 0) {
      nearLimitM = nearNumerator / nearDenominator;
    } else {
      nearLimitM = 0;
    }
    nearLimitM = Math.max(0.01, nearLimitM);

    // 3. Fjerneste grænse Df (i meter)
    // Df = s * (H - f) / (H - s)  når s < H
    let farLimitM = Infinity;
    const isInfinity = (s >= hyperfocalM);

    if (!isInfinity) {
      const farDenominator = hyperfocalM - s;
      if (farDenominator > 0.000001) {
        farLimitM = (s * (hyperfocalM - f)) / farDenominator;
        // Sikkerhedssanering hvis Df bliver ekstremt stort
        if (farLimitM > 100000 || farLimitM <= 0) {
          farLimitM = Infinity;
        }
      } else {
        farLimitM = Infinity;
      }
    }

    // 4. Total Dybdeskarphed (Total DOF)
    let totalDofM = Infinity;
    if (farLimitM !== Infinity) {
      totalDofM = Math.max(0, farLimitM - nearLimitM);
    }

    // 5. Fordeling foran og bag motiv
    const depthInFrontM = Math.max(0, s - nearLimitM);
    let depthBehindM = Infinity;
    let frontPercent = 50;
    let rearPercent = 50;

    if (farLimitM !== Infinity) {
      depthBehindM = Math.max(0, farLimitM - s);
      if (totalDofM > 0) {
        frontPercent = (depthInFrontM / totalDofM) * 100.0;
        rearPercent = (depthBehindM / totalDofM) * 100.0;
      }
    } else {
      frontPercent = 0; // Uendelig bagud
      rearPercent = 100;
    }

    // 6. Forstørrelsesgrad (Magnification ratio m)
    let magnification = 0;
    if (s > f) {
      magnification = f / (s - f);
    }

    // 7. Fysisk indgangspupil diameter D = f / N (mm)
    const pupilDiameterMm = focalLengthMm / aperture;

    // 8. 35mm Ækvivalenter (FoV & Dof)
    const equivFocalLength = Math.round(focalLengthMm * sensorInfo.cropFactor);
    const equivAperture = +(aperture * sensorInfo.cropFactor).toFixed(1);

    // 9. Diffraktion & Airy Disk (λ = 550nm)
    // d_Airy = 2.44 * 0.55µm * N ≈ 1.342 * N µm
    const airyDiskUm = 1.342 * aperture;
    const cocUm = cocMm * 1000.0;
    const isDiffractionLimited = airyDiskUm > cocUm;
    let diffractionStatus = {
      level: 'optimal', // 'optimal' | 'mild' | 'noticeable'
      label: 'Optimal skarphed',
      badgeClass: 'badge-success',
      desc: 'Blænden er i det ideelle optiske område uden synlig diffraktionsuskarphed.'
    };

    if (aperture >= 16) {
      diffractionStatus = {
        level: 'noticeable',
        label: 'Mærkbar diffraktion',
        badgeClass: 'badge-danger',
        desc: 'Diffraktion gennem den lille blændeåbning spreder lyset og blødgør fine detaljer.'
      };
    } else if (aperture >= 11 || isDiffractionLimited) {
      diffractionStatus = {
        level: 'mild',
        label: 'Begyndende diffraktion',
        badgeClass: 'badge-warning',
        desc: 'Diffraktion kan anes ved 100% zoom på højtopløste sensorer.'
      };
    }

    // 10. Baggrundsslørings-indikator (Bokeh på uendelig baggrund)
    // Sløringscirkel på sensoren for motiv i uendelig afstand: b_inf = f^2 / (N * s)
    const blurAtInfinityMm = (focalLengthMm * focalLengthMm) / (1000.0 * aperture * s);
    const blurToCocRatio = blurAtInfinityMm / cocMm;

    let bokehQuality = {
      rating: 'medium',
      label: 'Klassisk Bokeh',
      desc: 'Behagelig separation mellem motiv og baggrund.'
    };
    if (blurToCocRatio < 1.0) {
      bokehQuality = {
        rating: 'sharp',
        label: 'Skarp baggrund',
        desc: 'Baggrunden bevarer fuld genkendelighed og skarphed.'
      };
    } else if (blurToCocRatio < 4.0) {
      bokehQuality = {
        rating: 'subtle',
        label: 'Let sløring',
        desc: 'Baggrunden er let dæmpet, men kontekst kan tydeligt ses.'
      };
    } else if (blurToCocRatio >= 15.0) {
      bokehQuality = {
        rating: 'creamy',
        label: 'Fløjlsblød "Creamy" Bokeh',
        desc: 'Baggrunden smelter fuldstændigt sammen til ren, blød bokeh.'
      };
    }

    return {
      focalLengthMm,
      aperture,
      distanceM,
      sensor: sensorInfo,
      cocMm,
      hyperfocalM,
      nearLimitM,
      farLimitM,
      totalDofM,
      isInfinity,
      depthInFrontM,
      depthBehindM,
      frontPercent: Math.min(100, Math.max(0, frontPercent)),
      rearPercent: Math.min(100, Math.max(0, rearPercent)),
      magnification,
      pupilDiameterMm,
      equivFocalLength,
      equivAperture,
      diffractionStatus,
      airyDiskUm,
      bokehQuality,
      blurToCocRatio
    };
  }

  /**
   * Formaterer en afstand pænt på dansk (mm, cm eller m)
   *
   * @param {number} meters - Afstand i meter
   * @param {boolean} [includeUnit=true]
   * @returns {string} F.eks. "14,2 cm", "2,45 m" eller "∞ (Uendelig)"
   */
  function formatDistance(meters, includeUnit = true) {
    if (meters === Infinity || meters >= 99999) {
      return includeUnit ? '∞ (Uendelig)' : '∞';
    }
    if (meters < 0.001) {
      return (meters * 1000).toFixed(1).replace('.', ',') + (includeUnit ? ' mm' : '');
    }
    if (meters < 0.10) {
      // Mindre end 10 cm -> vis i millimeter eller cm
      return (meters * 100).toFixed(1).replace('.', ',') + (includeUnit ? ' cm' : '');
    }
    if (meters < 1.0) {
      // 10 cm til 1 m -> vis i cm
      return (meters * 100).toFixed(1).replace('.', ',') + (includeUnit ? ' cm' : '');
    }
    if (meters < 10.0) {
      // 1 m til 10 m -> vis 2 decimaler
      return meters.toFixed(2).replace('.', ',') + (includeUnit ? ' m' : '');
    }
    if (meters < 100.0) {
      // 10 m til 100 m -> vis 1 decimal
      return meters.toFixed(1).replace('.', ',') + (includeUnit ? ' m' : '');
    }
    // Over 100 m -> afrund til hel meter
    return Math.round(meters).toString() + (includeUnit ? ' m' : '');
  }

  /**
   * Beregner sløringscirkel i millimeter for et objekt i en given afstand dPlane
   * når objektivet er fokuseret på s
   */
  function calculateBlurCircleAtDistance(dPlaneM, focusDistM, focalLengthMm, aperture) {
    if (dPlaneM <= 0 || focusDistM <= 0) return 0;
    const f = focalLengthMm / 1000.0;
    const N = aperture;
    const s = focusDistM;
    const d = dPlaneM;

    // Standard optisk CoC formel for vilkårlig afstand d:
    // c_d = | (f^2 / (N * (s - f))) * ((d - s) / d) |
    if (d === s) return 0;
    const denominator = N * (s - f) * d;
    if (Math.abs(denominator) < 0.000001) return 0;

    const blurM = Math.abs((f * f * (d - s)) / denominator);
    return blurM * 1000.0; // i millimeter på sensoren
  }

  return {
    SENSOR_PRESETS,
    calculateDOF,
    formatDistance,
    calculateBlurCircleAtDistance
  };
}));
