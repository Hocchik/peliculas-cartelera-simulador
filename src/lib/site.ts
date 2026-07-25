/**
 * URL pública del sitio. Hace falta absoluta para las previsualizaciones al
 * compartir: WhatsApp no resuelve rutas relativas.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` es estable entre despliegues; `VERCEL_URL`
 * cambia en cada uno y solo sirve de respaldo para las preview.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3001";
}
