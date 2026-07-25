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
| Cupo de nominaciones | **4 por invitado**; el host no tiene tope, porque rellena y modera. |
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
- **Polling de un latido cada 3 s** para el estado en vivo: `/api/sala/[code]/pulse` devuelve
  solo una huella del estado y el cliente llama a `router.refresh()` únicamente si cambió.
  Es suficiente para ≤10 usuarios; no añadir WebSockets/Pusher salvo que se note lag real.
- **Zod** para validar todo input de usuario y toda respuesta de TMDB.
- **TMDB** para búsqueda, pósters y metadatos.
- Deploy en **Vercel**. Todo el stack cabe en tiers gratuitos.

### Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run — unitarios, sin red ni base
npm run test:db      # vitest run --config vitest.integration.config.ts (toca Neon)
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
    api/sala/[code]/pulse/route.ts  # huella del estado para el polling
  components/
    phases/                      # una por room.phase; page.tsx solo despacha
    movie/                       # MovieSearch, PosterImage, RemoveMovieButton
    seeding/                     # ApprovalCard
    bracket/                     # BracketGrid, VoteCard
    room/                        # CreateRoomForm, JoinRoomForm, RoomCode, LiveUpdates, HostButton
    ui/                          # shadcn
  db/
    schema.ts  index.ts  migrations/
  lib/
    bracket.ts     # cuadro, siembra, avance de rondas (PURO, testeado)
    tournament.ts  # el cuadro contra la base: generar, resolver ronda, podio
    room-types.ts  # tipos de vista compartidos con el cliente
    tmdb.ts        # cliente de TMDB, `server-only`
    tmdb-types.ts  # tipos compartidos con el cliente
    poster.ts      # URLs de póster, seguro en el cliente
    session.ts     # cookie firmada de participante
    rooms.ts       # lectura del estado de sala (recorta la autoría)
    nominations.ts # topes por persona y huella de estado (PURO, testeado)
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

**Nominación.** Cada invitado puede nominar **4 películas** (`DEFAULT_MAX_PER_GUEST`), hasta
llegar a 16 en la sala. El **host no tiene tope**: es quien rellena el cuadro si falta gente y
quien modera. `settings.maxPerPerson` pisa el tope de los invitados, nunca el del host.

Cada uno puede retirar las suyas; **el host puede retirar cualquiera**, incluidas las ajenas, y
ve quién nominó qué para hacer ese primer filtro.

El tope se comprueba en el servidor dentro de `addMovie`, no solo desactivando el buscador: la
Server Action es alcanzable con un POST directo.

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

**El flujo completo funciona**: nominar → sembrar → sortear → votar los versus → cartelera.

- Neon conectado, migraciones `0000` y `0001` aplicadas.
- TMDB conectado con el token v4 (`Interestelar` / `Interstellar`: el par bilingüe que
  necesita la UI).
- Actualización en vivo por latido; tope de 4 nominaciones por invitado, host sin tope.
- Las rondas se cierran solas cuando votan todos; el host puede forzarlas antes.
- 42 tests unitarios + 5 de integración contra Neon. `typecheck`, `lint` y `build` pasan.

**Verificado contra el servidor real**, no solo compilado:

- Torneo completo con 11 películas: 8 cruces en la primera ronda, 5 byes, la más aprobada
  pasa sin jugar, 15 cruces en total, 4 rondas, podio de 4 en la cartelera.
- Resolver una ronda ya cerrada no duplica cruces ni cartelera.
- Cada fase renderiza lo suyo y los botones de host no aparecen para los invitados.
- **Invariante 3 comprobada en el payload**: con un cruce abierto y un voto emitido, el
  cliente recibe `"tally":null` y no hay ningún conteo real; el marcador aparece recién
  cuando el cruce cierra.
- Proxy de TMDB: 401 sin cookie, 401 con firma falsificada, 200 con cookie válida.

**Siguientes pasos**

1. Animación de la moneda al aire (hoy el empate se resuelve bien, pero se ve como un
   resultado más; falta el momento).
2. Reemplazar `window.confirm` del `HostButton` por un `AlertDialog` de shadcn.
3. Fechas en la cartelera y compartir con imagen OG para WhatsApp.
4. Deploy en Vercel.

**Deuda conocida**

- `npm audit` reporta vulnerabilidades transitivas de tooling (eslint→minimatch,
  esbuild dev-server, sharp/libvips). `npm audit fix --force` degradaría Next: no correrlo.
  Revisar cuando suban las versiones de `eslint-config-next` y `drizzle-kit`.
- Las Server Actions de sala devuelven `{ ok, error }` en vez de lanzar: el cliente muestra el
  mensaje tal cual, así que los textos de error son copy visible para el usuario.
- El driver HTTP de Neon no da transacciones interactivas. Donde hace falta atomicidad se
  compensa a mano (ver `createRoom`). `resolveOpenRound` no es atómica: si se cortara a mitad,
  quedarían cruces resueltos sin la ronda siguiente. Se arregla volviendo a cerrar la ronda.
- Una sala terminada no se puede reabrir ni volver a jugar; hay que crear otra.

---

@AGENTS.md
