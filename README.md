# Mundial de Pelis

Nominen, sorteen y voten qué película ver entre amigos. Cada sala admite hasta 16
películas, se siembran con una encuesta de aprobación, se sortea el cuadro y se
juega en versus hasta la final. El podio arma la cartelera de las próximas noches.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL, TMDB_API_KEY y SESSION_SECRET
npm run db:migrate
npm run dev
```

Abrir http://localhost:3000.

Servicios necesarios, todos con tier gratuito:

- [Neon](https://neon.tech) — Postgres. Copiar la connection string *pooled*.
- [TMDB](https://www.themoviedb.org/settings/api) — API key v3 para búsqueda y pósters.
- [Vercel](https://vercel.com) — deploy.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run db:generate  # generar migración tras tocar src/db/schema.ts
npm run db:migrate   # aplicar migraciones
npm run db:studio    # inspeccionar la base
```

## Documentación

Las decisiones de producto, el modelo de datos, las invariantes y las reglas del
torneo están en [CLAUDE.md](CLAUDE.md).

---

Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
