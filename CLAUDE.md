# Mundial de Pelis

Web para que un grupo de amigos nomine películas, las sortee en un cuadro tipo Mundial,
vote los versus en vivo y termine con una **cartelera** de qué se ve.

Slug: `mundial-de-pelis`. La carpeta del repo sigue llamándose `Sorteo de Pelis`.

> **Estado:** scaffold, base de datos y lógica del cuadro listos. Falta conectar Neon/TMDB
> y construir la UI. Ver *Estado actual* al final.


# Reglas
Piensa antes de actuar. Lee los archivos antes de escribir código.
Edita solo lo que cambia, no reescribas archivos enteros.
No releas archivos que ya hayas leído salvo que hayan cambiado.
No repitas código sin cambios en tus respuestas.
Sin preámbulos, sin resúmenes al final, sin explicar lo obvio.
Testea antes de dar por terminado.

---

## 1. Producto en una pantalla

Una **sala equivale a un evento**: se crea, se juega y se archiva. No se reutiliza.

```
Sala  (código: PELIS-4K9)
 1. NOMINAR   → cada uno agrega las películas que quiera (máx 16 en la sala)
 2. SIEMBRA   → encuesta de aprobación rápida: "¿cuáles verías?" (30 s)
 3. SORTEO    → animación que llena el cuadro; las 4 más aprobadas son cabezas de serie
 4. LLAVES    → versus ronda por ronda, todos votando en vivo
 5. CARTELERA → el podio arma el orden de las próximas noches de película
```

El **host** (quien creó la sala) es el único que avanza de fase y el único que modera.

### Decisiones cerradas (no re-litigar)

| Tema | Decisión |
|---|---|
| Acceso | Código de sala + apodo. Sin emails ni contraseñas. Identidad en cookie del dispositivo. |
| Modo de decisión | Híbrido: encuesta de siembra → bracket. **No** es sorteo 100% aleatorio. |
| Ritmo | En vivo, todos juntos. La UI se actualiza para todos mientras votan. |
| Empates | Moneda al aire animada, **decidida en el servidor**. |
| Resultado | El podio completo arma la cartelera, no solo la campeona. |
| Cupo de nominaciones | **Libre**: cualquiera sube varias hasta llenar las 16. El host regula. |
| Autoría de nominaciones | Se guarda, pero **solo la ve el host**, para su filtro previo. |
| Alcance de la sala | Una sala **por evento**. Sin historial ni salas recurrentes. |
| Idioma | Interfaz solo en español. Los títulos se muestran en español **y** en su idioma original. |
| Fuera de alcance v1 | Proveedores de streaming, series, historial de "ya vistas", ratings. |

### Único supuesto pendiente

Grupo de ~4 a 10 personas. Solo afecta a la frecuencia de empates (ya resuelta por la moneda)
y a la carga de polling; nada del diseño depende de este número.

---

## 2. Stack

- **Next.js 16.2** (App Router, Server Actions, Turbopack) + **React 19.2** + **TypeScript strict**
  - ⚠️ Next 16 trae cambios de API respecto a versiones anteriores. Antes de escribir
    código de rutas, layouts, Server Actions o Route Handlers, **leer la guía
    correspondiente en `node_modules/next/dist/docs/`** (ver `AGENTS.md`).
- **Tailwind CSS v4** + **shadcn/ui**
- **Neon** (Postgres serverless) + **Drizzle ORM** — elegido sobre Supabase porque su free
  tier no pausa el proyecto tras días de inactividad; esta app se usa de forma esporádica.
- **SWR con polling de 2 s** para el estado en vivo. Es suficiente para ≤10 usuarios; no
  añadir WebSockets/Pusher salvo que se note lag real.
- **Zod** para validar todo input de usuario y toda respuesta de TMDB.
- **TMDB** para búsqueda, pósters y metadatos.
- Deploy en **Vercel**. Todo el stack cabe en tiers gratuitos.

### Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run db:generate  # drizzle-kit generate  (tras tocar src/db/schema.ts)
npm run db:migrate   # aplicar migraciones
npm run db:studio    # inspeccionar la BD
```

### Variables de entorno (`.env.local`)

```
DATABASE_URL=postgres://...        # Neon
TMDB_ACCESS_TOKEN=...              # token de lectura v4, se manda como Bearer
SESSION_SECRET=...                 # firma de la cookie de participante
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

---

## 3. Estructura

```
src/
  app/
    page.tsx                     # landing: crear sala / unirse con código
    actions.ts                   # createRoom, joinRoom
    sala/[code]/
      page.tsx                   # despacha la vista según room.phase
      actions.ts                 # addMovie, removeMovie (y las que vengan)
    api/tmdb/search/route.ts     # proxy de búsqueda; exige cookie válida
  components/
    movie/                       # MovieSearch, PosterImage, RemoveMovieButton
    room/                        # CreateRoomForm, JoinRoomForm, RoomCode
    ui/                          # shadcn
  db/
    schema.ts  index.ts  migrations/
  lib/
    bracket.ts     # cuadro, siembra, avance de rondas (PURO, testeado)
    tmdb.ts        # cliente de TMDB, `server-only`
    tmdb-types.ts  # tipos compartidos con el cliente
    poster.ts      # URLs de póster, seguro en el cliente
    session.ts     # cookie firmada de participante
    rooms.ts       # lectura del estado de sala (recorta la autoría)
    codes.ts       # códigos de sala y semillas
    db-errors.ts   # detección de violación de índice único
```

---

## 4. Modelo de datos

Como la sala es un evento único, **no existe tabla `tournaments`**: el sorteo vive en `rooms`.
Si algún día se quieren salas recurrentes, esa tabla se reintroduce y todo lo demás cuelga de ella.

| Tabla | Campos |
|---|---|
| `rooms` | id, code (unique), name, phase, draw_seed int, tiebreak_seed int, settings jsonb, created_at |
| `participants` | id, room_id, nickname, avatar_seed, is_host, device_token, last_seen_at |
| `movies` | id, room_id, tmdb_id, title, original_title, year, poster_path, runtime, overview, vote_average, added_by, created_at |
| `seed_votes` | id, room_id, participant_id, movie_id (aprobación) |
| `matches` | id, room_id, round, slot, movie_a_id, movie_b_id, winner_id, decided_by, status |
| `votes` | id, match_id, participant_id, choice_movie_id |
| `screenings` | id, room_id, movie_id, position, scheduled_at (nullable) |

`phase` ∈ `lobby | nominating | seeding | draw | bracket | finished`
Las salas se crean directamente en `nominating`: el lobby y la nominación son la misma
pantalla, así que `lobby` está en el enum pero sin usar.
`status` (matches) ∈ `pending | open | decided`
`decided_by` ∈ `votes | coinflip | host | bye`
`settings` ∈ `{ maxPerPerson?: number }` — sin límite por defecto.

**El host no se guarda en `rooms`.** Sería una FK circular con `participants`. Se identifica
con `participants.is_host` + un índice único parcial que impide dos hosts en la misma sala.

**Índices únicos que sostienen la integridad del juego:**

```sql
UNIQUE (rooms.code)
UNIQUE (movies.room_id, tmdb_id)                    -- sin películas duplicadas en una sala
UNIQUE (votes.match_id, participant_id)             -- un voto por persona por versus
UNIQUE (seed_votes.room_id, participant_id, movie_id) -- una aprobación por peli
UNIQUE (participants.room_id) WHERE is_host         -- un solo host por sala
UNIQUE (participants.room_id, device_token)         -- por sala, NO global: el mismo
                                                    -- dispositivo entra a muchas salas
UNIQUE (participants.room_id, nickname)             -- no hay dos "Josué" en la misma sala
UNIQUE (matches.room_id, round, slot)
UNIQUE (screenings.room_id, position)
```

