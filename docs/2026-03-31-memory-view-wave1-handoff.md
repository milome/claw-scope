# MemoryView Wave 1 Handoff

Date: 2026-03-31
Status: Wave 1 in progress
Target: `src/app/components/views/MemoryView.tsx`

## Goal

Lock down the first ownership split for `MemoryView` so follow-up refactors do not re-entangle layout shell, scroll containers, and tab content.

## Ownership Contract

### Shell ownership

`MemoryView` owns the outer shell.

Current owner:

- `MemoryViewShell` inside [MemoryView.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryView.tsx)

Rules:

- The shell owns the shared rounded container, border, background mode, min-height, and `relative` positioning.
- The shell is the only layer allowed to decide whether the tab workspace is visible.
- Child panels must not recreate the outer shell card.

### Scroll ownership

`MemoryView` owns the absolute scroll frame.

Current owner:

- `MemoryViewScrollRegion` inside [MemoryView.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryView.tsx)

Rules:

- The scroll region owns `absolute inset-0 overflow-auto`.
- Individual tab panels receive content space inside that frame.
- Extracted tab components should not add another competing page-level absolute scroll root unless there is a documented exception.

### Drawer ownership

The diagnostics drawer is now owned by:

- [MemoryDiagnosticsDrawer.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryDiagnosticsDrawer.tsx)

Rules:

- Drawer rendering, close button, and diagnostics card composition live in the drawer component.
- `MemoryView` retains state ownership only: open/close state, summaries, and callbacks.

### Tab ownership

The search tab is now owned by:

- [MemorySearchPanel.tsx](D:/Dev/claw-scope/src/app/components/views/MemorySearchPanel.tsx)

The footprints tab is now owned by:

- [MemoryFootprintsPanel.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryFootprintsPanel.tsx)

The knowledge tab is now owned by:

- [MemoryKnowledgePanel.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryKnowledgePanel.tsx)

Rules:

- The panel owns search-tab body layout and result rendering.
- `MemoryView` still owns cross-tab state, gateway calls, routing callbacks, and shell/scroll placement.

### Documents internal ownership

The documents tab still belongs to `MemoryView`, but its internal layouts are now split into:

- [MemoryDocumentsDesktop.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryDocumentsDesktop.tsx)
- [MemoryDocumentsMobile.tsx](D:/Dev/claw-scope/src/app/components/views/MemoryDocumentsMobile.tsx)

Rules:

- Desktop/mobile layout decisions live in those components, not inline in `MemoryView`.
- `MemoryView` still owns the documents tab header, save/reload controls, and document state.

## Checklist

- `MemoryViewShell` remains the only owner of the workspace outer shell.
- `MemoryViewScrollRegion` remains the only owner of the page-level tab scroll frame.
- `MemoryDiagnosticsDrawer` contains drawer JSX; `MemoryView` only passes state and callbacks.
- At least one tab panel is extracted without duplicating shell ownership.
- `search`, `footprints`, and `knowledge` are extracted panels.
- `documents` desktop/mobile rendering is split without changing tab-level ownership.
- New extracted panels do not silently introduce a second shell or second page-level scroll container.

## Next likely Wave 1 follow-up

- Next decision point is whether to fully extract the documents tab shell/header, or keep it centralized while only extracting deep substructure.
