"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Edit3,
  Lock,
  Megaphone,
  Pencil,
  Radio,
  Save,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import type { Role } from "@/lib/types";

export interface UserOption {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
}

const NOTIF_ICONS = [
  { emoji: "🎉", label: "Event & Party" },
  { emoji: "⚡", label: "Patch & Update" },
  { emoji: "📢", label: "Announcement" },
  { emoji: "🛡️", label: "Staff & Security" },
  { emoji: "🔒", label: "Session & Account" },
  { emoji: "🛒", label: "Store & Order" },
  { emoji: "🎫", label: "Support Ticket" },
  { emoji: "📋", label: "Form & App" },
  { emoji: "💎", label: "VIP & Rank" },
  { emoji: "🚀", label: "Launch & Release" },
  { emoji: "🎁", label: "Reward & Gift" },
  { emoji: "🔥", label: "Hot & Special" },
  { emoji: "🏆", label: "Contest & Winner" },
  { emoji: "⚔️", label: "PvP & Realm" },
  { emoji: "⭐", label: "Featured" },
  { emoji: "🔔", label: "General Alert" },
];

function parseTitleIconAndText(fullTitle: string): { icon: string; text: string } {
  const regex = /^(\u200d|\ud83c[\udf00-\udfff]|\ud83d[\udf00-\udfff]|\ud83e[\udf00-\udfff]|[\u2600-\u27ff])+\s*/u;
  const match = fullTitle.match(regex);
  if (match) {
    const icon = match[0].trim();
    const text = fullTitle.replace(regex, "").trim();
    return { icon, text };
  }
  return { icon: "🎉", text: fullTitle };
}

function NotificationIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative shrink-0 border-r border-line-strong dark:border-line" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-full px-3.5 flex items-center gap-1.5 bg-surface/40 hover:bg-surface/80 rounded-l-xl text-ink text-base font-bold transition-colors"
        title="Select notification icon"
      >
        <span>{value}</span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      {open && (
        <div className="absolute z-[100] top-[calc(100%+6px)] left-0 w-56 max-h-60 overflow-y-auto rounded-xl border border-line-strong bg-white dark:bg-card backdrop-blur-2xl shadow-2xl p-1.5 animate-fade-up">
          {NOTIF_ICONS.map((item) => (
            <button
              key={item.emoji}
              type="button"
              onClick={() => {
                onChange(item.emoji);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left",
                value === item.emoji
                  ? "bg-accent/15 text-accent-bright font-bold"
                  : "text-ink/80 hover:bg-surface hover:text-ink"
              )}
            >
              <span className="text-base">{item.emoji}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  target: "all" | "staff" | "moderators" | "users";
  priority: "normal" | "important" | "urgent";
  category: "announcement" | "system" | "event" | "security";
  sender: string;
  createdAt: string;
}

export interface DefaultTemplate {
  id: string;
  name: string;
  trigger: string;
  title: string;
  message: string;
  category: "welcome" | "system" | "support" | "security";
  enabled: boolean;
  fixed?: boolean;
}

const INITIAL_BROADCASTS: BroadcastItem[] = [];

const INITIAL_TEMPLATES: DefaultTemplate[] = [
  {
    id: "tpl-welcome",
    name: "New Player Welcome Message",
    trigger: "Automatically sent on first login. This is a fixed default — it cannot be manually dispatched and is delivered to every new user.",
    title: "🎉 Welcome to Mazora Network",
    message: "Your account is active. Connect to mc.mazora.us to claim your starter pack and explore survival mode!",
    category: "welcome",
    enabled: true,
    fixed: true,
  },
  {
    id: "tpl-security",
    name: "Account Session Verification",
    trigger: "Automatically sent on first login or new device session. Fixed default — fires automatically.",
    title: "🔒 Session Verification",
    message: "Your login session was verified successfully. If you suspect unauthorized activity, change your password in account settings.",
    category: "security",
    enabled: true,
    fixed: true,
  },
  {
    id: "tpl-form",
    name: "Form Response / Staff Application Result",
    trigger: "Admin dispatches manually after reviewing Google Form staff applications or other user submissions.",
    title: "📋 Staff Form Application Update",
    message: "Your application form submission has been reviewed by the administrative team. Check Discord for next steps!",
    category: "support",
    enabled: true,
  },
  {
    id: "tpl-ticket",
    name: "Support Ticket Status Update / Staff Reply",
    trigger: "Admin dispatches manually when staff responds to or resolves a ticket thread.",
    title: "🎫 Support Ticket Update",
    message: "A staff member has updated your ticket status. Click here to view the full response.",
    category: "support",
    enabled: true,
  },
  {
    id: "tpl-appeal",
    name: "Ban Appeal Decision Notice",
    trigger: "Admin dispatches manually when an appeal is approved, rejected, or updated.",
    title: "🛡️ Appeal Review Notice",
    message: "Your punishment appeal has been reviewed by staff. Click to view the decision details.",
    category: "support",
    enabled: true,
  },
  {
    id: "tpl-store",
    name: "Store Package & Rank Delivery",
    trigger: "Admin dispatches manually when a store purchase or vote reward is processed.",
    title: "🛒 Store Package Delivered",
    message: "Your rank, keys, and perks have been assigned to your connected Minecraft account!",
    category: "system",
    enabled: true,
  },
];

export function AdminBroadcastManager({ users = [] }: { users?: UserOption[] }) {
  const [activeTab, setActiveTab] = useState<"broadcasts" | "templates" | "direct">("broadcasts");
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(INITIAL_BROADCASTS);
  const [templates, setTemplates] = useState<DefaultTemplate[]>(INITIAL_TEMPLATES);

  // Broadcast composer state
  const [titleIcon, setTitleIcon] = useState("🎉");
  const [titleText, setTitleText] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<BroadcastItem["target"]>("all");
  const [priority, setPriority] = useState<BroadcastItem["priority"]>("normal");
  const [category, setCategory] = useState<BroadcastItem["category"]>("announcement");
  const [broadcastChannel, setBroadcastChannel] = useState<"mazora" | "account">("mazora");
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Direct User Dispatcher state
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<"account" | "mazora">("mazora");
  const dispatchableTemplates = templates.filter((t) => !t.fixed);
  const [selectedTemplateId, setSelectedTemplateId] = useState(dispatchableTemplates[0]?.id || "");
  const firstTpl = dispatchableTemplates[0];
  const initialDirect = parseTitleIconAndText(firstTpl?.title || "");
  const [directTitleIcon, setDirectTitleIcon] = useState(initialDirect.icon);
  const [directTitleText, setDirectTitleText] = useState(initialDirect.text);
  const [directMessage, setDirectMessage] = useState(firstTpl?.message || "");

  // Filtered user list for combobox
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName?.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  // Close user picker dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Edit states for Broadcast Items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editTarget, setEditTarget] = useState<BroadcastItem["target"]>("all");
  const [editPriority, setEditPriority] = useState<BroadcastItem["priority"]>("normal");
  const [editCategory, setEditCategory] = useState<BroadcastItem["category"]>("announcement");

  // Edit states for Templates
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [editTplTitle, setEditTplTitle] = useState("");
  const [editTplMessage, setEditTplMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleText.trim() || !message.trim()) return;

    setSending(true);
    setTimeout(() => {
      const fullTitle = `${titleIcon} ${titleText.trim()}`.trim();
      const newBroadcast: BroadcastItem = {
        id: `b-${Date.now()}`,
        title: fullTitle,
        message: message.trim(),
        target,
        priority,
        category,
        sender: broadcastChannel === "mazora" ? "Mazora Team" : "User Account",
        createdAt: "Just now",
      };

      setBroadcasts((prev) => [newBroadcast, ...prev]);
      setTitleText("");
      setMessage("");
      setSending(false);
      setSuccessMsg("Broadcast sent successfully to targeted users!");

      setTimeout(() => setSuccessMsg(""), 4000);
    }, 400);
  };

  const handleDirectDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !directTitleText.trim() || !directMessage.trim()) return;

    setSending(true);
    setTimeout(() => {
      setSending(false);
      const channelLabel = deliveryChannel === "mazora" ? "Mazora Team" : "User Account";
      setSuccessMsg(`Notification delivered to '${selectedUser.username}' via ${channelLabel} channel!`);
      setSelectedUser(null);
      setUserQuery("");
      setTimeout(() => setSuccessMsg(""), 4000);
    }, 400);
  };

  const selectTemplateForDirect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (tplId === "custom") {
      setDirectTitleIcon("🔔");
      setDirectTitleText("");
      setDirectMessage("");
      return;
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      const { icon, text } = parseTitleIconAndText(tpl.title);
      setDirectTitleIcon(icon);
      setDirectTitleText(text);
      setDirectMessage(tpl.message);
    }
  };

  const triggerTplForUser = (tpl: DefaultTemplate) => {
    if (tpl.fixed) return;
    setActiveTab("direct");
    setSelectedTemplateId(tpl.id);
    const { icon, text } = parseTitleIconAndText(tpl.title);
    setDirectTitleIcon(icon);
    setDirectTitleText(text);
    setDirectMessage(tpl.message);
  };

  const startEditBroadcast = (item: BroadcastItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditMessage(item.message);
    setEditTarget(item.target);
    setEditPriority(item.priority);
    setEditCategory(item.category);
  };

  const saveEditBroadcast = (id: string) => {
    setBroadcasts((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              title: editTitle.trim(),
              message: editMessage.trim(),
              target: editTarget,
              priority: editPriority,
              category: editCategory,
            }
          : b
      )
    );
    setEditingId(null);
    setSuccessMsg("Broadcast details updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id: string) => {
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
  };

  const startEditTemplate = (tpl: DefaultTemplate) => {
    setEditingTplId(tpl.id);
    setEditTplTitle(tpl.title);
    setEditTplMessage(tpl.message);
  };

  const saveEditTemplate = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, title: editTplTitle.trim(), message: editTplMessage.trim() }
          : t
      )
    );
    setEditingTplId(null);
    setSuccessMsg("Default template updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const toggleTemplateEnabled = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const getPriorityBadge = (p: BroadcastItem["priority"]) => {
    switch (p) {
      case "normal":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface text-muted border border-line">Normal</span>;
      case "important":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">Important</span>;
      case "urgent":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">Urgent</span>;
    }
  };

  const getTargetBadge = (t: BroadcastItem["target"]) => {
    switch (t) {
      case "all":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/15 text-accent-bright border border-accent/25"><Users size={10} /> Everyone</span>;
      case "staff":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25"><ShieldAlert size={10} /> Staff Only</span>;
      case "moderators":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">Mods+</span>;
      case "users":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Members</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Controls */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border border-line-strong bg-card backdrop-blur-xl shadow-md">
        <button
          type="button"
          onClick={() => setActiveTab("broadcasts")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "broadcasts"
              ? "bg-accent text-white shadow-md shadow-accent/25"
              : "text-ink/70 hover:text-ink hover:bg-surface"
          )}
        >
          <Megaphone size={14} />
          Broadcast Announcements ({broadcasts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("direct")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "direct"
              ? "bg-accent text-white shadow-md shadow-accent/25"
              : "text-ink/70 hover:text-ink hover:bg-surface"
          )}
        >
          <User size={14} />
          Direct User Dispatcher
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "templates"
              ? "bg-accent text-white shadow-md shadow-accent/25"
              : "text-ink/70 hover:text-ink hover:bg-surface"
          )}
        >
          <Settings size={14} />
          Default Templates ({templates.length})
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-up">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─── Tab 1: Broadcast Announcements ─── */}
      {activeTab === "broadcasts" && (
        <div className="space-y-8">
          {/* Composer Form */}
          <div className="p-6 rounded-2xl border border-line-strong bg-card backdrop-blur-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/15 text-accent-bright border border-accent/25">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">Broadcast New Announcement</h3>
                  <p className="text-xs text-muted font-medium">Send real-time notifications directly to player notification bells and feeds.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSend} className="space-y-5">
              {/* Title Input with Integrated Icon Select Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Notification Title</label>
                <div className="relative flex items-stretch rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 shadow-sm transition-all">
                  <NotificationIconPicker value={titleIcon} onChange={setTitleIcon} />

                  {/* Title Text Input */}
                  <input
                    type="text"
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    placeholder="e.g. Double XP Weekend Live!"
                    className="w-full px-3.5 py-2.5 bg-transparent text-ink text-sm font-medium focus:outline-none placeholder:text-muted/60"
                    required
                  />
                </div>
              </div>

              {/* Target Audience — Card Style Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink">Target Audience</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    { value: "all" as const, label: "Everyone", desc: "All members", icon: <Users size={16} />, color: "accent" },
                    { value: "staff" as const, label: "Staff Only", desc: "Helper+ tiers", icon: <ShieldAlert size={16} />, color: "blue" },
                    { value: "moderators" as const, label: "Mods+", desc: "Moderators & above", icon: <ShieldAlert size={16} />, color: "purple" },
                    { value: "users" as const, label: "Members", desc: "Regular players", icon: <User size={16} />, color: "emerald" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTarget(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                        target === opt.value
                          ? opt.color === "accent"
                            ? "border-accent bg-accent/10 dark:bg-accent/15 shadow-md shadow-accent/10 ring-1 ring-accent/30"
                            : opt.color === "blue"
                            ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30"
                            : opt.color === "purple"
                            ? "border-purple-500 bg-purple-500/10 dark:bg-purple-500/15 shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30"
                            : "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                      )}
                    >
                      <span className={cn(
                        "transition-colors",
                        target === opt.value
                          ? opt.color === "accent" ? "text-accent-bright"
                            : opt.color === "blue" ? "text-blue-500 dark:text-blue-400"
                            : opt.color === "purple" ? "text-purple-500 dark:text-purple-400"
                            : "text-emerald-500 dark:text-emerald-400"
                          : "text-muted"
                      )}>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-bold text-ink">{opt.label}</span>
                      <span className="text-[10px] text-muted font-medium leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sender Identity / Delivery Channel */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink">Sender Identity / Delivery Channel</label>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastChannel("mazora")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                      broadcastChannel === "mazora"
                        ? "border-accent bg-accent/10 shadow-md shadow-accent/15 ring-1 ring-accent/30"
                        : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-8 w-8 rounded-full object-cover border border-accent/30 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-ink">Mazora Team</div>
                      <p className="text-[10px] text-muted font-medium">Official broadcast sent under the Mazora Team identity & logo.</p>
                    </div>
                    {broadcastChannel === "mazora" && <Check size={16} className="text-accent-bright shrink-0 ml-auto" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastChannel("account")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                      broadcastChannel === "account"
                        ? "border-accent bg-accent/10 shadow-md shadow-accent/15 ring-1 ring-accent/30"
                        : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-line-strong shrink-0">
                      <User size={16} className="text-ink/70" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink">User Account</div>
                      <p className="text-[10px] text-muted font-medium">Broadcast sent under your active authenticated user/staff profile.</p>
                    </div>
                    {broadcastChannel === "account" && <Check size={16} className="text-accent-bright shrink-0 ml-auto" />}
                  </button>
                </div>
              </div>

              {/* Category & Priority — Styled Selects */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BroadcastItem["category"])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                  >
                    <option value="announcement">📢 Announcement</option>
                    <option value="event">🎉 Event & Rewards</option>
                    <option value="system">⚡ System & Patch</option>
                    <option value="security">🛡️ Security & Staff</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Priority Tier</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as BroadcastItem["priority"])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">⚠️ Important (Highlighted)</option>
                    <option value="urgent">🔴 Urgent (System Alert)</option>
                  </select>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Message Content</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the full broadcast message details here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none placeholder:text-muted/60"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-xs shadow-lg shadow-accent/25 transition-all disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{sending ? "Broadcasting..." : "Broadcast Notification"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Broadcast History List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-accent-bright" />
                <h3 className="font-display text-lg font-bold text-ink">Broadcast History ({broadcasts.length})</h3>
              </div>
            </div>

            <div className="space-y-3.5">
              {broadcasts.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-line-strong bg-card hover:border-line-strong transition-all shadow-md space-y-3"
                >
                  {editingId === item.id ? (
                    <div className="space-y-4 animate-fade-up">
                      <div className="flex items-center justify-between border-b border-line pb-2">
                        <span className="text-xs font-bold text-accent-bright flex items-center gap-1.5">
                          <Pencil size={13} /> Editing Broadcast Details
                        </span>
                        <button type="button" onClick={() => setEditingId(null)} className="text-muted hover:text-ink text-xs font-bold flex items-center gap-1">
                          <X size={14} /> Cancel
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-ink">Title</label>
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-xs font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-ink">Target</label>
                          <select value={editTarget} onChange={(e) => setEditTarget(e.target.value as BroadcastItem["target"])} className="w-full px-3 py-2 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-xs font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8">
                            <option value="all">Everyone</option>
                            <option value="staff">Staff Only</option>
                            <option value="moderators">Mods+</option>
                            <option value="users">Members</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-ink">Message</label>
                        <textarea rows={2} value={editMessage} onChange={(e) => setEditMessage(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-xs font-medium resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-xl border border-line bg-surface text-muted text-xs font-bold hover:text-ink">Cancel</button>
                        <button type="button" onClick={() => saveEditBroadcast(item.id)} className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-bold shadow-md shadow-accent/20 flex items-center gap-1.5">
                          <Save size={13} /> Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-base font-bold text-ink">{item.title}</h4>
                          {getTargetBadge(item.target)}
                          {getPriorityBadge(item.priority)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted font-medium mr-1">{item.createdAt}</span>
                          <button type="button" onClick={() => startEditBroadcast(item)} className="px-2.5 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface/80 text-ink text-xs font-bold flex items-center gap-1 transition-all" title="Edit broadcast details">
                            <Edit3 size={13} /><span>Edit Details</span>
                          </button>
                          <button type="button" onClick={() => handleDelete(item.id)} title="Delete broadcast entry" className="p-1.5 rounded-xl border border-transparent hover:border-red-500/40 hover:bg-red-500/10 text-muted hover:text-red-400 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-ink/80 dark:text-muted font-medium leading-relaxed">{item.message}</p>
                      <div className="text-xs text-muted/80 font-semibold pt-1 border-t border-line/40 flex items-center justify-between">
                        <span>Sent by {item.sender}</span>
                        <span className="text-accent-bright font-bold">Active in user feeds</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 2: Direct User Dispatcher ─── */}
      {activeTab === "direct" && (
        <div className="p-6 rounded-2xl border border-line-strong bg-card backdrop-blur-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/15 text-accent-bright border border-accent/25">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Direct User Notification Dispatcher</h3>
                <p className="text-xs text-muted font-medium">
                  Dispatch notifications to a specific user — for Google Form responses, store rank deliveries, ticket updates, or custom messages.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleDirectDispatch} className="space-y-4">
            <div className="space-y-4">
              {/* Searchable User Picker Combobox */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Select Target User</label>
                <div className="relative" ref={userPickerRef}>
                  {/* Selected user display / search input */}
                  {selectedUser ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-accent bg-accent/5 text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MinecraftAvatar username={selectedUser.username} size={26} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-ink truncate">{selectedUser.displayName || selectedUser.username}</div>
                          <div className="text-[10px] text-muted font-medium truncate">@{selectedUser.username}</div>
                        </div>
                        <RankChip role={selectedUser.role} />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedUser(null); setUserQuery(""); }}
                        className="p-1 rounded-lg hover:bg-surface text-muted hover:text-ink transition-all shrink-0"
                        title="Clear selection"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                      <input
                        type="text"
                        value={userQuery}
                        onChange={(e) => { setUserQuery(e.target.value); setUserDropdownOpen(true); }}
                        onFocus={() => setUserDropdownOpen(true)}
                        placeholder="Search by username, name, or role..."
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
                      />
                      <button
                        type="button"
                        onClick={() => setUserDropdownOpen((o) => !o)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {userDropdownOpen && !selectedUser && (
                    <div className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-white dark:bg-card backdrop-blur-2xl shadow-2xl animate-fade-up">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted font-medium">
                          {users.length === 0 ? "No registered users found." : `No users matching "${userQuery}"`}
                        </div>
                      ) : (
                        <div className="py-1">
                          {filteredUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setUserQuery("");
                                setUserDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-surface/80 transition-colors text-left"
                            >
                              <MinecraftAvatar username={u.username} size={28} />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-ink truncate">{u.displayName || u.username}</div>
                                <div className="text-[10px] text-muted font-medium truncate">@{u.username}</div>
                              </div>
                              <RankChip role={u.role} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Template Preset Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">Notification Template Preset</label>
                  <span className="text-[11px] font-medium text-muted">Select a preset or choose Custom</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {dispatchableTemplates.map((t) => {
                    const parsed = parseTitleIconAndText(t.title);
                    const isSelected = selectedTemplateId === t.id;
                    const shortName = t.name.split("/")[0].trim();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTemplateForDirect(t.id)}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-xl border transition-all text-left relative",
                          isSelected
                            ? "border-accent bg-accent/10 dark:bg-accent/15 shadow-md shadow-accent/10 ring-1 ring-accent/30"
                            : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                        )}
                      >
                        <span className="text-lg mb-1">{parsed.icon}</span>
                        <span className="text-xs font-bold text-ink line-clamp-1">{shortName}</span>
                        <span className="text-[10px] text-muted font-medium line-clamp-1">Preset template</span>
                        {isSelected && <Check size={14} className="text-accent-bright absolute top-2 right-2" />}
                      </button>
                    );
                  })}

                  {/* Custom Message Option Card */}
                  <button
                    type="button"
                    onClick={() => selectTemplateForDirect("custom")}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border transition-all text-left relative",
                      selectedTemplateId === "custom"
                        ? "border-accent bg-accent/10 dark:bg-accent/15 shadow-md shadow-accent/10 ring-1 ring-accent/30"
                        : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                    )}
                  >
                    <span className="text-lg mb-1">✍️</span>
                    <span className="text-xs font-bold text-ink">Custom Message</span>
                    <span className="text-[10px] text-muted font-medium">Write custom text</span>
                    {selectedTemplateId === "custom" && <Check size={14} className="text-accent-bright absolute top-2 right-2" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery Channel Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink">Delivery Channel</label>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeliveryChannel("mazora")}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    deliveryChannel === "mazora"
                      ? "border-accent bg-accent/10 shadow-md shadow-accent/15 ring-1 ring-accent/30"
                      : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-8 w-8 rounded-full object-cover border border-accent/30 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-ink">Mazora Team</div>
                    <p className="text-[10px] text-muted font-medium">Sent as an official Mazora Team notification — like news & announcements.</p>
                  </div>
                  {deliveryChannel === "mazora" && <Check size={16} className="text-accent-bright shrink-0 ml-auto" />}
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryChannel("account")}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    deliveryChannel === "account"
                      ? "border-accent bg-accent/10 shadow-md shadow-accent/15 ring-1 ring-accent/30"
                      : "border-line-strong dark:border-line bg-white dark:bg-surface/60 hover:bg-gray-50 dark:hover:bg-surface"
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-line-strong shrink-0">
                    <User size={16} className="text-ink/70" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">User Account</div>
                    <p className="text-[10px] text-muted font-medium">Sent as a personal system notification — shows in the user&apos;s account feed only.</p>
                  </div>
                  {deliveryChannel === "account" && <Check size={16} className="text-accent-bright shrink-0 ml-auto" />}
                </button>
              </div>
            </div>

            {/* Title Input with Integrated Icon Select Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">Notification Title</label>
              <div className="relative flex items-stretch rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 shadow-sm transition-all">
                <NotificationIconPicker value={directTitleIcon} onChange={setDirectTitleIcon} />

                {/* Title Text Input */}
                <input
                  type="text"
                  value={directTitleText}
                  onChange={(e) => setDirectTitleText(e.target.value)}
                  placeholder="e.g. Staff Form Application Update"
                  className="w-full px-3.5 py-2.5 bg-transparent text-ink text-sm font-medium focus:outline-none placeholder:text-muted/60"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">Message Text</label>
              <textarea
                rows={3}
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none placeholder:text-muted/60"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-xs shadow-lg shadow-accent/25 transition-all disabled:opacity-50"
              >
                <Send size={14} />
                <span>{sending ? "Delivering..." : "Dispatch Direct Notification"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Tab 3: Automated Default Templates ─── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-line-strong bg-card backdrop-blur-2xl shadow-xl space-y-1">
            <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <Sparkles size={18} className="text-accent-bright" />
              Default Notification Templates
            </h3>
            <p className="text-xs text-muted font-medium">
              Fixed defaults (Welcome & Session Verification) auto-trigger on first login and cannot be dispatched manually — only their text can be edited. Dispatchable templates (Forms, Tickets, Store, Appeals) are sent manually via the Direct User Dispatcher.
            </p>
          </div>

          <div className="space-y-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={cn(
                  "p-5 rounded-2xl border bg-card hover:border-line-strong transition-all shadow-md space-y-3",
                  tpl.fixed ? "border-accent/20" : "border-line-strong"
                )}
              >
                {editingTplId === tpl.id ? (
                  /* Inline Edit Template Form */
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="text-xs font-bold text-accent-bright flex items-center gap-1.5">
                        <Pencil size={13} /> Editing: {tpl.name}
                      </span>
                      <button type="button" onClick={() => setEditingTplId(null)} className="text-muted hover:text-ink text-xs font-bold flex items-center gap-1">
                        <X size={14} /> Cancel
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink">Default Title</label>
                      <input type="text" value={editTplTitle} onChange={(e) => setEditTplTitle(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink">Default Message Text</label>
                      <textarea rows={3} value={editTplMessage} onChange={(e) => setEditTplMessage(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong dark:border-line bg-white dark:bg-surface/80 text-ink text-sm font-medium resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setEditingTplId(null)} className="px-3.5 py-2 rounded-xl border border-line bg-surface text-muted text-xs font-bold hover:text-ink">Cancel</button>
                      <button type="button" onClick={() => saveEditTemplate(tpl.id)} className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md shadow-accent/20 flex items-center gap-1.5">
                        <Save size={14} /> Save Template
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Template Details View */
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-base font-bold text-ink">{tpl.name}</h4>

                          {tpl.fixed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-accent/15 text-accent-bright border-accent/25">
                              <Lock size={10} /> Fixed Default
                            </span>
                          ) : (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
                              tpl.enabled
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-surface text-muted border-line"
                            )}>
                              {tpl.enabled ? "Active" : "Disabled"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted font-medium pt-0.5">{tpl.trigger}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!tpl.fixed && (
                          <>
                            <button
                              type="button"
                              onClick={() => triggerTplForUser(tpl)}
                              className="px-3 py-1.5 rounded-xl border border-accent/40 bg-accent/15 text-accent-bright hover:bg-accent/25 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Send size={13} />
                              <span>Dispatch to User</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleTemplateEnabled(tpl.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all",
                                tpl.enabled
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                  : "border-line bg-surface text-muted hover:text-ink"
                              )}
                            >
                              {tpl.enabled ? "Disable" : "Enable"}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => startEditTemplate(tpl)}
                          className="px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface/80 text-ink text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line/60 bg-surface/50 space-y-1">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-5 w-5 rounded-full object-cover border border-accent/30" />
                        <span className="text-[11px] font-bold text-accent-bright">Mazora Team</span>
                      </div>
                      <div className="text-xs font-bold text-ink mt-1">{tpl.title}</div>
                      <p className="text-xs text-muted font-medium leading-relaxed">{tpl.message}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
