export interface BreedStandardPoint {
  week: number;
  targetG: number;
  minG?: number;
  maxG?: number;
}

export const HY_LINE_BROWN_HEN: BreedStandardPoint[] = [
  { week: 0, targetG: 40, minG: 36, maxG: 44 },
  { week: 4, targetG: 260, minG: 235, maxG: 285 },
  { week: 8, targetG: 660, minG: 595, maxG: 725 },
  { week: 12, targetG: 1050, minG: 945, maxG: 1155 },
  { week: 15, targetG: 1290, minG: 1160, maxG: 1420 },
  { week: 16, targetG: 1370, minG: 1235, maxG: 1505 },
  { week: 17, targetG: 1450, minG: 1305, maxG: 1595 },
  { week: 18, targetG: 1540, minG: 1385, maxG: 1695 },
  { week: 20, targetG: 1680, minG: 1510, maxG: 1850 },
  { week: 24, targetG: 1820, minG: 1640, maxG: 2000 },
  { week: 26, targetG: 1860, minG: 1675, maxG: 2045 },
  { week: 30, targetG: 1920, minG: 1730, maxG: 2110 },
  { week: 40, targetG: 1960, minG: 1765, maxG: 2155 },
  { week: 60, targetG: 1990, minG: 1790, maxG: 2190 },
  { week: 80, targetG: 2010, minG: 1810, maxG: 2210 },
  { week: 100, targetG: 2020, minG: 1820, maxG: 2220 },
];

export const ISA_BROWN_HEN: BreedStandardPoint[] = [
  { week: 0, targetG: 40, minG: 36, maxG: 44 },
  { week: 1, targetG: 60, minG: 54, maxG: 66 },
  { week: 2, targetG: 90, minG: 81, maxG: 99 },
  { week: 3, targetG: 130, minG: 117, maxG: 143 },
  { week: 4, targetG: 180, minG: 162, maxG: 198 },
  { week: 5, targetG: 240, minG: 216, maxG: 264 },
  { week: 6, targetG: 310, minG: 279, maxG: 341 },
  { week: 7, targetG: 390, minG: 351, maxG: 429 },
  { week: 8, targetG: 470, minG: 423, maxG: 517 },
  { week: 9, targetG: 550, minG: 495, maxG: 605 },
  { week: 10, targetG: 640, minG: 576, maxG: 704 },
  { week: 11, targetG: 730, minG: 657, maxG: 803 },
  { week: 12, targetG: 820, minG: 738, maxG: 902 },
  { week: 13, targetG: 910, minG: 819, maxG: 1001 },
  { week: 14, targetG: 1000, minG: 900, maxG: 1100 },
  { week: 15, targetG: 1090, minG: 981, maxG: 1199 },
  { week: 16, targetG: 1180, minG: 1062, maxG: 1298 },
  { week: 17, targetG: 1270, minG: 1143, maxG: 1397 },
  { week: 18, targetG: 1370, minG: 1233, maxG: 1507 },
  { week: 19, targetG: 1470, minG: 1323, maxG: 1617 },
  { week: 20, targetG: 1570, minG: 1413, maxG: 1727 },
  { week: 22, targetG: 1700, minG: 1530, maxG: 1870 },
  { week: 24, targetG: 1800, minG: 1620, maxG: 1980 },
  { week: 28, targetG: 1900, minG: 1710, maxG: 2090 },
  { week: 32, targetG: 1950, minG: 1755, maxG: 2145 },
  { week: 36, targetG: 2000, minG: 1800, maxG: 2200 },
  { week: 40, targetG: 2050, minG: 1845, maxG: 2255 },
  { week: 50, targetG: 2100, minG: 1890, maxG: 2310 },
  { week: 60, targetG: 2150, minG: 1935, maxG: 2365 },
  { week: 72, targetG: 2200, minG: 1980, maxG: 2420 },
  { week: 80, targetG: 2200, minG: 1980, maxG: 2420 },
];

