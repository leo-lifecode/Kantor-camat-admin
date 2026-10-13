"use client";

import { useState } from "react";
import { Plus, Search, BriefcaseBusiness, Pencil, ToggleLeft } from "lucide-react";

const initialServices = [
  { id: 1, code: "KTP", name: "Pembuatan KTP", description: "Pembuatan dan pembaruan Kartu Tanda Penduduk", duration: 15, active: true },
  { id: 2, code: "KK", name: "Kartu Keluarga", description: "Pembuatan dan perubahan Kartu Keluarga", duration: 20, active: true },
  { id: 3, code: "DOM", name: "Surat Domisili", description: "Surat keterangan domisili warga", duration: 10, active: true },
  { id: 4, code: "SKU", name: "Surat Keterangan Usaha", description: "Surat keterangan usaha warga", duration: 15, active: false },
];

export default function ServicesPage() {
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState("");
  const toggle = (id: number) => setServices(items => items.map(item => item.id === id ? { ...item, active: !item.active } : item));
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Layanan</h1><p className="mt-1 text-sm text-gray-500">Kelola jenis layanan dan estimasi durasi pelayanan.</p></div><button onClick={() => alert("Form tambah layanan perlu dihubungkan ke backend.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><Plus size={18}/>Tambah Layanan</button></div>
    <div className="relative max-w-lg"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau kode layanan..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div>
    <div className="grid gap-4 md:grid-cols-2">{services.filter(s => (s.name+" "+s.code).toLowerCase().includes(search.toLowerCase())).map(service=><article key={service.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><BriefcaseBusiness size={21}/></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${service.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-600"}`}>{service.active?"Aktif":"Nonaktif"}</span></div><p className="mt-4 text-xs font-bold tracking-wider text-purple-600">{service.code}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{service.name}</h2><p className="mt-2 min-h-10 text-sm text-gray-500">{service.description}</p><div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-sm text-gray-600">Estimasi <strong>{service.duration} menit</strong></p><div className="flex gap-2"><button onClick={()=>alert("Form edit layanan perlu dihubungkan ke backend.")} aria-label="Edit layanan" className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50"><Pencil size={17}/></button><button onClick={()=>toggle(service.id)} aria-label="Ubah status layanan" className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50"><ToggleLeft size={17}/></button></div></div></article>)}</div>
    <p className="text-xs text-gray-400">Data contoh untuk tampilan. Perubahan belum disimpan ke database.</p>
  </div>;
}