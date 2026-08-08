"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Crown,
  Gamepad2,
  Gem,
  Hammer,
  Layers,
  Pickaxe,
  Save,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type { GameMode } from "@/lib/types";
import { saveStoreModeAction } from "@/lib/actions/store-admin";
import { FormRow, Input, Modal, Select, Textarea, useToast } from "@/components/ui";

export type GameModeDraft = GameMode | null;

// Curated Minecraft-flavored icon set — values must match the PascalCase keys
// in components/shared/icon.tsx so the icon actually renders on the storefront.
export const MODE_ICON_OPTIONS = [
  { value: "Gamepad2", label: "Survival", icon: Gamepad2 },
  { value: "Pickaxe", label: "Mining", icon: Pickaxe },
  { value: "Swords", label: "PvP", icon: Swords },
  { value: "Shield", label: "Defense", icon: Shield },
  { value: "Layers", label: "Blocks", icon: Layers },
  { value: "Gem", label: "Loot", icon: Gem },
  { value: "Crown", label: "Prestige", icon: Crown },
  { value: "Trophy", label: "Competitive", icon: Trophy },
  { value: "Hammer", label: "Building", icon: Hammer },
  { value: "Sparkles", label: "Creative", icon: Sparkles },
  { value: "Users", label: "Community", icon: Users },
  { value: "Activity", label: "Events", icon: Activity },
] as const;
const MODE_ICON_VALUES = new Set(MODE_ICON_OPTIONS.map((option) => option.value));

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * The one game mode editor shared by every admin surface (Store catalog and the
 * Game Modes dashboard). Both write to the same `game_modes` table, so editing
 * a mode from either place shows up in the other and on the public site.
 *
 * The two surfaces have different jobs, so the form adapts via `variant`:
 * - "store" (Store catalog): the commerce listing — name, price-page basics,
 *   icon, visibility. No page-content fields, to keep it lean.
 * - "dashboard" (Game Modes page): also edits what powers the public game
 *   mode detail page — Features, Mode rules, Useful commands.
 */
