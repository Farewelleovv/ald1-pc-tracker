"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/");
    });
  }, [router]);

  const signInWithGoogle = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F2EB]">
      <div className="rounded-xl bg-[#EFE6DA] p-6 text-center">
        <h1 className="mb-4 text-lg font-semibold">
          Sign in to your PC Tracker
        </h1>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="rounded-md bg-[#C8B6A6] px-4 py-2 text-sm"
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}