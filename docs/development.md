# Guía de Desarrollo de El Gallinero

Este documento proporciona instrucciones detalladas para configurar el entorno de desarrollo, ejecutar pruebas, y contribuir efectivamente al proyecto El Gallinero.

## Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js ≥ 20.9** (recomendado usar [nvm](https://github.com/nvm-sh/nvm) para gestionar versiones)
- **PostgreSQL ≥ 14** (cualquier versión reciente funciona)
- **Git**
- **Editor de código** (VS Code recomendado con extensiones: ESLint, Prettier, Tailwind CSS IntelliSense)

## Configuración del Entorno de Desarrollo

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Camilosal/El-Gallinero.git
cd El-Gallinero
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copie el archivo de ejemplo y ajuste según su entorno:

```bash
cp .env.example .env.local
```

Edite `.env.local` con sus credenciales de PostgreSQL:

```env
DATABASE_URL=postgresql://TU_USUARIO:TU_CONTRASE���ÑA@localhost:5432/app_db
```

> **Importante**: Nunca confirme `.env.local` en el repositorio. Está listado en `.gitignore`.

### 4. Preparar la Base de Datos

#### Opción A: Usar el script de configuración completa (recomendado para inicio)

```bash
# Crear la base de datos
createdb app_db

# Aplicar el esquema
npm run db:push

# Sembrar datos de demostración
npm run db:seed
```

#### Opción B: Paso a paso (para desarrollo activo)

```bash
# 1. Crear base de datos
createdb app_db

# 2. Aplicar migraciones del esquema
npm run db:push

# 3. (Opcional) Sembrar datos iniciales
npm run db:seed

# 4. Durante el desarrollo, cuando cambie el esquema:
npm run db:generate   # Genera archivos de migración SQL
npm run db:push       # Aplica los cambios a la BD
```

### 5. Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Flujo de Trabajo de Desarrollo

### Desarrollo de Funcionalidades

1. **Crear una rama nueva** desde `main`:
   ```bash
   git checkout -b feature/nombre-descriptivo
   ```

2. **Implementar los cambios** siguiendo las guías de estilo
3. **Escribir o actualizar pruebas** según corresponda
4. **Ejecutar el suite de pruebas localmente**:
   ```bash
   npm run test
   ```
5. **Verificar tipos y linting**:
   ```bash
   npm run typecheck && npm run lint
   ```
6. **Hacer commit** con mensaje convencional:
   ```bash
   git commit -m "feat(módulo): descripción breve del cambio"
   ```
7. **Push a su fork**:
   ```bash
   git push origin feature/nombre-descriptivo
   ```
8. **Abrir un Pull Request** contra `main` en el repositorio original

### Trabajo con la Base de Datos

#### Generar Migraciones

Cuando modifique `src/db/schema.ts`:

```bash
# Genera archivos de migración en drizzle/
npm run db:generate
```

Revisa los archivos generados antes de aplicarlos.

#### Aplicar Cambios

```bash
# Aplica todas las migraciones pendientes
npm run db:push
```

#### Sembrar Datos

```bash
# Sembrar datos de demostración (idempotente)
npm run db:seed

# Para re-sembrar desde cero (elimina datos existentes)
npm run db:seed -- --force
```

### Pruebas

#### Ejecutar el Suite Completo

```bash
npm run test
```

#### Modo Watch (desarrollo activo)

```bash
npm run test:watch
```

#### Cobertura de Código

```bash
npm run test -- --coverage
```

La cobertura se generará en `coverage/`

#### Escritura de Pruebas

Las pruebas se ubican en:
- `tests/` para pruebas de integración y de flujo
- Junto a los archivos fuente como `*.test.ts` para pruebas unitarias

Ejemplo de estructura de prueba:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MiComponente } from './MiComponente'

describe('MiComponente', () => {
  beforeEach(() => {
    // Configuración antes de cada prueba
  })

  it('debe renderizar correctamente', () => {
    render(<MiComponente />)
    expect(screen.getByText(/texto esperado/i)).toBeInTheDocument()
  })

  it('maneja el caso edge correctamente', () => {
    // ... implementación
  })
})
```

### Estilos y UI

El proyecto usa Tailwind CSS 4. Para modificar estilos:

1. **Preferir clases utilitarias** cuando sea posible
2. **Para estilos complejos**, use:
   - Archivo CSS global: `src/app/globals.css`
   - Módulos CSS: `nombre.module.css`
   - Estilos en línea con la sintaxis de Tailwind (`tw` en template literales si usa styled-components)

Ejemplo de buena práctica:

```tsx
// Bueno: clases utilitarias de Tailwind
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Acción
</button>

