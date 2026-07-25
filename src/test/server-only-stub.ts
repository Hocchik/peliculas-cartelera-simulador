/**
 * `server-only` lanza a propósito fuera del contexto react-server, así que en
 * los tests de integración se sustituye por esto. La garantía real la sigue
 * dando el build de Next, que es donde importa.
 */
export {};
