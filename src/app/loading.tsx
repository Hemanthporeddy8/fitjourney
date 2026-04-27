
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
          <Loader2 className="h-16 w-16 animate-spin text-primary absolute inset-0 [animation-delay:-0.3s]" />
        </div>
        <div className="space-y-3 text-center">
          <div className="h-6 w-48 bg-muted animate-pulse rounded-full mx-auto" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded-full mx-auto opacity-60" />
        </div>
      </div>
    </div>
  );
}