---

## 5. Invariantes — NO romper

1. **Máx 16 películas por sala.** Validar en la Server Action *y* con el índice único; nunca
   solo en el cliente.
2. **Un voto por participante por match**, garantizado por la base de datos. Si el insert
   falla por conflicto, es un intento de doble voto: devolver error, no hacer upsert silencioso.
3. **Los votos son secretos** hasta que el match cierra. La query que alimenta la UI de
   votación *no debe* devolver el conteo parcial ni quién votó qué. Evita el efecto arrastre.
4. **`movies.added_by` solo se expone al host.** El serializer de la lista de nominaciones
   omite el campo para todos los demás participantes. Es una regla de servidor, no de UI: no
   basta con ocultarlo en el render.
5. **El azar vive en el servidor y es reproducible.** `rooms.draw_seed` y `rooms.tiebreak_seed`
   se guardan al crear la sala. El sorteo y la moneda al aire se derivan de
   `(seed, match.id)` con un PRNG determinista. La animación del cliente **muestra** un
   resultado ya decidido; nunca lo genera. Sin esto, un refresh cambiaría el ganador.
6. **Solo el host cambia `room.phase`** y solo el host modera. Verificar `is_host` en el
   servidor en cada transición y en cada borrado ajeno.
7. **`src/lib/bracket.ts` es puro** (sin I/O, sin `Date.now()`, sin `Math.random()`): recibe
   estado y devuelve estado. Es lo único con tests obligatorios.
8. **`TMDB_API_KEY` nunca llega al cliente.** Toda llamada pasa por `/api/tmdb/*`.
9. Los datos de TMDB se **denormalizan** al insertar la película. La cartelera debe seguir
   funcionando si TMDB está caído.

---

## 6. Reglas del torneo

**Nominación.** Cualquiera agrega las películas que quiera hasta llegar a 16 en total. Cada
uno puede retirar las suyas; **el host puede retirar cualquiera**, incluidas las ajenas, y ve
quién nominó qué para hacer ese primer filtro. Si el reparto se desbalancea, el host puede
fijar `settings.maxPerPerson`; por defecto no hay tope individual.

**Siembra.** Cada participante marca todas las películas que estaría dispuesto a ver
(voto de aprobación, sin límite). El puntaje de una película = nº de aprobaciones.

**Sorteo.** Las 4 mejor puntuadas son cabezas de serie y van a los slots `0, 8, 4, 12` de un
cuadro de 16, de modo que no puedan cruzarse antes de semifinales. Las 12 restantes se barajan
con Fisher-Yates usando `draw_seed`. Empate en el puntaje de siembra → desempata el mismo seed.

**Cuadro incompleto.** Si hay menos de 16 películas, se rellena hasta la siguiente potencia de 2
con *byes*, y los byes se asignan **a los cabezas de serie** (como en el Mundial). Con ≤4
películas se salta directo a semifinales/final.

**Rondas.** 16 → octavos, cuartos, semis, final (15 matches). Todos los matches de una ronda
están abiertos a la vez. La ronda cierra cuando **todos los participantes activos** han votado
todos sus matches, o cuando el host fuerza el cierre.

**Cierre forzado.** El host puede cerrar una ronda con votos pendientes, pero **siempre tras un
diálogo de confirmación** que diga cuántas personas faltan y qué matches se resolverán sin sus
votos. Es una acción irreversible disparable por error desde el móvil.

**Empate en un match.** Moneda al aire derivada de `(tiebreak_seed, round, slot)` — no del
UUID del match, que no es un número y no serviría de semilla —,
`decided_by = 'coinflip'`. La UI reproduce una animación de moneda que aterriza en el
resultado guardado.

