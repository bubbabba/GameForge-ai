/**
 * Injects a tiny console-capture shim into the game HTML.
 *
 * The shim intercepts console.log / warn / error and window.onerror /
 * unhandledrejection, then postMessages them to the parent window (the
 * editor) so the IDE console panel can display them in real time.
 *
 * The shim itself is written in plain ES5 so it runs in any browser even
 * if the game code has a syntax error before the shim finishes executing.
 * The </script> inside the string literal is split to avoid breaking the
 * outer HTML parser.
 */

const SHIM = `<script>
(function () {
  'use strict';
  var _orig = { log: console.log, warn: console.warn, error: console.error };
  ['log', 'warn', 'error'].forEach(function (level) {
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        try {
          return typeof a === 'object' && a !== null
            ? JSON.stringify(a, null, 2)
            : String(a);
        } catch (_) { return '[Object]'; }
      });
      try {
        window.parent.postMessage(
          { type: 'game-console', level: level, message: args.join(' ') },
          '*'
        );
      } catch (_) {}
      _orig[level].apply(console, arguments);
    };
  });

  window.onerror = function (msg, src, line, col, err) {
    var text = err
      ? (err.stack || err.message || String(msg))
      : String(msg);
    if (line) text += '  (line ' + line + (col ? ':' + col : '') + ')';
    try {
      window.parent.postMessage(
        { type: 'game-console', level: 'error', message: text },
        '*'
      );
    } catch (_) {}
    return false;
  };

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var text = r
      ? (r.stack || r.message || String(r))
      : 'Unhandled promise rejection';
    try {
      window.parent.postMessage(
        { type: 'game-console', level: 'error', message: text },
        '*'
      );
    } catch (_) {}
  });
})();
<` + `/script>`;

/**
 * Returns a copy of `html` with the console-capture shim inserted as early
 * as possible (right after <head>, <body>, or at the very beginning).
 */
export function injectConsoleCapture(html: string): string {
  if (!html) return html;
  if (html.includes("<head>")) {
    return html.replace("<head>", "<head>" + SHIM);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => m + SHIM);
  }
  return SHIM + html;
}
