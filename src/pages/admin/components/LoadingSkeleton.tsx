interface LoadingSkeletonProps {
  variant?: 'card' | 'table-row' | 'text';
  count?: number;
}

export const LoadingSkeleton = ({ variant = 'card', count = 1 }: LoadingSkeletonProps) => {
  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <>
        {items.map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-gray-800" />
                <div className="mt-2 h-8 w-20 rounded bg-gray-800" />
                <div className="mt-2 h-3 w-32 rounded bg-gray-800" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-gray-800" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'table-row') {
    return (
      <>
        {items.map((_, i) => (
          <tr key={i} className="animate-pulse border-b border-gray-800">
            <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-800" /></td>
            <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-800" /></td>
            <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-800" /></td>
            <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-800" /></td>
            <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-800" /></td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-800 animate-pulse" />
      ))}
    </>
  );
};