export function GameModeFormModal({
  draft,
  modesCount,
  onClose,
  variant = "store",
}: {
  draft: GameModeDraft | undefined;
  modesCount: number;
  onClose: () => void;
  variant?: "store" | "dashboard";
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState("Gamepad2");
  const [busy, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const showDetails = variant === "dashboard";

  useEffect(() => {
    if (draft === undefined) return;
    setName(draft?.name ?? "");
    setSlug(draft?.slug ?? "");
    setSlugTouched(Boolean(draft));
    setIcon(draft?.icon && MODE_ICON_VALUES.has(draft.icon as never) ? draft.icon : "Gamepad2");
  }, [draft]);

  function submit(formData: FormData) {
    start(async () => {
      const result = await saveStoreModeAction(formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Modal open={draft !== undefined} onClose={onClose} label={draft ? "Edit game mode" : "Create game mode"} size="wide">
      <form action={submit} className="store-admin-modal panel overflow-hidden">
        <div className="store-admin-modal-head border-b border-line px-6 py-5">
          <div>
            <p className="eyebrow">{showDetails ? (draft ? "Edit game mode" : "New game mode") : (draft ? "Edit marketplace" : "New marketplace")}</p>
            <h2 className="mt-2 text-2xl font-black">{draft ? draft.name : "Create game mode"}</h2>
          </div>
          <div className="store-admin-form-steps" aria-label="Game mode form sections">
            <span>Basics</span><span>Display</span><span>Icon</span>{showDetails && <span>Details</span>}<span>Visibility</span>
          </div>
        </div>

        <div className="store-admin-form-body grid gap-5 p-6 md:grid-cols-2">
          {draft?.id && <input type="hidden" name="id" value={draft.id} />}
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="tagline" value="" />
          <input type="hidden" name="accent" value={draft?.accent ?? "violet"} />
          <input type="hidden" name="sortOrder" value={draft?.sortOrder ?? modesCount * 10} />
          <input type="hidden" name="icon" value={icon} />
          {!showDetails && (
            <>
              <input type="hidden" name="features" value={draft?.features.join("\n") ?? ""} />
              <input type="hidden" name="rules" value={draft?.rules.join("\n") ?? ""} />
              <input type="hidden" name="commands" value={draft?.commands.map((c) => `${c.cmd} | ${c.desc}`).join("\n") ?? ""} />
            </>
          )}

          <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-mode-basics">
            <header>
              <span>01</span>
              <div><h3 id="store-mode-basics">Marketplace basics</h3><p>Name the game mode and describe what makes it different. The Store URL is generated for you.</p></div>
            </header>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormRow label="Mode name" htmlFor="mode-name" hint={slug ? `Store URL: /store/${slug}` : undefined}>
                  <Input id="mode-name" name="name" value={name} onChange={(event) => {
                    setName(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }} required />
                </FormRow>
              </div>
              <div className="md:col-span-2">
                <FormRow label="Description" htmlFor="mode-description">
                  <Textarea id="mode-description" name="description" rows={3} defaultValue={draft?.description ?? ""} />
                </FormRow>
              </div>
            </div>
          </section>

          <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-mode-display">
            <header>
              <span>02</span>
              <div><h3 id="store-mode-display">Display</h3><p>What shoppers see on the mode&apos;s tab and card.</p></div>
            </header>
            <div className="grid gap-5 md:grid-cols-2">
              <FormRow label="Minecraft version" htmlFor="mode-version">
                <Input id="mode-version" name="version" defaultValue={draft?.version ?? "1.21.11"} required />
              </FormRow>
              <FormRow label="Store status" htmlFor="mode-status" hint="Shown on the mode's tab as “Store live” or “Coming soon.”">
                <Select id="mode-status" name="storeStatus" defaultValue={draft?.storeStatus ?? "coming_soon"}>
                  <option value="live">Store live</option><option value="coming_soon">Coming soon</option>
                </Select>
              </FormRow>
            </div>
          </section>

          <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-mode-appearance">
            <header>
              <span>03</span>
              <div><h3 id="store-mode-appearance">Icon</h3><p>Shown on the mode&apos;s tab, card, and cover art.</p></div>
            </header>

            <div className="store-admin-category-options">
              {MODE_ICON_OPTIONS.map(({ value, label, icon: OptIcon }) => (
                <label key={value} className={icon === value ? "is-selected" : ""}>
                  <input type="radio" name="iconChoice" value={value} checked={icon === value} onChange={() => setIcon(value)} />
                  <span><OptIcon size={17} /></span>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </label>
              ))}
            </div>
          </section>

          {showDetails && (
            <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-mode-details">
              <header>
                <span>04</span>
                <div><h3 id="store-mode-details">Mode details page</h3><p>Powers the public game mode detail page — leave blank to hide a block.</p></div>
              </header>
              <div className="grid gap-5 md:grid-cols-2">
                <FormRow label="Features" htmlFor="mode-features" hint="One per line">
                  <Textarea id="mode-features" name="features" rows={5} defaultValue={draft?.features.join("\n") ?? ""} placeholder={"Custom biomes\nLand claims\nPlayer-run shops"} />
                </FormRow>
                <FormRow label="Mode rules" htmlFor="mode-rules" hint="One per line">
                  <Textarea id="mode-rules" name="rules" rows={5} defaultValue={draft?.rules.join("\n") ?? ""} placeholder={"No griefing outside claims\nPvP only in wilderness"} />
                </FormRow>
                <div className="md:col-span-2">
                  <FormRow label="Useful commands" htmlFor="mode-commands" hint="One per line, as: /command | what it does">
                    <Textarea id="mode-commands" name="commands" rows={4} defaultValue={draft?.commands.map((c) => `${c.cmd} | ${c.desc}`).join("\n") ?? ""} placeholder={"/spawn | Return to spawn\n/sethome | Set your home point"} />
                  </FormRow>
                </div>
              </div>
            </section>
          )}

          <section className="store-admin-form-section md:col-span-2" aria-labelledby="store-mode-visibility">
            <header>
              <span>{showDetails ? "05" : "04"}</span>
              <div><h3 id="store-mode-visibility">Visibility</h3><p>Control whether shoppers can see this game mode.</p></div>
            </header>
            <label className="store-admin-publish flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-semibold">
              <input type="checkbox" name="enabled" defaultChecked={draft?.enabled ?? true} className="h-4 w-4 accent-violet-500" />
              Show this game mode in the Store selector
            </label>
          </section>
        </div>

        <div className="store-admin-modal-actions flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary"><Save size={15} /> {busy ? "Saving…" : "Save game mode"}</button>
        </div>
      </form>
    </Modal>
  );
}
