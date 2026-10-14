"use client";

import { useEffect, useState } from "react";
import { UserRound, Mail, Phone, ShieldCheck, Save, LockKeyhole } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function ProfilePage() {
  const [name, setName] = useState("Admin Talawi");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) { if (active) setNotice(userError?.message ?? "Sesi login tidak ditemukan."); return; }
      const { data, error } = await supabase.from("profiles").select("name,phone").eq("id", userData.user.id).maybeSingle();
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setName(data?.name ?? "");
      setPhone(data?.phone ?? "");
      setEmail(userData.user.email ?? "");
    }
    void loadProfile();
    return () => { active = false; };
  }, [databaseMode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    if (!databaseMode) {
      setNotice("Mode demo: perubahan hanya berada di form. Isi environment Supabase untuk menyimpan profil.");
      setBusy(false);
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Sesi login tidak ditemukan.");
      const { error: profileError } = await supabase.from("profiles").update({ name: name.trim(), phone: phone.trim() || null }).eq("id", userData.user.id);
      if (profileError) throw profileError;
      if (email.trim() && email.trim() !== userData.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        setNotice("Profil tersimpan. Perubahan email mungkin memerlukan konfirmasi melalui email.");
      } else {
        setNotice("Profil berhasil disimpan.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal menyimpan profil.");
    } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Profil Admin</h1><p className="mt-1 text-sm text-gray-500">Informasi akun administrator.</p></div>
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-4 border-b pb-6"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"><UserRound size={30}/></div><div><h2 className="font-semibold text-gray-900">{name}</h2><p className="mt-1 text-sm text-gray-500">Administrator Sistem Antrian</p><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"><ShieldCheck size={13}/>ADMIN</span></div></div>
    <form onSubmit={submit} className="space-y-5 pt-6"><Field label="Nama Lengkap" icon={<UserRound size={17}/>} value={name} onChange={setName}/><Field label="Email" icon={<Mail size={17}/>} value={email} onChange={setEmail} type="email"/><Field label="Nomor Telepon" icon={<Phone size={17}/>} value={phone} onChange={setPhone}/><div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"><LockKeyhole size={17} className="mr-2 inline"/>{databaseMode ? "Perubahan profil disimpan ke Supabase. Perubahan email dapat meminta verifikasi." : "Mode demo: isi environment Supabase untuk menyimpan perubahan."}</div>{notice&&<p role="status" className="text-sm text-purple-700">{notice}</p>}<button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"><Save size={17}/>{busy ? "Menyimpan..." : "Simpan Perubahan"}</button></form></section></div>;
}
function Field({label,icon,value,onChange,type="text"}:{label:string;icon:React.ReactNode;value:string;onChange:(v:string)=>void;type?:string}) { return <label className="block space-y-2"><span className="text-sm font-medium text-gray-700">{label}</span><span className="flex items-center gap-3 rounded-xl border border-gray-200 px-4"><span className="text-gray-400">{icon}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full py-3 text-sm outline-none"/></span></label>; }
