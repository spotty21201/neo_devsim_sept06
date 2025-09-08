import React from 'react'

export function Card({ title, action, children }: { title: string, action?: React.ReactNode, children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

