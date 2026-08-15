# EVOQ UI Design System

## Visual direction

Professional esports control platform. Visual language should
communicate: - competition - technology - live operations - clarity

Avoid excessive animation and decorative effects that reduce usability.

## Technology

React + normal CSS. No Tailwind. No Bootstrap. Prefer CSS Modules or a
clearly scoped modular CSS architecture.

## Layout

Responsive: - large desktop - desktop/tablet - tablet - mobile - small
mobile

## Core patterns

-   App shell
-   Sidebar
-   Top navigation
-   Page header
-   Cards
-   Tables
-   Tabs
-   Modals
-   Drawers
-   Toast/feedback
-   Empty states
-   Skeleton/loading states
-   Error states
-   Permission states

## Tables

Tables live inside overflow containers on narrow screens. Never cause
page-level horizontal scrolling.

## Forms

Stack fields on narrow screens. Use accessible labels and validation
messages.

## Touch

Interactive controls should have comfortable touch targets.

## Notification panel

Render at a high-level container/portal so parent overflow and stacking
contexts cannot clip it.

## Accessibility

-   semantic HTML
-   keyboard navigation
-   visible focus
-   labels
-   appropriate ARIA where needed
-   sufficient contrast
-   non-hover-only actions

## State presentation

Every data-driven page supports: - loading - populated - empty -
validation error - API error - permission denied - network failure
