"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "monica.perezartavia@gmail.com";

type PendingPhotocard = {
  id: number;
  member: string;
  era: string | null;
  type: string | null;
  pc_name: string | null;
  sort_order: number | null;
  image_path: string | null;
  created_at: string;
};

export default function AdminPendingPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rows, setRows] = useState<PendingPhotocard[]>([]);
  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      setAuthLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setErrorMessage(userError.message);
        setAuthLoading(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const allowed =
        (user.email?.toLowerCase() || "") === ADMIN_EMAIL.toLowerCase();

      setIsAdmin(allowed);
      setAuthLoading(false);

      if (!allowed) return;

      await fetchPending();
    };

    init();
  }, [router]);

  useEffect(() => {
    if (!actionMessage && !errorMessage) return;

    const timer = setTimeout(() => {
      setActionMessage("");
      setErrorMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [actionMessage, errorMessage]);

  const fetchPending = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("pending_photocards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  };

  const handleApprove = async (row: PendingPhotocard) => {
    if (!row.image_path) {
      setErrorMessage("This pending row has no image_path.");
      return;
    }

    setProcessingId(row.id);
    setErrorMessage("");
    setActionMessage("");

    try {
      const imageUrl = supabase.storage
        .from("poca-images")
        .getPublicUrl(row.image_path).data.publicUrl;

      const { error: insertError } = await supabase.from("photocards").insert({
  member: row.member,
  era: row.era,
  type: row.type,
  pc_name: row.pc_name,
  sort_order: row.sort_order,
  image_path: row.image_path,
  image_url: imageUrl,
});

      if (insertError) {
        throw new Error(`Approve insert failed: ${insertError.message}`);
      }

      const { error: deleteError } = await supabase
        .from("pending_photocards")
        .delete()
        .eq("id", row.id);

      if (deleteError) {
        throw new Error(`Pending delete failed: ${deleteError.message}`);
      }

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setActionMessage(`Approved: ${row.pc_name || row.image_path}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (row: PendingPhotocard) => {
    setProcessingId(row.id);
    setErrorMessage("");
    setActionMessage("");

    try {
      const { error } = await supabase
        .from("pending_photocards")
        .delete()
        .eq("id", row.id);

      if (error) {
        throw new Error(`Reject failed: ${error.message}`);
      }

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setActionMessage(`Rejected: ${row.pc_name || row.image_path}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[#EFE6DA] p-6">
          <p>Checking admin access...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[#EFE6DA] p-6">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-gray-700">
            This page is only available to the admin account.
          </p>
        </div>

        {errorMessage ? (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800 shadow-lg">
            {errorMessage}
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl bg-[#EFE6DA] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Pending photocards</h1>
              <p className="mt-2 text-sm text-gray-700">
                Review uploads before approving them into the live table.
              </p>
            </div>

            <button
              onClick={fetchPending}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-6">Loading pending photocards...</p>
          ) : rows.length === 0 ? (
            <p className="mt-6 text-sm text-gray-700">
              No pending photocards yet.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 justify-items-center sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const imageUrl = row.image_path
                  ? supabase.storage
                      .from("poca-images")
                      .getPublicUrl(row.image_path).data.publicUrl
                  : "";

                const isProcessing = processingId === row.id;

                return (
                  <div
                    key={row.id}
                    style={{
                      width: "260px",
                      background: "white",
                      borderRadius: "16px",
                      padding: "16px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div
                      style={{
                        width: "220px",
                        margin: "0 auto",
                      }}
                    >
                      <div
                        style={{
                          width: "220px",
                          height: "293px",
                          overflow: "hidden",
                          borderRadius: "12px",
                          background: "#f5efe7",
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={row.pc_name || "Pending photocard"}
                            style={{
                              display: "block",
                              width: "220px",
                              height: "293px",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "220px",
                              height: "293px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#6b7280",
                              fontSize: "14px",
                            }}
                          >
                            No image
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "16px",
                          fontSize: "14px",
                          lineHeight: 1.5,
                        }}
                      >
                        <p>
                          <strong>Member:</strong> {row.member}
                        </p>
                        <p>
                          <strong>Era:</strong> {row.era || "—"}
                        </p>
                        <p>
                          <strong>Type:</strong> {row.type || "—"}
                        </p>
                        <p>
                          <strong>PC name:</strong> {row.pc_name || "—"}
                        </p>
                        <p
                          style={{
                            wordBreak: "break-word",
                            fontSize: "12px",
                            color: "#4b5563",
                            marginTop: "8px",
                          }}
                        >
                          <strong>Path:</strong> {row.image_path || "—"}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleApprove(row)}
                          disabled={isProcessing}
                          className="flex-1 rounded-xl bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {isProcessing ? "Working..." : "Approve"}
                        </button>

                        <button
                          onClick={() => handleReject(row)}
                          disabled={isProcessing}
                          className="flex-1 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                        >
                          {isProcessing ? "Working..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {errorMessage ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-red-100 px-4 py-3 text-sm text-red-800 shadow-lg">
          {errorMessage}
        </div>
      ) : actionMessage ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-green-100 px-4 py-3 text-sm text-green-800 shadow-lg">
          {actionMessage}
        </div>
      ) : null}
    </main>
  );
}
