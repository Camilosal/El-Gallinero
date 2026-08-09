import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-earth-50 text-slate-900">
      {/* Hero Section */}
      <section className="py-20 text-center">
        <h1 className="mb-6 text-4xl font-bold text-earth-800">
          El Gallinero �� 🐔
        </h1>
        <p className="mb-8 text-xl text-earth-600 max-w-3xl mx-auto">
          Sistema integral de gestión de gallinero para granja autosustentable.
          Controla la producción, finanzas, inventario y más.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/app"
            className="px-6 py-3 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors font-medium"
          >
            Ir al Panel de Control
          </Link>
          <Link
            href="https://github.com/Camilosal/El-Gallinero"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-earth-300 rounded-lg hover:bg-earth-50 transition-colors"
          >
            Ver en GitHub
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-3xl font-bold text-center text-earth-800">
            Características Principales
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="mb-4 text-xl font-semibold text-earth-700">���🐔 Producción</h3>
              <p className="text-earth-500">
                Gestión completa de gallinas, pollos, incubación y producción de huevos con seguimiento en tiempo real.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="mb-4 text-xl font-semibold text-earth-700">���💰 Finanzas</h3>
              <p className="text-earth-500">
                Integración automática de finanzas: cada operación genera su transacción contable con trazabilidad.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="mb-4 text-xl font-semibold text-earth-700">���📊 Analítica</h3>
              <p className="text-earth-500">
                KPIs en tiempo real, gráficos de tendencias y reportes exportables para toma de decisiones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-16 bg-earth-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-3xl font-bold text-center text-earth-800">
            Tecnologías Utilizadas
          </h2>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h3 className="mb-3 text-lg font-semibold text-earth-700">Next.js 16</h3>
              <p className="text-earth-500">Framework React para aplicaciones web modernas.</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h3 className="mb-3 text-lg font-semibold text-earth-700">PostgreSQL</h3>
              <p className="text-earth-500">Base de datos relacional robusta y confiable.</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h3 className="mb-3 text-lg font-semibold text-earth-700">Tailwind CSS</h3>
              <p className="text-earth-500">Framework CSS para diseños responsivos y personalizados.</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h3 className="mb-3 text-lg font-semibold text-earth-700">Drizzle ORM</h3>
              <p className="text-earth-500">ORM TypeScript para consultas de base de datos eficientes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 text-center">
        <h2 className="mb-8 text-3xl font-bold text-earth-800">
          Únete al Proyecto de Código Abierto
        </h2>
        <p className="mb-10 text-xl text-earth-600 max-w-2xl mx-auto">
          El Gallinero es un proyecto de código abierto. ¡Contribuye, reporta issues o sugiere nuevas características!
        </p>
        <Link
          href="https://github.com/Camilosal/El-Gallinero/fork"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-4 bg-earth-600 text-white rounded-lg hover:bg-earth-700 transition-colors font-medium shadow-lg"
        >
          Fork en GitHub <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-earth-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-earth-400">
          &copy; {new Date().getFullYear()} El Gallinero. Licencia MIT.
        </div>
      </footer>
    </div>
  );
}
