"use client";

import { useEffect, useState } from "react";
import { Search, Users, ShieldCheck, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type UserRow = { id: string | number; name: string; email: string; phone: string; role: string; status: string };
const initialUsers: UserRow[] = [
  { id: 1, name: "Admin Talawi", email: "admin@talawi.go.id", phone: "081234567890", role: "ADMIN", status: "Aktif" },
  { id: 2, name: "Ahmad Fauzi", email: "ahmad@example.com", phone: "081234567891", role: "WARGA", status: "Aktif" },
  { id: 3, name: "Siti Rahma", email: "siti@example.com", phone: "081234567892", role: "WARGA", status: "Aktif" },
  { id: 4, name: "Budi Santoso", email: "budi@example.com", phone: "081234567893", role: "WARGA", status: "Nonaktif" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [notice, setNotice] = useState("");
  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    getSupabaseBrowserClient().from("profiles").select("id,name,phone,role").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setUsers((data ?? []).map(row => ({ id: row.id, name: row.name, email: "Email tidak tersedia di tabel profil", phone: row.phone ?? "-", role: row.role, status: "Aktif" })));
    });
    return () => { active = false; };
  }, [databaseMode]);

  const filteredUsers = users.filter(user => (user.name + " " + user.email + " " + user.phone).toLowerCase().includes(search.toLowerCase()) && (role === "ALL" || user.role === role));
  const admins = users.filter(user => user.role === "ADMIN").length;
  const citizens = users.filter(user => user.role === "WARGA").length;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">Pengguna</h1><p className="mt-1 text-sm text-gray-500">Daftar akun admin dan warga yang terdaftar.</p></div>
    {notice && <p role="status" className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
    <div className="grid gap-4 sm:grid-cols-3"><Summary title="Total Pengguna" value={users.length} icon={<Users size={20}/>} /><Summary title="Admin" value={admins} icon={<ShieldCheck size={20}/>} /><Summary title="Warga" value={citizens} icon={<UserRound size={20}/>} /></div>
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, telepon, atau email..." className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div><select value={role} onChange={e=>setRole(e.target.value)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm"><option value="ALL">Semua Peran</option><option value="ADMIN">Admin</option><option value="WARGA">Warga</option></select></div>
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-4">Pengguna</th><th className="px-5 py-4">Telepon</th><th className="px-5 py-4">Peran</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y">{filteredUsers.map(user=><tr key={user.id} className="hover:bg-gray-50"><td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{user.name}</p><p className="mt-1 text-xs text-gray-500">{user.email}</p></td><td className="px-5 py-4 text-sm text-gray-600">{user.phone}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${user.role==="ADMIN"?"bg-purple-50 text-purple-700":"bg-blue-50 text-blue-700"}`}>{user.role}</span></td><td className="px-5 py-4 text-sm text-gray-600">{user.status}</td></tr>)}</tbody></table></div></div>
    <p className="text-xs text-gray-400">{databaseMode ? "Data berasal dari Supabase. Email tidak ditampilkan karena berada di Auth, bukan tabel profil." : "Data contoh. Pengelolaan akun produksi menggunakan Supabase Auth dan kebijakan RLS."}</p>
  </div>;
}

function Summary({title,value,icon}:{title:string;value:number;icon:React.ReactNode}) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-gray-500">{title}</p><span className="text-purple-600">{icon}</span></div><p className="mt-3 text-3xl font-bold text-gray-900">{value}</p></div>; }
