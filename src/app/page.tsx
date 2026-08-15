import Link from "next/link";
import { 
  Egg, 
  DollarSign, 
  BarChart3, 
  Package, 
  Heart, 
  Wheat,
  CheckCircle2,
  ArrowRight,
  Leaf,
  Shield,
  Zap
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-earth-50 to-white text-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-earth-100/50 via-transparent to-earth-100/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-earth-100 rounded-full text-earth-700 text-sm font-medium mb-6">
              <Leaf className="w-4 h-4" />
              <span>Granja Autosustentable Iwagé</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-earth-900 mb-6 leading-tight">
              El Gallinero
            </h1>
            
            <p className="text-xl sm:text-2xl text-earth-600 max-w-3xl mx-auto mb-4 leading-relaxed">
              Sistema integral de gestión avícola para una granja sustentable
            </p>
            
            <p className="text-lg text-earth-500 max-w-2xl mx-auto mb-10">
              Controla producción, finanzas, inventarios y sanidad en una sola plataforma diseñada específicamente para gallineros.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/login"
                className="group px-8 py-4 bg-earth-600 text-white rounded-xl hover:bg-earth-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                Iniciar Sesión
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#caracteristicas"
                className="px-8 py-4 border-2 border-earth-300 text-earth-700 rounded-xl hover:bg-earth-50 transition-all font-semibold text-lg"
              >
                Conocer Más
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-earth-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-earth-600 mb-2">100%</div>
              <div className="text-earth-500 font-medium">Trazabilidad</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-earth-600 mb-2">24/7</div>
              <div className="text-earth-500 font-medium">Monitoreo</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-earth-600 mb-2">Auto</div>
              <div className="text-earth-500 font-medium">Registro</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-earth-600 mb-2">PWA</div>
              <div className="text-earth-500 font-medium">Offline Ready</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="caracteristicas" className="py-20 bg-earth-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-earth-800 mb-4">
              Todo lo que necesitas para gestionar tu gallinero
            </h2>
            <p className="text-xl text-earth-600 max-w-2xl mx-auto">
              Herramientas especializadas para cada aspecto de la producción avícola
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Producción */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-earth-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Egg className="w-7 h-7 text-earth-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Producción</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-earth-500 mt-0.5 flex-shrink-0" />
                  <span>Gestión de gallinas y pollos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-earth-500 mt-0.5 flex-shrink-0" />
                  <span>Registro de postura diario</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-earth-500 mt-0.5 flex-shrink-0" />
                  <span>Control de incubación</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-earth-500 mt-0.5 flex-shrink-0" />
                  <span>Ciclo de vida automático</span>
                </li>
              </ul>
            </div>

            {/* Finanzas */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <DollarSign className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Finanzas</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Ingresos y egresos automáticos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Cálculo de costos por lote</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Balance en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Catálogo de productos</span>
                </li>
              </ul>
            </div>

            {/* Inventarios */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Package className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Inventarios</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Control de stock automático</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Alertas de stock bajo</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Movimientos registrados</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Inventario físico</span>
                </li>
              </ul>
            </div>

            {/* Sanidad */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Heart className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Sanidad</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Registro de tratamientos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Control de vacunación</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Mortalidad y causas</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Alertas sanitarias</span>
                </li>
              </ul>
            </div>

            {/* Análisis */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Análisis</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>KPIs en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Gráficos de tendencias</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Reportes exportables</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Análisis de rentabilidad</span>
                </li>
              </ul>
            </div>

            {/* Alimentación */}
            <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all p-8 border border-earth-100">
              <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Wheat className="w-7 h-7 text-yellow-600" />
              </div>
              <h3 className="text-2xl font-bold text-earth-800 mb-3">Alimentación</h3>
              <ul className="space-y-2 text-earth-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>Programas alimenticios</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>Formulación de alimentos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>Consumo automático</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>Control de costos</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-earth-800 mb-4">
              ¿Por qué El Gallinero?
            </h2>
            <p className="text-xl text-earth-600 max-w-2xl mx-auto">
              Diseñado específicamente para las necesidades de un gallinero autosustentable
            </p>
          </div>
          
          <div className="grid gap-12 md:grid-cols-3">
            <div className="text-center">
              <div className="w-16 h-16 bg-earth-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-earth-600" />
              </div>
              <h3 className="text-xl font-bold text-earth-800 mb-3">Datos Seguros</h3>
              <p className="text-earth-600">
                Base de datos PostgreSQL con respaldos automáticos. Tu información siempre está protegida.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-earth-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-earth-600" />
              </div>
              <h3 className="text-xl font-bold text-earth-800 mb-3">Automatización Total</h3>
              <p className="text-earth-600">
                Los registros se generan automáticamente desde las operaciones diarias. Menos trabajo manual.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-earth-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Leaf className="w-8 h-8 text-earth-600" />
              </div>
              <h3 className="text-xl font-bold text-earth-800 mb-3">Enfoque Sustentable</h3>
              <p className="text-earth-600">
                Diseñado para granjas autosustentables. Control de recursos y optimización de ciclos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 bg-earth-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-earth-800 mb-4">
              Tecnología Moderna
            </h2>
            <p className="text-xl text-earth-600 max-w-2xl mx-auto">
              Construido con las mejores tecnologías para garantizar rendimiento y confiabilidad
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-earth-100">
              <div className="text-3xl font-bold text-earth-700 mb-2">Next.js 16</div>
              <p className="text-earth-500 text-sm">Framework React de última generación</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-earth-100">
              <div className="text-3xl font-bold text-earth-700 mb-2">PostgreSQL</div>
              <p className="text-earth-500 text-sm">Base de datos robusta y confiable</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-earth-100">
              <div className="text-3xl font-bold text-earth-700 mb-2">TypeScript</div>
              <p className="text-earth-500 text-sm">Código seguro y mantenible</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-earth-100">
              <div className="text-3xl font-bold text-earth-700 mb-2">Tailwind CSS</div>
              <p className="text-earth-500 text-sm">Diseño responsivo y moderno</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-earth-600 to-earth-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Comienza a gestionar tu gallinero hoy
          </h2>
          <p className="text-xl text-earth-100 mb-10 max-w-2xl mx-auto">
            Accede al sistema completo de gestión avícola diseñado para la granja autosustentable Iwagé
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="group px-8 py-4 bg-white text-earth-700 rounded-xl hover:bg-earth-50 transition-all font-semibold text-lg shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              Iniciar Sesión
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 border-2 border-white text-white rounded-xl hover:bg-white/10 transition-all font-semibold text-lg"
            >
              Ir al Dashboard
            </Link>
            <Link
              href="/dashboard/guia"
              className="px-8 py-4 border-2 border-white/50 text-earth-200 rounded-xl hover:bg-white/10 transition-all font-semibold text-lg flex items-center justify-center gap-2"
            >
              📖 Guía de Usuario
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-earth-900 text-earth-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3 mb-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <span className="text-2xl">🐓</span>
                El Gallinero
              </h3>
              <p className="text-earth-400 text-sm">
                Sistema integral de gestión avícola para la granja autosustentable Iwagé.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Enlaces</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/dashboard/guia" className="hover:text-white transition-colors">Guía de Usuario</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Proyecto</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://github.com/Camilosal/El-Gallinero" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="https://iwage.com.mx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Iwagé
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-earth-800 text-center text-sm text-earth-500">
            <p>&copy; {new Date().getFullYear()} El Gallinero — Iwagé Granja Autosustentable. Código abierto bajo licencia MIT.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
