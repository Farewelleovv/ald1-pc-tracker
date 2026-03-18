"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Status = "prio" | "otw" | "owned";

type Photocard = {
  id: number;
  member: string;
  era: string | null;
  type: string | null;
};

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

export default function StatsPage() {
  const router = useRouter();

  const [pcs, setPcs] = useState<Photocard[]>([]);
  const [pcStatus, setPcStatus] = useState<Record<number, Status>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  const [loading, setLoading] = useState(true);

  // session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUserId(user?.id ?? null);
    });
  }, []);

  // fetch photocards
  useEffect(() => {
    const fetchPCs = async () => {
      const { data } = await supabase
        .from("photocards")
        .select("*");

      if (data) setPcs(data);

      setLoading(false);
    };

    fetchPCs();
  }, []);

  // fetch statuses
  useEffect(() => {
    if (!userId) return;

    const fetchStatuses = async () => {
      const { data } = await supabase
        .from("user_pcs")
        .select("pc_id, status")
        .eq("user_id", userId);

      if (!data) return;

      const map: Record<number, Status> = {};

      data.forEach((row) => {
        map[row.pc_id] = row.status;
      });

      setPcStatus(map);
    };

    fetchStatuses();
  }, [userId]);

  // FILTERED PCS
  const filtered = pcs.filter((pc) => {
    if (selectedMembers.length > 0 && !selectedMembers.includes(pc.member))
      return false;

    if (selectedEra !== "All" && pc.era !== selectedEra)
      return false;

    if (selectedType !== "All" && pc.type !== selectedType)
      return false;

    return true;
  });

  // STATS (affected by filters)
  const stats = {
    total: filtered.length,
    owned: filtered.filter((pc) => pcStatus[pc.id] === "owned").length,
    otw: filtered.filter((pc) => pcStatus[pc.id] === "otw").length,
    prio: filtered.filter((pc) => pcStatus[pc.id] === "prio").length,
    missing: filtered.filter((pc) => !pcStatus[pc.id]).length,
  };

  const completion =
    stats.total === 0
      ? 0
      : Math.round(((stats.owned + stats.otw) / stats.total) * 100);

  // MEMBER STATS (NOT affected by filters)
  const memberStats = MEMBERS.map((member) => {
    const memberPCs = pcs.filter((pc) => pc.member === member);

    const owned = memberPCs.filter(
      (pc) =>
        pcStatus[pc.id] === "owned" ||
        pcStatus[pc.id] === "otw"
    ).length;

    const total = memberPCs.length;

    const percent =
      total === 0 ? 0 : Math.round((owned / total) * 100);

    return {
      member,
      owned,
      total,
      percent,
    };
  });

  // circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (completion / 100) * circumference;

  return (
    <main className="min-h-screen bg-[#F7F2EB] text-[#4A3F35] px-4 py-6">

      {/* navigation */}
      <button
        onClick={() => router.push("/")}
        className="mb-4 rounded-lg bg-[#EFE6DA] px-3 py-2 text-sm hover:bg-[#E3DACF]"
      >
        Main Page
      </button>

      <h1 className="text-2xl font-semibold mb-6">
        Collection Stats
      </h1>


      {/* FILTERS */}
      <section className="mb-6 flex flex-col gap-3">

        {/* members */}
        <div className="flex flex-wrap gap-2">

          <button
            onClick={() => setSelectedMembers([])}
            className={`rounded-full px-3 py-1 text-sm ${
              selectedMembers.length === 0
                ? "bg-[#C8B6A6]"
                : "bg-[#EFE6DA]"
            }`}
          >
            All Members
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
                className={`rounded-full px-3 py-1 text-sm ${
                  active
                    ? "bg-[#C8B6A6]"
                    : "bg-[#EFE6DA]"
                }`}
              >
                {member}
              </button>
            );
          })}

        </div>

        {/* era + type */}
        <div className="grid grid-cols-2 gap-2">

          <select
            value={selectedEra}
            onChange={(e) => setSelectedEra(e.target.value)}
            className="rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
          >
            <option value="All">All eras</option>
            <option value="Euphoria">Euphoria</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-md bg-[#EFE6DA] px-3 py-2 text-sm"
          >
            <option value="All">All types</option>
            <option value="Album">Album</option>
            <option value="POB">POB</option>
            <option value="Merch">Merch</option>
            <option value="Event">Event</option>
            <option value="Other">Other</option>
          </select>

        </div>

      </section>

      {/* STAT CARDS */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">Total</p>
            <p className="text-xl font-semibold">{stats.total}</p>
          </div>

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">Owned</p>
            <p className="text-xl font-semibold">{stats.owned}</p>
          </div>

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">OTW</p>
            <p className="text-xl font-semibold">{stats.otw}</p>
          </div>

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">Prio</p>
            <p className="text-xl font-semibold">{stats.prio}</p>
          </div>

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">Missing</p>
            <p className="text-xl font-semibold">{stats.missing}</p>
          </div>

          <div className="bg-[#EFE6DA] rounded-xl p-4">
            <p className="text-sm opacity-70">Completion</p>
            <p className="text-xl font-semibold">{completion}%</p>
          </div>

        </div>
      )}

      {/* MEMBER COMPLETION */}
      <h2 className="text-lg font-semibold mb-1">
        Completion by Member
      </h2>

      <p className="text-xs opacity-60 mb-3">
        Based on your full collection
      </p>

      <div className="flex flex-col gap-3">

        {memberStats.map((m) => (
          <div
            key={m.member}
            className="bg-[#EFE6DA] rounded-xl p-3"
          >

            <div className="flex justify-between text-sm mb-1">
              <span>{m.member}</span>
              <span>
                {m.owned}/{m.total} ({m.percent}%)
              </span>
            </div>

            <div className="h-2 bg-[#DDD2C5] rounded-full overflow-hidden">

              <div
                className="h-full bg-[#C8B6A6]"
                style={{
                  width: `${m.percent}%`,
                }}
              />

            </div>

          </div>
        ))}

      </div>

    </main>
  );
}
