type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";

const styles: Record<QueueStatus, string> = {
  WAITING: "bg-amber-50 text-amber-700",
  CALLED: "bg-blue-50 text-blue-700",
  SERVING: "bg-purple-50 text-purple-700",
  COMPLETED: "bg-green-50 text-green-700",
  SKIPPED: "bg-red-50 text-red-700",
};

const labels: Record<QueueStatus, string> = {
  WAITING: "Menunggu",
  CALLED: "Dipanggil",
  SERVING: "Dilayani",
  COMPLETED: "Selesai",
  SKIPPED: "Dilewati",
};

export default function QueueStatusBadge({ status }: { status: QueueStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
