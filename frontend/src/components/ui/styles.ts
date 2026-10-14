/**
 * Centralised control-panel styling.
 *
 * Extracted from ControlPanel.tsx so panel sections can be split into their own
 * files without each one re-deriving its own Tailwind class strings.
 */
// ============================================================================
// CENTRALIZED UI STYLING SYSTEM
// ============================================================================

export const UI_STYLES = {
  // Typography
  typography: {
    heading: 'text-base font-semibold text-white',
    subheading: 'text-sm font-medium text-gray-300',
    label: 'text-xs text-gray-400',
    caption: 'text-[10px] text-gray-500',
    body: 'text-xs text-gray-300',
  },

  // Spacing & Layout
  spacing: {
    px: 'px-3',
    py: 'py-2.5',
    gap: 'gap-2',
    section: 'space-y-3',
  },

  // Colors
  colors: {
    background: 'bg-gray-900',
    border: 'border-gray-800',
    text: 'text-white',
    textSecondary: 'text-gray-300',
    hover: 'hover:bg-gray-800',
    active: 'bg-gray-700 text-accent-cyan',
  },

  // Buttons & Controls
  button: {
    primary: 'px-3 py-2 rounded-lg bg-accent-cyan text-gray-900 font-medium text-sm hover:bg-accent-cyan/90 transition-all',
    secondary: 'px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:text-white transition-all text-xs font-medium',
    small: 'px-2 py-1.5 rounded text-xs font-medium transition-all',
  },

  // Input fields
  input: 'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan',

  // Toggle/Checkbox
  toggle: 'w-4 h-4 rounded accent-accent-cyan cursor-pointer',

  // Slider
  slider: 'w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan',
};
