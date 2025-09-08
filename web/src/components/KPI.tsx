import React from 'react'

export function KPI({ label, value, sub, tooltip }: { label: string, value: string, sub?: React.ReactNode, tooltip?: string }) {
  return (
    <div>
      <div className="text-sm text-gray-500" title={tooltip}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
