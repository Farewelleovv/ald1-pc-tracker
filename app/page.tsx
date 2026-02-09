"use client";

import { useEffect, useState } from "react";
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
  const [userId, setUserId] = useState<string | null>(null);

  const [pcs, setPcs] = useState<Photocard[]>([]);
  const [pcStatus, setPcStatus] = useState<Record<number, Status>>({});
  const [loading, setLoading] = useState(true);

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // ----------------------------
  // FETCH AUTH + DATA
  // ----------------------------
  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      const { data: pcsData, error: pcsError } = await supabase
        .from("photocards")
        .select("*")
        .order("order", { ascending: true });

      if (pcsError) console.error(pcsError);
      if (pcsData) setPcs(pcsData);

      const { data: statusData, error: statusError } = await supabase
        .from("user_pcs")
        .select("pc_id, status")
        .eq("user_id", uid);

      if (statusError) console.error(statusError);

      if (statusData) {
        const map: Record<number, Status> = {};
        statusData.forEach((row) => {
          map[row.pc_id] = row.status as Status;
        });
        setPcStatus(map);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // ----------------------------
  // STATUS CYCLING
  // ----------------------------
  const cycleStatus = async (pcId: number) => {
    if (!userId) return;

    const current = pcStatus[pcId] ?? null;
    const next =
      STATUS_ORDER[
        (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length
      ];

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

    if (updateError) console.error(updateError);

    // INSERT fallback
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from("user_pcs").insert({
        user_id: userId,
        pc_id: pcId,
        status: next,
      });

      if (insertError) console.error(insertError);
    }

    setPcStatus((prev) => ({
      ...prev,
      [pcId]: next,
    }));
  };

  // ----------------------------
  // FILTERING
  // ----------------------------
  const visiblePCs = pcs.filter((pc) => {
    if (
      selectedMembers.length > 0 &&
      !selectedMembers.includes(pc.member)
    )
      return false;

    if (selectedEra !== "All" && pc.era !== selectedEra) return false;
    if (selectedType !== "All" && pc.type !== selectedType) return false;

    return true;
  });

  return (
    <main className="min-h-screen bg-[#F7F2EB] text-[#4A3F35] px-3 py-4">
      {/* Header */}
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">
          Alpha Drive One PC Tracker
        </h1>
        <p className="text-sm opacity-70">
          Track your photocard collection
        </p>
      </header>

      {/* Member selector */}
      <section className="mb-4 overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMembers([])}
            className={`rounded-full px-4 py-2 text-sm ${
              selectedMembers.length === 0
                ? "bg-[#C8B6A6]"
                : "bg-[#EFE6DA]"
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
        <p className="text-center text-sm opacity-60">
          Loading photocards…
        </p>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-8 gap-2">
          {visiblePCs.map((pc) => {
            const status = pcStatus[pc.id];

            return (
              <button
                key={pc.id}
                onClick={() => cycleStatus(pc.id)}
                className="relative aspect-[2.8/4] rounded-lg bg-[#EFE6DA] overflow-hidden"
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

                {/* Tint for null / prio / otw */}
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

                {/* PC name (hover / tap-safe) */}
                {pc.pc_name && (
                  <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
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
