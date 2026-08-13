"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

/**
 * The staff rank guide, opened from the "?" button on the org chart.
 *
 * Previously a native <details>/<summary>, which cannot be dismissed by
 * clicking away from it — on touch devices that left the panel stuck open with
 * no obvious way back, since the only close target was a 2.35rem button hidden
 * behind the panel itself. This renders an overlay that fills the whole org
 * chart card instead, and any click or tap anywhere on it closes.
 *
 * Closing on clicks *inside* the panel is deliberate, not an oversight: the
 * rank rows are plain text with nothing interactive in them, so there is no
 * action to swallow, and "tap anywhere to close" is far easier to discover on a
 * phone than aiming for a close button.
 *
 * Portalled to <body>, and this is load-bearing twice over. The org chart is
 * taller than the viewport on every phone, so an overlay scoped to the card
 * centred the panel hundreds of pixels below the fold — it opened "invisibly"
 * and had to be scrolled to. And .team-org-chart carries a backdrop-filter,
 * which makes it a containing block for fixed-position descendants, so
 * position:fixed alone would still have been trapped inside the card. Only
 * escaping the subtree gives a panel that is centred in the viewport at every
 * screen size.
 */
export function RanksHelpPopover({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // createPortal needs a real document, which does not exist during SSR.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    // aria-modal tells assistive tech everything outside the dialog is inert,
    // so focus must move INTO it — otherwise a screen-reader user is stranded
    // on the (now inert) trigger. The panel has nothing tabbable inside, so
    // the panel itself takes focus.
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus goes back to the trigger rather than the top of the document,
      // so keyboard users do not lose their place in the chart.
      triggerRef.current?.focus();
    };

    // Without this the page scrolls behind the panel on touch devices.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    // Same reasoning as the Escape path: the closed dialog must hand focus
    // back to the control that opened it.
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="team-ranks-trigger"
        aria-expanded={open}
        aria-label="View all staff ranks"
        title="View all staff ranks"
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={20} />
      </button>

      {open && mounted && createPortal(
        <div
          className="team-ranks-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Staff rank guide"
          onClick={close}
        >
          <div className="team-ranks-panel" ref={panelRef} tabIndex={-1}>
            {/* Decorative: the whole overlay is the close target, so this X is
                a visual affordance only — as a <button> it was a focusable
                control that did nothing when activated by keyboard. */}
            <span className="team-ranks-close" aria-hidden="true">
              <X size={16} />
            </span>
            {children}
            <p className="team-ranks-dismiss-hint">Tap anywhere or press Esc to close</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
