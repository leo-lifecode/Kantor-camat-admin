"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Plus, Search, Briefcase, Pencil, ToggleLeft, X } from "lucide-react";

type Service = { id: string | number; code: string; name: string; description: string; duration: number; active: boolean };
const initialServices: Service[] = [
  { id: 1, code: "KTP", name: "Pembuatan KTP", description: "Pembuatan dan pembaruan Kartu Tanda Penduduk", duration: 15, active: true },
  { id: 2, code: "KK", name: "Kartu Keluarga", description: "Pembuatan dan perubahan Kartu Keluarga", duration: 20, active: true },
  { id: 3, code: "DOM", name: "Surat Domisili", description: "Surat keterangan domisili warga", duration: 10, active: true },
  { id: 4, code: "SKU", name: "Surat Keterangan Usaha", description: "Surat keterangan usaha warga", duration: 15, active: false },
];

const blankForm = { code: "", name: "", description: "", duration: 15 };

export default function ServicesPage() {
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [notice, setNotice] = useState("");

  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    getSupabaseBrowserClient().from("services").select("id,code,name,description,estimated_duration,is_active").order("name").then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setServices((data ?? []).map(row => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? "", duration: row.estimated_duration, active: row.is_active })));
    });
    return () => { active = false; };
  }, [databaseMode]);

  const filteredServices = useMemo(() => services.filter(service =>
    (service.name + " " + service.code + " " + service.description).toLowerCase().includes(search.toLowerCase())
  ), [services, search]);

  function openCreate() {
    setEditingId(null);
    setForm(blankForm);
    setNotice("");
    setShowForm(true);
  }

  function openEdit(service: Service) {
    setEditingId(service.id);
    setForm({ code: service.code, name: service.name, description: service.description, duration: service.duration });
    setNotice("");
    setShowForm(true);
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const description = form.description.trim();
    if (!code || !name || !description || form.duration < 1) return;
    if (services.some(service => service.code === code && service.id !== editingId)) {
      setNotice("Kode layanan sudah digunakan. Gunakan kode yang berbeda.");
      return;
    }
    if (databaseMode) {
      try {
        const supabase = getSupabaseBrowserClient();
        const payload = { code, name, description, estimated_duration: Number(form.duration) };
        const result = editingId !== null
          ? await supabase.from("services").update(payload).eq("id", String(editingId))
          : await supabase.from("services").insert({ ...payload, is_active: true });
        if (result.error) throw result.error;
        const { data, error } = await supabase.from("services").select("id,code,name,description,estimated_duration,is_active").order("name");
        if (error) throw error;
        setServices((data ?? []).map(row => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? "", duration: row.estimated_duration, active: row.is_active })));
        setNotice(editingId !== null ? "Layanan berhasil diperbarui di database." : "Layanan berhasil ditambahkan ke database.");
        setShowForm(false);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Gagal menyimpan layanan."); }
      return;
    }
    if (editingId !== null) {
      setServices(current => current.map(service => service.id === editingId ? { ...service, code, name, description, duration: Number(form.duration) } : service));
      setNotice("Layanan diperbarui pada data contoh.");
    } else {
      setServices(current => [...current, { id: Math.max(0, ...current.map(service => Number(service.id))) + 1, code, name, description, duration: Number(form.duration), active: true }]);
      setNotice("Layanan baru ditambahkan pada data contoh.");
    }
    setShowForm(false);
  }

  async function toggleService(id: string | number) {
    const service = services.find(item => item.id === id);
    if (!service) return;
    if (databaseMode) {
      const { error } = await getSupabaseBrowserClient().from("services").update({ is_active: !service.active }).eq("id", String(id));
      if (error) { setNotice(error.message); return; }
      setServices(current => current.map(item => item.id === id ? { ...item, active: !item.active } : item));
      setNotice("Status layanan berhasil diperbarui di database.");
      return;
    }
    setServices(current => current.map(item => item.id === id ? { ...item, active: !item.active } : item));
    setNotice("Status layanan diperbarui pada data contoh.");
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Layanan</h1><p className="mt-1 text-sm text-gray-500">Kelola jenis layanan dan estimasi durasi pelayanan.</p></div><button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><Plus size={18}/>Tambah Layanan</button></div>
    {notice && <p role="status" className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
    {showForm && <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900">{editingId===null?"Tambah Layanan":"Edit Layanan"}</h2><button onClick={()=>setShowForm(false)} aria-label="Tutup form" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18}/></button></div>
      <form onSubmit={saveService} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-gray-700">Kode Layanan<input required maxLength={10} value={form.code} onChange={e=>setForm(v=>({...v,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")}))} placeholder="Contoh: KTP" className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <label className="space-y-2 text-sm font-medium text-gray-700">Nama Layanan<input required maxLength={100} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Nama layanan" className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <label className="space-y-2 text-sm font-medium text-gray-700">Estimasi Durasi (menit)<input required type="number" min={1} max={480} value={form.duration} onChange={e=>setForm(v=>({...v,duration:Number(e.target.value)}))} className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <label className="space-y-2 text-sm font-medium text-gray-700 md:col-span-2">Deskripsi<textarea required maxLength={500} rows={3} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} placeholder="Jelaskan layanan" className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <div className="flex gap-3 md:col-span-2"><button type="submit" className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700">Simpan Layanan</button><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button></div>
      </form>
    </section>}
    <div className="relative max-w-lg"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, kode, atau deskripsi layanan..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div>
    <div className="grid gap-4 md:grid-cols-2">{filteredServices.map(service=><article key={service.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Briefcase size={21}/></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${service.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-600"}`}>{service.active?"Aktif":"Nonaktif"}</span></div><p className="mt-4 text-xs font-bold tracking-wider text-purple-600">{service.code}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{service.name}</h2><p className="mt-2 min-h-10 text-sm text-gray-500">{service.description}</p><div className="mt-4 flex items-center justify-between border-t pt-4"><p className="text-sm text-gray-600">Estimasi <strong>{service.duration} menit</strong></p><div className="flex gap-2"><button onClick={()=>openEdit(service)} aria-label={`Edit ${service.name}`} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50"><Pencil size={17}/></button><button onClick={()=>toggleService(service.id)} aria-label={service.active?"Nonaktifkan layanan":"Aktifkan layanan"} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50"><ToggleLeft size={17}/></button></div></div></article>)}
      {filteredServices.length===0 && <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 md:col-span-2">Tidak ada layanan yang cocok.</div>}
    </div>
    <p className="text-xs text-gray-400">{databaseMode ? "Terhubung ke Supabase. Perubahan layanan disimpan ke database." : "Mode demo: tambah, edit, dan status hanya disimpan di state halaman, bukan database."}</p>
  </div>;
}
