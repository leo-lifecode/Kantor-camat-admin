import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, RefreshControl, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import type { Session } from "@supabase/supabase-js";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";

type Service = { id: string; name: string; description: string | null; estimated_duration: number };
type Queue = {
  id: string; queue_number: string; status: string; arrival_time: string;
  called_time: string | null; service?: { name: string } | null;
};
type Announcement = { id: string; title: string; content: string; category: string; image_url: string | null; published_at: string | null };
type QueueRow = { id: string; queue_number: string; status: string; arrival_time: string; called_time: string | null; services: { name: string } | { name: string }[] | null };;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

const colors = { ink: "#171725", muted: "#777783", purple: "#6957e8", pale: "#eeebff", line: "#e8e7ee", bg: "#f7f7fb", green: "#15803d", amber: "#b45309" };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [screen, setScreen] = useState<"home" | "services" | "status" | "history" | "profile">("home");
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCategory, setServiceCategory] = useState<"Semua" | "Kependudukan" | "Surat & Rekomendasi">("Semua");
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
      const row = queueResult.data as QueueRow | null;
      const nextQueue: Queue | null = row ? { id: row.id, queue_number: row.queue_number, status: row.status, arrival_time: row.arrival_time, called_time: row.called_time, service: Array.isArray(row.services) ? row.services[0] : row.services } : null;
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
      if (nextQueue) setScreen("status");
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
    const client = supabase;
    const userId = session.user.id;
    const channel = client.channel(`warga-updates-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queues", filter: `user_id=eq.${userId}` }, () => { void loadData(userId); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { body?: string; type?: string };
        if (row.type === "QUEUE_CALLED") setBanner(row.body ?? "Nomor antrian Anda dipanggil.");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => { void loadData(userId); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
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
      setScreen("status");
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

  const displayName = String(session.user.user_metadata?.name ?? session.user.email?.split("@")[0] ?? "Warga");
  const firstName = displayName.split(" ")[0];
  const filteredServices = services.filter((service) => {
    const query = serviceQuery.trim().toLowerCase();
    const matchesQuery = service.name.toLowerCase().includes(query) || (service.description ?? "").toLowerCase().includes(query);
    const serviceText = `${service.name} ${service.description ?? ""}`.toLowerCase();
    const isPopulation = /ktp|kartu keluarga|kependudukan|akta|pindah|domisili|nik|identitas/.test(serviceText);
    const matchesCategory = serviceCategory === "Semua" || (serviceCategory === "Kependudukan" ? isPopulation : !isPopulation);
    return matchesQuery && matchesCategory;
  });
  const selected = services.find((service) => service.id === selectedService);
  const queueService = services.find((service) => service.name === queue?.service?.name);
  const queueStatus = queue?.status ?? "WAITING";
  const currentStep = queueStatus === "COMPLETED" ? 5 : queueStatus === "CALLED" || queueStatus === "SERVING" ? 3 : 2;

  return <SafeAreaView style={styles.screen}>
    <ExpoStatusBar style="dark" />
    <View style={styles.topBar}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>◴</Text></View>
      <View style={styles.brandCopy}>
        <Text style={styles.brandEyebrow}>Kecamatan Talawi</Text>
        <Text style={styles.brandTitle}>{screen === "home" ? "Home" : screen === "services" ? "Antrian" : screen === "status" ? "Antrian" : screen === "history" ? "Riwayat" : "Profil"}</Text>
      </View>
      <TouchableOpacity style={styles.headerAction} onPress={() => setBanner("Notifikasi antrean akan muncul di sini.")}><Text style={styles.headerActionText}>♧</Text></TouchableOpacity>
      <TouchableOpacity style={styles.avatar} onPress={() => setScreen("profile")}><Text style={styles.avatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></TouchableOpacity>
    </View>

    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.purple} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {banner ? <TouchableOpacity style={styles.banner} onPress={() => setBanner("")}><Text style={styles.bannerText}>{banner}</Text></TouchableOpacity> : null}

      {screen === "home" && <>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Selamat pagi, {firstName} 👋</Text>
              <Text style={styles.heroSubtitle}>Kantor Camat Talawi • Pelayanan Terpadu</Text>
            </View>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Sistem aktif</Text></View>
          </View>
          <TouchableOpacity style={styles.heroQueue} onPress={() => setScreen(queue ? "status" : "services")}>
            <View style={styles.heroQueueIcon}><Text style={styles.heroQueueIconText}>◖</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroQueueLabel}>{queue ? "ANTREAN ANDA" : "LAYANAN KECAMATAN"}</Text>
              <Text style={styles.heroQueueNumber}>{queue ? queue.queue_number : "Ambil nomor"}</Text>
              <Text style={styles.heroQueueMeta}>{queue ? statusLabel(queue.status) : "Administrasi kependudukan & surat"}</Text>
            </View>
            {queue ? <Text style={styles.heroQueueArrow}>›</Text> : null}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.quickAction} onPress={() => setScreen(queue ? "status" : "services")}>
          <View style={styles.quickIcon}><Text style={styles.quickIconText}>▣</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickTitle}>{queue ? "Lihat antrean aktif" : "Perlu layanan kecamatan?"}</Text>
            <Text style={styles.quickSubtitle}>{queue ? "Pantau posisi dan status layanan" : "Pilih layanan dan ambil nomor antrean"}</Text>
          </View>
          <View style={styles.quickButton}><Text style={styles.quickButtonText}>{queue ? "Lihat" : "Ambil ›"}</Text></View>
        </TouchableOpacity>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Layanan utama</Text><Text style={styles.sectionCaption}>Pilih layanan kependudukan dan surat resmi</Text></View>
          <Text style={styles.sectionCount}>{services.length} layanan</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {services.slice(0, 5).map((service, index) => <TouchableOpacity key={service.id} style={styles.categoryCard} onPress={() => { setSelectedService(service.id); setScreen("services"); }}>
            <View style={[styles.categoryIcon, { backgroundColor: index % 2 ? "#EAFBF3" : "#EEEAFE" }]}><Text style={styles.categoryIconText}>{["▣", "♧", "▤", "✿", "⌂"][index % 5]}</Text></View>
            <Text style={styles.categoryName} numberOfLines={2}>{service.name}</Text>
            <Text style={styles.categoryHint}>{service.estimated_duration} mnt</Text>
          </TouchableOpacity>)}
          {services.length === 0 && <View style={styles.emptyCard}><Text style={styles.muted}>Layanan belum tersedia.</Text></View>}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Informasi & pengumuman</Text><Text style={styles.sectionCaption}>Informasi terbaru dari kantor</Text></View>
        </View>
        {announcements.slice(0, 3).map((item) => <View key={item.id} style={styles.announcement}>
          <View style={styles.announcementIcon}><Text style={styles.announcementIconText}>i</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.announcementMeta}>{(item.category || "INFORMASI").toUpperCase()}  •  {item.published_at ? new Date(item.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "Terbaru"}</Text>
            <Text style={styles.announcementTitle}>{item.title}</Text>
            <Text style={styles.announcementBody} numberOfLines={2}>{item.content}</Text>
          </View>
        </View>)}
        {announcements.length === 0 && <View style={styles.emptyCard}><Text style={styles.muted}>Belum ada pengumuman yang dipublikasikan.</Text></View>}

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Status loket pelayanan</Text><Text style={styles.sectionCaption}>Estimasi waktu sesuai layanan</Text></View></View>
        {services.slice(0, 3).map((service, index) => <TouchableOpacity key={service.id} style={styles.servicePreview} onPress={() => { setSelectedService(service.id); setScreen("services"); }}>
          <View style={styles.servicePreviewIcon}><Text style={styles.categoryIconText}>{["▣", "♧", "▤"][index]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.servicePreviewTitle}>{service.name}</Text>
            <Text style={styles.servicePreviewMeta}>{service.description ?? "Pelayanan Kantor Camat Talawi"}</Text>
            <Text style={styles.servicePreviewEstimate}>◷  Estimasi {service.estimated_duration} menit</Text>
          </View>
          <Text style={styles.servicePreviewArrow}>›</Text>
        </TouchableOpacity>)}
        <View style={styles.tipCard}><Text style={styles.tipIcon}>✓</Text><Text style={styles.tipText}><Text style={{ fontWeight: "800", color: colors.ink }}>Tips nyaman: </Text>Siapkan berkas pendukung sebelum nomor dipanggil agar pelayanan lebih lancar.</Text></View>
      </>}

      {screen === "services" && <>
        <View style={styles.selectionHero}>
          <View style={styles.selectionLive}><View style={styles.liveDot} /><Text style={styles.selectionLiveText}>Sistem antrean aktif • FCFS</Text></View>
          <Text style={styles.selectionTitle}>Ambil Nomor Antrean</Text>
          <Text style={styles.selectionSubtitle}>Pilih jenis layanan administrasi kependudukan dan perizinan terpadu.</Text>
        </View>
        <View style={styles.stepper}>
          <View style={styles.step}><Text style={styles.stepCircleActive}>1</Text><Text style={styles.stepActiveText}>Layanan</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.step}><Text style={styles.stepCircle}>2</Text><Text style={styles.stepText}>Data diri</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.step}><Text style={styles.stepCircle}>3</Text><Text style={styles.stepText}>Tiket</Text></View>
        </View>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={serviceQuery} onChangeText={setServiceQuery} placeholder="Cari layanan surat, KTP, KK..." placeholderTextColor="#9999A3" style={styles.searchInput} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(["Semua", "Kependudukan", "Surat & Rekomendasi"] as const).map((category) => (
            <TouchableOpacity key={category} onPress={() => setServiceCategory(category)} style={serviceCategory === category ? styles.filterActive : styles.filterChip}>
              <Text style={serviceCategory === category ? styles.filterActiveText : styles.filterText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filteredServices.map((service, index) => <TouchableOpacity key={service.id} activeOpacity={0.88} onPress={() => setSelectedService(service.id)} style={[styles.serviceChoice, selectedService === service.id && styles.serviceChoiceSelected]}>
          <View style={styles.serviceChoiceTop}>
            <View style={styles.serviceChoiceIcon}><Text style={styles.categoryIconText}>{["▣", "♧", "⇄", "✿", "⌂"][services.findIndex((item) => item.id === service.id) % 5]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceChoiceTitle}>{service.name}</Text>
              <Text style={styles.serviceChoiceDescription}>{service.description ?? "Layanan administrasi Kantor Camat Talawi."}</Text>
            </View>
            <Text style={[styles.serviceChoiceRadio, selectedService === service.id && styles.serviceChoiceRadioSelected]}>{selectedService === service.id ? "●" : "○"}</Text>
          </View>
          <View style={styles.serviceChoiceFooter}><Text style={styles.serviceChoiceMeta}>▣  Pelayanan Kecamatan</Text><Text style={styles.serviceChoiceMeta}>◷  ±{service.estimated_duration} mnt</Text></View>
        </TouchableOpacity>)}
        {filteredServices.length === 0 && <View style={styles.emptyCard}><Text style={styles.muted}>Layanan tidak ditemukan.</Text></View>}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}><Text style={styles.summaryLabel}>☑  RINGKASAN ANTREAN</Text><Text style={styles.summaryPill}>Layanan</Text></View>
          <View style={styles.divider} />
          <Text style={styles.summaryCaption}>Layanan terpilih</Text>
          <Text style={styles.summaryService}>{selected?.name ?? "Pilih layanan terlebih dahulu"}</Text>
          <Text style={styles.summaryEstimate}>{selected ? "Estimasi pelayanan ±" + selected.estimated_duration + " menit" : "Nomor antrean dibuat setelah konfirmasi"}</Text>
          <View style={styles.documentTip}><Text style={styles.documentTipText}>ⓘ  Siapkan dokumen asli dan fotokopi sesuai persyaratan layanan.</Text></View>
        </View>
        <TouchableOpacity style={[styles.primaryButton, (!selectedService || busy || !!queue) && styles.disabled]} disabled={!selectedService || busy || !!queue} onPress={() => void createQueue()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{queue ? "Anda masih memiliki antrean aktif" : "Lanjut & Ambil Nomor Antrean  →"}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => setScreen("home")}><Text style={styles.backLinkText}>Kembali ke Home</Text></TouchableOpacity>
      </>}

      {screen === "status" && queue && <>
        <View style={styles.realtimeRow}><View style={styles.liveDot} /><Text style={styles.realtimeText}>Live realtime server</Text><View style={styles.updatePill}><Text style={styles.updatePillText}>↻  FCFS</Text></View></View>
        <View style={styles.statusCard}>
          <View style={styles.statusAccent} />
          <View style={styles.statusTop}><View><Text style={styles.statusEyebrow}>NOMOR ANTREAN ANDA</Text><Text style={styles.statusNumber}>{queue.queue_number}</Text></View><View style={[styles.statusPill, queue.status === "CALLED" || queue.status === "SERVING" ? styles.statusPillCalled : null]}><Text style={styles.statusPillText}>●  {statusLabel(queue.status)}</Text></View></View>
          <View style={styles.statusService}><Text style={styles.statusServiceIcon}>▤</Text><View style={{ flex: 1 }}><Text style={styles.statusServiceName}>{queue.service?.name ?? "Layanan kecamatan"}</Text><Text style={styles.statusServiceMeta}>Kantor Camat Talawi</Text></View></View>
          <View style={styles.statusMetrics}>
            <View style={styles.metric}><Text style={styles.metricLabel}>Nomor antrean</Text><Text style={styles.metricValue}>{queue.queue_number}</Text><Text style={styles.metricHint}>tiket Anda</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Estimasi</Text><Text style={styles.metricValue}>{queueService?.estimated_duration ?? "—"}</Text><Text style={styles.metricHint}>menit layanan</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Status</Text><Text style={styles.metricValueSmall}>{statusLabel(queue.status)}</Text><Text style={styles.metricHint}>real-time</Text></View>
          </View>
        </View>
        <TouchableOpacity style={styles.ticketButton} onPress={() => Alert.alert("Tiket Antrean Digital", "Nomor antrean Anda: " + queue.queue_number + "\nTunjukkan nomor ini kepada petugas.")}><Text style={styles.ticketButtonText}>▦  Tampilkan Tiket Digital</Text></TouchableOpacity>
                <View style={styles.timelineCard}>
          <View style={styles.timelineHeading}><Text style={styles.sectionTitle}>Tahapan pelayanan</Text><Text style={styles.timelineAlgorithm}>Algoritma FCFS</Text></View>
          <QueueStep done={currentStep >= 1} active={currentStep === 1} title="Tiket dibuat" caption="Antrean tercatat pada sistem" />
          <QueueStep done={currentStep >= 2} active={currentStep === 2} title="Masuk daftar tunggu" caption="Urutan berdasarkan waktu kedatangan" />
          <QueueStep done={currentStep >= 3} active={currentStep === 3} title="Panggilan menuju loket" caption="Pantau notifikasi saat nomor dipanggil" />
          <QueueStep done={currentStep >= 4} active={currentStep === 4} title="Verifikasi dokumen fisik" caption="Siapkan berkas asli dan fotokopi" />
          <QueueStep done={currentStep >= 5} active={currentStep === 5} title="Pelayanan selesai" caption="Terima dokumen dari petugas" last />
        </View>
        <View style={styles.tipCard}><Text style={styles.tipIcon}>i</Text><Text style={styles.tipText}>Harap siapkan berkas asli dan fotokopi sebelum nomor Anda dipanggil ke loket pelayanan.</Text></View>
      </>}

      {screen === "status" && !queue && <View style={styles.emptyCard}><Text style={styles.sectionTitle}>Belum ada antrean aktif</Text><Text style={styles.muted}>Pilih layanan untuk mengambil nomor antrean.</Text><TouchableOpacity style={styles.primaryButton} onPress={() => setScreen("services")}><Text style={styles.primaryText}>Pilih layanan</Text></TouchableOpacity></View>}
      {screen === "history" && <View style={styles.emptyCard}><Text style={styles.sectionTitle}>Riwayat antrean</Text><Text style={styles.muted}>Riwayat antrean selesai belum tersedia.</Text></View>}
      {screen === "profile" && <>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{session.user.email}</Text>
          <View style={styles.profileVerified}><View style={styles.profileVerifiedDot} /><Text style={styles.profileVerifiedText}>Akun warga Antrian Talawi</Text></View>
        </View>
        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>Informasi Akun</Text>
          <View style={styles.profileInfoRow}><View style={styles.profileInfoIcon}><Text style={styles.profileInfoIconText}>♙</Text></View><View style={{ flex: 1 }}><Text style={styles.profileInfoLabel}>Nama lengkap</Text><Text style={styles.profileInfoValue}>{displayName}</Text></View></View>
          <View style={styles.profileInfoRow}><View style={styles.profileInfoIcon}><Text style={styles.profileInfoIconText}>✉</Text></View><View style={{ flex: 1 }}><Text style={styles.profileInfoLabel}>Email terdaftar</Text><Text style={styles.profileInfoValue}>{session.user.email ?? "Tidak tersedia"}</Text></View></View>
        </View>
        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>Tentang Aplikasi</Text>
          <View style={styles.profileInfoRow}><View style={styles.profileInfoIcon}><Text style={styles.profileInfoIconText}>◷</Text></View><View style={{ flex: 1 }}><Text style={styles.profileInfoValue}>Antrian Talawi</Text><Text style={styles.profileInfoLabel}>Layanan antrean digital Kecamatan Talawi</Text></View></View>
          <View style={styles.profileInfoRow}><View style={styles.profileInfoIcon}><Text style={styles.profileInfoIconText}>✓</Text></View><View style={{ flex: 1 }}><Text style={styles.profileInfoValue}>Sistem FCFS</Text><Text style={styles.profileInfoLabel}>Urutan antrean berdasarkan waktu kedatangan</Text></View></View>
        </View>
        <TouchableOpacity style={styles.profileLogout} onPress={() => void signOut()}><Text style={styles.profileLogoutText}>↪  Keluar dari akun</Text></TouchableOpacity>
      </>}
    </ScrollView>
    <View style={styles.tabBar}>
      <TabButton icon="⌂" label="Home" active={screen === "home"} onPress={() => setScreen("home")} />
      <TabButton icon="▣" label="Antrian" active={screen === "services" || screen === "status"} onPress={() => setScreen(queue ? "status" : "services")} />
      <TabButton icon="◷" label="Riwayat" active={screen === "history"} onPress={() => setScreen("history")} />
      <TabButton icon="♙" label="Profil" active={screen === "profile"} onPress={() => setScreen("profile")} />
    </View>
  </SafeAreaView>;
}

function statusLabel(status: string) {
  if (status === "WAITING") return "Sedang menunggu";
  if (status === "CALLED") return "Dipanggil ke loket";
  if (status === "SERVING") return "Sedang dilayani";
  if (status === "COMPLETED") return "Selesai";
  return "Dilewati";
}

function TabButton({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={styles.tabItem}>
    <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
    <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
  </TouchableOpacity>;
}

function QueueStep({ done, active, title, caption, last = false }: { done: boolean; active: boolean; title: string; caption: string; last?: boolean }) {
  return <View style={styles.stepRow}>
    <View style={styles.stepRail}>
      <View style={[styles.queueStepIcon, done && styles.queueStepDone, active && styles.queueStepActive]}>
        <Text style={[styles.queueStepIconText, (done || active) && styles.queueStepIconTextActive]}>{done ? "✓" : "•"}</Text>
      </View>
      {!last && <View style={styles.stepConnector} />}
    </View>
    <View style={[styles.stepCopy, last && { paddingBottom: 0 }]}>
      <Text style={[styles.stepTitle, active && styles.stepTitleActive, !done && !active && styles.stepTitlePending]}>{title}</Text>
      <Text style={styles.stepCaption}>{caption}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  authScreen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 22 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 28, gap: 12 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 14 },
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
  primaryButton: { backgroundColor: colors.purple, borderRadius: 16, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 4, elevation: 3 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14, textAlign: "center" },
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
  topBar: { height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, backgroundColor: "#fff" },
  brandMark: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.purple },
  brandMarkText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  brandCopy: { flex: 1, paddingLeft: 10 },
  brandEyebrow: { color: colors.muted, fontSize: 11 },
  brandTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  headerAction: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerActionText: { color: colors.ink, fontSize: 22 },
  avatar: { width: 38, height: 38, borderRadius: 20, borderWidth: 2, borderColor: colors.pale, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  avatarText: { color: colors.purple, fontSize: 15, fontWeight: "800" },
  heroCard: { backgroundColor: colors.purple, borderRadius: 24, padding: 18, gap: 16, elevation: 3 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 28 },
  heroSubtitle: { color: "#eeeaff", fontSize: 12, lineHeight: 18, marginTop: 5 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#20c77a" },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  heroQueue: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 12, gap: 10 },
  heroQueueIcon: { width: 44, height: 44, backgroundColor: colors.pale, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroQueueIconText: { color: colors.purple, fontSize: 23 },
  heroQueueLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1 },
  heroQueueNumber: { color: colors.purple, fontSize: 21, fontWeight: "800", marginTop: 2 },
  heroQueueMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  heroQueueArrow: { color: colors.purple, fontSize: 27, paddingHorizontal: 5 },
  quickAction: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 13, gap: 10, elevation: 2 },
  quickIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  quickIconText: { color: colors.purple, fontSize: 21 },
  quickTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  quickSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  quickButton: { backgroundColor: colors.purple, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10 },
  quickButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  sectionCaption: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionCount: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  categoryRow: { paddingRight: 6, gap: 8 },
  categoryCard: { width: 82, minHeight: 126, padding: 9, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 2 },
  categoryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  categoryIconText: { color: colors.purple, fontSize: 20 },
  categoryName: { color: colors.ink, fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center", marginTop: 7 },
  categoryHint: { color: colors.muted, fontSize: 9, marginTop: 4 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 18, padding: 17, gap: 8, borderWidth: 1, borderColor: colors.line },
  announcementIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  announcementIconText: { color: colors.purple, fontWeight: "800" },
  announcementMeta: { color: colors.purple, fontSize: 9, fontWeight: "700", marginBottom: 4 },
  servicePreview: { backgroundColor: "#fff", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, elevation: 2 },
  servicePreviewIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  servicePreviewTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  servicePreviewMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  servicePreviewEstimate: { color: colors.purple, fontSize: 10, marginTop: 5 },
  servicePreviewArrow: { color: "#b7b1d5", fontSize: 24 },
  tipCard: { backgroundColor: "#e8e3ff", borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  tipIcon: { width: 34, height: 34, borderRadius: 18, textAlign: "center", textAlignVertical: "center", overflow: "hidden", color: colors.purple, fontWeight: "800", fontSize: 18, backgroundColor: "#fff" },
  tipText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 17 },
  selectionHero: { backgroundColor: colors.purple, borderRadius: 22, padding: 18, gap: 8, elevation: 3 },
  selectionLive: { flexDirection: "row", alignItems: "center", gap: 7 },
  selectionLiveText: { color: "#e7e2ff", fontSize: 11, fontWeight: "600" },
  selectionTitle: { color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 3 },
  selectionSubtitle: { color: "#eeeaff", fontSize: 12, lineHeight: 18 },
  stepper: { backgroundColor: "#fff", borderRadius: 18, padding: 10, flexDirection: "row", alignItems: "center", elevation: 1 },
  step: { minWidth: 54, alignItems: "center", gap: 4 },
  stepCircleActive: { width: 28, height: 28, borderRadius: 16, backgroundColor: colors.purple, color: "#fff", textAlign: "center", textAlignVertical: "center", overflow: "hidden", fontWeight: "800" },
  stepActiveText: { color: colors.purple, fontSize: 10, fontWeight: "700" },
  stepLine: { height: 1, flex: 1, backgroundColor: colors.line, marginHorizontal: 3 },
  stepCircle: { width: 28, height: 28, borderRadius: 16, backgroundColor: "#eeeef2", color: colors.ink, textAlign: "center", textAlignVertical: "center", overflow: "hidden", fontWeight: "700" },
  stepText: { color: colors.muted, fontSize: 10 },
  searchBox: { minHeight: 48, borderRadius: 14, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, elevation: 1 },
  searchIcon: { color: colors.muted, fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, paddingVertical: 10 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterActive: { backgroundColor: colors.purple, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  filterActiveText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  filterChip: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  filterText: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  serviceChoice: { backgroundColor: "#fff", borderWidth: 1, borderColor: "transparent", borderRadius: 20, padding: 13, marginTop: 7, gap: 10, elevation: 2 },
  serviceChoiceSelected: { borderColor: colors.purple, borderWidth: 2 },
  serviceChoiceTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  serviceChoiceIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  serviceChoiceTitle: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  serviceChoiceDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  serviceChoiceRadio: { color: "#d4d4d8", fontSize: 20 },
  serviceChoiceRadioSelected: { color: colors.purple },
  serviceChoiceFooter: { backgroundColor: colors.bg, borderRadius: 10, padding: 8, flexDirection: "row", justifyContent: "space-between" },
  serviceChoiceMeta: { color: colors.muted, fontSize: 10 },
  summaryCard: { backgroundColor: colors.pale, borderRadius: 20, padding: 15, gap: 5 },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  summaryPill: { color: "#fff", backgroundColor: colors.purple, fontSize: 10, fontWeight: "700", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  divider: { height: 1, backgroundColor: "#dcd8f4", marginVertical: 5 },
  summaryCaption: { color: colors.muted, fontSize: 10 },
  summaryService: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  summaryEstimate: { color: colors.purple, fontSize: 11, marginTop: 2 },
  documentTip: { backgroundColor: "#fff", borderRadius: 12, padding: 10, marginTop: 8 },
  documentTipText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  backLink: { alignItems: "center", paddingVertical: 10 },
  backLinkText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  realtimeRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 2, paddingBottom: 2 },
  realtimeText: { color: colors.muted, flex: 1, fontSize: 12 },
  updatePill: { backgroundColor: "#eeeef2", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  updatePillText: { color: colors.muted, fontSize: 10 },
  statusCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, overflow: "hidden", elevation: 3 },
  statusAccent: { position: "absolute", left: 0, right: 0, top: 0, height: 6, backgroundColor: colors.purple },
  statusTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  statusEyebrow: { color: colors.purple, fontSize: 11, fontWeight: "800" },
  statusNumber: { color: colors.ink, fontSize: 31, fontWeight: "900", marginTop: 2 },
  statusPill: { backgroundColor: "#fff2df", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  statusPillCalled: { backgroundColor: "#e7f8ee" },
  statusPillText: { color: colors.amber, fontSize: 10, fontWeight: "800" },
  statusService: { backgroundColor: "#f5f3f4", borderRadius: 15, padding: 12, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  statusServiceIcon: { color: colors.purple, fontSize: 20 },
  statusServiceName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  statusServiceMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  statusMetrics: { flexDirection: "row", gap: 7, marginTop: 11 },
  metric: { flex: 1, backgroundColor: "#f5f3f4", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 5, alignItems: "center", minHeight: 82 },
  metricLabel: { color: colors.muted, fontSize: 10 },
  metricValue: { color: colors.purple, fontSize: 15, fontWeight: "800", marginTop: 5 },
  metricHint: { color: "#9999a3", fontSize: 9, marginTop: 3, textAlign: "center" },
  metricValueSmall: { color: colors.ink, fontSize: 10, fontWeight: "800", marginTop: 7, textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 8 },
  ticketButton: { flex: 1, minHeight: 48, backgroundColor: "#e7e1ff", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  ticketButtonText: { color: colors.purple, fontSize: 12, fontWeight: "800" },
  cancelButton: { paddingHorizontal: 13, minHeight: 48, backgroundColor: "#fde8e7", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: "#c73c3c", fontSize: 11, fontWeight: "700" },
  timelineCard: { backgroundColor: "#fff", borderRadius: 22, padding: 17, elevation: 2 },
  timelineHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  timelineAlgorithm: { color: colors.purple, fontSize: 10 },
  stepRow: { flexDirection: "row", minHeight: 58 },
  stepRail: { width: 30, alignItems: "center" },
  queueStepIcon: { width: 25, height: 25, borderRadius: 14, backgroundColor: "#eeeef2", alignItems: "center", justifyContent: "center", zIndex: 1 },
  queueStepDone: { backgroundColor: "#20bf6b" },
  queueStepActive: { backgroundColor: colors.purple },
  queueStepIconText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  queueStepIconTextActive: { color: "#fff" },
  stepConnector: { position: "absolute", width: 2, top: 24, bottom: -1, backgroundColor: "#e4e1e5" },
  stepCopy: { flex: 1, paddingLeft: 9, paddingBottom: 10 },
  stepTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  stepTitleActive: { color: colors.purple },
  stepTitlePending: { color: "#9999a3", fontWeight: "500" },
  stepCaption: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  profileHero: { backgroundColor: colors.purple, borderRadius: 24, padding: 24, alignItems: "center", gap: 8, marginBottom: 4 },
  profileName: { color: "#fff", fontSize: 21, fontWeight: "800", textAlign: "center", marginTop: 4 },
  profileEmail: { color: "#eeeaff", fontSize: 12, textAlign: "center" },
  profileVerified: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginTop: 5 },
  profileVerifiedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#20c77a" },
  profileVerifiedText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  profileSection: { backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 15, borderWidth: 1, borderColor: colors.line },
  profileSectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  profileInfoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileInfoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  profileInfoIconText: { color: colors.purple, fontSize: 19, fontWeight: "700" },
  profileInfoLabel: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  profileInfoValue: { color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  profileLogout: { minHeight: 50, borderRadius: 15, backgroundColor: "#fff0ef", borderWidth: 1, borderColor: "#fbd5d2", alignItems: "center", justifyContent: "center", padding: 14 },
  profileLogoutText: { color: "#c2413a", fontSize: 13, fontWeight: "800" },
  profileCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 22, padding: 24, gap: 9 },
  profileAvatar: { width: 68, height: 68, borderRadius: 36, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: colors.purple, fontSize: 26, fontWeight: "800" },
  outlineButton: { borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13, marginTop: 12 },
  outlineButtonText: { color: colors.purple, fontWeight: "700" },
  tabBar: { height: 64, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0eff3", paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 50 },
  tabIcon: { fontSize: 20, lineHeight: 22, color: colors.muted },
  tabLabel: { color: colors.muted, fontSize: 10 },
  tabActive: { color: colors.purple, fontWeight: "800" },
});