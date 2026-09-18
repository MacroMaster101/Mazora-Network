"use client";

import { useState } from "react";
import { BODY_MAX } from "@/lib/forums-rules";

/**
 * The body field every forum form shares.
 *
 * Deliberately dumb: it owns the character count and nothing else. Whether the
 * viewer may post at all is a server decision, so a caller that renders this
 * has already been told yes — this component never asks.
 */
export function PostComposer({
  name = "body",
  defaultValue = "",
  placeholder,
  rows = 5,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  rows?: number;
}) {
  const [length, setLength] = useState(defaultValue.length);

  return (
    <div className="space-y-1.5">
      <textarea
        name={name}
        rows={rows}
        maxLength={BODY_MAX}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(event) => setLength(event.target.value.length)}
        className="input w-full resize-y"
      />
      <p className="text-right text-xs text-muted">
        {length} / {BODY_MAX}
        <span className="ml-2">**bold** · *italic* · `code` · &gt; quote · - list</span>
      </p>
    </div>
  );
}