// También bueno: módulo CSS para estilos complejos
import styles from './MiComponente.module.css'
// ...
<div className={styles.contenedor}>
  <!-- contenido -->
</div>
```

### Depuración

#### Logs del Servidor

Los logs de Next.js aparecen en la terminal donde ejecuta `npm run dev`.

#### Logs de la Base de Datos

Para ver consultas SQL generadas por Drizzle, agregue a `.env.local`:

```env
DEBUG=drizzle:query
```

Luego reinicie el servidor.

#### Herramientas de Desarrollo del Navegador

- Use React DevTools para inspeccionar el árbol de componentes
- Use las pestañas de Red y Application para observar requests y almacenamiento
- Use la pestaña de Fuente para establecer puntos de interrupción en código fuente

### Build y Producción

#### Construir para Producción

```bash
npm run build
```

#### Iniciar Servidor de Producción

```bash
npm start
```

#### Variables de Entorno en Producción

En producción, configure las variables de entorno según su plataforma de hosting (Vercel, Docker, etc.):

- `DATABASE_URL`: URL de conexión a PostgreSQL
- Otras variables según necesite

### Solución de Problemas Comunes

#### Error de Conexión a Base de Datos

Verifique:
- PostgreSQL está corriendo: `sudo service postgresql status` (Linux) o use su servicio de macOS/Windows
- `.env.local` tiene la URL correcta
- El usuario tiene permisos para crear/conectar a la base de datos
- La base de datos `app_db` existe

#### Errores de Tipos de TypeScript

Ejecute:
```bash
npm run typecheck
```

Revise cuidadosamente los mensajes de error - suelen indicar exactamente qué está mal.

#### Pruebas Fallando Aleatoriamente

- Asegúrese de que las pruebas no dependan de estado global
- Use `beforeEach` y `afterEach` para limpiar estado
- Para pruebas que involucran fechas, considere usar librerías como `jest-fake-timers` o controlar el tiempo explícitamente

#### Problemas con Tailwind

- Verifique que tenga la extensión de Tailwind CSS IntelliSense instalada en VS Code
- Asegúrese de que sus archivos tengan extensiones reconocidas (`.tsx`, `.css`)
- Reinicie el servidor de desarrollo después de cambiar `tailwind.config.ts` o `postcss.config.mjs`

### Recursos Adicionales

- [Documentación de Next.js 16](https://nextjs.org/docs)
- [Documentación de Drizzle ORM](https://orm.drizzle.team)
- [Guía de Tailwind CSS 4](https://tailwindcss.com/docs)
- [Documentación de Vitest](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Preguntas Frecuentes

### ¿Cómo contribuyo con una nueva característica?

1. Abra un issue describiendo la característica
2. Espere feedback de los mantenedores
3. Implemente siguiendo esta guía
4. Abra un Pull Request

### ¿Dónde debo colocar nuevos componentes?

Siga la estructura existente en `src/app/(app)/[sección]/[submódulo]/`. Por ejemplo:
- Nuevos componentes de producción van en `src/app/(app)/produccion/[submódulo]/components/`
- Componentes reutilizables van en `src/components/`

### ¿Cómo agrego una nueva ruta API?

1. Cree el archivo en `src/app/api/[ruta]/route.ts`
2. Siga el patrón de las rutas existentes (GET, POST, etc.)
3. Asegúrese de manejar errores adecuadamente
4. Agregue pruebas en `tests/` si es lógica compleja

### ¿Dónde va la lógica de negocio compleja?

- Lógica relacionada con datos: en `src/lib/` (ej: `src/lib/inventory.ts` para lógica de inventario)
- Lógica específica de componentes: dentro del componente o en hooks personalizados
- Lógica de transacciones financieras: en `src/lib/finance.ts` o similar

### ¿Cómo activo una característica experimental?

Use las variables de entorno en `.env.local` con prefijo `NEXT_PUBLIC_` para características que necesiten estar disponibles en el cliente, o variables normales para solo servidor.

Recuerde reiniciar el servidor de desarrollo después de cambiar variables de entorno.
