export const CAMPAIGN_LAYOUTS = [
  { id: 'film', name: 'Film', hint: 'Full-height image film controlled by scrolling', icon: '▣' },
  { id: 'stack', name: 'Stacked cards', hint: 'Rounded cards slide over one another, like your reference', icon: '▱' },
  { id: 'horizontal', name: 'Horizontal cards', hint: 'Swipe or use arrows to explore one card at a time', icon: '↔' },
  { id: 'grid', name: 'Card grid', hint: 'See every card together with a gentle hover lift', icon: '▦' },
  { id: 'fan', name: 'Fan cards', hint: 'A playful tilted deck that straightens on hover', icon: '◈' },
  { id: 'fade', name: 'Fade cards', hint: 'One card at a time with a soft crossfade', icon: '◐' },
] as const;
export function campaignLayout(value: unknown) {
  return CAMPAIGN_LAYOUTS.some(layout => layout.id === value) ? String(value) : 'film';
}
