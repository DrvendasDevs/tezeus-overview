interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div
      className="flex items-center justify-center my-4 animate-fade-in"
      data-date-separator={date}
    >
      <div className="bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105 border border-black/5 dark:border-white/20">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 capitalize">
          {date}
        </span>
      </div>
    </div>
  );
}
