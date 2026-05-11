# Structured Desk Prototype Design

**Goal**

Prototype a more distinctive desktop-web visual design for AiTodo based on the selected `Structured Desk` direction. The prototype should make the app feel editorial, structured, and browser-native rather than mobile-native or iOS-inspired.

**Scope**

This prototype is presentation-only. It should not change task behavior, state flow, persistence, authentication rules, or recurrence logic.

## Visual Direction

The chosen direction is a warm editorial workspace with:

- a paper-like background instead of a flat app shell
- stronger grid and column structure
- sharper edges and lighter corner radius than the current UI
- more typographic hierarchy and less reliance on pill-shaped controls
- restrained accent color, with emphasis coming from spacing, rules, and layout

The design should feel like a thoughtful desktop web app, closer to an editorial board or bulletin layout than a native mobile product.

## Layout

The current narrow central column should evolve into a clearer desktop composition:

- calendar remains available as a side rail
- main area becomes a structured content column with stronger sections
- header, composer, filters, and list should read as stacked editorial blocks
- task rows should feel like cards on a board, but with flatter geometry than the current rounded-shell style

On smaller screens, the prototype should still collapse cleanly and remain usable without introducing a separate visual system.

## Component Treatment

### App Shell

- Introduce warmer page/background tones
- Reduce “floating app” feel
- Use subtle borders, rules, and panel sections to define space

### Header

- Keep existing greeting and sign-out behavior
- Restyle as a desktop page masthead with clearer hierarchy

### Add Task / Sort

- Make the composer look more integrated into the layout
- Reduce the generic “input + blue button” feel
- Keep the existing controls and behavior

### Categories and Filters

- Keep category chips and banners functionally identical
- Restyle them to match the editorial system with flatter shapes and more deliberate spacing

### Task List

- Restyle list items to feel more like structured rows/blocks than mobile cards
- Preserve checkbox, priority, category, due date, recurrence, description, and subtask controls
- Improve hierarchy so title, metadata, and controls feel less cramped

### Auth Screen

- Bring the auth card into the same visual family so the prototype feels coherent

## Error Handling

No new runtime behavior is required. Existing error banners and loading states should be visually restyled only.

## Testing

This prototype is primarily visual. Verification should focus on:

- lint passing
- existing tests still passing
- responsive layout holding together in the browser
- no regressions in core interactions like add task, sort, category filter, due date, and task expansion

## Out of Scope

- changing information architecture
- new task features
- new onboarding copy
- dark mode redesign beyond keeping the current mode functional
- data model or API changes
