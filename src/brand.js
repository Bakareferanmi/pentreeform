// Approved user-supplied SVG. Keep the wordmark separate.
export const BRAND_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"256\" height=\"256\" role=\"img\" aria-label=\"Pentreeform\">\n  <rect width=\"64\" height=\"64\" rx=\"16\" fill=\"#6020c8\"/>\n  <!-- pen nib -->\n  <path fill=\"#fff\" d=\"M32 8 45 26Q48 31 44 37L40 53Q32 57 24 53L20 37Q16 31 19 26Z\"/>\n  <!-- slit + eye of the nib -->\n  <path d=\"M32 12V26\" stroke=\"#6020c8\" stroke-width=\"2.4\" stroke-linecap=\"round\" fill=\"none\"/>\n  <circle cx=\"32\" cy=\"30\" r=\"3.4\" fill=\"#6020c8\"/>\n  <!-- tree branching inside the nib -->\n  <path d=\"M32 36V50M32 44 26.5 39M32 44 37.5 39\" stroke=\"#6020c8\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/>\n</svg>\n";

// One approved mark for React and the dashboard renderer. Decorative, never a second announcement.
export function brandMotionMarkup(state='loading'){
 const motion=['loading','notice','error'].includes(state)?state:'loading';
 const svg=BRAND_ICON.replace('role="img" aria-label="Pentreeform"','aria-hidden="true" focusable="false"');
 return '<span class="brand-motion brand-motion--'+motion+'" aria-hidden="true">'+svg+'</span>';
}
