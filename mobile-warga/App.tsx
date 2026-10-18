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

const colors = { ink: "#172554", muted: "#64748b", purple: "#6d4aff", pale: "#f4f1ff", line: "#e2e8f0", bg: "#f8fafc", green: "#15803d", amber: "#b45309" };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [screen, setScreen] = useState<"home" | "services" | "status" | "history" | "profile">("home");
  const [serviceQuery, setServiceQuery] = useState("");
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
      setScreen(nextQueue ? "status" : "home");
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
  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(serviceQuery.trim().toLowerCase()) ||
    (service.description ?? "").toLowerCase().includes(serviceQuery.trim().toLowerCase())
  );
  const selected = services.find((service) => service.id === selectedService);
  const queuePosition = queue ? Math.max(1, services.length ? 1 : 1) : 0;
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
          <View style={styles.filterActive}><Text style={styles.filterActiveText}>Semua</Text></View>
          <View style={styles.filterChip}><Text style={styles.filterText}>Kependudukan</Text></View>
          <View style={styles.filterChip}><Text style={styles.filterText}>Surat & Rekomendasi</Text></View>
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
            <View style={styles.metric}><Text style={styles.metricLabel}>Nomor</Text><Text style={styles.metricValue}>{queue.queue_number}</Text><Text style={styles.metricHint}>tiket aktif</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Estimasi</Text><Text style={styles.metricValue}>{selected?.estimated_duration ?? "—"}</Text><Text style={styles.metricHint}>menit / orang</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>Status</Text><Text style={styles.metricValueSmall}>{statusLabel(queue.status)}</Text><Text style={styles.metricHint}>diperbarui live</Text></View>
          </View>
        </View>
        <View style={styles.actionRow}><TouchableOpacity style={styles.ticketButton} onPress={() => Alert.alert("Tiket Antrean Digital", "Nomor antrean Anda: " + queue.queue_number + "\\nTunjukkan nomor ini kepada petugas.")}><Text style={styles.ticketButtonText}>▦  Tampilkan Tiket</Text></TouchableOpacity><TouchableOpacity style={styles.cancelButton} onPress={() => Alert.alert("Batalkan antrean?", "Pembatalan antrean belum tersedia di aplikasi.", [{ text: "Tutup" }])}><Text style={styles.cancelButtonText}>⊗  Batal</Text></TouchableOpacity></View>
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
      {screen === "profile" && <View style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.sectionTitle}>{displayName}</Text><Text style={styles.muted}>{session.user.email}</Text><TouchableOpacity style={styles.outlineButton} onPress={() => void signOut()}><Text style={styles.outlineButtonText}>Keluar dari akun</Text></TouchableOpacity></View>}
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
