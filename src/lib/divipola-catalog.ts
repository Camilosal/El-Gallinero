export type ColombianRegion =
  | "Andina"
  | "Caribe"
  | "Pacífica"
  | "Orinoquía"
  | "Amazonía";

export type ThermalFloor = "Calido" | "Templado" | "Frio" | "Paramo";

export interface DivipolaMunicipality {
  daneCode: string;
  departmentCode: string;
  department: string;
  municipality: string;
  region: ColombianRegion;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  thermalFloor: ThermalFloor;
  avgTempC: number;
  avgHumidityPct: number;
  nearestMarketHub: string;
}

export const COLOMBIA_DIVIPOLA_CATALOG: DivipolaMunicipality[] = [
  // Cundinamarca y Bogotá D.C.
  { daneCode: "25286", departmentCode: "25", department: "Cundinamarca", municipality: "Funza", region: "Andina", latitude: 4.7164, longitude: -74.212, altitudeMeters: 2548, thermalFloor: "Frio", avgTempC: 14.2, avgHumidityPct: 78, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25473", departmentCode: "25", department: "Cundinamarca", municipality: "Mosquera", region: "Andina", latitude: 4.7059, longitude: -74.2302, altitudeMeters: 2516, thermalFloor: "Frio", avgTempC: 14.4, avgHumidityPct: 77, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25430", departmentCode: "25", department: "Cundinamarca", municipality: "Madrid", region: "Andina", latitude: 4.7324, longitude: -74.2642, altitudeMeters: 2554, thermalFloor: "Frio", avgTempC: 14.0, avgHumidityPct: 78, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25269", departmentCode: "25", department: "Cundinamarca", municipality: "Facatativá", region: "Andina", latitude: 4.8137, longitude: -74.3545, altitudeMeters: 2586, thermalFloor: "Frio", avgTempC: 13.6, avgHumidityPct: 80, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25290", departmentCode: "25", department: "Cundinamarca", municipality: "Fusagasugá", region: "Andina", latitude: 4.3365, longitude: -74.3638, altitudeMeters: 1728, thermalFloor: "Templado", avgTempC: 19.5, avgHumidityPct: 75, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25279", departmentCode: "25", department: "Cundinamarca", municipality: "Fómeque", region: "Andina", latitude: 4.4856, longitude: -73.8964, altitudeMeters: 1895, thermalFloor: "Templado", avgTempC: 18.2, avgHumidityPct: 79, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25151", departmentCode: "25", department: "Cundinamarca", municipality: "Cáqueza", region: "Andina", latitude: 4.4056, longitude: -73.9478, altitudeMeters: 1746, thermalFloor: "Templado", avgTempC: 19.2, avgHumidityPct: 76, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25875", departmentCode: "25", department: "Cundinamarca", municipality: "Villeta", region: "Andina", latitude: 5.0124, longitude: -74.4728, altitudeMeters: 850, thermalFloor: "Calido", avgTempC: 25.0, avgHumidityPct: 72, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25386", departmentCode: "25", department: "Cundinamarca", municipality: "La Mesa", region: "Andina", latitude: 4.6326, longitude: -74.4628, altitudeMeters: 1200, thermalFloor: "Templado", avgTempC: 22.4, avgHumidityPct: 74, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25320", departmentCode: "25", department: "Cundinamarca", municipality: "Guaduas", region: "Andina", latitude: 5.0686, longitude: -74.5981, altitudeMeters: 992, thermalFloor: "Calido", avgTempC: 24.0, avgHumidityPct: 73, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25843", departmentCode: "25", department: "Cundinamarca", municipality: "Villa de San Diego de Ubaté", region: "Andina", latitude: 5.3075, longitude: -73.8153, altitudeMeters: 2556, thermalFloor: "Frio", avgTempC: 13.8, avgHumidityPct: 77, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25899", departmentCode: "25", department: "Cundinamarca", municipality: "Zipaquirá", region: "Andina", latitude: 5.0221, longitude: -74.0048, altitudeMeters: 2650, thermalFloor: "Frio", avgTempC: 13.2, avgHumidityPct: 79, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "25183", departmentCode: "25", department: "Cundinamarca", municipality: "Chocontá", region: "Andina", latitude: 5.1463, longitude: -73.6853, altitudeMeters: 2655, thermalFloor: "Frio", avgTempC: 13.0, avgHumidityPct: 80, nearestMarketHub: "Tunja / Bogotá" },
  { daneCode: "25175", departmentCode: "25", department: "Cundinamarca", municipality: "Chía", region: "Andina", latitude: 4.8616, longitude: -74.0325, altitudeMeters: 2564, thermalFloor: "Frio", avgTempC: 14.0, avgHumidityPct: 77, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "11001", departmentCode: "11", department: "Bogotá D.C.", municipality: "Bogotá D.C.", region: "Andina", latitude: 4.711, longitude: -74.0721, altitudeMeters: 2625, thermalFloor: "Frio", avgTempC: 14.0, avgHumidityPct: 76, nearestMarketHub: "Corabastos Bogotá" },

  // Santander
  { daneCode: "68001", departmentCode: "68", department: "Santander", municipality: "Bucaramanga", region: "Andina", latitude: 7.1193, longitude: -73.1227, altitudeMeters: 959, thermalFloor: "Calido", avgTempC: 24.5, avgHumidityPct: 74, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68406", departmentCode: "68", department: "Santander", municipality: "Lebrija", region: "Andina", latitude: 7.1136, longitude: -73.2189, altitudeMeters: 1055, thermalFloor: "Templado", avgTempC: 23.6, avgHumidityPct: 75, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68307", departmentCode: "68", department: "Santander", municipality: "Girón", region: "Andina", latitude: 7.0682, longitude: -73.1698, altitudeMeters: 777, thermalFloor: "Calido", avgTempC: 25.8, avgHumidityPct: 73, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68547", departmentCode: "68", department: "Santander", municipality: "Piedecuesta", region: "Andina", latitude: 6.9866, longitude: -73.0493, altitudeMeters: 1005, thermalFloor: "Templado", avgTempC: 23.8, avgHumidityPct: 74, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68276", departmentCode: "68", department: "Santander", municipality: "Floridablanca", region: "Andina", latitude: 7.0622, longitude: -73.0864, altitudeMeters: 925, thermalFloor: "Calido", avgTempC: 24.6, avgHumidityPct: 74, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68615", departmentCode: "68", department: "Santander", municipality: "Rionegro (Santander)", region: "Andina", latitude: 7.2642, longitude: -73.1494, altitudeMeters: 590, thermalFloor: "Calido", avgTempC: 26.8, avgHumidityPct: 76, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68655", departmentCode: "68", department: "Santander", municipality: "Sabana de Torres", region: "Andina", latitude: 7.3917, longitude: -73.4958, altitudeMeters: 110, thermalFloor: "Calido", avgTempC: 29.2, avgHumidityPct: 78, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68679", departmentCode: "68", department: "Santander", municipality: "San Gil", region: "Andina", latitude: 6.555, longitude: -73.1336, altitudeMeters: 1117, thermalFloor: "Templado", avgTempC: 23.2, avgHumidityPct: 71, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68755", departmentCode: "68", department: "Santander", municipality: "Socorro", region: "Andina", latitude: 6.4684, longitude: -73.2602, altitudeMeters: 1230, thermalFloor: "Templado", avgTempC: 22.5, avgHumidityPct: 72, nearestMarketHub: "Centroabastos Bucaramanga" },
  { daneCode: "68077", departmentCode: "68", department: "Santander", municipality: "Barbosa (Santander)", region: "Andina", latitude: 5.9325, longitude: -73.6194, altitudeMeters: 1610, thermalFloor: "Templado", avgTempC: 20.4, avgHumidityPct: 74, nearestMarketHub: "Centroabastos Bucaramanga" },

  // Valle del Cauca
  { daneCode: "76001", departmentCode: "76", department: "Valle del Cauca", municipality: "Cali", region: "Pacífica", latitude: 3.4516, longitude: -76.532, altitudeMeters: 995, thermalFloor: "Calido", avgTempC: 24.8, avgHumidityPct: 72, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76111", departmentCode: "76", department: "Valle del Cauca", municipality: "Guadalajara de Buga", region: "Pacífica", latitude: 3.9009, longitude: -76.2978, altitudeMeters: 969, thermalFloor: "Calido", avgTempC: 24.9, avgHumidityPct: 73, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76834", departmentCode: "76", department: "Valle del Cauca", municipality: "Tuluá", region: "Pacífica", latitude: 4.0847, longitude: -76.1954, altitudeMeters: 966, thermalFloor: "Calido", avgTempC: 25.0, avgHumidityPct: 72, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76520", departmentCode: "76", department: "Valle del Cauca", municipality: "Palmira", region: "Pacífica", latitude: 3.5394, longitude: -76.3036, altitudeMeters: 1001, thermalFloor: "Calido", avgTempC: 24.5, avgHumidityPct: 72, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76130", departmentCode: "76", department: "Valle del Cauca", municipality: "Candelaria", region: "Pacífica", latitude: 3.4067, longitude: -76.3481, altitudeMeters: 973, thermalFloor: "Calido", avgTempC: 25.1, avgHumidityPct: 73, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76892", departmentCode: "76", department: "Valle del Cauca", municipality: "Yumbo", region: "Pacífica", latitude: 3.5823, longitude: -76.4915, altitudeMeters: 1021, thermalFloor: "Calido", avgTempC: 24.6, avgHumidityPct: 71, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76364", departmentCode: "76", department: "Valle del Cauca", municipality: "Jamundí", region: "Pacífica", latitude: 3.2611, longitude: -76.5394, altitudeMeters: 975, thermalFloor: "Calido", avgTempC: 24.9, avgHumidityPct: 74, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "76147", departmentCode: "76", department: "Valle del Cauca", municipality: "Cartago", region: "Pacífica", latitude: 4.7464, longitude: -75.9117, altitudeMeters: 917, thermalFloor: "Calido", avgTempC: 25.5, avgHumidityPct: 72, nearestMarketHub: "Mercasa Pereira / Cavasa" },
  { daneCode: "76895", departmentCode: "76", department: "Valle del Cauca", municipality: "Zarzal", region: "Pacífica", latitude: 4.3958, longitude: -76.0714, altitudeMeters: 916, thermalFloor: "Calido", avgTempC: 25.4, avgHumidityPct: 71, nearestMarketHub: "Cavasa Cali" },

  // Antioquia
  { daneCode: "05001", departmentCode: "05", department: "Antioquia", municipality: "Medellín", region: "Andina", latitude: 6.2442, longitude: -75.5812, altitudeMeters: 1495, thermalFloor: "Templado", avgTempC: 22.0, avgHumidityPct: 69, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05615", departmentCode: "05", department: "Antioquia", municipality: "Rionegro (Antioquia)", region: "Andina", latitude: 6.1552, longitude: -75.3737, altitudeMeters: 2125, thermalFloor: "Frio", avgTempC: 17.5, avgHumidityPct: 76, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05664", departmentCode: "05", department: "Antioquia", municipality: "San Pedro de los Milagros", region: "Andina", latitude: 6.4686, longitude: -75.5578, altitudeMeters: 2475, thermalFloor: "Frio", avgTempC: 14.8, avgHumidityPct: 78, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05686", departmentCode: "05", department: "Antioquia", municipality: "Santa Rosa de Osos", region: "Andina", latitude: 6.6474, longitude: -75.4603, altitudeMeters: 2550, thermalFloor: "Frio", avgTempC: 14.0, avgHumidityPct: 80, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05264", departmentCode: "05", department: "Antioquia", municipality: "Entrerríos", region: "Andina", latitude: 6.565, longitude: -75.5142, altitudeMeters: 2300, thermalFloor: "Frio", avgTempC: 15.6, avgHumidityPct: 78, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05237", departmentCode: "05", department: "Antioquia", municipality: "Donmatías", region: "Andina", latitude: 6.49, longitude: -75.3947, altitudeMeters: 2200, thermalFloor: "Frio", avgTempC: 16.5, avgHumidityPct: 77, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05440", departmentCode: "05", department: "Antioquia", municipality: "Marinilla", region: "Andina", latitude: 6.1742, longitude: -75.3358, altitudeMeters: 2120, thermalFloor: "Frio", avgTempC: 17.4, avgHumidityPct: 76, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05376", departmentCode: "05", department: "Antioquia", municipality: "La Ceja", region: "Andina", latitude: 6.0281, longitude: -75.4292, altitudeMeters: 2200, thermalFloor: "Frio", avgTempC: 16.8, avgHumidityPct: 77, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05318", departmentCode: "05", department: "Antioquia", municipality: "Guarne", region: "Andina", latitude: 6.2797, longitude: -75.4422, altitudeMeters: 2150, thermalFloor: "Frio", avgTempC: 17.2, avgHumidityPct: 76, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05045", departmentCode: "05", department: "Antioquia", municipality: "Apartadó", region: "Caribe", latitude: 7.883, longitude: -76.6259, altitudeMeters: 30, thermalFloor: "Calido", avgTempC: 28.8, avgHumidityPct: 84, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05154", departmentCode: "05", department: "Antioquia", municipality: "Caucasia", region: "Caribe", latitude: 7.9865, longitude: -75.1935, altitudeMeters: 50, thermalFloor: "Calido", avgTempC: 29.5, avgHumidityPct: 79, nearestMarketHub: "Central Mayorista Medellín" },
  { daneCode: "05042", departmentCode: "05", department: "Antioquia", municipality: "Santa Fe de Antioquia", region: "Andina", latitude: 6.5569, longitude: -75.8281, altitudeMeters: 550, thermalFloor: "Calido", avgTempC: 27.2, avgHumidityPct: 70, nearestMarketHub: "Central Mayorista Medellín" },

  // Eje Cafetero (Quindío, Risaralda, Caldas)
  { daneCode: "63001", departmentCode: "63", department: "Quindío", municipality: "Armenia", region: "Andina", latitude: 4.5339, longitude: -75.6811, altitudeMeters: 1483, thermalFloor: "Templado", avgTempC: 21.5, avgHumidityPct: 76, nearestMarketHub: "Mercar Armenia" },
  { daneCode: "63130", departmentCode: "63", department: "Quindío", municipality: "Calarcá", region: "Andina", latitude: 4.5284, longitude: -75.6435, altitudeMeters: 1573, thermalFloor: "Templado", avgTempC: 20.8, avgHumidityPct: 77, nearestMarketHub: "Mercar Armenia" },
  { daneCode: "63470", departmentCode: "63", department: "Quindío", municipality: "Montenegro", region: "Andina", latitude: 4.5664, longitude: -75.7511, altitudeMeters: 1294, thermalFloor: "Templado", avgTempC: 22.8, avgHumidityPct: 75, nearestMarketHub: "Mercar Armenia" },
  { daneCode: "63594", departmentCode: "63", department: "Quindío", municipality: "Quimbaya", region: "Andina", latitude: 4.6231, longitude: -75.7636, altitudeMeters: 1339, thermalFloor: "Templado", avgTempC: 22.4, avgHumidityPct: 75, nearestMarketHub: "Mercar Armenia" },
  { daneCode: "66001", departmentCode: "66", department: "Risaralda", municipality: "Pereira", region: "Andina", latitude: 4.8087, longitude: -75.6906, altitudeMeters: 1411, thermalFloor: "Templado", avgTempC: 21.8, avgHumidityPct: 75, nearestMarketHub: "Mercasa Pereira" },
  { daneCode: "66170", departmentCode: "66", department: "Risaralda", municipality: "Dosquebradas", region: "Andina", latitude: 4.8359, longitude: -75.6725, altitudeMeters: 1460, thermalFloor: "Templado", avgTempC: 21.4, avgHumidityPct: 76, nearestMarketHub: "Mercasa Pereira" },
  { daneCode: "66682", departmentCode: "66", department: "Risaralda", municipality: "Santa Rosa de Cabal", region: "Andina", latitude: 4.8686, longitude: -75.6214, altitudeMeters: 1715, thermalFloor: "Templado", avgTempC: 19.6, avgHumidityPct: 78, nearestMarketHub: "Mercasa Pereira" },
  { daneCode: "17001", departmentCode: "17", department: "Caldas", municipality: "Manizales", region: "Andina", latitude: 5.0703, longitude: -75.5138, altitudeMeters: 2150, thermalFloor: "Frio", avgTempC: 17.2, avgHumidityPct: 78, nearestMarketHub: "Centro Galerías Manizales" },
  { daneCode: "17174", departmentCode: "17", department: "Caldas", municipality: "Chinchiná", region: "Andina", latitude: 4.9825, longitude: -75.6036, altitudeMeters: 1378, thermalFloor: "Templado", avgTempC: 21.8, avgHumidityPct: 77, nearestMarketHub: "Centro Galerías Manizales" },
  { daneCode: "17380", departmentCode: "17", department: "Caldas", municipality: "La Dorada", region: "Andina", latitude: 5.4533, longitude: -74.6647, altitudeMeters: 178, thermalFloor: "Calido", avgTempC: 28.8, avgHumidityPct: 74, nearestMarketHub: "Bogotá / Medellín" },

  // Tolima y Huila
  { daneCode: "73001", departmentCode: "73", department: "Tolima", municipality: "Ibagué", region: "Andina", latitude: 4.4389, longitude: -75.2322, altitudeMeters: 1285, thermalFloor: "Templado", avgTempC: 23.0, avgHumidityPct: 72, nearestMarketHub: "Plaza La 21 Ibagué" },
  { daneCode: "73268", departmentCode: "73", department: "Tolima", municipality: "Espinal", region: "Andina", latitude: 4.1492, longitude: -74.8842, altitudeMeters: 323, thermalFloor: "Calido", avgTempC: 28.2, avgHumidityPct: 68, nearestMarketHub: "Ibagué / Corabastos" },
  { daneCode: "73449", departmentCode: "73", department: "Tolima", municipality: "Melgar", region: "Andina", latitude: 4.2047, longitude: -74.6408, altitudeMeters: 323, thermalFloor: "Calido", avgTempC: 28.4, avgHumidityPct: 70, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "73443", departmentCode: "73", department: "Tolima", municipality: "San Sebastián de Mariquita", region: "Andina", latitude: 5.1986, longitude: -74.8925, altitudeMeters: 495, thermalFloor: "Calido", avgTempC: 27.2, avgHumidityPct: 71, nearestMarketHub: "Ibagué / Bogotá" },
  { daneCode: "41001", departmentCode: "41", department: "Huila", municipality: "Neiva", region: "Andina", latitude: 2.9273, longitude: -75.2819, altitudeMeters: 442, thermalFloor: "Calido", avgTempC: 28.0, avgHumidityPct: 68, nearestMarketHub: "Surabastos Neiva" },
  { daneCode: "41551", departmentCode: "41", department: "Huila", municipality: "Pitalito", region: "Andina", latitude: 1.8537, longitude: -76.0507, altitudeMeters: 1318, thermalFloor: "Templado", avgTempC: 21.0, avgHumidityPct: 76, nearestMarketHub: "Surabastos Neiva" },
  { daneCode: "41298", departmentCode: "41", department: "Huila", municipality: "Garzón", region: "Andina", latitude: 2.1959, longitude: -75.6278, altitudeMeters: 828, thermalFloor: "Calido", avgTempC: 24.4, avgHumidityPct: 72, nearestMarketHub: "Surabastos Neiva" },

  // Boyacá
  { daneCode: "15001", departmentCode: "15", department: "Boyacá", municipality: "Tunja", region: "Andina", latitude: 5.5353, longitude: -73.3678, altitudeMeters: 2820, thermalFloor: "Frio", avgTempC: 12.8, avgHumidityPct: 76, nearestMarketHub: "Complejo Sur Tunja" },
  { daneCode: "15238", departmentCode: "15", department: "Boyacá", municipality: "Duitama", region: "Andina", latitude: 5.8245, longitude: -73.0341, altitudeMeters: 2590, thermalFloor: "Frio", avgTempC: 14.2, avgHumidityPct: 74, nearestMarketHub: "Tunja / Sogamoso" },
  { daneCode: "15759", departmentCode: "15", department: "Boyacá", municipality: "Sogamoso", region: "Andina", latitude: 5.7143, longitude: -72.9339, altitudeMeters: 2569, thermalFloor: "Frio", avgTempC: 14.5, avgHumidityPct: 73, nearestMarketHub: "Tunja / Corabastos" },
  { daneCode: "15516", departmentCode: "15", department: "Boyacá", municipality: "Paipa", region: "Andina", latitude: 5.78, longitude: -73.1172, altitudeMeters: 2525, thermalFloor: "Frio", avgTempC: 14.5, avgHumidityPct: 75, nearestMarketHub: "Tunja / Corabastos" },
  { daneCode: "15176", departmentCode: "15", department: "Boyacá", municipality: "Chiquinquirá", region: "Andina", latitude: 5.6194, longitude: -73.8186, altitudeMeters: 2556, thermalFloor: "Frio", avgTempC: 14.0, avgHumidityPct: 77, nearestMarketHub: "Corabastos Bogotá" },
  { daneCode: "15299", departmentCode: "15", department: "Boyacá", municipality: "Garagoa", region: "Andina", latitude: 5.0825, longitude: -73.3636, altitudeMeters: 1650, thermalFloor: "Templado", avgTempC: 19.4, avgHumidityPct: 76, nearestMarketHub: "Tunja / Corabastos" },

  // Nariño y Cauca (Cuyes y Avicultura de Montaña)
  { daneCode: "52001", departmentCode: "52", department: "Nariño", municipality: "Pasto", region: "Andina", latitude: 1.2136, longitude: -77.2811, altitudeMeters: 2527, thermalFloor: "Frio", avgTempC: 13.8, avgHumidityPct: 78, nearestMarketHub: "El Potrerillo Pasto" },
  { daneCode: "52356", departmentCode: "52", department: "Nariño", municipality: "Ipiales", region: "Andina", latitude: 0.8247, longitude: -77.6419, altitudeMeters: 2898, thermalFloor: "Frio", avgTempC: 11.8, avgHumidityPct: 80, nearestMarketHub: "El Potrerillo Pasto" },
  { daneCode: "52838", departmentCode: "52", department: "Nariño", municipality: "Túquerres", region: "Andina", latitude: 1.0872, longitude: -77.6194, altitudeMeters: 3104, thermalFloor: "Paramo", avgTempC: 10.5, avgHumidityPct: 81, nearestMarketHub: "El Potrerillo Pasto" },
  { daneCode: "19001", departmentCode: "19", department: "Cauca", municipality: "Popayán", region: "Andina", latitude: 2.4448, longitude: -76.6147, altitudeMeters: 1760, thermalFloor: "Templado", avgTempC: 19.0, avgHumidityPct: 77, nearestMarketHub: "Cavasa Cali / Popayán" },
  { daneCode: "19698", departmentCode: "19", department: "Cauca", municipality: "Santander de Quilichao", region: "Pacífica", latitude: 3.0094, longitude: -76.4849, altitudeMeters: 1071, thermalFloor: "Calido", avgTempC: 24.0, avgHumidityPct: 73, nearestMarketHub: "Cavasa Cali" },
  { daneCode: "19548", departmentCode: "19", department: "Cauca", municipality: "Piendamó", region: "Andina", latitude: 2.6417, longitude: -76.5269, altitudeMeters: 1685, thermalFloor: "Templado", avgTempC: 19.5, avgHumidityPct: 76, nearestMarketHub: "Cavasa Cali / Popayán" },

  // Región Caribe (Atlántico, Bolívar, Córdoba, Sucre, Magdalena, Cesar)
  { daneCode: "08001", departmentCode: "08", department: "Atlántico", municipality: "Barranquilla", region: "Caribe", latitude: 10.9685, longitude: -74.7813, altitudeMeters: 18, thermalFloor: "Calido", avgTempC: 28.8, avgHumidityPct: 78, nearestMarketHub: "Granabastos Barranquilla" },
  { daneCode: "08638", departmentCode: "08", department: "Atlántico", municipality: "Sabanalarga", region: "Caribe", latitude: 10.6311, longitude: -74.9208, altitudeMeters: 87, thermalFloor: "Calido", avgTempC: 28.6, avgHumidityPct: 77, nearestMarketHub: "Granabastos Barranquilla" },
  { daneCode: "08078", departmentCode: "08", department: "Atlántico", municipality: "Baranoa", region: "Caribe", latitude: 10.7941, longitude: -74.9164, altitudeMeters: 118, thermalFloor: "Calido", avgTempC: 28.4, avgHumidityPct: 76, nearestMarketHub: "Granabastos Barranquilla" },
  { daneCode: "08296", departmentCode: "08", department: "Atlántico", municipality: "Galapa", region: "Caribe", latitude: 10.8961, longitude: -74.8842, altitudeMeters: 83, thermalFloor: "Calido", avgTempC: 28.7, avgHumidityPct: 77, nearestMarketHub: "Granabastos Barranquilla" },
  { daneCode: "13001", departmentCode: "13", department: "Bolívar", municipality: "Cartagena de Indias", region: "Caribe", latitude: 10.391, longitude: -75.4794, altitudeMeters: 2, thermalFloor: "Calido", avgTempC: 28.9, avgHumidityPct: 80, nearestMarketHub: "Bazurto Cartagena" },
  { daneCode: "13836", departmentCode: "13", department: "Bolívar", municipality: "Turbaco", region: "Caribe", latitude: 10.3289, longitude: -75.4117, altitudeMeters: 120, thermalFloor: "Calido", avgTempC: 28.2, avgHumidityPct: 79, nearestMarketHub: "Bazurto Cartagena" },
  { daneCode: "23001", departmentCode: "23", department: "Córdoba", municipality: "Montería", region: "Caribe", latitude: 8.748, longitude: -75.8814, altitudeMeters: 18, thermalFloor: "Calido", avgTempC: 29.0, avgHumidityPct: 78, nearestMarketHub: "Mercadito del Sur Montería" },
  { daneCode: "23162", departmentCode: "23", department: "Córdoba", municipality: "Cereté", region: "Caribe", latitude: 8.8853, longitude: -75.7922, altitudeMeters: 15, thermalFloor: "Calido", avgTempC: 29.1, avgHumidityPct: 78, nearestMarketHub: "Mercadito del Sur Montería" },
  { daneCode: "23660", departmentCode: "23", department: "Córdoba", municipality: "Sahagún", region: "Caribe", latitude: 8.9462, longitude: -75.4428, altitudeMeters: 75, thermalFloor: "Calido", avgTempC: 28.8, avgHumidityPct: 77, nearestMarketHub: "Mercadito del Sur Montería" },
  { daneCode: "70001", departmentCode: "70", department: "Sucre", municipality: "Sincelejo", region: "Caribe", latitude: 9.3047, longitude: -75.3978, altitudeMeters: 213, thermalFloor: "Calido", avgTempC: 27.8, avgHumidityPct: 76, nearestMarketHub: "Corozal / Barranquilla" },
  { daneCode: "47001", departmentCode: "47", department: "Magdalena", municipality: "Santa Marta", region: "Caribe", latitude: 11.2408, longitude: -74.199, altitudeMeters: 6, thermalFloor: "Calido", avgTempC: 29.0, avgHumidityPct: 76, nearestMarketHub: "Granabastos Barranquilla" },
  { daneCode: "20001", departmentCode: "20", department: "Cesar", municipality: "Valledupar", region: "Caribe", latitude: 10.4631, longitude: -73.2532, altitudeMeters: 169, thermalFloor: "Calido", avgTempC: 29.2, avgHumidityPct: 68, nearestMarketHub: "Mercabastos Valledupar" },

  // Orinoquía y Norte de Santander
  { daneCode: "50001", departmentCode: "50", department: "Meta", municipality: "Villavicencio", region: "Orinoquía", latitude: 4.142, longitude: -73.6266, altitudeMeters: 467, thermalFloor: "Calido", avgTempC: 26.8, avgHumidityPct: 78, nearestMarketHub: "Central Abastos Villavicencio" },
  { daneCode: "50006", departmentCode: "50", department: "Meta", municipality: "Acacías", region: "Orinoquía", latitude: 3.987, longitude: -73.7579, altitudeMeters: 498, thermalFloor: "Calido", avgTempC: 26.5, avgHumidityPct: 79, nearestMarketHub: "Central Abastos Villavicencio" },
  { daneCode: "50313", departmentCode: "50", department: "Meta", municipality: "Granada (Meta)", region: "Orinoquía", latitude: 3.5462, longitude: -73.7069, altitudeMeters: 372, thermalFloor: "Calido", avgTempC: 27.2, avgHumidityPct: 78, nearestMarketHub: "Central Abastos Villavicencio" },
  { daneCode: "50606", departmentCode: "50", department: "Meta", municipality: "Restrepo", region: "Orinoquía", latitude: 4.2622, longitude: -73.5625, altitudeMeters: 570, thermalFloor: "Calido", avgTempC: 26.0, avgHumidityPct: 79, nearestMarketHub: "Central Abastos Villavicencio" },
  { daneCode: "85001", departmentCode: "85", department: "Casanare", municipality: "Yopal", region: "Orinoquía", latitude: 5.3378, longitude: -72.3959, altitudeMeters: 350, thermalFloor: "Calido", avgTempC: 27.6, avgHumidityPct: 74, nearestMarketHub: "Villavicencio / Corabastos" },
  { daneCode: "85010", departmentCode: "85", department: "Casanare", municipality: "Aguazul", region: "Orinoquía", latitude: 5.1728, longitude: -72.5469, altitudeMeters: 290, thermalFloor: "Calido", avgTempC: 27.9, avgHumidityPct: 75, nearestMarketHub: "Villavicencio / Corabastos" },
  { daneCode: "54001", departmentCode: "54", department: "Norte de Santander", municipality: "Cúcuta", region: "Andina", latitude: 7.8939, longitude: -72.5078, altitudeMeters: 320, thermalFloor: "Calido", avgTempC: 28.4, avgHumidityPct: 68, nearestMarketHub: "Cenabastos Cúcuta" },
  { daneCode: "54498", departmentCode: "54", department: "Norte de Santander", municipality: "Ocaña", region: "Andina", latitude: 8.2377, longitude: -73.356, altitudeMeters: 1202, thermalFloor: "Templado", avgTempC: 22.4, avgHumidityPct: 73, nearestMarketHub: "Cenabastos Cúcuta" },
];

export const COLOMBIA_DEPARTMENTS: string[] = Array.from(
  new Set(COLOMBIA_DIVIPOLA_CATALOG.map((m) => m.department)),
).sort((a, b) => a.localeCompare(b, "es"));

function normalizeText(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getMunicipalitiesByDepartment(department?: string | null): DivipolaMunicipality[] {
  const normDept = normalizeText(department);
  if (!normDept) return COLOMBIA_DIVIPOLA_CATALOG;
  return COLOMBIA_DIVIPOLA_CATALOG.filter((m) => normalizeText(m.department) === normDept);
}

export function inferThermalFloorByAltitude(altitudeMeters: number): ThermalFloor {
  if (altitudeMeters >= 2850) return "Paramo";
  if (altitudeMeters >= 1950) return "Frio";
  if (altitudeMeters >= 1000) return "Templado";
  return "Calido";
}

export function resolveDivipolaMunicipality(
  codeOrCity?: string | null,
  department?: string | null,
): DivipolaMunicipality {
  const clean = normalizeText(codeOrCity);
  const cleanDept = normalizeText(department);

  if (clean) {
    const byCode = COLOMBIA_DIVIPOLA_CATALOG.find((m) => m.daneCode === clean);
    if (byCode) return byCode;

    if (cleanDept) {
      const exactDeptCity = COLOMBIA_DIVIPOLA_CATALOG.find(
        (m) =>
          normalizeText(m.department) === cleanDept &&
          (normalizeText(m.municipality) === clean || normalizeText(m.municipality).includes(clean)),
      );
      if (exactDeptCity) return exactDeptCity;
    }

    const exactCity = COLOMBIA_DIVIPOLA_CATALOG.find(
      (m) => normalizeText(m.municipality) === clean,
    );
    if (exactCity) return exactCity;

    const partialCity = COLOMBIA_DIVIPOLA_CATALOG.find((m) =>
      normalizeText(m.municipality).includes(clean),
    );
    if (partialCity) return partialCity;
  }

  if (cleanDept) {
    const byDept = COLOMBIA_DIVIPOLA_CATALOG.find(
      (m) =>
        normalizeText(m.department) === cleanDept ||
        normalizeText(m.department).includes(cleanDept),
    );
    if (byDept) return byDept;
  }

  if (clean) {
    const byDeptFromCity = COLOMBIA_DIVIPOLA_CATALOG.find((m) =>
      normalizeText(m.department).includes(clean),
    );
    if (byDeptFromCity) return byDeptFromCity;
  }

  return COLOMBIA_DIVIPOLA_CATALOG[0];
}

export type ZoneCoverageScope = "local" | "regional" | "nacional";

export interface ZoneResolutionResult {
  municipality: DivipolaMunicipality;
  coverageScope: ZoneCoverageScope;
  coverageLabel: string;
  periodLabel: string;
  matchedDepartment: string;
  matchedRegion: ColombianRegion | "Nacional";
}

function averageMunicipalities(
  items: DivipolaMunicipality[],
  fallbackLabel: string,
  department: string,
  region: ColombianRegion,
): DivipolaMunicipality {
  const n = Math.max(1, items.length);
  const avgLat = Number((items.reduce((s, m) => s + m.latitude, 0) / n).toFixed(4));
  const avgLon = Number((items.reduce((s, m) => s + m.longitude, 0) / n).toFixed(4));
  const avgAlt = Math.round(items.reduce((s, m) => s + m.altitudeMeters, 0) / n);
  const avgTemp = Number((items.reduce((s, m) => s + m.avgTempC, 0) / n).toFixed(1));
  const avgHum = Math.round(items.reduce((s, m) => s + m.avgHumidityPct, 0) / n);
  const first = items[0] || COLOMBIA_DIVIPOLA_CATALOG[0];

  return {
    daneCode: first.daneCode,
    departmentCode: first.departmentCode,
    department,
    municipality: fallbackLabel,
    region,
    latitude: avgLat,
    longitude: avgLon,
    altitudeMeters: avgAlt,
    thermalFloor: inferThermalFloorByAltitude(avgAlt),
    avgTempC: avgTemp,
    avgHumidityPct: avgHum,
    nearestMarketHub: first.nearestMarketHub,
  };
}

/**
 * Resuelve los datos territoriales y climáticos base de la granja en cascada de 3 niveles:
 * 1. Zona local exacta (código DANE o municipio DIVIPOLA)
 * 2. Promedio regional (departamento o macro-región del último periodo disponible)
 * 3. Promedio nacional Colombia (último periodo disponible)
 */
export function resolveZoneWithFallback(input: {
  daneCode?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string | null;
  periodLabel?: string;
}): ZoneResolutionResult {
  const periodLabel = input.periodLabel || "Último periodo disponible";
  const normCode = normalizeText(input.daneCode);
  const normCity = normalizeText(input.city);
  const normDept = normalizeText(input.department);
  const normCountry = normalizeText(input.country);

  const isForeignCountry =
    normCountry !== "" &&
    normCountry !== "colombia" &&
    !normCountry.includes("colombia");

  if (!isForeignCountry) {
    // 1. Coincidencia exacta por código DANE
    if (normCode) {
      const byCode = COLOMBIA_DIVIPOLA_CATALOG.find((m) => m.daneCode === normCode);
      if (byCode) {
        return {
          municipality: byCode,
          coverageScope: "local",
          coverageLabel: `Zona local: ${byCode.municipality}, ${byCode.department} (DANE ${byCode.daneCode})`,
          periodLabel,
          matchedDepartment: byCode.department,
          matchedRegion: byCode.region,
        };
      }
    }

    // 2. Coincidencia exacta por municipio (+ departamento opcional cuando hay homónimos)
    if (normCity) {
      const byCityInDept = normDept
        ? COLOMBIA_DIVIPOLA_CATALOG.find((m) => {
            const munNorm = normalizeText(m.municipality);
            const matchesCity =
              munNorm === normCity || (normCity.length >= 4 && munNorm.includes(normCity));
            return (
              matchesCity &&
              (normalizeText(m.department) === normDept || normalizeText(m.department).includes(normDept))
            );
          })
        : undefined;
      const byCityAny =
        byCityInDept ||
        COLOMBIA_DIVIPOLA_CATALOG.find((m) => {
          const munNorm = normalizeText(m.municipality);
          return munNorm === normCity || (normCity.length >= 4 && munNorm.includes(normCity));
        });
      const byCity = byCityInDept || byCityAny;
      if (byCity) {
        return {
          municipality: byCity,
          coverageScope: "local",
          coverageLabel: `Zona local: ${byCity.municipality}, ${byCity.department} (DANE ${byCity.daneCode})`,
          periodLabel,
          matchedDepartment: byCity.department,
          matchedRegion: byCity.region,
        };
      }
    }

    // 3. Cascada a promedio departamental / regional
    if (normDept) {
      const deptItems = COLOMBIA_DIVIPOLA_CATALOG.filter(
        (m) =>
          normalizeText(m.department) === normDept ||
          normalizeText(m.department).includes(normDept),
      );
      if (deptItems.length > 0) {
        const rep = deptItems[0];
        const profile = averageMunicipalities(
          deptItems,
          `Promedio ${rep.department}`,
          rep.department,
          rep.region,
        );
        return {
          municipality: profile,
          coverageScope: "regional",
          coverageLabel: `Promedio regional: ${rep.department} · Región ${rep.region} (${periodLabel})`,
          periodLabel,
          matchedDepartment: rep.department,
          matchedRegion: rep.region,
        };
      }

      const regionItems = COLOMBIA_DIVIPOLA_CATALOG.filter((m) =>
        normalizeText(m.region).includes(normDept),
      );
      if (regionItems.length > 0) {
        const rep = regionItems[0];
        const profile = averageMunicipalities(
          regionItems,
          `Promedio Región ${rep.region}`,
          rep.department,
          rep.region,
        );
        return {
          municipality: profile,
          coverageScope: "regional",
          coverageLabel: `Promedio regional: Región ${rep.region} (${periodLabel})`,
          periodLabel,
          matchedDepartment: rep.department,
          matchedRegion: rep.region,
        };
      }
    }
  }

  // 4. Promedio nacional del último periodo disponible
  const nationalProfile = averageMunicipalities(
    COLOMBIA_DIVIPOLA_CATALOG,
    "Promedio Nacional Colombia",
    "Promedio Nacional",
    "Andina",
  );
  nationalProfile.daneCode = "00000";
  nationalProfile.departmentCode = "00";
  nationalProfile.nearestMarketHub = "Consolidado Nacional SIPSA (DANE)";

  return {
    municipality: nationalProfile,
    coverageScope: "nacional",
    coverageLabel: `Promedio nacional Colombia (${periodLabel})`,
    periodLabel,
    matchedDepartment: "Promedio Nacional",
    matchedRegion: "Nacional",
  };
}
