"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const signInWithPassword = async () => {
    if (!email || !password) {
      alert("Please enter email + password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/");
  };

  const signUpWithPassword = async () => {
    if (!email || !password) {
      alert("Please enter email + password.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created! If email confirmation is enabled, check your email.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F2EB]">
      <div className="w-full max-w-sm rounded-xl bg-[#EFE6DA] p-6 text-center">
        <h1 className="mb-4 text-lg font-semibold">Sign in to your PC Tracker</h1>

        {/* Google */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full rounded-md bg-[#C8B6A6] px-4 py-2 text-sm mb-4"
        >
          Continue with Google
        </button>

        <div className="mb-4 text-xs opacity-60">or</div>

        {/* Email/Password */}
        <div className="flex flex-col gap-2 text-left">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-md bg-[#F7F2EB] px-3 py-2 text-sm"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-md bg-[#F7F2EB] px-3 py-2 text-sm"
          />

          <button
            onClick={signInWithPassword}
            disabled={loading}
            className="w-full rounded-md bg-[#C8B6A6] px-4 py-2 text-sm mt-2"
          >
            Sign in
          </button>

          <button
            onClick={signUpWithPassword}
            disabled={loading}
            className="w-full rounded-md bg-[#E3DACF] px-4 py-2 text-sm"
          >
            Create account
          </button>
        </div>
      </div>
    </main>
  );
}
