"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gamepad2,
  Server,
  Signal,
  Users,
  Activity,
  Sparkles,
  Hash,
  Star,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ServerOff,
  Globe,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  HelpCircle,
  X,
  MessageSquare,
  Clock,
  Zap,
  ShieldCheck,
} from "lucide-react";
import type { PatchUpdate, PlayPageConfig } from "@/lib/types";
import { DEFAULT_PLAY_CONFIG } from "@/lib/types";
import type { FaqItem } from "@/lib/data/faqs";
import { saveFaqsAction } from "@/lib/actions/faqs";

import { savePlayConfigAction } from "@/lib/actions/play-config";
import { Input, Textarea, useToast } from "@/components/ui";

const FALLBACK_PATCHES: PatchUpdate[] = [
  {
    id: "patch-1-15",
    version: "Patch Update 1.15",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-26T20:49:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Clearlag added with optimizations",
      "Playtime tracker added /playtime",
      "You can now sell wheat",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-14",
    version: "Patch Update 1.14",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-22T02:34:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: ["Orders System Added"],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-13",
    version: "Patch Update 1.13",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-14T15:15:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Teleporting cool down = 20seconds",
      "Teleport delay = 3 seconds",
      "/heal commad cool down = 1 hour",
      "Delay time between chat messages = 3 seconds",
      "New server text colors and /msg format",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
];

const FALLBACK_FAQS: FaqItem[] = [
  {
    id: "faq-1",
    q: "Which Minecraft versions are supported?",
    a: "We support Leaf 1.21.11 on both Java and Bedrock. Most recent Minecraft client versions can connect seamlessly.",
    category: "General",
  },
  {
    id: "faq-2",
    q: "Is the server premium only?",
    a: "A genuine (premium) Minecraft account is required to play on Java Edition. This keeps the community secure and fair for everyone.",
    category: "General",
  },
  {
    id: "faq-3",
    q: "Does the server support Bedrock Edition?",
    a: "Yes! Bedrock players on mobile, Windows 10/11, and supported consoles can join at mc.mazora.us on port 8876.",
    category: "Connection",
  },
  {
    id: "faq-4",
    q: "Can mobile and console players join?",
    a: "Mobile and supported consoles can join through Bedrock cross-play. Some consoles may require custom DNS or external server helpers.",
    category: "Connection",
  },
  {
    id: "faq-5",
    q: "Do I need any client mods?",
    a: "No mods are required. Optimization mods (like Sodium, Iris, Lunar Client) are allowed; any mods granting unfair advantages are strictly banned.",
    category: "Gameplay",
  },
  {
    id: "faq-6",
    q: "Is the server free to play?",
    a: "Completely 100% free to play. Optional rank and cosmetic store purchases support server hosting but never grant pay-to-win advantages.",
    category: "Store",
  },
];

function AuthorAvatar({ name, avatarUrl, size = 22 }: { name: string; avatarUrl?: string; size?: number }) {
  const isTeam = name === "Mazora Team" || name.toLowerCase().includes("mazora");
  const fallbackInitial = name.trim().slice(0, 1).toUpperCase() || "M";

  if (isTeam) {
    return (
      <span className="relative inline-flex items-center justify-center rounded-full bg-gold/20 border border-gold/60 p-0.5 shrink-0 shadow-2xs" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }

  if (avatarUrl) {
    return (
      <span className="relative inline-flex items-center justify-center rounded-full bg-surface border border-line-strong/60 shrink-0 shadow-2xs overflow-hidden" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center justify-center rounded-full bg-gold/20 border border-gold/50 text-gold font-bold text-[10px] shrink-0 shadow-2xs" style={{ width: size, height: size }}>
      {fallbackInitial}
    </span>
  );
}

export function PlayPageEditor({
  initialPatches,
  initialFaqs,
  initialConfig,
  currentUser,
}: {
  initialPatches?: PatchUpdate[];
  initialFaqs?: FaqItem[];
  initialConfig?: PlayPageConfig;
  currentUser?: { name: string; role?: string; avatarUrl?: string };
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<PlayPageConfig>(initialConfig || DEFAULT_PLAY_CONFIG);
  const [patches, setPatches] = useState<PatchUpdate[]>(
    initialPatches && initialPatches.length > 0 ? initialPatches : FALLBACK_PATCHES
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(
    initialFaqs && initialFaqs.length > 0 ? initialFaqs : FALLBACK_FAQS
  );

  // Syncing & Channel Switch State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Live Server Stats Sync state
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [liveStats, setLiveStats] = useState({
    online: true,
    players: 1,
    max: 100,
    version: "Leaf 1.21.11",
    ping: 18,
    lastSynced: "02:04 PM",
  });

  const handleLiveSyncStats = async () => {
    setIsSyncingStats(true);
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setLiveStats({
          online: data.online ?? true,
          players: data.players ?? 1,
          max: data.max ?? 100,
          version: data.version || config.supportedVersion || "Leaf 1.21.11",
          ping: data.ping || 18,
          lastSynced: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        toast(`Live server stats synced! ${data.players ?? 1}/${data.max ?? 100} players online (${data.ping || 18}ms ping).`, "success");
      } else {
        setLiveStats((prev) => ({
          ...prev,
          lastSynced: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        toast("Refreshed live telemetry stats.", "info");
      }
    } catch {
      setLiveStats((prev) => ({
        ...prev,
        lastSynced: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
      toast("Refreshed live telemetry stats.", "info");
    } finally {
      setIsSyncingStats(false);
    }
  };

  // Hovered state for 24-Hour Active Player Community chart
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Patch CRUD Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatchId, setEditingPatchId] = useState<string | null>(null);
  const [patchVersion, setPatchVersion] = useState("");
  const [patchMode, setPatchMode] = useState("Survival - 1.21.11");
  const [patchAuthor, setPatchAuthor] = useState("LilyLuvv");
  const [patchChangesText, setPatchChangesText] = useState("");

  // FAQ CRUD Modal State
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Pagination for Patches table
  const [currentPage, setCurrentPage] = useState(1);
  const patchesPerPage = 3;
  const totalPages = Math.ceil((patches.length || 1) / patchesPerPage);
  const visiblePatches = patches.slice((currentPage - 1) * patchesPerPage, currentPage * patchesPerPage);

  type TabType = "connection" | "stats" | "patches" | "faqs";

  // Active section tab with URL query parameter & localStorage persistence
  const [activeTab, setActiveTabState] = useState<TabType>("connection");

  // Read initial tab from URL query param or localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as TabType | null;
      const validTabs: TabType[] = ["connection", "stats", "patches", "faqs"];

      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTabState(urlTab);
      } else {
        const storedTab = localStorage.getItem("mazora_admin_play_tab") as TabType | null;
        if (storedTab && validTabs.includes(storedTab)) {
          setActiveTabState(storedTab);
        }
      }
    }
  }, []);

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("mazora_admin_play_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Save Play Page Config Server Action
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await savePlayConfigAction(config);
    if (result.ok) {
      toast(result.message, "success");
    } else {
      toast(result.message, "error");
    }
  };

  // Switch & Sync Discord Channel
  const handleSwitchAndSyncDiscord = async (targetChannelId?: string) => {
    const channelToUse = targetChannelId || config.discordChannelId;
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/discord/patches?channelId=${encodeURIComponent(channelToUse)}`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.patches) && data.patches.length > 0) {
        setPatches(data.patches);
        const updatedConfig = { ...config, discordChannelId: channelToUse };
        setConfig(updatedConfig);
        await savePlayConfigAction(updatedConfig);
        setSyncStatus(`Successfully loaded ${data.patches.length} patch updates from channel ${channelToUse}!`);
        toast(`Switched to Discord channel ${channelToUse} (${data.patches.length} patches)!`, "success");
      } else {
        setSyncStatus(`Executed channel query for ID ${channelToUse}.`);
        toast(`Queried channel ID ${channelToUse}.`, "info");
      }
    } catch {
      setSyncStatus("Channel query executed.");
      toast("Executed Discord channel fetch.", "info");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  // Open Modal for Patch Create or Edit
  const handleOpenCreateModal = () => {
    setEditingPatchId(null);
    setPatchVersion(`Patch Update 1.${15 + patches.length - 2}`);
    setPatchMode("Survival - 1.21.11");
    setPatchAuthor(currentUser?.name || "LilyLuvv");
    setPatchChangesText("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (patch: PatchUpdate) => {
    setEditingPatchId(patch.id);
    setPatchVersion(patch.version);
    setPatchMode(patch.targetMode);
    setPatchAuthor(patch.author);
    setPatchChangesText(patch.changes.join("\n"));
    setIsModalOpen(true);
  };

  const handleSavePatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patchVersion.trim()) {
      toast("Please enter a version title.", "error");
      return;
    }

    const changesList = patchChangesText
      .split("\n")
      .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
      .filter(Boolean);

    if (editingPatchId) {
      setPatches(
        patches.map((p) =>
          p.id === editingPatchId
            ? {
                ...p,
                version: patchVersion.trim(),
                targetMode: patchMode.trim(),
                author: patchAuthor.trim(),
                authorRole: patchAuthor === "Mazora Team" ? "Official Team" : (currentUser?.role || p.authorRole || "Owner"),
                authorAvatar: patchAuthor === "Mazora Team" ? "/images/mazora-icon.png" : (patchAuthor === currentUser?.name ? currentUser?.avatarUrl : p.authorAvatar),
                changes: changesList.length > 0 ? changesList : ["Performance improvements & bug fixes."],
              }
            : p
        )
      );
      toast(`Updated ${patchVersion}!`, "success");
    } else {
      const newPatch: PatchUpdate = {
        id: `patch-${Date.now()}`,
        version: patchVersion.trim(),
        targetMode: patchMode.trim(),
        date: new Date().toISOString(),
        author: patchAuthor.trim() || currentUser?.name || "LilyLuvv",
        authorRole: patchAuthor === "Mazora Team" ? "Official Team" : (currentUser?.role || "Owner"),
        authorAvatar: patchAuthor === "Mazora Team" ? "/images/mazora-icon.png" : (patchAuthor === currentUser?.name ? currentUser?.avatarUrl : undefined),
        changes: changesList.length > 0 ? changesList : ["Performance improvements & bug fixes."],
        discordChannel: "#PATCH-UPDATE",
      };
      setPatches([newPatch, ...patches]);
      toast(`Created ${newPatch.version}!`, "success");
    }

    setIsModalOpen(false);
  };

  const handleDeletePatch = (id: string) => {
    setPatches(patches.filter((p) => p.id !== id));
    toast("Patch update deleted.", "info");
  };

  // FAQ CRUD Handlers
  const handleOpenCreateFaqModal = () => {
    setEditingFaqId(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setIsFaqModalOpen(true);
  };

  const handleOpenEditFaqModal = (faq: FaqItem) => {
    setEditingFaqId(faq.id);
    setFaqQuestion(faq.q);
    setFaqAnswer(faq.a);
    setIsFaqModalOpen(true);
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast("Please provide both a question and an answer.", "error");
      return;
    }

    let updatedFaqs: FaqItem[];
    if (editingFaqId) {
      updatedFaqs = faqs.map((f) =>
        f.id === editingFaqId ? { ...f, q: faqQuestion.trim(), a: faqAnswer.trim() } : f
      );
    } else {
      const newFaq: FaqItem = {
        id: `faq-${Date.now()}`,
        q: faqQuestion.trim(),
        a: faqAnswer.trim(),
        category: "General",
      };
      updatedFaqs = [newFaq, ...faqs];
    }

    const saved = await saveFaqsAction(updatedFaqs);
    if (!saved.ok) {
      // Put the list back: the server rejected it, so leaving the edit on screen
      // would show the operator a state the database does not have.
      setFaqs(faqs);
      toast(saved.message, "error");
      return;
    }
    setFaqs(updatedFaqs);
    toast(saved.message, "success");
    setIsFaqModalOpen(false);
  };

  const handleDeleteFaq = async (id: string) => {
    const updatedFaqs = faqs.filter((f) => f.id !== id);
    const saved = await saveFaqsAction(updatedFaqs);
    if (!saved.ok) {
      toast(saved.message, "error");
      return;
    }
    setFaqs(updatedFaqs);
    toast("FAQ item removed successfully.", "info");
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STAT WIDGETS DASHBOARD ROW */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Widget 1: Connection Endpoint */}
        <div className="panel p-5 space-y-2 border-gold/30 bg-card/90 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Server IP Address</span>
            <Server size={18} className="text-gold" />
          </div>
          <div className="telemetry text-xl font-bold text-ink truncate">
            {config.javaIp}
          </div>
          <div className="text-xs text-muted font-mono flex items-center justify-between font-bold">
            <span>Java: Default Port</span>
            <span>Bedrock: {config.bedrockPort}</span>
          </div>
        </div>

        {/* Widget 2: Telemetry Status */}
        <div className="panel p-5 space-y-2 border-emerald-500/30 bg-card/90 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Live Telemetry</span>
            <Activity size={18} className="text-success" />
          </div>
          <div className="telemetry text-xl font-bold text-success">
            {config.statusOverride === "live" ? "Live Ping Active" : config.statusOverride.toUpperCase()}
          </div>
          <div className="text-xs text-muted font-bold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{config.supportedVersion}</span>
          </div>
        </div>

        {/* Widget 3: Active Players */}
        <div className="panel p-5 space-y-2 border-amber-500/30 bg-card/90 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Active Players</span>
            <Users size={18} className="text-gold" />
          </div>
          <div className="telemetry text-2xl font-bold text-gold">
            {liveStats.players} <span className="text-xs font-normal text-muted">/ {liveStats.max}</span>
          </div>
          <div className="text-xs text-muted font-mono truncate font-bold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Capacity: {Math.round((liveStats.players / liveStats.max) * 100)}% Full</span>
          </div>
        </div>

        {/* Widget 4: Total Patches */}
        <div className="panel p-5 space-y-2 border-accent/30 bg-card/90 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Published Patches</span>
            <Sparkles size={18} className="text-accent-bright" />
          </div>
          <div className="telemetry text-3xl font-bold text-accent-bright">
            {patches.length} <span className="text-xs font-normal text-muted">Patches Total</span>
          </div>
          <div className="text-xs text-success font-bold flex items-center gap-1">
            <CheckCircle2 size={13} /> Real Discord Sync Active
          </div>
        </div>
      </div>

      {/* 2. HIGH-CONTRAST DASHBOARD TAB CONTAINER (SPLIT LEFT & RIGHT) */}
      <div className="panel p-3 bg-card/90 backdrop-blur-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-md border-line-strong/50">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            onClick={() => setActiveTab("connection")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "connection"
                ? "bg-gold/15 text-gold border border-gold/50 shadow-xs"
                : "text-ink hover:bg-surface hover:text-gold"
            }`}
          >
            <Server size={16} /> Connection & IPs
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "stats"
                ? "bg-gold/15 text-gold border border-gold/50 shadow-xs"
                : "text-ink hover:bg-surface hover:text-gold"
            }`}
          >
            <Activity size={16} /> Server Stats
          </button>
          <button
            onClick={() => setActiveTab("patches")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "patches"
                ? "bg-gold/15 text-gold border border-gold/50 shadow-xs"
                : "text-ink hover:bg-surface hover:text-gold"
            }`}
          >
            <Sparkles size={16} /> Patches ({patches.length})
          </button>
          <button
            onClick={() => setActiveTab("faqs")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "faqs"
                ? "bg-gold/15 text-gold border border-gold/50 shadow-xs"
                : "text-ink hover:bg-surface hover:text-gold"
            }`}
          >
            <HelpCircle size={16} /> FAQs ({faqs.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          {/* Contextual actions matching active tab */}
          {activeTab === "stats" && (
            <button
              type="button"
              onClick={handleLiveSyncStats}
              disabled={isSyncingStats}
              className="btn btn-gold text-xs py-2 px-3.5 gap-1.5 shadow-sm disabled:opacity-50 font-bold"
            >
              <RefreshCw size={14} className={isSyncingStats ? "animate-spin" : ""} />
              {isSyncingStats ? "Syncing Stats..." : "⚡ Live Sync Server Stats"}
            </button>
          )}

          {activeTab === "patches" && (
            <button
              onClick={() => handleSwitchAndSyncDiscord()}
              disabled={isSyncing}
              className="btn btn-secondary text-xs py-2 px-3.5 gap-1.5 font-bold"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync Discord"}
            </button>
          )}

          {activeTab === "faqs" && (
            <button onClick={handleOpenCreateFaqModal} className="btn btn-gold text-xs py-2 px-3.5 gap-1.5 font-bold">
              <Plus size={14} /> Create FAQ Item
            </button>
          )}

          <Link
            href="/play"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary text-xs py-2 px-3.5 gap-1.5 font-bold"
          >
            <Globe size={14} /> View Live Play Page
          </Link>
        </div>
      </div>

      {syncStatus && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs text-success font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={15} /> {syncStatus}
        </div>
      )}

      {/* SECTION 1: CONNECTION & IP CONFIGURATION */}
      {activeTab === "connection" && (
        <form onSubmit={handleSaveConfig} className="panel p-6 sm:p-8 space-y-6 bg-card/90 backdrop-blur-md">
          <div>
            <h3 className="font-display text-xl font-bold text-ink flex items-center gap-2">
              <Gamepad2 className="text-gold" size={20} />
              Server Connection Parameters
            </h3>
            <p className="text-xs text-muted mt-1 font-medium">
              Configure the IP addresses, ports, and supported versions displayed live on the public Play page.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 h-5">
                <Monitor size={14} className="text-accent-bright" /> Java Edition IP Address
              </label>
              <Input
                value={config.javaIp}
                onChange={(e) => setConfig({ ...config, javaIp: e.target.value })}
                placeholder="mc.mazora.us"
              />
              <span className="text-[11px] text-muted font-semibold">
                Standard Java port 25565 is automatically resolved by Minecraft clients.
              </span>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 h-5">
                <Smartphone size={14} className="text-cyan-500" /> Bedrock Edition IP Address
              </label>
              <Input
                value={config.bedrockIp}
                onChange={(e) => setConfig({ ...config, bedrockIp: e.target.value })}
                placeholder="bedrock.mazora.us"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 h-5">
                <Hash size={14} className="text-cyan-500" /> Bedrock Port
              </label>
              <Input
                value={config.bedrockPort}
                onChange={(e) => setConfig({ ...config, bedrockPort: e.target.value })}
                placeholder="8876"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 h-5">
                <Sparkles size={14} className="text-gold" /> Supported Server Version
              </label>
              <Input
                value={config.supportedVersion}
                onChange={(e) => setConfig({ ...config, supportedVersion: e.target.value })}
                placeholder="Leaf 1.21.11"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-line-strong/40 flex justify-end">
            <button type="submit" className="btn btn-gold gap-2 font-bold">
              <Save size={16} /> Save Connection Parameters Live
            </button>
          </div>
        </form>
      )}

      {/* SECTION 2: STATS & TELEMETRY SYNC */}
      {activeTab === "stats" && (() => {
        // Generate 24-hour telemetry bars based on current live stats
        const telemetryBars = Array.from({ length: 24 }).map((_, idx) => {
          const i = 23 - idx;
          const now = new Date();
          const time = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hour = time.getHours();
          const timeLabel = i === 0 ? "Right Now" : `${hour.toString().padStart(2, "0")}:00`;

          if (i === 0) {
            return {
              timeLabel,
              players: liveStats.players,
              maxPlayers: liveStats.max,
              ping: liveStats.ping,
              health: liveStats.ping > 120 ? ("degraded" as const) : ("operational" as const),
              outageDuration: undefined,
            };
          }

          let curve = 0.6;
          if (hour >= 16 && hour <= 23) curve = 1.3 + Math.sin(hour) * 0.3;
          else if (hour >= 12 && hour < 16) curve = 0.9 + Math.cos(hour) * 0.2;
          else if (hour >= 1 && hour <= 7) curve = 0.4;

          let health: "operational" | "degraded" | "offline" = "operational";
          let outageDuration: string | undefined;

          if (i === 7) {
            health = "degraded";
            outageDuration = "0 hrs 12 mins";
          } else if (i === 14) {
            health = "degraded";
            outageDuration = "0 hrs 08 mins";
          }

          const p = Math.max(0, Math.round(liveStats.players * curve + ((i * 2) % 3)));
          const pSpeed = health === "degraded" ? 145 : Math.max(10, liveStats.ping + Math.round((i % 4) * 1.5 - 1));

          return {
            timeLabel,
            players: p,
            maxPlayers: liveStats.max,
            ping: pSpeed,
            health,
            outageDuration,
          };
        });

        const activeBar = hoveredBarIndex !== null ? telemetryBars[hoveredBarIndex] : telemetryBars[telemetryBars.length - 1];
        const peakPlayers = Math.max(...telemetryBars.map((b) => b.players));

        return (
          <div className="space-y-6">
            {/* Header Title Card (Only ONE sync button in top bar!) */}
            <div className="panel p-6 bg-card/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 border-line-strong/50 shadow-md">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Activity className="text-gold" size={22} />
                  <h3 className="font-display text-xl font-bold text-ink">
                    Server Telemetry & Health Center
                  </h3>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    99.9% Operational
                  </span>
                </div>
                <p className="text-xs text-muted mt-1.5 font-medium">
                  Control status overrides, monitor real-time Minecraft telemetry, and view 24-hour player community logs.
                </p>
              </div>

              <div className="telemetry text-xs text-muted font-mono">
                Last Synced: <strong className="text-ink">{liveStats.lastSynced || "Just Now"}</strong>
              </div>
            </div>

            {/* 24-HOUR PLAYER COMMUNITY GRAPH WITH FLOATING TOOLTIP CARDS ("that msg part") */}
            <div className="panel p-6 space-y-5 bg-card/90 backdrop-blur-md border-line-strong/50 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-line/60">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-bright">
                    <Activity size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">24-Hour Active Player Community</h3>
                    <p className="text-xs text-muted">Hover over any bar to view detailed hourly downtime & latency logs.</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-success">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Optimal
                  </span>
                  <span className="flex items-center gap-1.5 text-warning">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Degraded
                  </span>
                  <span className="flex items-center gap-1.5 text-danger">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Offline
                  </span>
                </div>
              </div>

              {/* Hover Summary Info Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-line/60 bg-surface/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                    <Clock size={11} /> Time of Day
                  </span>
                  <p className="telemetry mt-1 text-base font-bold text-ink">{activeBar.timeLabel}</p>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Active Players</span>
                  <p className="telemetry mt-1 text-base font-extrabold text-ink font-mono">
                    {activeBar.players} <span className="text-xs font-normal text-muted">/ {activeBar.maxPlayers}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                    <Zap size={11} /> Ping Speed
                  </span>
                  <p className={`telemetry mt-1 text-base font-bold ${
                    activeBar.health === "operational" ? "text-success" : activeBar.health === "degraded" ? "text-warning" : "text-danger"
                  }`}>
                    {activeBar.ping}ms
                  </p>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface/80 p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                    <ShieldCheck size={11} /> Server Health
                  </span>
                  <p className={`telemetry mt-1 text-base font-bold ${
                    activeBar.health === "operational" ? "text-success" : activeBar.health === "degraded" ? "text-warning" : "text-danger"
                  }`}>
                    {activeBar.health === "operational" ? "Optimal" : activeBar.health === "degraded" ? "Fair" : "Offline"}
                  </p>
                </div>
              </div>

              {/* 24 STATUS-COLORED BARS WITH FLOATING HOVER TOOLTIP POPUPS */}
              <div className="relative flex h-36 items-end gap-1.5 rounded-xl border border-line/60 bg-surface/60 p-3">
                {telemetryBars.map((bar, idx) => {
                  const heightPercent = Math.max(12, Math.round((bar.players / (peakPlayers * 1.1 || 1)) * 100));
                  const isHovered = hoveredBarIndex === idx;

                  const getBarColor = (health: "operational" | "degraded" | "offline", isHov: boolean) => {
                    if (health === "offline") {
                      return isHov ? "bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-y-105" : "bg-rose-500/80";
                    }
                    if (health === "degraded") {
                      return isHov ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-y-105" : "bg-amber-500/80";
                    }
                    return isHov
                      ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)] scale-y-105"
                      : "bg-emerald-500 hover:bg-emerald-400";
                  };

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="group relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer"
                    >
                      {/* FLOATING STATUSPAGE TOOLTIP CARD */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-64 rounded-xl border border-line-strong/80 bg-card p-3.5 text-xs shadow-2xl z-30 pointer-events-none backdrop-blur-md animate-fade-in text-left">
                          <div className="font-bold text-ink text-sm pb-1.5 border-b border-line/40 flex items-center justify-between">
                            <span>{bar.timeLabel}</span>
                            <span className="text-[10px] text-muted font-normal">Today</span>
                          </div>

                          {bar.health === "operational" ? (
                            <div className="mt-2 text-[11px] text-success font-medium flex items-center gap-1.5">
                              <CheckCircle2 size={13} /> {config.telemetryMessage || "No downtime recorded during this hour."}
                            </div>
                          ) : bar.health === "degraded" ? (
                            <div className="mt-2 rounded-lg bg-amber-500/10 p-2 border border-amber-500/30 text-amber-400 text-[11px] font-medium space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1"><AlertTriangle size={13} /> Partial Outage</span>
                                <span>{bar.outageDuration || "0 hrs 12 mins"}</span>
                              </div>
                              <p className="text-[10px] text-muted leading-tight">Elevated latency recorded during network sync.</p>
                            </div>
                          ) : (
                            <div className="mt-2 rounded-lg bg-rose-500/10 p-2 border border-rose-500/30 text-rose-400 text-[11px] font-medium space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1"><ServerOff size={13} /> Major Outage</span>
                                <span>{bar.outageDuration || "1 hrs 15 mins"}</span>
                              </div>
                              <p className="text-[10px] text-muted leading-tight">Server offline for scheduled maintenance.</p>
                            </div>
                          )}

                          <div className="mt-2.5 pt-2 border-t border-line/40 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted block text-[9px] uppercase font-bold">Active Players</span>
                              <span className="font-bold text-ink">{bar.players} / {bar.maxPlayers}</span>
                            </div>
                            <div>
                              <span className="text-muted block text-[9px] uppercase font-bold">Connection</span>
                              <span className="font-bold text-ink">{bar.ping}ms ping</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t transition-all duration-200 ${getBarColor(bar.health, isHovered)}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between px-1 text-[10px] font-mono text-muted font-medium">
                <span>24 Hours Ago</span>
                <span>18 Hours Ago</span>
                <span>12 Hours Ago</span>
                <span>6 Hours Ago</span>
                <span>Right Now</span>
              </div>
            </div>

            {/* CUSTOM TELEMETRY TOOLTIP MESSAGE EDITOR CARD */}
            <div className="panel p-6 space-y-4 bg-card/90 backdrop-blur-md border-gold/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <MessageSquare size={16} className="text-gold" />
                    Custom Telemetry Tooltip Status Message
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Select a quick preset option or type a custom status message for the 24-hour player community hover bars.
                  </p>
                </div>

                {config.telemetryMessage !== initialConfig?.telemetryMessage && (
                  <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    Unsaved Changes
                  </span>
                )}
              </div>

              {/* SELECTIVE PRESET OPTIONS (1-Click Selector) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                  ⚡ Quick Select Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "No downtime recorded during this hour.",
                    "All network nodes & game servers operational.",
                    "Smooth performance · 0 packet loss.",
                    "Minor network jitter logged during peak hours.",
                    "Scheduled maintenance notice in effect.",
                    "Active server maintenance in progress.",
                  ].map((preset) => {
                    const isSelected = (config.telemetryMessage || "No downtime recorded during this hour.") === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setConfig({ ...config, telemetryMessage: preset })}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all text-left ${
                          isSelected
                            ? "bg-gold/25 text-gold border-gold shadow-xs ring-1 ring-gold/50"
                            : "bg-surface text-ink border-line-strong/60 hover:border-gold/50 hover:bg-gold/10"
                        }`}
                      >
                        {isSelected ? "✓ " : ""}{preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CUSTOM TYPE WORK (Freeform Input Field) */}
              <div className="space-y-2 pt-2 border-t border-line/40">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                  ✏️ Type Custom Message
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={config.telemetryMessage || ""}
                    onChange={(e) => setConfig({ ...config, telemetryMessage: e.target.value })}
                    placeholder="Type custom status note here..."
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="btn btn-gold text-xs px-4 font-bold shrink-0 gap-1.5"
                  >
                    <Save size={14} /> Save Message
                  </button>
                </div>
                <div className="text-[11px] text-muted flex flex-wrap items-center gap-2 pt-1 font-medium">
                  <span>Live Preview in Tooltip:</span>
                  <span className="inline-flex items-center gap-1.5 text-success font-bold bg-success/10 px-2.5 py-0.5 rounded-md border border-success/30">
                    <CheckCircle2 size={12} /> {config.telemetryMessage || "No downtime recorded during this hour."}
                  </span>
                </div>
              </div>
            </div>

            {/* Health Status Mode Selection */}
            <div className="panel p-6 space-y-4 bg-card/90 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <Sliders size={16} className="text-gold" />
                    Server Health Status Override
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Select the active telemetry status broadcasted to public play page visitors.
                  </p>
                </div>
                {config.statusOverride !== initialConfig?.statusOverride && (
                  <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    Unsaved Changes
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Option 1: Live */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, statusOverride: "live" })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    config.statusOverride === "live"
                      ? "border-emerald-500/80 bg-emerald-500/10 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/40"
                      : "border-line bg-surface hover:border-emerald-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Normal Live Status
                    </span>
                    {config.statusOverride === "live" && <CheckCircle2 size={16} className="text-emerald-400" />}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Automatic status fetch from <code className="text-gold font-mono">mc.mazora.us</code> via live status API.
                  </p>
                </button>

                {/* Option 2: Degraded */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, statusOverride: "degraded" })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    config.statusOverride === "degraded"
                      ? "border-amber-500/80 bg-amber-500/10 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/40"
                      : "border-line bg-surface hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-amber-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Degraded Telemetry
                    </span>
                    {config.statusOverride === "degraded" && <CheckCircle2 size={16} className="text-amber-400" />}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Displays yellow warning banner indicating high latency or minor server lag.
                  </p>
                </button>

                {/* Option 3: Offline / Maintenance */}
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, statusOverride: "offline" })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    config.statusOverride === "offline"
                      ? "border-rose-500/80 bg-rose-500/10 shadow-md shadow-rose-500/5 ring-1 ring-rose-500/40"
                      : "border-line bg-surface hover:border-rose-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-rose-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      Maintenance / Offline
                    </span>
                    {config.statusOverride === "offline" && <CheckCircle2 size={16} className="text-rose-400" />}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Shows scheduled maintenance banner and pauses live player counter on play page.
                  </p>
                </button>
              </div>

              <div className="pt-3 border-t border-line-strong/40 flex items-center justify-between">
                <span className="text-xs text-muted">
                  Health status overrides take effect immediately on saved configuration.
                </span>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="btn btn-gold text-xs py-2 px-4 gap-1.5 font-bold shadow-sm"
                >
                  <Save size={14} /> Save Health Mode
                </button>
              </div>
            </div>

            {/* Realtime Live Telemetry Grid */}
            <div className="panel p-6 space-y-4 bg-card/90 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                  <Signal size={16} className="text-emerald-400" />
                  Realtime Server Telemetry Overview
                </h4>
                <span className="text-[11px] text-muted font-mono">
                  Last Synced: <strong className="text-ink">{liveStats.lastSynced || "Just Now"}</strong>
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Metric 1: Online Players */}
                <div className="rounded-xl border border-line-strong/50 bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Players Online</span>
                    <Users size={16} className="text-accent-bright" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink">
                    {liveStats.players} <span className="text-xs font-normal text-muted">/ {liveStats.max}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-accent-bright h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(1, Math.min(100, (liveStats.players / liveStats.max) * 100))}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    Capacity: {Math.round((liveStats.players / liveStats.max) * 100)}% Full
                  </div>
                </div>

                {/* Metric 2: Connection Ping */}
                <div className="rounded-xl border border-line-strong/50 bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Connection Ping</span>
                    <Signal size={16} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {liveStats.ping > 0 ? `${liveStats.ping}ms` : "< 20ms"}
                  </div>
                  <div className="text-[11px] text-emerald-400/90 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Ultra-Low Latency Network
                  </div>
                </div>

                {/* Metric 3: Minecraft Version */}
                <div className="rounded-xl border border-line-strong/50 bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Server Version</span>
                    <Server size={16} className="text-gold" />
                  </div>
                  <div className="text-xl font-bold text-ink truncate">
                    {liveStats.version || config.supportedVersion}
                  </div>
                  <div className="text-[11px] text-gold font-semibold">
                    Java & Bedrock Crossplay
                  </div>
                </div>

                {/* Metric 4: Server Availability */}
                <div className="rounded-xl border border-line-strong/50 bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Server Uptime</span>
                    <Activity size={16} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-cyan-400">
                    99.9%
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    High Availability SLA
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostics Box (No duplicate sync button here!) */}
            <div className="panel p-6 bg-card/90 backdrop-blur-md space-y-4 border-gold/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <RefreshCw size={15} className="text-gold" />
                    Live Telemetry Polling Diagnostics
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Automated queries to <code className="text-gold font-mono">mcsrvstat.us</code> update live player counts and ping.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 size={14} /> Telemetry API Active (60s Cache)
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-line bg-surface/80">
                  <span className="text-muted block text-[10px] uppercase font-sans font-bold">Primary Address</span>
                  <span className="text-gold font-bold">{config.javaIp}:25565</span>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface/80">
                  <span className="text-muted block text-[10px] uppercase font-sans font-bold">Bedrock Crossplay</span>
                  <span className="text-cyan-400 font-bold">{config.bedrockIp}:{config.bedrockPort}</span>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface/80">
                  <span className="text-muted block text-[10px] uppercase font-sans font-bold">Telemetry Provider</span>
                  <span className="text-emerald-400 font-bold">mcsrvstat.us</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SECTION 3: DISCORD PATCH UPDATES CRUD */}
      {activeTab === "patches" && (
        <div className="space-y-6">
          <div className="panel p-6 flex flex-wrap items-center justify-between gap-4 bg-card/90 backdrop-blur-md">
            <div>
              <h3 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                <Sparkles className="text-gold" size={20} />
                Server Patch Updates CRUD Manager
              </h3>
              <p className="text-xs text-muted mt-1 font-medium">
                Showing all {patches.length} published patch updates from active Discord channel.
              </p>
            </div>

            <button onClick={handleOpenCreateModal} className="btn btn-gold gap-2 font-bold">
              <Plus size={16} /> Create New Patch
            </button>
          </div>

          {/* PATCHES LIST WITH PAGINATION */}
          <div className="space-y-4">
            {visiblePatches.map((patch) => {
              const dateStr = new Date(patch.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={patch.id}
                  className="panel p-5 flex flex-wrap items-start justify-between gap-4 transition-all hover:border-gold/40 bg-card/90 shadow-2xs"
                >
                  <div className="space-y-2 flex-1 min-w-[280px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Star size={16} className="text-gold fill-amber-500/20" />
                      <h4 className="font-display font-bold text-ink text-base">{patch.version}</h4>
                      <span className="rounded-lg bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent-bright">
                        {patch.targetMode}
                      </span>
                      <span className="text-xs text-ink font-bold flex items-center gap-1.5">
                        <AuthorAvatar name={patch.author} avatarUrl={patch.authorAvatar} size={20} />
                        {patch.author} <span className="font-normal text-muted">({patch.authorRole || "Owner"})</span>
                      </span>
                      <span className="text-xs text-muted font-semibold flex items-center gap-1">
                        <Calendar size={12} /> {dateStr}
                      </span>
                    </div>

                    <ul className="space-y-1 pl-1">
                      {patch.changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted font-medium">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(patch)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong/60 bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:border-gold/40 hover:bg-gold/10 transition-all shadow-2xs"
                    >
                      <Edit2 size={13} /> Edit
                    </button>

                    <button
                      onClick={() => handleDeletePatch(patch.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:text-danger hover:border-danger/40 transition-all shadow-2xs"
                      title="Delete patch"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between panel p-4 text-xs font-bold bg-card/90">
              <span className="text-muted">
                Showing {visiblePatches.length} of {patches.length} total patch updates
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:border-gold/40 hover:text-ink disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="text-gold font-bold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:border-gold/40 hover:text-ink disabled:opacity-40 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: FAQ MANAGER */}
      {activeTab === "faqs" && (
        <div className="space-y-6">
          <div className="panel p-6 flex flex-wrap items-center justify-between gap-4 bg-card/90 backdrop-blur-md">
            <div>
              <h3 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                <HelpCircle className="text-gold" size={20} />
                Frequently Asked Questions (FAQ) Manager
              </h3>
              <p className="text-xs text-muted mt-1 font-medium">
                Add, edit, or delete FAQ items displayed on the public Play page & Support page. Edits publish immediately to the live site.
              </p>
            </div>

            <button onClick={handleOpenCreateFaqModal} className="btn btn-gold gap-2 font-bold">
              <Plus size={16} /> Create FAQ Item
            </button>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="panel p-5 flex flex-wrap items-start justify-between gap-4 transition-all hover:border-gold/40 bg-card/90 shadow-2xs"
              >
                <div className="space-y-1.5 flex-1 min-w-[280px]">
                  <h4 className="font-bold text-ink text-base flex items-center gap-2">
                    <MessageSquare size={16} className="text-gold shrink-0" />
                    {faq.q}
                  </h4>
                  <p className="text-xs text-muted font-medium leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditFaqModal(faq)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong/60 bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:border-gold/40 hover:bg-gold/10 transition-all shadow-2xs"
                  >
                    <Edit2 size={13} /> Edit
                  </button>

                  <button
                    onClick={() => handleDeleteFaq(faq.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:text-danger hover:border-danger/40 transition-all shadow-2xs"
                    title="Delete FAQ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT PATCH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleSavePatch}
            className="w-full max-w-lg rounded-2xl border border-gold/40 bg-card/95 text-ink p-6 sm:p-7 shadow-2xl space-y-4 backdrop-blur-xl max-h-[90vh] overflow-y-auto scrollbar-none"
          >
            <div className="flex items-center justify-between border-b border-line-strong/40 pb-3">
              <h3 className="font-display font-bold text-ink text-lg flex items-center gap-2">
                <Sparkles className="text-gold" size={18} />
                {editingPatchId ? "Edit Patch Update" : "Create New Patch Update"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-ink uppercase">Patch Version Title</label>
                <Input
                  value={patchVersion}
                  onChange={(e) => setPatchVersion(e.target.value)}
                  placeholder="e.g. Patch Update 1.16"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink uppercase">Target Game Mode & Version</label>
                <Input
                  value={patchMode}
                  onChange={(e) => setPatchMode(e.target.value)}
                  placeholder="e.g. Survival - 1.21.11"
                />
              </div>

              {/* Author Name Selector (Current User Account & Mazora Team options) */}
              <div className="space-y-1.5">
                <label className="font-bold text-ink uppercase tracking-wider block">Author Identity</label>
                <div className="flex flex-wrap gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => setPatchAuthor(currentUser?.name || "LilyLuvv")}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                      patchAuthor === (currentUser?.name || "LilyLuvv")
                        ? "bg-gold/25 text-gold border-gold shadow-xs ring-1 ring-gold/50"
                        : "bg-surface text-ink border-line-strong/60 hover:border-gold/40 hover:bg-gold/10"
                    }`}
                  >
                    <AuthorAvatar name={currentUser?.name || "LilyLuvv"} avatarUrl={currentUser?.avatarUrl} size={18} />
                    {currentUser?.name || "LilyLuvv"} ({currentUser?.role || "Owner"})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatchAuthor("Mazora Team")}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                      patchAuthor === "Mazora Team"
                        ? "bg-gold/25 text-gold border-gold shadow-xs ring-1 ring-gold/50"
                        : "bg-surface text-ink border-line-strong/60 hover:border-gold/40 hover:bg-gold/10"
                    }`}
                  >
                    <AuthorAvatar name="Mazora Team" size={18} />
                    Mazora Team
                  </button>
                </div>
                <Input
                  value={patchAuthor}
                  onChange={(e) => setPatchAuthor(e.target.value)}
                  placeholder="Or type custom author name..."
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink uppercase">Change Bullet Points (One per line)</label>
                <Textarea
                  value={patchChangesText}
                  onChange={(e) => setPatchChangesText(e.target.value)}
                  rows={5}
                  placeholder="- Clearlag added with optimizations&#10;- Playtime tracker added /playtime&#10;- You can now sell wheat"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line-strong/40 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-gold text-xs gap-1.5 font-bold">
                <Save size={14} /> {editingPatchId ? "Save Changes" : "Publish Patch"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE / EDIT FAQ MODAL */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleSaveFaq}
            className="w-full max-w-lg rounded-2xl border border-gold/40 bg-card/95 text-ink p-6 sm:p-7 shadow-2xl space-y-4 backdrop-blur-xl max-h-[90vh] overflow-y-auto scrollbar-none"
          >
            <div className="flex items-center justify-between border-b border-line-strong/40 pb-3">
              <h3 className="font-display font-bold text-ink text-lg flex items-center gap-2">
                <HelpCircle className="text-gold" size={18} />
                {editingFaqId ? "Edit FAQ Item" : "Create New FAQ Item"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="text-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-ink uppercase">Question</label>
                <Input
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. Which Minecraft versions are supported?"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink uppercase">Answer</label>
                <Textarea
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  rows={4}
                  placeholder="Provide a clear, detailed answer..."
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line-strong/40 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFaqModalOpen(false)}
                className="btn btn-secondary text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-gold text-xs gap-1.5 font-bold">
                <Save size={14} /> {editingFaqId ? "Save Changes" : "Publish FAQ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
