"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as htmlToImage from "html-to-image";

const MEMBERS = [
  "Leo",
  "Junseo",
  "Arno",
  "Geonwoo",
  "Sangwon",
  "Xinlong",
  "Anxin",
  "Sanghyeon",
  "Units",
];

type Status = "prio" | "otw" | "owned";

type Photocard = {
  id: number;
  member: string;
  era: string | null;
  type: string | null;
  image_url: string | null;
  pc_name: string | null;
};

const STATUS_ORDER: (Status | null)[] = [null, "prio", "otw", "owned"];

// Sort grouping order (status-sort mode)
const STATUS_SORT_ORDER: (Status | "Missing")[] = [
  "owned",
  "otw",
  "prio",
  "Missing",
];

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [pcs, setPcs] = useState<Photocard[]>([]);
  const [pcStatus, setPcStatus] = useState<Record<number, Status>>({});
  const [loading, setLoading] = useState(true);

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Status filter: multi-select
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["All"]);

  // Sort mode
  const [sortMode, setSortMode] = useState<"default" | "status">("default");

  // Mobile: double-tap show PC name
  const [showNameFor, setShowNameFor] = useState<number | null>(null);
  const lastTapRef = useRef<Record<number, number>>({});
  const singleTapTimerRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});

  // Hint banner (once per device)
  const [showHint, setShowHint] = useState(false);

  // Menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Status dropdown per card
  const [statusMenuFor, setStatusMenuFor] = useState<number | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  // Status filter dropdown
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);

  // Export (grid-only)
  const exportRef = useRef<HTMLDivElement | null>(null);

  // Export mode (shrink ONLY for PNG)
  const [isExporting, setIsExporting] = useState(false);

  // ----------------------------
  // AUTH SESSION
  // ----------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // ----------------------------
  // MENU: CLOSE ON OUTSIDE CLICK
  // ----------------------------
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // ----------------------------
  // STATUS MENU: CLOSE ON OUTSIDE CLICK
  // ----------------------------
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (statusMenuFor === null) return;
      if (!statusMenuRef.current) return;
      if (statusMenuRef.current.contains(e.target as Node)) return;
      setStatusMenuFor(null);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [statusMenuFor]);

  // ----------------------------
  // STATUS FILTER: CLOSE ON OUTSIDE CLICK
  // ----------------------------
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!statusFilterRef.current) return;
      if (statusFilterRef.current.contains(e.target as Node)) return;
      setStatusFilterOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // ----------------------------
  // HINT (ONCE PER DEVICE)
  // ----------------------------
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("ald1_hint_dismissed");
      if (!dismissed) setShowHint(true);
    } catch {
      // ignore
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem("ald1_hint_dismissed", "1");
    } catch {
      // ignore
    }
  };

  // ----------------------------
  // FETCH PHOTOCARDS (PUBLIC)
  // ----------------------------
  useEffect(() => {
    const fetchPCs = async () => {
      const { data, error } = await supabase
        .from("photocards")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(0, 9999);

      if (error) console.error("Photocards fetch error:", error);
      if (data) setPcs(data);

      setLoading(false);
    };

    fetchPCs();
  }, []);

  // ----------------------------
  // FETCH STATUSES (ONLY IF LOGGED IN)
  // ----------------------------
  useEffect(() => {
    if (!userId) {
      setPcStatus({});
      return;
    }

    const fetchStatuses = async () => {
      const { data, error } = await supabase
        .from("user_pcs")
        .select("pc_id, status")
        .eq("user_id", userId);

      if (error) console.error("Status fetch error:", error);

      if (data) {
        const map: Record<number, Status> = {};
        data.forEach((row) => {
          map[row.pc_id] = row.status as Status;
        });
        setPcStatus(map);
      }
    };

    fetchStatuses();
  }, [userId]);

  // ----------------------------
  // LOGIN / LOGOUT
  // ----------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPcStatus({});
    setUserId(null);
    setUserEmail(null);
    setMenuOpen(false);
    router.push("/login");
  };

  const handleLogin = () => {
    setMenuOpen(false);
    router.push("/login");
  };

  // ----------------------------
  // STATUS CYCLING
  // ----------------------------
  const cycleStatus = async (pcId: number) => {
    if (!userId) {
      router.push("/login");
      return;
    }

    const current = pcStatus[pcId] ?? null;
    const next =
      STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];

    // DELETE when cycling back to null
    if (next === null) {
      const { error } = await supabase
        .from("user_pcs")
        .delete()
        .eq("user_id", userId)
        .eq("pc_id", pcId);

      if (error) console.error("Delete error:", error.message);

      setPcStatus((prev) => {
        const copy = { ...prev };
        delete copy[pcId];
        return copy;
      });

      return;
    }

    // UPDATE first
    const { data: updated, error: updateError } = await supabase
      .from("user_pcs")
      .update({ status: next })
      .eq("user_id", userId)
      .eq("pc_id", pcId)
      .select();

    if (updateError) console.error("Update error:", updateError);

    // INSERT fallback
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from("user_pcs").insert({
        user_id: userId,
        pc_id: pcId,
        status: next,
      });

      if (insertError) console.error("Insert error:", insertError);
    }

    setPcStatus((prev) => ({ ...prev, [pcId]: next }));
  };

  // ----------------------------
  // SET STATUS (DROPDOWN ACTION)
  // ----------------------------
  const setStatus = async (pcId: number, next: Status | null) => {
    if (!userId) {
      router.push("/login");
      return;
    }

    // DELETE when setting to null (Missing/unmarked)
    if (next === null) {
      const { error } = await supabase
        .from("user_pcs")
        .delete()
        .eq("user_id", userId)
        .eq("pc_id", pcId);

      if (error) console.error("Delete error:", error.message);

      setPcStatus((prev) => {
        const copy = { ...prev };
        delete copy[pcId];
        return copy;
      });

      return;
    }

    // UPDATE first
    const { data: updated, error: updateError } = await supabase
      .from("user_pcs")
      .update({ status: next })
      .eq("user_id", userId)
      .eq("pc_id", pcId)
      .select();

    if (updateError) console.error("Update error:", updateError);

    // INSERT fallback
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from("user_pcs").insert({
        user_id: userId,
        pc_id: pcId,
        status: next,
      });

      if (insertError) console.error("Insert error:", insertError);
    }

    setPcStatus((prev) => ({ ...prev, [pcId]: next }));
  };

  // ----------------------------
  // MOBILE: SINGLE TAP opens dropdown, DOUBLE TAP shows name
  // ----------------------------
  const handleCardTap = (pcId: number) => {
    const now = Date.now();
    const last = lastTapRef.current[pcId] || 0;

    // DOUBLE TAP: show name only
    if (now - last < 300) {
      // cancel pending single-tap action
      const t = singleTapTimerRef.current[pcId];
      if (t) clearTimeout(t);

      lastTapRef.current[pcId] = 0;

      setShowNameFor(pcId);
      setTimeout(() => {
        setShowNameFor((cur) => (cur === pcId ? null : cur));
      }, 1200);

      return;
    }

    // FIRST TAP: wait briefly to see if a second tap comes
    lastTapRef.current[pcId] = now;

    singleTapTimerRef.current[pcId] = setTimeout(() => {
      setStatusMenuFor((cur) => (cur === pcId ? null : pcId));
      lastTapRef.current[pcId] = 0;
    }, 300);
  };

  // ----------------------------
  // RESET FILTERS (BUTTON ON FILTER ROW)
  // ----------------------------
  const resetFilters = () => {
    setSelectedMembers([]);
    setSelectedEra("All");
    setSelectedType("All");
    setSelectedStatuses(["All"]);
    setSortMode("default");
    setStatusFilterOpen(false);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  // ----------------------------
  // PNG DOWNLOAD (SHRINKS ONLY DURING EXPORT)
  // ----------------------------
  const downloadPNG = async () => {
    setMenuOpen(false);
    setStatusFilterOpen(false);
    setStatusMenuFor(null);

    const node = exportRef.current;
    if (!node) return;

    // shrink UI only for capture
    setIsExporting(true);

    // let React apply shrink + close menus
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 120));

    // wait for images (but don’t block forever)
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    const waitForImg = (img: HTMLImageElement) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });

    await Promise.race([
      Promise.all(imgs.map(waitForImg)),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    try {
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        backgroundColor: "#F7F2EB",
        pixelRatio: 1, // keep stable
        skipFonts: true,
        imagePlaceholder:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
        fetchRequestInit: { mode: "cors", credentials: "omit" } as RequestInit,
      });

      const link = document.createElement("a");
      link.download = "alpha-drive-one-collection.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
      alert(
        "PNG export failed. With 500 cards, it may still be too large. Try filtering down or we can export in multiple parts."
      );
    } finally {
      // restore normal UI
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    const members = params.get("members");
    const era = params.get("era");
    const type = params.get("type");
    const status = params.get("status");
    const sort = params.get("sort");

    if (members) setSelectedMembers(members.split(",").filter(Boolean));
    if (era) setSelectedEra(era);
    if (type) setSelectedType(type);

    // status can be comma-separated for multi-select now
    if (status) {
      const list = status.split(",").filter(Boolean);
      setSelectedStatuses(list.length ? list : ["All"]);
    }

    if (sort === "status") setSortMode("status");
  }, []);

  // ----------------------------
  // FILTERING
  // ----------------------------
  const visiblePCsUnsorted = pcs.filter((pc) => {
    if (selectedMembers.length > 0 && !selectedMembers.includes(pc.member))
      return false;

    if (selectedEra !== "All" && pc.era !== selectedEra) return false;
    if (selectedType !== "All" && pc.type !== selectedType) return false;

    // Multi status filter
    if (!selectedStatuses.includes("All")) {
      const status = pcStatus[pc.id] ?? null;

      const wantsMissing = selectedStatuses.includes("Missing");
      const wantsPrio = selectedStatuses.includes("prio");
      const wantsOtw = selectedStatuses.includes("otw");
      const wantsOwned = selectedStatuses.includes("owned");

      const matchesMissing = wantsMissing && status === null;
      const matchesPrio = wantsPrio && status === "prio";
      const matchesOtw = wantsOtw && status === "otw";
      const matchesOwned = wantsOwned && status === "owned";

      if (!(matchesMissing || matchesPrio || matchesOtw || matchesOwned))
        return false;
    }

    return true;
  });

  // ----------------------------
  // SORTING (OPTIONAL)
  // Respects original order_sort by using the current order as tie-breaker.
  // ----------------------------
  const visiblePCs = (() => {
    if (sortMode === "default") return visiblePCsUnsorted;

    const originalIndex = new Map<number, number>();
    visiblePCsUnsorted.forEach((pc, idx) => originalIndex.set(pc.id, idx));

    const rank = (pcId: number) => {
      const s = pcStatus[pcId] ?? null;
      const key: Status | "Missing" = s === null ? "Missing" : s;
      const idx = STATUS_SORT_ORDER.indexOf(key);
      return idx === -1 ? 999 : idx;
    };

    return [...visiblePCsUnsorted].sort((a, b) => {
      const ra = rank(a.id);
      const rb = rank(b.id);
      if (ra !== rb) return ra - rb;
      // preserve original ordering within the same status group
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    });
  })();

  const activeFiltersLabel = (() => {
    const parts: string[] = [];

    if (selectedMembers.length > 0)
      parts.push(`Members: ${selectedMembers.join(", ")}`);
    if (selectedEra !== "All") parts.push(`Era: ${selectedEra}`);
    if (selectedType !== "All") parts.push(`Type: ${selectedType}`);
    if (!selectedStatuses.includes("All"))
      parts.push(`Status: ${selectedStatuses.join(", ")}`);
    if (sortMode === "status") parts.push(`Sort: Status`);

    if (parts.length === 0) return "No filters applied";
    return parts.join(" • ");
  })();

  const statusFilterLabel = (() => {
    if (selectedStatuses.includes("All")) return "All statuses";
    return selectedStatuses.join(", ");
  })();

  const toggleStatusFilterValue = (val: string) => {
    setSelectedStatuses((prev) => {
      // If clicking All -> set only All
      if (val === "All") return ["All"];

      // Remove All if present
      let next = prev.includes("All") ? [] : [...prev];

      if (next.includes(val)) {
        next = next.filter((x) => x !== val);
      } else {
        next.push(val);
      }

      // If nothing selected, fall back to All
      if (next.length === 0) return ["All"];

      return next;
    });
  };

  return (
    <main className="min-h-screen bg-[#F7F2EB] text-[#4A3F35] px-3 py-4">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between print:hidden">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-semibold">
            Alpha Drive One Collection Tracker
          </h1>
          <p className="text-sm opacity-70">Photocard tracker by Farewelleovv</p>
        </div>

        {/* Menu */}
        <div className="ml-2 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full bg-[#C8B6A6] px-4 py-2 text-sm font-medium text-[#4A3F35] shadow-sm hover:opacity-90"
          >
            Menu
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#EFE6DA] p-2 shadow-lg z-50">
              <div className="px-3 py-2 text-xs opacity-70">
                {userId ? (
                  <>
                    Signed in as
                    <div className="font-medium text-sm opacity-100">
                      {userEmail ?? "Unknown email"}
                    </div>
                  </>
                ) : (
                  <div className="font-medium text-sm opacity-100">
                    Not signed in
                  </div>
                )}
              </div>

              <div className="h-px bg-[#E3DACF] my-1" />

              <button
                onClick={downloadPNG}
                className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
              >
                Download current selection as PNG
              </button>

              <div className="h-px bg-[#E3DACF] my-1" />

              {userId ? (
                <button
                  onClick={handleLogout}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                >
                  Log out
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                >
                  Log in
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Print header */}
      <header className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold">
          Alpha Drive One Collection Tracker
        </h1>
        <p className="text-xs opacity-70">Printed view • {activeFiltersLabel}</p>
      </header>

      {/* Hint */}
      {showHint && (
        <div className="mb-4 rounded-xl bg-[#EFE6DA] p-3 text-sm print:hidden">
          <div className="flex items-start justify-between gap-3">
            <p className="leading-snug">
              Tip: On mobile <b>Tap</b> a card to change status. <b>Double tap</b>{" "}
              to see the PC name.
            </p>
            <button
              onClick={dismissHint}
              className="rounded-full bg-[#C8B6A6] px-3 py-1 text-xs font-medium hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Member selector */}
      <section className="mb-4 overflow-x-auto print:hidden">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMembers([])}
            className={`rounded-full px-4 py-2 text-sm ${
              selectedMembers.length === 0 ? "bg-[#C8B6A6]" : "bg-[#EFE6DA]"
            }`}
          >
            All
          </button>

          {MEMBERS.map((member) => {
            const active = selectedMembers.includes(member);
            return (
              <button
                key={member}
                onClick={() =>
                  setSelectedMembers((prev) =>
                    prev.includes(member)
                      ? prev.filter((m) => m !== member)
                      : [...prev, member]
                  )
                }
                className={`rounded-full px-4 py-2 text-sm ${
                  active ? "bg-[#C8B6A6]" : "bg-[#EFE6DA]"
                }`}
              >
                {member}
              </button>
            );
          })}
        </div>
      </section>

      {/* Filters row + Reset button */}
      <section className="mb-6 flex flex-col gap-2 print:hidden">
        <div className="flex gap-2 items-center">
          <select
            className="flex-1 rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
            value={selectedEra}
            onChange={(e) => setSelectedEra(e.target.value)}
          >
            <option value="All">All eras</option>
            <option value="Euphoria">Euphoria</option>
            <option value="b2p">Boys 2 Planet</option>
            <option value="Other">Other</option>
          </select>

          <select
            className="flex-1 rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="All">All types</option>
            <option value="Album">Album</option>
            <option value="POB">POB</option>
            <option value="Merch">Merch</option>
            <option value="Event">Event</option>
            <option value="Other">Other</option>
          </select>

          {/* Multi-status filter dropdown */}
          <div className="flex-1 relative" ref={statusFilterRef}>
            <button
              onClick={() => setStatusFilterOpen((v) => !v)}
              className="w-full rounded-md bg-[#EFE6DA] px-3 py-2 text-sm text-left"
            >
              {statusFilterLabel}
            </button>

            {statusFilterOpen && (
              <div className="absolute left-0 right-0 mt-2 rounded-xl bg-[#EFE6DA] shadow-lg z-50 p-2">
                <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes("All")}
                    onChange={() => toggleStatusFilterValue("All")}
                  />
                  All statuses
                </label>

                <div className="h-px bg-[#E3DACF] my-1" />

                <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes("Missing")}
                    onChange={() => toggleStatusFilterValue("Missing")}
                  />
                  Missing (unmarked)
                </label>

                <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes("prio")}
                    onChange={() => toggleStatusFilterValue("prio")}
                  />
                  Prio
                </label>

                <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes("otw")}
                    onChange={() => toggleStatusFilterValue("otw")}
                  />
                  OTW
                </label>

                <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes("owned")}
                    onChange={() => toggleStatusFilterValue("owned")}
                  />
                  Owned
                </label>

                <div className="h-px bg-[#E3DACF] my-1" />

                <button
                  onClick={() => setStatusFilterOpen(false)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] opacity-70"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Sort control */}
          <select
            className="flex-1 rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
            value={sortMode}
            onChange={(e) =>
              setSortMode(e.target.value as "default" | "status")
            }
          >
            <option value="default">Sort: Default</option>
            <option value="status">Sort: Status</option>
          </select>

          <button
            onClick={resetFilters}
            className="shrink-0 rounded-md bg-[#C8B6A6] px-3 py-2 text-sm font-medium shadow-sm hover:opacity-90"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Progress */}
      {(() => {
        const total = visiblePCs.length;
        if (total === 0) return null;

        const completed = visiblePCs.filter((pc) =>
          ["otw", "owned"].includes(pcStatus[pc.id])
        ).length;

        if (completed === 0) return null;

        const percent = Math.round((completed / total) * 100);

        return (
          <div className="mb-4 print:hidden">
            <div className="flex justify-end text-[11px] opacity-60 mb-1">
              {percent}%
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#E3DACF] overflow-hidden">
              <div
                className="h-full bg-[#B7A693]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Grid */}
      {loading ? (
        <p className="text-center text-sm opacity-60">Loading photocards…</p>
      ) : (
        <div ref={exportRef}>
          <section
            className={[
              "grid gap-2 print:grid-cols-10 print:gap-1",
              isExporting
                ? "grid-cols-8 md:grid-cols-12 gap-1" // ✅ smaller ONLY during export
                : "grid-cols-4 md:grid-cols-8",
            ].join(" ")}
          >
            {visiblePCs.map((pc) => {
              const status = pcStatus[pc.id];
              const showMobileName = showNameFor === pc.id;

              return (
                <div key={pc.id} className="relative">
                  <button
                    className={[
                      "group relative rounded-lg bg-[#EFE6DA] overflow-hidden print:rounded-md w-full",
                      isExporting ? "aspect-[2.8/4]" : "aspect-[2.8/4]", // keep aspect
                    ].join(" ")}
                    onClick={() => handleCardTap(pc.id)}
                  >
                    {pc.image_url ? (
                      <img
                        src={pc.image_url}
                        alt={pc.pc_name ?? pc.member}
                        className="h-full w-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs opacity-60">
                        {pc.member}
                      </div>
                    )}

                    {status !== "owned" && (
                      <div className="absolute inset-0 bg-black/30" />
                    )}

                    {status && (
                      <span
                        className={`absolute top-1 right-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                          status === "owned"
                            ? "bg-green-600"
                            : status === "otw"
                            ? "bg-blue-500"
                            : "bg-pink-500"
                        }`}
                      >
                        {status.toUpperCase()}
                      </span>
                    )}

                    {pc.pc_name && (
                      <div
                        className={[
                          "absolute bottom-0 w-full bg-black/60 px-1 py-0.5 text-[10px] text-white text-center",
                          "md:opacity-0 md:group-hover:opacity-100 md:transition-opacity",
                          showMobileName
                            ? "opacity-100"
                            : "opacity-0 md:opacity-0",
                        ].join(" ")}
                      >
                        {pc.pc_name}
                      </div>
                    )}
                  </button>

                  {statusMenuFor === pc.id && (
                    <div
                      ref={statusMenuRef}
                      className="absolute left-1/2 -translate-x-1/2 mt-2 w-44 rounded-xl bg-[#EFE6DA] shadow-lg z-50 p-2 print:hidden"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(pc.id, null);
                          setStatusMenuFor(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                      >
                        Missing (unmarked)
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(pc.id, "prio");
                          setStatusMenuFor(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                      >
                        Prio
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(pc.id, "otw");
                          setStatusMenuFor(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                      >
                        OTW
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(pc.id, "owned");
                          setStatusMenuFor(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF]"
                      >
                        Owned
                      </button>

                      <div className="h-px bg-[#E3DACF] my-1" />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuFor(null);
                        }}
                        className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-[#E3DACF] opacity-70"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}
    </main>
  );
}