export const HY_LINE_W36_HEN: BreedStandardPoint[] = [
  { week: 0, targetG: 38, minG: 34, maxG: 42 },
  { week: 2, targetG: 80, minG: 72, maxG: 88 },
  { week: 4, targetG: 155, minG: 140, maxG: 170 },
  { week: 6, targetG: 260, minG: 234, maxG: 286 },
  { week: 8, targetG: 390, minG: 351, maxG: 429 },
  { week: 10, targetG: 530, minG: 477, maxG: 583 },
  { week: 12, targetG: 680, minG: 612, maxG: 748 },
  { week: 14, targetG: 830, minG: 747, maxG: 913 },
  { week: 16, targetG: 970, minG: 873, maxG: 1067 },
  { week: 18, targetG: 1120, minG: 1008, maxG: 1232 },
  { week: 20, targetG: 1260, minG: 1134, maxG: 1386 },
  { week: 24, targetG: 1450, minG: 1305, maxG: 1595 },
  { week: 30, targetG: 1550, minG: 1395, maxG: 1705 },
  { week: 40, targetG: 1650, minG: 1485, maxG: 1815 },
  { week: 52, targetG: 1700, minG: 1530, maxG: 1870 },
  { week: 64, targetG: 1750, minG: 1575, maxG: 1925 },
  { week: 80, targetG: 1800, minG: 1620, maxG: 1980 },
];

export const COBB_500_MALE: BreedStandardPoint[] = [
  { week: 0, targetG: 42, minG: 38, maxG: 46 },
  { week: 1, targetG: 120, minG: 108, maxG: 132 },
  { week: 2, targetG: 260, minG: 234, maxG: 286 },
  { week: 3, targetG: 470, minG: 423, maxG: 517 },
  { week: 4, targetG: 750, minG: 675, maxG: 825 },
  { week: 5, targetG: 1100, minG: 990, maxG: 1210 },
  { week: 6, targetG: 1500, minG: 1350, maxG: 1650 },
  { week: 7, targetG: 1950, minG: 1755, maxG: 2145 },
  { week: 8, targetG: 2400, minG: 2160, maxG: 2640 },
];

export const COBB_500_FEMALE: BreedStandardPoint[] = [
  { week: 0, targetG: 40, minG: 36, maxG: 44 },
  { week: 1, targetG: 105, minG: 95, maxG: 116 },
  { week: 2, targetG: 220, minG: 198, maxG: 242 },
  { week: 3, targetG: 390, minG: 351, maxG: 429 },
  { week: 4, targetG: 610, minG: 549, maxG: 671 },
  { week: 5, targetG: 880, minG: 792, maxG: 968 },
  { week: 6, targetG: 1180, minG: 1062, maxG: 1298 },
  { week: 7, targetG: 1500, minG: 1350, maxG: 1650 },
  { week: 8, targetG: 1820, minG: 1638, maxG: 2002 },
];

export const ROSS_308_MALE: BreedStandardPoint[] = [
  { week: 0, targetG: 43, minG: 39, maxG: 47 },
  { week: 1, targetG: 185, minG: 167, maxG: 204 },
  { week: 2, targetG: 480, minG: 432, maxG: 528 },
  { week: 3, targetG: 960, minG: 864, maxG: 1056 },
  { week: 4, targetG: 1580, minG: 1422, maxG: 1738 },
  { week: 5, targetG: 2290, minG: 2061, maxG: 2519 },
  { week: 6, targetG: 2980, minG: 2682, maxG: 3278 },
  { week: 7, targetG: 3640, minG: 3276, maxG: 4004 },
];

