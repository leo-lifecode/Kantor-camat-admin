"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Megaphone, Plus, Search, Eye, EyeOff, X } from "lucide-react";

type Announcement = { id: string | number; title: string; category: string; date: string; content: string; active: boolean };
const initialItems: Announcement[] = [
  { id: 1, title: "Perubahan Jam Pelayanan", category: "Informasi", date: "13 Okt 2026", content: "Pelayanan masyarakat berlangsung pukul 08.00–15.00 WIB.", active: true },
  { id: 2, title: "Persyaratan Administrasi Kependudukan", category: "Layanan", date: "10 Okt 2026", content: "Pastikan dokumen persyaratan dibawa lengkap saat datang.", active: true },
  { id: 3, title: "Pemeliharaan Sistem", category: "Pemberitahuan", date: "05 Okt 2026", content: "Sistem antrian dapat mengalami gangguan singkat saat pemeliharaan.", active: false },
];

export default function AnnouncementsPage() {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Informasi");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");
  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    getSupabaseBrowserClient().from("announcements").select("id,title,category,content,is_active,published_at").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setItems((data ?? []).map(row => ({ id: row.id, title: row.title, category: row.category ?? "Informasi", date: row.published_at ? new Date(row.published_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-", content: row.content, active: row.is_active })));
    });
    return () => { active = false; };
  }, [databaseMode]);

  const filteredItems = useMemo(() => items.filter(item =>
    (item.title + " " + item.content).toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  async function addAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent) return;
    if (databaseMode) {
      const { error } = await getSupabaseBrowserClient().from("announcements").insert({ title: cleanTitle, category, content: cleanContent, is_active: true, published_at: new Date().toISOString() });
      if (error) { setNotice(error.message); return; }
      const { data, error: loadError } = await getSupabaseBrowserClient().from("announcements").select("id,title,category,content,is_active,published_at").order("created_at", { ascending: false });
      if (loadError) { setNotice(loadError.message); return; }
      setItems((data ?? []).map(row => ({ id: row.id, title: row.title, category: row.category ?? "Informasi", date: row.published_at ? new Date(row.published_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-", content: row.content, active: row.is_active })));
    } else {
      setItems(current => [{ id: Math.max(0, ...current.map(item => Number(item.id))) + 1, title: cleanTitle, category, date: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }), content: cleanContent, active: true }, ...current]);
    }
    setTitle("");
    setContent("");
    setCategory("Informasi");
    setShowForm(false);
    setNotice("Pengumuman ditambahkan ke data contoh dan langsung berstatus dipublikasikan.");
  }

  function togglePublished(id: number) {
    setItems(current => current.map(item => item.id === id ? { ...item, active: !item.active } : item));
    setNotice("{databaseMode ? "Pengumuman terhubung ke Supabase." : "Mode demo: publikasi hanya tersimpan di state halaman."}");
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-bold text-gray-900">Pengumuman</h1><p className="mt-1 text-sm text-gray-500">Publikasikan informasi resmi untuk warga.</p></div>
      <button onClick={() => { setShowForm(true); setNotice(""); }} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><Plus size={18}/>Buat Pengumuman</button>
    </div>
    {notice && <p role="status" className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
    {showForm && <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900">Pengumuman Baru</h2><button onClick={() => setShowForm(false)} aria-label="Tutup form" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18}/></button></div>
      <form onSubmit={addAnnouncement} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-gray-700">Judul<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul pengumuman" className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <label className="space-y-2 text-sm font-medium text-gray-700">Kategori<select value={category} onChange={e=>setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal"><option>Informasi</option><option>Layanan</option><option>Pemberitahuan</option><option>Darurat</option></select></label>
        <label className="space-y-2 text-sm font-medium text-gray-700 md:col-span-2">Isi pengumuman<textarea required maxLength={2000} value={content} onChange={e=>setContent(e.target.value)} rows={4} placeholder="Tulis informasi untuk warga..." className="w-full rounded-xl border border-gray-200 px-3 py-3 font-normal outline-none focus:border-purple-500"/></label>
        <div className="flex gap-3 md:col-span-2"><button type="submit" className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700">Publikasikan</button><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button></div>
      </form>
    </section>}
    <div className="relative max-w-lg"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul atau isi pengumuman..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500"/></div>
    <div className="space-y-4">{filteredItems.map(item=><article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Megaphone size={21}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{item.category}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.active?"bg-green-50 text-green-700":"bg-gray-100 text-gray-600"}`}>{item.active?"Dipublikasikan":"Disembunyikan"}</span></div><h2 className="mt-3 font-semibold text-gray-900">{item.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">{item.content}</p><p className="mt-3 text-xs text-gray-400">{item.date}</p></div><button onClick={()=>togglePublished(item.id)} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50" aria-label={item.active?"Sembunyikan pengumuman":"Publikasikan pengumuman"}>{item.active?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></article>)}
      {filteredItems.length===0 && <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Tidak ada pengumuman yang cocok.</div>}
    </div>
    <p className="text-xs text-gray-400">{databaseMode ? "Terhubung ke Supabase. Pengumuman aktif tampil di aplikasi warga." : "Mode demo: tambah dan publikasi hanya disimpan di state halaman, bukan database."}</p>
  </div>;
}
