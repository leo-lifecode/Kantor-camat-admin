"use client";

import { useState } from "react";
import { Search, Users, ShieldCheck, UserRound } from "lucide-react";

const initialUsers = [
  { id: 1, name: "Admin Talawi", email: "admin@talawi.go.id", phone: "081234567890", role: "ADMIN", status: "Aktif" },
  { id: 2, name: "Ahmad Fauzi", email: "ahmad@example.com", phone: "081234567891", role: "WARGA", status: "Aktif" },
  { id: 3, name: "Siti Rahma", email: "siti@example.com", phone: "081234567892", role: "WARGA", status: "Aktif" },
  { id: 4, name: "Budi Santoso", email: "budi@example.com", phone: "081234567893", role: "WARGA", status: "Nonaktif" },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const users = initialUsers.filter(u=>(u.name+" "+u.email).toLowerCase().includes(search.toLowerCase())&&(role==="ALL"||u.role===role));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">Pengguna</h1><p className="mt-1 text-sm text-gray-500">Daftar akun admin dan warga yang terdaftar.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Summary title="Total Pengguna" value={initialUsers.length} icon={<Users size={20}/>} /><Summary title="Admin" value={initialUsers.filter(u=>u.role==="ADMIN").length} icon={<ShieldCheck size={20}/>} /><Summary title="Warga" value={initialUsers.filter(u=>u.role==="WARGA").length} icon={<UserRound size={20}/>} /></div>
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau email..." className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div><select value={role} onChange={e=>setRole(e.target.value)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm"><option value="ALL">Semua Peran</option><option value="ADMIN">Admin</option><option value="WARGA">Warga</option></select></div>
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-4">Pengguna</th><th className="px-5 py-4">Telepon</th><th className="px-5 py-4">Peran</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y">{users.map(u=><tr key={u.id} className="hover:bg-gray-50"><td className="px-5 py-4"><p className="text-sm font-semibold text-gray-900">{u.name}</p><p className="mt-1 text-xs text-gray-500">{u.email}</p></td><td className="px-5 py-4 text-sm text-gray-600">{u.phone}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${u.role==="ADMIN"?"bg-purple-50 text-purple-700":"bg-blue-50 text-blue-700"}`}>{u.role}</span></td><td className="px-5 py-4 text-sm text-gray-600">{u.status}</td></tr>)}</tbody></table></div></div>
    <p className="text-xs text-gray-400">Data contoh. Pengelolaan akun produksi harus menggunakan Supabase Auth dan kebijakan RLS.</p>
  </div>;
}

function Summary({title,value,icon}:{title:string;value:number;icon:React.ReactNode}) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-gray-500">{title}</p><span className="text-purple-600">{icon}</span></div><p className="mt-3 text-3xl font-bold text-gray-900">{value}</p></div>; }