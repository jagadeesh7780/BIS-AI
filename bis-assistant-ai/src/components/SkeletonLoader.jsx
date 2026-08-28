// Reusable skeleton loader components

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <div className="skeleton h-4 w-24 mb-4 rounded" />
      <div className="skeleton h-5 w-3/4 mb-3 rounded" />
      <div className="skeleton h-4 w-full mb-2 rounded" />
      <div className="skeleton h-4 w-5/6 mb-4 rounded" />
      <div className="skeleton h-9 w-32 rounded-lg" />
    </div>
  )
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonChatMessage() {
  return (
    <div className="flex items-start gap-3">
      <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 max-w-md">
        <div className="skeleton h-4 w-full mb-2 rounded" />
        <div className="skeleton h-4 w-4/5 mb-2 rounded" />
        <div className="skeleton h-4 w-3/5 rounded" />
      </div>
    </div>
  )
}

export function SkeletonStandardCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-3">
      <div className="flex justify-between items-start">
        <div className="skeleton h-6 w-20 rounded-full" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-5/6 rounded" />
      <div className="skeleton h-9 w-28 rounded-lg mt-2" />
    </div>
  )
}