export const ROSS_308_FEMALE: BreedStandardPoint[] = [
  { week: 0, targetG: 42, minG: 38, maxG: 46 },
  { week: 1, targetG: 175, minG: 158, maxG: 193 },
  { week: 2, targetG: 445, minG: 400, maxG: 490 },
  { week: 3, targetG: 860, minG: 774, maxG: 946 },
  { week: 4, targetG: 1380, minG: 1242, maxG: 1518 },
  { week: 5, targetG: 1960, minG: 1764, maxG: 2156 },
  { week: 6, targetG: 2530, minG: 2277, maxG: 2783 },
  { week: 7, targetG: 3060, minG: 2754, maxG: 3366 },
];

export const ROSS_308_MIXED: BreedStandardPoint[] = ROSS_308_MALE.map((m, idx) => {
  const f = ROSS_308_FEMALE[idx];
  return {
    week: m.week,
    targetG: Math.round((m.targetG + f.targetG) / 2),
    minG: f.minG,
    maxG: m.maxG,
  };
});

export const CUY_MEJORADO: BreedStandardPoint[] = [
  { week: 0, targetG: 120, minG: 95, maxG: 145 },
  { week: 1, targetG: 175, minG: 150, maxG: 200 },
  { week: 2, targetG: 240, minG: 210, maxG: 270 },
  { week: 3, targetG: 320, minG: 280, maxG: 360 },
  { week: 4, targetG: 410, minG: 360, maxG: 460 },
  { week: 6, targetG: 590, minG: 520, maxG: 660 },
  { week: 8, targetG: 770, minG: 690, maxG: 860 },
  { week: 10, targetG: 940, minG: 840, maxG: 1040 },
  { week: 12, targetG: 1060, minG: 950, maxG: 1180 },
  { week: 13, targetG: 1120, minG: 1000, maxG: 1250 },
];

export const CUY_CRIOLLO: BreedStandardPoint[] = [
  { week: 0, targetG: 95, minG: 80, maxG: 115 },
  { week: 2, targetG: 175, minG: 150, maxG: 205 },
  { week: 4, targetG: 290, minG: 255, maxG: 330 },
  { week: 6, targetG: 415, minG: 365, maxG: 465 },
  { week: 8, targetG: 540, minG: 480, maxG: 605 },
  { week: 10, targetG: 655, minG: 585, maxG: 730 },
  { week: 12, targetG: 750, minG: 675, maxG: 830 },
  { week: 14, targetG: 820, minG: 735, maxG: 910 },
  { week: 16, targetG: 870, minG: 780, maxG: 960 },
];

export const ALL_BREED_STANDARDS: Record<string, BreedStandardPoint[]> = {
  "ISA Brown_hembra": ISA_BROWN_HEN,
  "Hy-Line W-36_hembra": HY_LINE_W36_HEN,
  "Cobb 500_macho": COBB_500_MALE,
  "Cobb 500_hembra": COBB_500_FEMALE,
  "Ross 308_macho": ROSS_308_MALE,
  "Ross 308_hembra": ROSS_308_FEMALE,
  "Ross 308_mixto": ROSS_308_MIXED,
  "Cuy Mejorado_mixto": CUY_MEJORADO,
};


// ─── Codorniz Japónica (Coturnix coturnix japonica) ───
export const COTURNIX_JAPONICA: BreedStandardPoint[] = [
  { week: 0, targetG: 7, minG: 6, maxG: 8 },
  { week: 1, targetG: 25, minG: 22, maxG: 28 },
  { week: 2, targetG: 55, minG: 50, maxG: 61 },
  { week: 3, targetG: 90, minG: 81, maxG: 99 },
  { week: 4, targetG: 120, minG: 108, maxG: 132 },
  { week: 5, targetG: 145, minG: 130, maxG: 160 },
  { week: 6, targetG: 160, minG: 144, maxG: 176 },
];

