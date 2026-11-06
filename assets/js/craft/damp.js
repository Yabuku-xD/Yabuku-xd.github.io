/** Travel past a limit flattens out toward `max` instead of stopping dead. */
export function damp(distance, max) {
  return max * (1 - Math.exp(-distance / max));
}
