"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { submitStoreRequest, type StoreRequestResult } from "@/lib/actions/store";
import { oauthAction, switchDiscordAccountAction, type AuthResult } from "@/lib/actions/auth";
import type { DiscordIdentity } from "@/lib/types";
import { DiscordIcon } from "@/components/auth/provider-icons";
import { FormRow, Input, Textarea, useToast } from "@/components/ui";
import { useCart } from "./cart-provider";

const initialState: StoreRequestResult = { ok: false };
const initialOauthState: AuthResult = { ok: false };
const DRAFT_KEY = "mz_order_draft";

interface OrderDraft {
  minecraftUsername?: string;
  notes?: string;
}

function readDraft(): OrderDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OrderDraft) : {};
  } catch {
    return {};
  }
}

export function OrderRequestForm({ configured }: { configured: boolean }) {
  const { items, clear } = useCart();
  const [state, formAction, pending] = useActionState(submitStoreRequest, initialState);
  const [oauthState, oauthFormAction, oauthPending] = useActionState(oauthAction, initialOauthState);
  const [switchState, switchFormAction, switchPending] = useActionState(switchDiscordAccountAction, initialOauthState);
  const [discord, setDiscord] = useState<DiscordIdentity | null | undefined>(undefined);
  // Signing in with Discord does not put anyone in the Mazora server, and the
  // order ticket + DM both need membership — so checkout tracks it separately.
  const [inGuild, setInGuild] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("/discord");
  const [checkingGuild, setCheckingGuild] = useState(false);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);
  // Values typed before a "Connect Discord" hop survive the OAuth redirect.
  const [draft] = useState<OrderDraft>(readDraft);
  const { toast } = useToast();

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Session storage unavailable; the draft simply is not restored. */
    }
  }, []);

  const saveDraft = () => {
    const username = (document.getElementById("minecraftUsername") as HTMLInputElement | null)?.value ?? "";
    const notes = (document.getElementById("notes") as HTMLTextAreaElement | null)?.value ?? "";
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ minecraftUsername: username, notes }));
    } catch {
      /* Session storage unavailable; the draft simply is not saved. */
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/discord", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { discord: null }))
      .then((body) => {
        if (cancelled) return;
        setDiscord(body.discord ?? null);
        setInGuild(body.inGuild !== false);
        if (body.inviteUrl) setInviteUrl(body.inviteUrl);
      })
      .catch(() => {
        if (!cancelled) setDiscord(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** "I joined — check again": re-asks the server whether they are in now. */
  const recheckGuild = async () => {
    setCheckingGuild(true);
    try {
      const response = await fetch("/api/me/discord", { cache: "no-store" });
      const body = response.ok ? await response.json() : null;
      const joined = body?.inGuild !== false;
      setInGuild(joined);
      toast(
        joined ? "You're in the Mazora Discord — you can send your request." : "We still can't see you in the server. Join, then try again.",
        joined ? "success" : "error",
      );
    } catch {
      toast("We couldn't check your Discord membership. Try again in a moment.", "error");
    } finally {
      setCheckingGuild(false);
    }
  };

  useEffect(() => {
    if (state.ok && state.message) toast(state.message, "success");
    else if (!state.ok && state.message) toast(state.message, "error");
  }, [state, toast]);

  useEffect(() => {
    if (!oauthState.ok && oauthState.message) toast(oauthState.message, "error");
  }, [oauthState, toast]);

  useEffect(() => {
    if (!switchState.ok && switchState.message) toast(switchState.message, "error");
  }, [switchState, toast]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "oauth_failed") {
        toast(
          "Discord connection failed — that account is already tied to a different Mazora account. Use Switch to sign out and log in with it directly.",
          "error",
        );
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("error");
        window.history.replaceState({}, "", cleanUrl.toString());
      }
    }
  }, [toast]);

  /**
   * Switching Discord means signing out: the session owns the Discord identity,
   * so clearing it client-side only made the next login try to *link* a second
   * Discord to the same account, which Discord/Supabase reject.
   *
   * The confirmation is rendered in the page rather than via window.confirm —
   * embedded webviews and sandboxed iframes suppress the native dialog and hand
   * back `false` without showing anything, which silently ate the click.
   */
  const switchDiscord = () => {
    saveDraft();
    const formData = new FormData();
    formData.append("next", "/store?cart=request");
    startTransition(() => {
      switchFormAction(formData);
    });
  };

  const connectDiscord = () => {
    saveDraft();
    const formData = new FormData();
    formData.append("provider", "discord");
    formData.append("next", "/store?cart=request");
    startTransition(() => {
      oauthFormAction(formData);
    });
  };

  if (state.ok) {
    return (
      <div className="mt-5 rounded-xl border border-success/25 bg-success/5 p-5 text-center">
        <CheckCircle2 size={32} className="mx-auto text-success" />
        <h3 className="mt-3 font-display text-lg font-bold">Request sent</h3>
        <p className="telemetry mt-1 text-sm font-semibold text-accent-bright">{state.reference}</p>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
        {/* Stated here as well as in the DM: a buyer with DMs closed would
            otherwise never learn that the ticket is where to look. */}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Once staff confirm it, a <strong className="text-fg">private ticket channel</strong> opens for you in the
          Mazora Discord — that is where payment is arranged. You will also get a DM, but if your DMs are closed just
          check the server.
        </p>
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="cart-discord-connect-btn mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition"
        >
          <DiscordIcon className="h-4 w-4" />
          Open Mazora Discord
        </a>
        <p className="mt-3 text-xs text-muted">Save the reference above. No payment has been taken.</p>
        <button type="button" onClick={clear} className="btn btn-ghost btn-sm mt-4">
          Start a new order
        </button>
      </div>
    );
  }

  return (
    <>

      <form action={formAction} className="store-request-form mt-5 space-y-4 border-t pt-5">
        <input type="hidden" name="items" value={JSON.stringify(items.map(({ slug, qty }) => ({ slug, qty })))} />
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <h3 className="flex items-center gap-2 font-display font-bold">
            <MessageCircle size={17} className="text-accent-bright" /> Request this order
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Staff receive the request in Discord and open a private ticket channel with you to arrange payment, then
            deliver the items in-game. A Discord account and Mazora server membership are required.
          </p>
        </div>

        <FormRow label="Minecraft username" htmlFor="minecraftUsername" error={state.errors?.minecraftUsername}>
          <Input
            id="minecraftUsername"
            name="minecraftUsername"
            autoComplete="username"
            placeholder="Your in-game name"
            maxLength={16}
            required
            defaultValue={draft.minecraftUsername}
            aria-invalid={Boolean(state.errors?.minecraftUsername)}
          />
        </FormRow>

        <div>
          <span className="mb-1.5 block text-xs font-semibold">Discord</span>
          {discord === undefined ? (
            <div className="cart-skeleton h-[4.35rem] animate-pulse rounded-xl" aria-hidden="true" />
          ) : discord ? (
            <div className="cart-discord-card flex items-center gap-3 rounded-xl p-3">
              <input type="hidden" name="discordUsername" value={discord.username} />
              <input type="hidden" name="discordId" value={discord.id} />
              {discord.avatarUrl ? (
                <Image
                  src={discord.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full"
                />
              ) : (
                <span className="cart-discord-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full">
                  <DiscordIcon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <strong className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">@{discord.username}</span>
                  <BadgeCheck size={15} className="cart-assurance-ico shrink-0" aria-label="Verified" />
                </strong>
                {inGuild ? (
                  <span className="cart-muted mt-0.5 block text-xs">
                    Verified · in the Mazora Discord · updates arrive by DM
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs font-semibold text-warning">
                    Verified · not in the Mazora Discord yet
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setConfirmingSwitch((open) => !open)}
                disabled={switchPending}
                aria-expanded={confirmingSwitch}
                className="cart-link-muted shrink-0 text-xs font-semibold underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {switchPending ? "Switching…" : "Switch"}
              </button>
            </div>
          ) : (
            <div className="cart-discord-card rounded-xl p-4">
              <p className="cart-muted text-xs leading-relaxed">
                Connect your Discord to place the order. It fills in your username and is how staff reach you — your
                order gets its own private ticket channel in the Mazora server.
              </p>
              <button
                type="button"
                onClick={connectDiscord}
                disabled={oauthPending}
                className="cart-discord-connect-btn mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {oauthPending ? <Loader2 size={16} className="animate-spin" /> : <DiscordIcon className="h-5 w-5" />}
                {oauthPending ? "Opening Discord…" : "Connect Discord"}
              </button>
              {/* Never assume the buyer already has Discord — a Minecraft store
                  gets plenty of first-timers, and a dead end here is a lost order. */}
              <p className="cart-muted mt-3 text-center text-[0.7rem] leading-relaxed">
                No Discord account?{" "}
                <a
                  href="https://discord.com/register"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-accent-bright"
                >
                  Create one free
                </a>
                , then{" "}
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-accent-bright"
                >
                  join the Mazora server
                </a>{" "}
                and come back here.
              </p>
            </div>
          )}

          {discord && confirmingSwitch && (
            <div className="mt-2 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <p className="text-xs font-semibold">Use a different Discord account?</p>
              <p className="cart-muted mt-1 text-xs leading-relaxed">
                Your Mazora account is signed in as <strong className="text-fg">@{discord.username}</strong>. To order
                as someone else you have to be signed out first — we&apos;ll send you straight to Discord to log in
                again. Your cart and everything typed here is kept.
              </p>
              {/* Discord's OAuth has no "choose an account" prompt (only
                  prompt=consent), so it authorises as whoever is already logged
                  in on that device — including the desktop app, if it grabs the
                  handoff. Without this warning people authorise as the same
                  account twice and assume the switch is broken. */}
              <p className="cart-muted mt-2 text-xs leading-relaxed">
                <strong className="text-warning">Before you continue:</strong> make sure Discord itself is logged in as
                the account you want. Discord authorises whoever is already signed in — it never asks you to pick. Log
                out of Discord first, or use <em>Switch Accounts</em> in the Discord app.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={switchDiscord}
                  disabled={switchPending}
                  className="cart-discord-connect-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {switchPending ? <Loader2 size={16} className="animate-spin" /> : <DiscordIcon className="h-4 w-4" />}
                  {switchPending ? "Signing out…" : "Sign out & switch"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSwitch(false)}
                  disabled={switchPending}
                  className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {discord && !inGuild && (
            <div className="mt-2 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs font-semibold">Join the Mazora Discord to continue</p>
              <p className="cart-muted mt-1 text-xs leading-relaxed">
                Staff arrange payment and deliver your items in a private ticket inside our server, so we need you in
                there before the request can be sent.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cart-discord-connect-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition"
                >
                  <DiscordIcon className="h-4 w-4" />
                  Join Mazora Discord
                </a>
                <button
                  type="button"
                  onClick={recheckGuild}
                  disabled={checkingGuild}
                  className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingGuild ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {checkingGuild ? "Checking…" : "I joined — check again"}
                </button>
              </div>
            </div>
          )}

          {(state.errors?.discordId || state.errors?.discordUsername) && (
            <p className="mt-1.5 text-xs text-danger">{state.errors?.discordId ?? state.errors?.discordUsername}</p>
          )}
        </div>

        <FormRow label="Notes" htmlFor="notes" hint="Optional" error={state.errors?.notes}>
          <Textarea id="notes" name="notes" rows={3} maxLength={500} defaultValue={draft.notes} placeholder="Anything staff should know?" />
        </FormRow>

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted">
            <input name="agreement" value="yes" type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" required />
            <span>
              I understand this is an order request. No payment is taken on this website and delivery starts after staff
              confirms payment.
            </span>
          </label>
          {state.errors?.agreement && <p className="mt-1.5 text-xs text-danger">{state.errors.agreement}</p>}
        </div>

        {state.message && !state.ok && (
          <p className="rounded-lg border border-danger/25 bg-danger/5 p-3 text-xs text-danger" role="alert">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !configured || !discord || !inGuild}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          {pending ? "Sending to staff…" : "Send order request"}
        </button>

        {configured && discord === null && (
          <p className="cart-muted text-center text-xs">Connect your Discord above to send the request.</p>
        )}

        {!configured && (
          <p className="cart-muted text-center text-xs leading-relaxed">
            Online requests are temporarily unavailable. Message our team in the{" "}
            <Link href="/discord" className="underline underline-offset-2 hover:text-accent-bright">
              Mazora Discord
            </Link>{" "}
            to complete your order.
          </p>
        )}
      </form>
    </>
  );
}
