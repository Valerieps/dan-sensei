# ADR-011: The visual identity follows Apple's Human Interface Guidelines

**Status:** Accepted
**Date:** 2026-11-15
**Decision:** The app looks and behaves like a native iOS and iPadOS 26 app, with Dan's colors as
the accent. The values live in `src/ui/theme/tokens.css`. The design system with its components,
previews and reasons is the claude.ai artifact "Dan Sensei" (design system), owned by Valéria:
https://claude.ai/artifact/Q49svvL9C1EZ8DHZpmym36.
- **Color:**
  - The surfaces are Apple's grouped backgrounds: `#F2F2F7` and `#FFFFFF` in light; `#000000`,
    `#1C1C1E` and `#2C2C2E` in dark.
  - The accent (`--color-brand`) is Dan's emerald `#10B981` in dark and `#047857` in light, where the
    lighter one fails 4.5:1 with white text.
  - Red (`#D70015` / `#FF6961`) and orange (`#B25000` / `#FFB340`) are Apple's high-contrast
    variants. Red is for billing and destructive confirmations, orange for health.
  - The live class has its own colors, the same in both themes: work emerald, rest `systemIndigo`
    `#5E5CE6`, prep paper `#E8E2D4`.
  - Secondary text is opaque (`#636366` / `#98989F`), because Apple's 60% secondaryLabel misses
    4.5:1.
- **Type:** the system fonts. `--font-sans` is SF Pro, and `--font-rounded` is SF Pro Rounded for
  the live class and big numbers. The scale is iOS's footnote, subheadline, body, title 2, title 1
  and large title (13, 15, 17, 22, 28, 34 px). No web font is bundled.
- **Shape:**
  - The radii are concentric: 12 for fields, 22 for cards (`--radius-card`), 34 for sheets and bars
    (`--radius-sheet`).
  - Buttons are capsules.
  - Cards separate from the background by color, without borders.
  - The glass material (`--color-glass`, `--blur-glass`) is used only on the floating control layer.
- **Navigation** (product rule in `docs/spec/telas-de-gestao.md`):
  - A tab bar: Hoje, Agenda, Alunos, plus Exercícios on iPad. On iPad it sits at the top and turns
    into a sidebar; on iPhone it floats at the bottom.
  - Actions live in the toolbar: + menu, search, settings.
  - Short tasks open in sheets.
  - The appearance follows the device, with no in-app theme switch.
- **Logo:** Tatame, a pinwheel of four mats around a square. It appears only in the app icon
  (`public/icon*.svg`, emerald field) and in the live class header.

**Why:**
- Dan uses an iPad and an iPhone every day. Components he already knows cost nothing to learn and
  make the app read as a finished product.
- System fonts bring Dynamic Type, Bold Text and optical sizes, and keep the bundle free of font
  files (`docs/SEGURANCA.md`: minimize dependencies).
- The review followed the `apple-design` skill (Apple's HIG pages, June 2026 edition). It cited:
  - `branding.md`: accent only on primary actions and status;
  - `tab-bars.md`: tabs navigate, they don't act;
  - `liquid-glass.md`: glass only on controls;
  - `dark-mode.md`: no app-specific appearance setting;
  - `accessibility.md`: 44 pt targets, 4.5:1 text.

**Alternatives:**
- The four directions in issue #6 kept the side menu and a dark-only theme.
- A custom-font identity (IBM Plex Sans with Barlow Condensed) was the first draft of the design
  system. It lost to the system fonts for Dynamic Type and to avoid shipping font files.
- For the live class, a free-palette "Ampulheta" direction (light paper, cobalt rest that drains
  like an hourglass) is documented in the artifact "Propostas da aula em dupla":
  https://claude.ai/artifact/HEfZPXNd5gRxKVuKkADoWr. It stays an option for the phase 1c test on
  Dan's iPad (issue #7).
