export interface BreedStandardPoint {
  week: number;
  targetG: number;
  minG?: number;
  maxG?: number;
}

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

export const ALL_BREED_STANDARDS: Record<string, BreedStandardPoint[]> = {
  "ISA Brown_hembra": ISA_BROWN_HEN,
  "Hy-Line W-36_hembra": HY_LINE_W36_HEN,
  "Cobb 500_macho": COBB_500_MALE,
  "Cobb 500_hembra": COBB_500_FEMALE,
};
