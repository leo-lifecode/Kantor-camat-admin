import {
  LayoutDashboard,
  ListOrdered,
  BriefcaseBusiness,
  Megaphone,
  Users,
  FileText,
  ChartNoAxesCombined,
  UserCircle,
} from "lucide-react";

export const adminNavigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Antrian",
    href: "/antrian",
    icon: ListOrdered,
  },
  {
    label: "Layanan",
    href: "/layanan",
    icon: BriefcaseBusiness,
  },
  {
    label: "Pengumuman",
    href: "/pengumuman",
    icon: Megaphone,
  },
  {
    label: "Pengguna",
    href: "/pengguna",
    icon: Users,
  },
  {
    label: "Laporan",
    href: "/laporan",
    icon: FileText,
  },
  {
    label: "Analitik FCFS",
    href: "/analitik-fcfs",
    icon: ChartNoAxesCombined,
  },
  {
    label: "Profil",
    href: "/profil",
    icon: UserCircle,
  },
];
