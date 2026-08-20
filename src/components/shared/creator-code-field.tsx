"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { BadgePercent, Check, ChevronDown, Loader2, X } from "lucide-react";
import { previewCreatorCode, type CreatorCodePreviewResult } from "@/lib/actions/creator-codes";
import { useToast } from "@/components/ui";
import { usd } from "@/lib/utils";
import type { CartItem } from "./cart-provider";

/**
 * Discount-code entry for the cart review step.
 *
 * Collapsed to a single line by default: most buyers do not have a code, and a
 * permanently open input invites people to hunt for one they were never given.
 * Applying happens here, beside the total; the resulting deduction is repeated
 * in the order summary on the request step.
 *
 * The discount is always computed server-side — this sends only the code string
 * and the cart slugs.
 */
export function CreatorCodeField({
  items,
  appliedCode,
  onApplyCode,
}: {
  items: CartItem[];
  appliedCode: CreatorCodePreviewResult | null;
  onApplyCode: (value: CreatorCodePreviewResult | null) => void;
}) {
  const [codeState, codeFormAction, codePending] = useActionState(previewCreatorCode, { ok: false });
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (codeState.ok) {
      onApplyCode(codeState);
      setOpen(false);
      setCode("");
      toast(
        `${codeState.codeType === "event" ? `${codeState.creatorName} event code` : `${codeState.creatorName}'s creator code`} applied — you saved ${usd(codeState.discount ?? 0)}.`,
        "success",
      );
    } else if (codeState.message) {
      toast(codeState.message, "error");
    }
  }, [codeState, onApplyCode, toast]);

  const applyCode = () => {
    // Blank submits used to reach the server and come back as "isn't valid",
    // which reads as though a correctly typed code was rejected.
    if (codePending || !code) return;
    const data = new FormData();
    data.append("creatorCode", code);
    data.append("items", JSON.stringify(items.map(({ slug, qty }) => ({ slug, qty }))));
    startTransition(() => codeFormAction(data));
  };

  if (appliedCode?.ok) {
    return (
      <div className="cart-code-applied flex items-center gap-3 rounded-xl px-3 py-2.5">
        <span className="cart-code-tick grid h-6 w-6 shrink-0 place-items-center rounded-full">
          <Check size={13} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-xs font-bold">
            {appliedCode.code}
            <span className="cart-muted font-semibold"> · {appliedCode.creatorName}</span>
          </span>
          <span className="cart-code-save block text-[11px] font-semibold">
            {appliedCode.percentOff}% off · you save {usd(appliedCode.discount ?? 0)}
          </span>
        </span>
        <button
          type="button"
          className="cart-code-remove grid h-7 w-7 shrink-0 place-items-center rounded-lg transition"
          aria-label={`Remove discount code ${appliedCode.code}`}
          onClick={() => {
            onApplyCode(null);
            toast("Discount code removed.", "success");
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="cart-code">
      <button
        type="button"
        className="cart-code-toggle flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition"
        aria-expanded={open}
        aria-controls="creator-code-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <BadgePercent size={15} className="cart-code-ico shrink-0" aria-hidden="true" />
        <span className="flex-1 text-xs font-bold">Have a discount code?</span>
        <ChevronDown
          size={15}
          className={`cart-code-chevron shrink-0 ${open ? "is-open" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div id="creator-code-panel" className="cart-code-panel" data-open={open || undefined}>
        <div className="flex gap-2 pt-2">
          <input
            id="creatorCodeInput"
            name="creatorCodeInput"
            className="cart-code-input min-h-12 min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em]"
            placeholder="ENTER CODE"
            maxLength={40}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Discount code"
            value={code}
            /*
              Controlled, and normalised on the way in rather than only by the
              `uppercase` CSS. The field used to be read back out of the DOM with
              getElementById at submit time, so what was sent was the raw typed
              text while the box displayed something else — a lowercase or
              space-padded paste looked correct and was rejected. Matching the
              server's own normalisation here makes what you see what is sent.
            */
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))}
            onKeyDown={(event) => {
              // Enter previews the code. It must never submit anything around it.
              if (event.key === "Enter") {
                event.preventDefault();
                applyCode();
              }
            }}
          />
          <button
            type="button"
            className="cart-code-apply min-h-12 shrink-0 rounded-lg px-4 text-xs font-bold transition"
            disabled={codePending || !code}
            onClick={applyCode}
          >
            {codePending ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
