const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
export function scrollSceneState(top: number, trackHeight: number, stageHeight: number, count: number) {
  const progress = clamp(-top / Math.max(1, trackHeight - stageHeight), 0, 1);
  const position = progress * Math.max(0, count - 1);
  return { progress, position, active: Math.round(position) };
}
export function cardSceneMotion(position: number, index: number, reduced: boolean) {
  if (reduced) return { opacity: 1, y: 0, scale: 1 };
  const distance = index - position;
  return { opacity: clamp(1 - Math.abs(distance), 0, 1), y: clamp(distance, -1, 1) * 90, scale: 1 - Math.min(1, Math.abs(distance)) * .055 };
}