**Resultado.** No hay una sola ganadora: campeona, subcampeona y las dos semifinalistas pasan a
`screenings` como las próximas cuatro noches, en ese orden.

---

## 7. Convenciones

- **Mobile-first sin excepción.** Se vota desde el celular en el sofá. El bracket completo en
  pantalla chica es el problema de UI más difícil del proyecto: resolverlo con scroll horizontal
  por rondas + vista "match actual" a pantalla completa, no encogiendo el cuadro entero.
- Mutaciones vía **Server Actions**; los Route Handlers quedan para el proxy de TMDB.
- Toda la copy de la interfaz en **español**, tono informal ("Tu voto", "Faltan 3 por votar").
- **Títulos bilingües.** Buscar en TMDB con `language=es-MX` y guardar `title` (español) y
  `original_title`. Mostrar el español como principal y el original debajo en menor jerarquía;
  si coinciden, mostrar uno solo. El buscador de TMDB ya encuentra por título original, así que
  escribir "Interstellar" funciona sin trabajo extra.
- `PosterImage` siempre con placeholder y fallback: los `poster_path` faltantes son comunes.
- Atribución de TMDB obligatoria en el footer: *"This product uses the TMDB API but is not
  endorsed or certified by TMDB."*
- Buscador de TMDB con debounce de 300 ms y caché por query.

---

## 8. Roadmap

**MVP** — crear/unirse a sala, buscador TMDB, tope de 16, moderación del host, siembra,
sorteo animado, bracket con votación en vivo, podio. *Con esto ya resuelve el problema real.*

**v1** — cartelera con fechas, compartir con imagen OG para WhatsApp, pulido de animaciones.

**v2 (explícitamente fuera por ahora)** — proveedores de streaming por país, historial de
"ya vistas" y ratings, salas recurrentes, series, repechaje, estadísticas por persona, PWA.

---

## 9. Estado actual

**Funcionando de punta a punta**

- Neon conectado, migraciones `0000` y `0001` aplicadas contra la base real.
- TMDB conectado con el token v4. Búsqueda verificada: devuelve `Interestelar` /
  `Interstellar`, exactamente el par bilingüe que necesita la UI.
- Fase 1 completa: crear sala, entrar con código + apodo, buscar en TMDB, nominar hasta 16,
  retirar nominaciones (las propias cualquiera; las ajenas solo el host).
- `src/lib/bracket.ts` + 30 tests: PRNG determinista, siembra estándar, byes a las cabezas de
  serie, moneda al aire reproducible, avance de rondas.
- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.

**Probado contra el servidor real**, no solo compilado: landing 200, sala existente 200 con
formulario de apodo, código en minúsculas resuelto por `normalizeRoomCode`, sala inexistente
404, proxy de TMDB 401 sin cookie y 401 con firma falsificada, 200 con cookie válida.

**Siguientes pasos**

1. Fase de siembra: pantalla de aprobación + `seed_votes` + acción para cerrarla (solo host).
2. Sorteo: generar `matches` de la ronda 1 con `drawSlots` + `initialMatches`, con animación.
3. Llaves: pantalla de versus, `votes`, cierre de ronda, cierre forzado con confirmación,
   animación de moneda al aire.
4. Cartelera: podio → `screenings`.
5. Polling con SWR para que el cuadro se mueva en vivo para todos.

**Deuda conocida**

- El puerto 3000 lo ocupa otro proyecto del usuario (JKore); `next dev` cae al 3001.
- `npm audit` reporta vulnerabilidades transitivas de tooling (eslint→minimatch,
  esbuild dev-server, sharp/libvips). `npm audit fix --force` degradaría Next: no correrlo.
  Revisar cuando suban las versiones de `eslint-config-next` y `drizzle-kit`.
- Las Server Actions de sala devuelven `{ ok, error }` en vez de lanzar: el cliente muestra el
  mensaje tal cual, así que los textos de error son copy visible para el usuario.

---

@AGENTS.md
