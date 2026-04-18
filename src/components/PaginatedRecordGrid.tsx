import { ReactNode, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface PaginatedRecordGridProps<T> {
  items: T[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  renderItem: (item: T, globalIndex: number) => ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  actionButton?: ReactNode;
  gridClassName?: string;
  containerHeight?: string;
}

export function PaginatedRecordGrid<T>({
  items,
  page,
  pageSize,
  onPageChange,
  renderItem,
  loading = false,
  emptyMessage = "No records found",
  emptyDescription = "",
  actionButton,
  gridClassName = "",
  containerHeight = "max-h-[500px] md:max-h-[600px]",
}: PaginatedRecordGridProps<T>) {
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i++
      ) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-muted-foreground text-sm mt-1">{emptyDescription}</p>
        )}
        {actionButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        className={`
          grid gap-4 md:gap-6
          grid-cols-1 md:grid-cols-2 lg:grid-cols-3
          overflow-y-auto
          ${containerHeight}
          pr-1
          scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent
          hover:scrollbar-thumb-muted-foreground/50
        `}
      >
        {paginatedItems.map((item, localIndex) =>
          renderItem(item, startIndex + localIndex)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 pt-4 border-t bg-background">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(p as number)}
                  className="h-8 w-8 p-0"
                >
                  {p}
                </Button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="h-8 px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function computePagination<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  paginatedItems: T[];
  pagination: PaginationInfo;
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    paginatedItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}
