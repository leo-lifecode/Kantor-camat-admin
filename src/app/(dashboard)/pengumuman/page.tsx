"use client";

import { useState } from "react";
import { Megaphone, Plus, Search, Eye, EyeOff } from "lucide-react";

const initialItems = [
  { id: 1, title: "Perubahan Jam Pelayanan", category: "Informasi", date: "13 Okt 2026", content: "Pelayanan masyarakat berlangsung pukul 08.00–15.00 WIB.", active: true },
  { id: 2, title: "Persyaratan Administrasi Kependudukan", category: "Layanan", date: "10 Okt 2026", content: "Pastikan dokumen persyaratan dibawa lengkap saat datang.", active: true },
  { id: 3, title: "Pemeliharaan Sistem", category: "Pemberitahuan", date: "05 Okt 2026", content: "Sistem antrian dapat mengalami gangguan singkat saat pemeliharaan.", active: false },
];

export default function AnnouncementsPage() {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Pengumuman</h1><p className="mt-1 text-sm text-gray-500">Publikasikan informasi resmi untuk warga.</p></div><button onClick={()=>alert("Form pengumuman perlu dihubungkan ke backend.")} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><Plus size={18}/>Buat Pengumuman</button></div>
    <div className="relative max-w-lg"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul pengumuman..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div>
    <div className="space-y-4">{items.filter(x=>x.title.toLowerCase().includes(search.toLowerCase())).map(item=><article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Megaphone size={21}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{item.category}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-600"}`}>{item.active?"Dipublikasikan":"Disembunyikan"}</span></div><h2 className="mt-3 font-semibold text-gray-900">{item.title}</h2><p className="mt-1 text-sm leading-6 text-gray-600">{item.content}</p><p className="mt-3 text-xs text-gray-400">{item.date}</p></div><button onClick={()=>setItems(prev=>prev.map(x=>x.id===item.id?{...x,active:!x.active}:x))} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50" aria-label="Ubah publikasi">{item.active?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></article>)}</div>
    <p className="text-xs text-gray-400">Data contoh. Status publikasi hanya berubah di tampilan dan belum tersimpan di database.</p>
  </div>;
}