// ─── Pato Pekín (Anas platyrhynchos domesticus) ───
export const PATO_PEKIN: BreedStandardPoint[] = [
  { week: 0, targetG: 55, minG: 50, maxG: 60 },
  { week: 1, targetG: 200, minG: 180, maxG: 220 },
  { week: 2, targetG: 550, minG: 495, maxG: 605 },
  { week: 3, targetG: 1100, minG: 990, maxG: 1210 },
  { week: 4, targetG: 1700, minG: 1530, maxG: 1870 },
  { week: 5, targetG: 2200, minG: 1980, maxG: 2420 },
  { week: 6, targetG: 2600, minG: 2340, maxG: 2860 },
  { week: 7, targetG: 2900, minG: 2610, maxG: 3190 },
  { week: 8, targetG: 3100, minG: 2790, maxG: 3410 },
  { week: 9, targetG: 3200, minG: 2880, maxG: 3520 },
  { week: 10, targetG: 3200, minG: 2880, maxG: 3520 },
];

// ─── Pato Criollo / Muscovy (Cairina moschata) ───
export const PATO_MUSCOVY: BreedStandardPoint[] = [
  { week: 0, targetG: 60, minG: 54, maxG: 66 },
  { week: 2, targetG: 200, minG: 180, maxG: 220 },
  { week: 4, targetG: 700, minG: 630, maxG: 770 },
  { week: 6, targetG: 1400, minG: 1260, maxG: 1540 },
  { week: 8, targetG: 2100, minG: 1890, maxG: 2310 },
  { week: 10, targetG: 2700, minG: 2430, maxG: 2970 },
  { week: 12, targetG: 3200, minG: 2880, maxG: 3520 },
  { week: 14, targetG: 3500, minG: 3150, maxG: 3850 },
];

// ─── Conejo Nueva Zelanda / California (Oryctolagus cuniculus) ───
export interface WeightCurvePoint {
  day: number;
  targetG: number;
  minG?: number;
  maxG?: number;
}

export const CONEJO_NZ_CALIFORNIA: WeightCurvePoint[] = [
  { day: 0, targetG: 50, minG: 45, maxG: 55 },
  { day: 7, targetG: 130, minG: 117, maxG: 143 },
  { day: 14, targetG: 270, minG: 243, maxG: 297 },
  { day: 21, targetG: 450, minG: 405, maxG: 495 },
  { day: 28, targetG: 680, minG: 612, maxG: 748 },
  { day: 35, targetG: 950, minG: 855, maxG: 1045 },
  { day: 42, targetG: 1250, minG: 1125, maxG: 1375 },
  { day: 49, targetG: 1550, minG: 1395, maxG: 1705 },
  { day: 56, targetG: 1850, minG: 1665, maxG: 2035 },
  { day: 63, targetG: 2100, minG: 1890, maxG: 2310 },
  { day: 70, targetG: 2300, minG: 2070, maxG: 2530 },
  { day: 77, targetG: 2450, minG: 2205, maxG: 2695 },
  { day: 84, targetG: 2550, minG: 2295, maxG: 2805 },
];

/** Mapa de especie → curva de referencia (por semanas) */
export const SPECIES_WEIGHT_CURVES: Record<string, BreedStandardPoint[]> = {
  pollo: [
    { week: 0, targetG: 42 }, { week: 1, targetG: 170 }, { week: 2, targetG: 400 },
    { week: 3, targetG: 720 }, { week: 4, targetG: 1100 }, { week: 5, targetG: 1500 },
    { week: 6, targetG: 1900 }, { week: 7, targetG: 2300 }, { week: 8, targetG: 2600 },
  ],
  codorniz: COTURNIX_JAPONICA,
  pato: PATO_PEKIN,
  conejo: [
    { week: 0, targetG: 50 }, { week: 1, targetG: 130 }, { week: 2, targetG: 270 },
    { week: 3, targetG: 450 }, { week: 4, targetG: 680 }, { week: 5, targetG: 950 },
    { week: 6, targetG: 1250 }, { week: 7, targetG: 1550 }, { week: 8, targetG: 1850 },
    { week: 9, targetG: 2100 }, { week: 10, targetG: 2300 }, { week: 11, targetG: 2450 },
    { week: 12, targetG: 2550 },
  ],
  cuy: CUY_MEJORADO,
};
