"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !data.user) throw new Error(authError?.message || "Login gagal.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role,name").eq("id", data.user.id).single();
      if (profileError || profile?.role !== "ADMIN") {
        await supabase.auth.signOut();
        throw new Error("Akun ini tidak memiliki akses administrator.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat login.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10"><div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white"><ShieldCheck size={28}/></div><div className="mt-5 text-center"><h1 className="text-2xl font-bold text-gray-900">Login Admin</h1><p className="mt-2 text-sm text-gray-500">Sistem Antrian Digital Kantor Camat Talawi</p></div><form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="text-sm font-medium text-gray-700">Email</span><span className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 px-4"><Mail size={18} className="text-gray-400"/><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@kantor.go.id" className="w-full py-3 text-sm outline-none"/></span></label><label className="block"><span className="text-sm font-medium text-gray-700">Kata Sandi</span><span className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 px-4"><LockKeyhole size={18} className="text-gray-400"/><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan kata sandi" className="w-full py-3 text-sm outline-none"/></span></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60">{loading?"Memeriksa akun...":"Masuk ke Dashboard"}</button></form><p className="mt-6 text-center text-xs leading-5 text-gray-400">Akses hanya untuk akun dengan role ADMIN di tabel profiles.</p><p className="mt-3 text-center text-sm"><Link href="/" className="text-purple-700 hover:underline">Kembali ke halaman utama</Link></p></div></main>;
}
