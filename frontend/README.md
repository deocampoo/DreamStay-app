@@ -1,36 +1,25 @@
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
DreamStay-app — Proyecto de Testing con IA

## Getting Started
-Descripción breve

First, run the development server:
DreamStay-app es una aplicación de reservas de hoteles cuyo desarrollo delegamos en un agente de inteligencia artificial para concentrar el trabajo del equipo en aseguramiento de calidad (QA). Nuestro proceso parte de historias de usuario, que la IA utiliza para implementar las funcionalidades; luego diseñamos y ejecutamos pruebas y documentamos resultados y defectos.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
-Objetivo

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Garantizar calidad desde el inicio, maximizando cobertura y velocidad de validación al separar desarrollo (IA) y testing (equipo QA).

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.
-Flujo de trabajo

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
1.Historias de usuario (con criterios de aceptación).

## Learn More
2.Implementación por IA a partir de esas historias.

To learn more about Next.js, take a look at the following resources:
3.Diseño de casos de prueba trazados a cada historia.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
4.Ejecución de pruebas (funcionales y de aceptación).

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
5.Reportes:

## Deploy on Vercel
-Reporte de ejecución (resultados por caso).

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
-Reporte de defectos (registro, severidad y seguimiento).





































