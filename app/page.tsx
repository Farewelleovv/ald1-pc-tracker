"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [pcs, setPcs] = useState<Photocard[]>([]);
  const [pcStatus, setPcStatus] = useState<Record<number, Status>>({});
  const [loading, setLoading] = useState(true);

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Mobile: double-tap show PC name
  const [showNameFor, setShowNameFor] = useState<number | null>(null);
  const lastTapRef = useRef<Record<number, number>>({});
  const singleTapTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );

  // Hint banner (once per device)
  const [showHint, setShowHint] = useState(false);

  // ----------------------------
  // AUTH SESSION
  // ----------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
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
        .order("order", { ascending: true });

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
    router.push("/login");
  };

  const handleLogin = () => {
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
  // MOBILE: SINGLE TAP cycles, DOUBLE TAP shows name
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
      cycleStatus(pcId);
      lastTapRef.current[pcId] = 0;
    }, 300);
  };

  // ----------------------------
  // FILTERING
  // ----------------------------
  const visiblePCs = pcs.filter((pc) => {
    if (selectedMembers.length > 0 && !selectedMembers.includes(pc.member))
      return false;

    if (selectedEra !== "All" && pc.era !== selectedEra) return false;
    if (selectedType !== "All" && pc.type !== selectedType) return false;

    return true;
  });

  return (
    <main className="min-h-screen bg-[#F7F2EB] text-[#4A3F35] px-3 py-4">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-semibold">Alpha Drive One Collection Tracker</h1>
          <p className="text-sm opacity-70">Photocard tracker by Farewelleovv</p>
        </div>

        <div className="ml-2">
          {userId ? (
            <button
              onClick={handleLogout}
              className="rounded-full bg-[#C8B6A6] px-4 py-2 text-sm font-medium text-[#4A3F35] shadow-sm hover:opacity-90"
            >
              Log out
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="rounded-full bg-[#C8B6A6] px-4 py-2 text-sm font-medium text-[#4A3F35] shadow-sm hover:opacity-90"
            >
              Log in
            </button>
          )}
        </div>
      </header>

      {/* Hint */}
      {showHint && (
        <div className="mb-4 rounded-xl bg-[#EFE6DA] p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="leading-snug">
              Tip: <b>Tap</b> a card to change status. <b>Double tap</b> to see the
              PC name.
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
      <section className="mb-4 overflow-x-auto">
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

      {/* Filters */}
      <section className="mb-6 flex gap-2">
        <select
          className="w-1/2 rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
          value={selectedEra}
          onChange={(e) => setSelectedEra(e.target.value)}
        >
          <option value="All">All eras</option>
          <option value="Euphoria">Euphoria</option>
          <option value="b2p">Boys 2 Planet</option>
          <option value="Otro">Otros</option>
        </select>

        <select
          className="w-1/2 rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="All">All types</option>
          <option value="Album">Album</option>
          <option value="POB">POB</option>
          <option value="Merch">Merch</option>
          <option value="Other">Other</option>
        </select>
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
          <div className="mb-4">
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
        <section className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {visiblePCs.map((pc) => {
            const status = pcStatus[pc.id];
            const showMobileName = showNameFor === pc.id;

            return (
              <button
                key={pc.id}
                className="group relative aspect-[2.8/4] rounded-lg bg-[#EFE6DA] overflow-hidden"
                onClick={() => handleCardTap(pc.id)}
              >
                {pc.image_url ? (
                  <img
                    src={pc.image_url}
                    alt={pc.pc_name ?? pc.member}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs opacity-60">
                    {pc.member}
                  </div>
                )}

                {/* Tint for null / prio / otw (disappears once owned) */}
                {status !== "owned" && (
                  <div className="absolute inset-0 bg-brown/35" />
                )}

                {/* Status badge */}
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

                {/* PC name: Desktop hover + Mobile double-tap */}
                {pc.pc_name && (
                  <div
                    className={[
                      "absolute bottom-0 w-full bg-black/60 px-1 py-0.5 text-[10px] text-white text-center",
                      "md:opacity-0 md:group-hover:opacity-100 md:transition-opacity",
                      showMobileName ? "opacity-100" : "opacity-0 md:opacity-0",
                    ].join(" ")}
                  >
                    {pc.pc_name}
                  </div>
                )}
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}
