import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, RefreshControl, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { Session } from "@supabase/supabase-js";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";

type Service = { id: string; name: string; description: string | null; estimated_duration: number };
type Queue = {
  id: string; queue_number: string; status: string; arrival_time: string;
  called_time: string | null; service?: { name: string } | null;
};
type Announcement = { id: string; title: string; content: string; category: string; image_url: string | null; published_at: string | null };\ntype QueueRow = { id: string; queue_number: string; status: string; arrival_time: string; called_time: string | null; services: { name: string } | { name: string }[] | null };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

const colors = { ink: "#172554", muted: "#64748b", purple: "#6d4aff", pale: "#f4f1ff", line: "#e2e8f0", bg: "#f8fafc", green: "#15803d", amber: "#b45309" };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState("");
  const lastQueueStatus = useRef<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [serviceResult, queueResult, announcementResult] = await Promise.all([
      supabase.from("services").select("id,name,description,estimated_duration").eq("is_active", true).order("name"),
      supabase.from("queues").select("id,queue_number,status,arrival_time,called_time,services(name)").eq("user_id", userId).in("status", ["WAITING", "CALLED", "SERVING"]).order("arrival_time", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("announcements").select("id,title,content,category,image_url,published_at").eq("is_active", true).order("published_at", { ascending: false }).limit(10),
    ]);
    if (serviceResult.error) setBanner(serviceResult.error.message);
    else {
      setServices((serviceResult.data ?? []) as Service[]);
      if (!selectedService && serviceResult.data?.[0]) setSelectedService(serviceResult.data[0].id);
    }
    if (queueResult.error) setBanner(queueResult.error.message);
    else {
      const row = queueResult.data as any;
      const nextQueue: Queue | null = row ? { ...row, service: Array.isArray(row.services) ? row.services[0] : row.services } : null;
      if (nextQueue?.status === "CALLED" && lastQueueStatus.current !== "CALLED") {
        const spoken = `Nomor antrian Anda ${nextQueue.queue_number}, silakan menuju loket pelayanan.`;
        Speech.speak(spoken, { language: "id-ID", rate: 0.92 });
        await Notifications.scheduleNotificationAsync({
          content: { title: "Antrian Anda dipanggil", body: spoken, sound: true },
          trigger: null,
        }).catch(() => undefined);
        setBanner(spoken);
      }
      lastQueueStatus.current = nextQueue?.status ?? null;
      setQueue(nextQueue);
    }
    if (announcementResult.error) setBanner(announcementResult.error.message);
    else setAnnouncements((announcementResult.data ?? []) as Announcement[]);
  }, [selectedService]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user.id) void loadData(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    }).catch(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) void loadData(nextSession.user.id);
      else { setQueue(null); setAnnouncements([]); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [loadData]);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    const channel = supabase.channel(`warga-updates-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queues", filter: `user_id=eq.${userId}` }, () => { void loadData(userId); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { title?: string; body?: string; type?: string };
        if (row.type === "QUEUE_CALLED") {
          setBanner(row.body ?? "Nomor antrian Anda dipanggil.");
          Speech.speak(row.body ?? "Nomor antrian Anda dipanggil, silakan menuju loket.", { language: "id-ID", rate: 0.92 });
          void Notifications.scheduleNotificationAsync({ content: { title: row.title ?? "Antrian dipanggil", body: row.body ?? "", sound: true }, trigger: null });
        }
        void loadData(userId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => { void loadData(userId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session?.user.id, loadData]);

  async function authenticate() {
    if (!supabase) { Alert.alert("Konfigurasi belum ada", "Isi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY di file .env."); return; }
    if (!email.trim() || password.length < 6) { Alert.alert("Periksa data", "Masukkan email dan password minimal 6 karakter."); return; }
    setBusy(true);
    try {
      if (registerMode) {
        if (!name.trim()) { Alert.alert("Nama wajib diisi", "Masukkan nama lengkap."); return; }
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (data.session) setSession(data.session);
        else Alert.alert("Periksa email", "Registrasi berhasil dikirim. Verifikasi email jika diminta, lalu masuk.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session);
      }
    } catch (error) { Alert.alert("Autentikasi gagal", error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  async function createQueue() {
    if (!supabase || !selectedService) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_queue", { p_service_id: selectedService });
      if (error) throw error;
      setBanner(`Nomor antrian ${data.queue_number} berhasil dibuat. Simpan nomor ini.`);
      await loadData(session!.user.id);
    } catch (error) { Alert.alert("Tidak dapat mengambil antrian", error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); setSession(null); }

  async function refresh() {
    if (!session?.user.id) return;
    setRefreshing(true);
    await loadData(session.user.id);
    setRefreshing(false);
  }

  if (!supabase) return <SafeAreaView style={styles.center}><Text style={styles.logo}>T</Text><Text style={styles.title}>Antrian Talawi</Text><Text style={styles.muted}>Konfigurasi Supabase belum diisi.</Text><Text style={styles.body}>Salin .env.example menjadi .env dan isi EXPO_PUBLIC_SUPABASE_URL serta EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text></SafeAreaView>;
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.purple} /><Text style={styles.muted}>Memuat aplikasi...</Text></SafeAreaView>;
  if (!session) return <SafeAreaView style={styles.authScreen}><ExpoStatusBar style="dark" /><View style={styles.brand}><Text style={styles.logo}>T</Text><Text style={styles.title}>Antrian Talawi</Text><Text style={styles.muted}>Layanan administrasi, tanpa perlu menebak giliran.</Text></View><View style={styles.card}><Text style={styles.heading}>{registerMode ? "Buat akun warga" : "Masuk ke akun"}</Text>{registerMode && <TextInput value={name} onChangeText={setName} placeholder="Nama lengkap" style={styles.input} /> }<TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" style={styles.input} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password (min. 6 karakter)" style={styles.input} /><TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => void authenticate()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{registerMode ? "Daftar" : "Masuk"}</Text>}</TouchableOpacity><TouchableOpacity onPress={() => setRegisterMode(!registerMode)}><Text style={styles.link}>{registerMode ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar warga"}</Text></TouchableOpacity></View></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><ExpoStatusBar style="dark" /><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.purple} />} contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>KANTOR CAMAT TALAWI</Text><Text style={styles.title}>Halo, {session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "Warga"}</Text><Text style={styles.muted}>Informasi layanan dan antrian Anda.</Text></View><TouchableOpacity onPress={() => void signOut()}><Text style={styles.link}>Keluar</Text></TouchableOpacity></View>
    {banner ? <View style={styles.banner}><Text style={styles.bannerText}>{banner}</Text></View> : null}
    <View style={styles.queueCard}><Text style={styles.cardEyebrow}>STATUS ANTRIAN ANDA</Text><Text style={styles.queueNumber}>{queue?.queue_number ?? "—"}</Text><Text style={styles.queueStatus}>{queue ? statusLabel(queue.status) : "Belum mengambil nomor"}</Text><Text style={styles.queueDescription}>{queue ? `${queue.service?.name ?? "Layanan"} · masuk ${new Date(queue.arrival_time).toLocaleTimeString("id-ID")}` : "Pilih layanan untuk mendapatkan nomor antrian."}</Text>{queue?.status === "CALLED" && <Text style={styles.calledText}>Nomor Anda dipanggil. Silakan menuju loket pelayanan.</Text>}</View>
    {!queue ? <View style={styles.card}><Text style={styles.heading}>Ambil nomor antrian</Text><Text style={styles.muted}>Pilih layanan. Sistem menentukan urutan berdasarkan waktu kedatangan.</Text>{services.map((service) => <TouchableOpacity key={service.id} onPress={() => setSelectedService(service.id)} style={[styles.serviceOption, selectedService === service.id && styles.serviceSelected]}><View style={{ flex: 1 }}><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.muted}>{service.description ?? `Estimasi ${service.estimated_duration} menit`}</Text></View><Text style={styles.radio}>{selectedService === service.id ? "●" : "○"}</Text></TouchableOpacity>)}<TouchableOpacity style={[styles.primaryButton, (!selectedService || busy) && styles.disabled]} disabled={!selectedService || busy} onPress={() => void createQueue()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Ambil Antrian</Text>}</TouchableOpacity></View> : <View style={styles.card}><Text style={styles.heading}>Sedang dalam antrian</Text><Text style={styles.muted}>Anda hanya dapat memiliki satu antrian aktif. Setelah selesai atau dilewati, Anda dapat mengambil nomor baru.</Text></View>}
    <View style={styles.sectionHeader}><Text style={styles.heading}>Pengumuman Kantor</Text><Text style={styles.muted}>Informasi terbaru</Text></View>
    {announcements.map((item) => <View key={item.id} style={styles.announcement}><View style={styles.tag}><Text style={styles.tagText}>{item.category || "Informasi"}</Text></View><Text style={styles.announcementTitle}>{item.title}</Text><Text style={styles.announcementBody}>{item.content}</Text>{item.published_at && <Text style={styles.date}>{new Date(item.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Text>}</View>)}
    {announcements.length === 0 && <View style={styles.card}><Text style={styles.muted}>Belum ada pengumuman yang dipublikasikan.</Text></View>}
    <Text style={styles.footer}>Pembaruan status melalui koneksi real-time. Tarik layar ke bawah untuk menyegarkan.</Text>
  </ScrollView></SafeAreaView>;
}

function statusLabel(status: string) {
  if (status === "WAITING") return "Menunggu giliran";
  if (status === "CALLED") return "Sedang dipanggil";
  if (status === "SERVING") return "Sedang dilayani";
  if (status === "COMPLETED") return "Selesai";
  return "Dilewati";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  authScreen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 22 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 28, gap: 12 },
  content: { padding: 20, paddingBottom: 42, gap: 16 },
  brand: { alignItems: "center", marginBottom: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 },
  logo: { width: 52, height: 52, lineHeight: 52, borderRadius: 17, overflow: "hidden", textAlign: "center", backgroundColor: colors.purple, color: "#fff", fontSize: 25, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 8 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  eyebrow: { color: colors.purple, fontWeight: "800", letterSpacing: 1.4, fontSize: 11 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  body: { color: colors.muted, textAlign: "center", lineHeight: 22, marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 },
  queueCard: { backgroundColor: colors.ink, borderRadius: 24, padding: 24, alignItems: "center" },
  cardEyebrow: { color: "#c4b5fd", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  queueNumber: { color: "#fff", fontSize: 48, fontWeight: "900", marginTop: 10 },
  queueStatus: { color: "#ddd6fe", fontWeight: "800", fontSize: 16, marginTop: 2 },
  queueDescription: { color: "#e2e8f0", fontSize: 12, textAlign: "center", marginTop: 8 },
  calledText: { color: "#fff", backgroundColor: "#7c2d12", overflow: "hidden", borderRadius: 12, padding: 12, marginTop: 14, fontWeight: "700", textAlign: "center" },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, color: colors.ink, backgroundColor: "#fff" },
  primaryButton: { backgroundColor: colors.purple, borderRadius: 13, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.45 },
  link: { color: colors.purple, fontWeight: "700", fontSize: 13, marginTop: 12 },
  serviceOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  serviceSelected: { borderColor: colors.purple, backgroundColor: colors.pale },
  serviceName: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  radio: { color: colors.purple, fontSize: 22 },
  banner: { backgroundColor: "#ede9fe", borderColor: "#ddd6fe", borderWidth: 1, borderRadius: 13, padding: 12 },
  bannerText: { color: "#4c1d95", fontSize: 13, fontWeight: "600", lineHeight: 19 },
  sectionHeader: { marginTop: 6 },
  announcement: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  tag: { alignSelf: "flex-start", backgroundColor: colors.pale, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { color: colors.purple, fontSize: 10, fontWeight: "800" },
  announcementTitle: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  announcementBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  date: { color: colors.muted, fontSize: 11, marginTop: 2 },
  footer: { textAlign: "center", color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
});
