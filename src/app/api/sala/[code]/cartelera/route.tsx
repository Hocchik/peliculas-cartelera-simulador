import { asc, eq } from "drizzle-orm";
import { ImageResponse } from "next/og";

import { db, movies, screenings } from "@/db";
import { posterUrl } from "@/lib/poster";
import { findRoomByCode } from "@/lib/rooms";

/**
 * La cartelera como imagen, para pegarla en el grupo. Es pública a propósito:
 * tiene que poder leerla el previsualizador de WhatsApp, que no manda cookies.
 * Solo expone lo que ya sabe cualquiera que tenga el código de la sala.
 */

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING = 48;
const GAP = 16;
/** Alto que se lleva el texto bajo cada póster: posición, título y año. */
const CAPTION_HEIGHT = 84;
/**
 * Lo que puede ocupar una tarjeta. Deliberadamente por debajo del hueco real:
 * con 3 o 4 películas el póster crecería hasta pegar los años contra el pie.
 */
const ROW_HEIGHT = 390;

const LABELS = [
  "Campeona",
  "Subcampeona",
  "Semifinalista",
  "Semifinalista",
  "Elegida por el host",
  "Elegida por el host",
];

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const room = await findRoomByCode(code);
  if (!room) return new Response("La sala no existe", { status: 404 });

  const lineup = await db()
    .select({
      position: screenings.position,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
    })
    .from(screenings)
    .innerJoin(movies, eq(screenings.movieId, movies.id))
    .where(eq(screenings.roomId, room.id))
    .orderBy(asc(screenings.position));

  if (lineup.length === 0) {
    return new Response("Esta sala todavía no tiene cartelera", { status: 404 });
  }

  // El póster se limita por los dos lados: con 6 manda el ancho, con 3 o 4
  // mandaría el alto y se saldrían de la imagen.
  const available = WIDTH - PADDING * 2;
  const byWidth = Math.floor((available - GAP * (lineup.length - 1)) / lineup.length);
  const byHeight = Math.floor((ROW_HEIGHT - CAPTION_HEIGHT) / 1.5);
  const posterWidth = Math.min(byWidth, byHeight);
  const posterHeight = Math.round(posterWidth * 1.5);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0b",
          color: "#fafafa",
          padding: PADDING,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div style={{ fontSize: 46, fontWeight: 700 }}>{room.name}</div>
          <div style={{ fontSize: 22, color: "#8a8a93" }}>· Mundial de Pelis</div>
        </div>

        <div
          style={{
            display: "flex",
            gap: GAP,
            marginTop: 28,
            flex: 1,
            alignItems: "center",
            // Con menos de 6 el ancho sobra; centrar evita el vacío a la derecha.
            justifyContent: "center",
          }}
        >
          {lineup.map((movie) => {
            const src = posterUrl(movie.posterPath, "w342");
            return (
              <div
                key={movie.position}
                style={{ display: "flex", flexDirection: "column", width: posterWidth }}
              >
                {/*
                  El título va detrás del póster: si TMDB no sirve la imagen, el
                  hueco no queda mudo. Cuando carga, la tapa por completo.
                */}
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    alignItems: "center",
                    justifyContent: "center",
                    width: posterWidth,
                    height: posterHeight,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#1b1b1f",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      padding: 12,
                      fontSize: 17,
                      color: "#6e6e78",
                      textAlign: "center",
                    }}
                  >
                    {movie.title}
                  </div>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      width={posterWidth}
                      height={posterHeight}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    marginTop: 12,
                    fontSize: 15,
                    color: movie.position === 1 ? "#f0c040" : "#8a8a93",
                  }}
                >
                  {movie.position}. {LABELS[movie.position - 1] ?? "En cartelera"}
                </div>

                <div
                  style={{
                    display: "flex",
                    marginTop: 4,
                    fontSize: 19,
                    fontWeight: 600,
                    width: posterWidth,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {movie.title}
                </div>

                {movie.year ? (
                  <div style={{ display: "flex", marginTop: 2, fontSize: 15, color: "#8a8a93" }}>
                    {movie.year}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", fontSize: 15, color: "#5c5c66" }}>
          Datos e imágenes de TMDB
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Corta para que el host vea al toque el cambio si edita las elegidas.
        "cache-control": "public, max-age=60",
      },
    },
  );
}
