export function StatusChip({ status, label }: { status: 'ok'|'warn'|'bad', label: string }) {
  const map = {
    ok:   { bg:'bg-emerald-50', text:'text-emerald-700' },
    warn: { bg:'bg-amber-50',   text:'text-amber-700' },
    bad:  { bg:'bg-red-50',     text:'text-red-700' },
  }[status]
  return <span className={`px-2 py-1 text-xs rounded-full ${map.bg} ${map.text}`}>{label}</span>
}

