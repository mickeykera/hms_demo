/**
 * Shared Tailwind colour classes for dynamically-coloured UI elements.
 *
 * Why this exists: Tailwind scans source files for *literal* class strings.
 * A template like `bg-${color}-100` is never emitted into the stylesheet,
 * so those classes silently do nothing at runtime. Every colour that is
 * chosen at runtime must therefore be listed here as a complete string.
 */

export const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100', text: 'text-blue-600' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100', text: 'text-orange-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100', text: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100', text: 'text-green-600' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100', text: 'text-indigo-600' },
  teal: { bg: 'bg-teal-50', icon: 'bg-teal-100', text: 'text-teal-600' },
  pink: { bg: 'bg-pink-50', icon: 'bg-pink-100', text: 'text-pink-600' },
  cyan: { bg: 'bg-cyan-50', icon: 'bg-cyan-100', text: 'text-cyan-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100', text: 'text-yellow-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100', text: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100', text: 'text-emerald-600' },
  gray: { bg: 'bg-gray-50', icon: 'bg-gray-100', text: 'text-gray-600' },
};

/**
 * Look up a palette entry, falling back to `gray` so an unexpected colour
 * name can never produce `undefined` class names.
 */
export function getColor(name) {
  return colorMap[name] || colorMap.gray;
}