# Client design system

## Direction

"Lab notebook": a calm, readable workspace for a security wargame. Neutral green-grey
surfaces, one teal accent, and monospace for addresses, code, and labels. Surfaces are flat
with 1px borders. Only menus and dialogs have a shadow. There are no gradients and no glow.

## Files

All files are in `src/styles/`.

| File | Content |
| --- | --- |
| `tokens.css` | All tokens |
| `base.css` | Element defaults, focus, reduced motion |
| `components.css` | Components (`ui-*` classes) |
| `shell.css` | Header, footer, page shell, loading indicator |
| `app.css` | Imports, rules shared by pages, and the 404 page |
| `home.css`, `level.css`, `stats.css`, `leaderboard.css` | Page styles |

## Theme

`data-theme` on `<html>` is `light` or `dark`. A script in `public/index.html` sets it before
the first paint: it uses `theme` from `localStorage`, or `prefers-color-scheme` when no choice
is saved. The switch in the header menu saves the choice.

Level art is not filtered. It sits on an `--color-art` plate in both themes.

## Color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-bg` | `#f6f8f7` | `#0e1513` | Page background |
| `--color-surface` | `#ffffff` | `#16201d` | Header, footer, cards, menus, dialogs |
| `--color-text` | `#14201d` | `#e6efec` | Text |
| `--color-text-muted` | `#51615c` | `#9db0aa` | Secondary text |
| `--color-border` | `#d5dedb` | `#2a3833` | Decorative borders |
| `--color-border-strong` | `#7c8c86` | `#647771` | Borders of inputs and controls |
| `--color-accent` | `#0b6b57` | `#4fd1b0` | Links, primary buttons, focus |
| `--color-on-accent` | `#ffffff` | `#06231c` | Text on the accent |
| `--color-success` | `#1b6e2e` | `#6fd184` | Success |
| `--color-warning` | `#855300` | `#f0b955` | Warning |
| `--color-danger` | `#b3261e` | `#ff8a80` | Error |
| `--color-art` | `#eddfd6` | `#eddfd6` | Plate behind level art |
| `--color-backdrop` | `rgba(0, 0, 0, 0.5)` | same | Layer behind dialogs |

Text and status colors have at least 4.5:1 contrast on `bg` and `surface`. `border-strong`
has at least 3:1.

## Other tokens

| Group | Tokens |
| --- | --- |
| Font | `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono), then system fonts |
| Text size | `--text-xs` 12px, `--text-sm` 14px, `--text-md` 16px, `--text-lg` 18px, `--text-xl` 22px, `--text-title` `clamp(28px, 6vw, 48px)` |
| Line height | `--line-height` 1.6 |
| Spacing | `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px, `--space-6` 32px, `--space-7` 48px, `--space-8` 64px |
| Radius | `--radius-control` 6px, `--radius-card` 10px (cards, menus, and dialogs) |
| Shadow | `--shadow-overlay` `0 8px 24px rgba(0, 0, 0, 0.2)` (menus and dialogs) |
| Width | `--width-page` 1120px, `--width-reading` 760px, `--gutter` `clamp(16px, 4vw, 32px)` |
| Touch | `--touch-target` 44px |
| Motion | `--duration` 150ms, 0ms under `prefers-reduced-motion: reduce` |

Body text is `--text-md`. No text is smaller than `--text-xs`. Focus is a 2px accent outline
with a 2px offset on `:focus-visible`; on menu items the offset is -2px because the menu clips it.

## Components

| Component | Classes |
| --- | --- |
| Button | `ui-button` (primary), `ui-button--secondary` |
| Card | `ui-card` |
| Badge | `ui-badge`, `ui-badge--success`, `ui-badge--warning`, `ui-badge--danger` |
| Input | `ui-input` |
| Menu | `ui-menu`, `ui-menu__item`, `ui-menu__group` |
| Dialog | `ui-dialog-backdrop`, `ui-dialog`, `ui-dialog__icon`, `ui-dialog__title`, `ui-dialog__close`, `ui-dialog__actions` |
| Alert | `ui-alert`, `ui-alert--success`, `ui-alert--warning`, `ui-alert--danger` |
| Table | `ui-table-wrapper` (horizontal scroll), `ui-table` |
| Prose | `ui-prose` |
| Code block | `ui-code` on `<pre>`; the syntax theme is dark in both themes |

A modifier class is used together with its base class. `ui-menu__item` shows its state from
`aria-expanded` (+ or −), and from `aria-checked` or `aria-current` (a check mark).

## Shell

| Part | Classes |
| --- | --- |
| Page shell | `app-shell`, `app-shell__content` |
| Header | `site-header`, `site-header__inner`, `site-header__wordmark`, `site-header__notice`, `site-header__menu` |
| Alert row under the header | `site-alert` |
| Loading indicator | `progress-bar-wrapper` |
| Footer | `site-footer`, `site-footer__inner` |

`index.js` renders the header, the page, and the footer once, for all routes. The shell is a
column of at least `100dvh`. The footer is in normal flow: at the bottom on short pages, after
the content on long pages.

Scripts show and hide `progress-bar-wrapper`, `deploy-window-bg`, and
`account-connection-window-bg` with `style.display`.

## Responsive rules

- Mobile first. The breakpoints are `min-width: 640px` and `min-width: 1024px`.
- No fixed width is larger than 320px. Use `max-width` and `min()`.
- Page content is at most `--width-page` wide, with `--gutter` at both sides.
- Below 640px the fork notice is on its own row, the menu fills the width between the gutters,
  and dialog buttons are stacked and full width.
- From 640px the notice is beside the wordmark, the menu is 320px wide at the inline end, and
  dialog buttons are in a row.
- Menus and dialogs scroll inside the viewport.
- Use logical properties, such as `margin-inline` and `inset-inline-end`.
