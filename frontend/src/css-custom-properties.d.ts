// Inline `style` objects sometimes carry CSS custom properties, e.g.
//   style={{ '--current-sidebar-w': sidebarExpanded ? '240px' : '72px' }}
//
// React's `CSSProperties` intentionally ships WITHOUT an index signature, so
// `checkJs` (via jsconfig.json) flags every `--*` key:
//   "Object literal may only specify known properties, and '--x' does not
//    exist in type 'Properties<string | number, string & {}>'"
//
// This module augmentation — the approach React's own type docs recommend —
// teaches TypeScript about the `--*` custom-property keys once, so we don't
// have to cast at every call site.
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
