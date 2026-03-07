"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";

const ADMIN_EMAIL = "monica.perezartavia@gmail.com";

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

type UploadState = {
  member: string;
  era: string;
  type: string;
  pc_name: string;
};

export default function AdminUploadPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<UploadState>({
    member: "",
    era: "",
    type: "",
    pc_name: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const previewPath = useMemo(() => {
    if (!file || !form.member) return "";

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeMember = slugify(form.member || "unknown");
    const safeEra = slugify(form.era || "unknown");
    const safeType = slugify(form.type || "unknown");
    const safePcName = slugify(form.pc_name || "pc");
    const random = "abc12"; // preview only

    return `${safeMember}/${safeEra}/${safeType}/${safePcName}-${random}.${ext}`;
  }, [file, form]);

  useEffect(() => {
    const checkUser = async () => {
      setAuthLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setErrorMessage(error.message);
        setAuthLoading(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const email = user.email?.toLowerCase() || "";
      const allowed = email === ADMIN_EMAIL.toLowerCase();

      setIsAdmin(allowed);
      setAuthLoading(false);
    };

    checkUser();
  }, [router]);

  const handleChange = (
    field: keyof UploadState,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFile(null);
    setForm({
      member: "",
      era: "",
      type: "",
      pc_name: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!isAdmin) {
      setErrorMessage("You are not allowed to upload photocards.");
      return;
    }

    if (!file) {
      setErrorMessage("Please select an image.");
      return;
    }

    if (!form.member.trim()) {
      setErrorMessage("Member is required.");
      return;
    }

    setSubmitting(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeMember = slugify(form.member || "unknown");
      const safeEra = slugify(form.era || "unknown");
      const safeType = slugify(form.type || "unknown");
      const safePcName = slugify(form.pc_name || "pc");
      const random = crypto.randomUUID().slice(0, 5);

      const fileName = `${safePcName}-${random}.${ext}`;
      const filePath = `${safeMember}/${safeEra}/${safeType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("pc-images")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { error: insertError } = await supabase
        .from("pending_photocards")
        .insert({
          member: form.member,
          era: form.era.trim() || null,
          type: form.type.trim() || null,
          pc_name: form.pc_name.trim() || null,
          image_path: filePath,
        });

      if (insertError) {
        throw new Error(`Pending insert failed: ${insertError.message}`);
      }

      setMessage(`Uploaded to pending review: ${filePath}`);
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl bg-[#EFE6DA] p-6">
          <p>Checking admin access...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl bg-[#EFE6DA] p-6">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-gray-700">
            This page is only available to the admin account.
          </p>
          {errorMessage ? (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-[#EFE6DA] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Admin photocard upload</h1>
        <p className="mt-2 text-sm text-gray-700">
          New uploads go into <span className="font-medium">pending_photocards</span>,
          not the live table.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">Image file</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Member *</label>
            <select
              value={form.member}
              onChange={(e) => handleChange("member", e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="">Select member</option>
              {MEMBERS.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Era</label>
            <input
              type="text"
              value={form.era}
              onChange={(e) => handleChange("era", e.target.value)}
              placeholder="e.g. Fansign"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Type</label>
            <input
              type="text"
              value={form.type}
              onChange={(e) => handleChange("type", e.target.value)}
              placeholder="e.g. Lucky Draw"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">PC name</label>
            <input
              type="text"
              value={form.pc_name}
              onChange={(e) => handleChange("pc_name", e.target.value)}
              placeholder="e.g. LD 1"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl bg-white/70 p-4 text-sm">
            <p className="font-medium">Preview path</p>
            <p className="mt-1 break-all text-gray-700">
              {previewPath || "Select a file and member to preview the path."}
            </p>
          </div>

          {message ? (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Uploading..." : "Upload to pending"}
          </button>
        </form>
      </div>
    </main>
  );
}