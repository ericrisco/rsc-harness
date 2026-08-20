// Negative control. Everything here LOOKS like a tell to a naive pattern and is not one:
// a URL with digits before a slash, a viewBox, and an em-dash inside a code comment.
/* tokens — lifted from styles.css, no magic hex */
export const Mark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
    {/* the hairline grid — structural, not decoration */}
    <rect width="100" height="100" rx="22" />
  </svg>
);
