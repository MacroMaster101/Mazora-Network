export default function Loading() {
  return (
    <div className="shell space-y-6 py-16">
      <div className="skeleton h-10 w-2/3 max-w-md rounded-lg" />
      <div className="skeleton h-4 w-full max-w-xl rounded" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel p-5">
            <div className="skeleton h-32 w-full rounded-lg" />
            <div className="skeleton mt-4 h-4 w-2/3 rounded" />
            <div className="skeleton mt-2 h-3 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
