# caja - asistente de turno

App para control de caja de tienda. Todo localStorage, sin backend.

## Features finales
- Abrir caja: fecha, fondo proveedores, ventas tarjeta César (sin César efectivo)
- 6 módulos: proveedores, transferencias, contar, cierre, historial, archivos
- Proveedores: Fondo / Caja / Combinado. Solo muestra 2 inputs si es combinado. Botón + circular para agregar dinero al fondo con historial.
- Transferencias simple
- Contar: caja / fondo / general (antes cierre) - proporciones correctas 56px, teclado numérico grande
- Teclado numérico bottom-sheet grande 60px por botón
- Cierre sin pantalla negra, guarda PDF detallado por secciones con fotos de tickets/comprobantes
- PDF bien acomodado por secciones, con resumen, tablas y fotos grid 2 columnas
- Sin base $200, sin textos innecesarios, sin emojis

## Opción 1: Subir directo a GitHub Pages (más fácil)
1. Crea repo en GitHub
2. Sube solo `index.html` (el que está en este paquete) a la rama main
3. En Settings > Pages > Deploy from branch > main / root
4. Listo, se publica en https://tuusuario.github.io/tu-repo/

Ese `index.html` ya es standalone, no necesita build, incluye React y todo.

## Opción 2: Proyecto Vite (para seguir desarrollando)
```
npm install
npm run dev
```
Estructura:
- App.tsx -> código principal
- main.tsx -> entry
- vite.config.ts, tailwind.config.js

Para deploy con Vite:
```
npm run build
# sube carpeta dist/ a Pages
```

## Datos
Todo se guarda en localStorage key `caja-asistente-v19`. Los PDFs se guardan como dataUrl en archivos.

## Última versión
v19 - textos limpios + general + + fondo con historial
