---
name: Radix Dialog form reset
description: Why dialog form fields retain stale values across reopens, and how to reset them correctly.
---

When a dialog's body is factored into its own React component (e.g. `<Dialog open={x}><MyDialogBody/></Dialog>`), that body component does NOT unmount when the dialog closes — only Radix's portal content is removed from the DOM via Presence. The component instance (and its `useState`) persists.

**Consequence:** resetting form state with `useEffect(() => {...}, [])` or a constant dependency runs only once. Reopening the dialog shows the previous values, which can submit stale/unintended data (e.g. an answer's text + isCorrect carried into the next "add answer").

**Rule:** Pass the `open` boolean into the body component and reset form fields in `useEffect(..., [open, ...])` guarded by `if (open)`. For controlled dialogs whose state lives in the parent, also clear that state on close — both via `onOpenChange(o => { if (!o) reset() })` (covers Esc/overlay/X) AND in the explicit Cancel button onClick (a button calling `setOpen(false)` does NOT trigger `onOpenChange`).

**How to apply:** any time you split a Dialog body into its own component or keep dialog field state in a parent. Verify by opening, typing, cancelling, and reopening — fields must be clean.
