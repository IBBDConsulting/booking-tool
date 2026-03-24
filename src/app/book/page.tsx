"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function BookRedirectInner() {
  const searchParams = useSearchParams();
  const agent = searchParams.get("agent");

  useEffect(() => {
    const url = agent ? `/book/select?agent=${agent}` : "/book/select";
    window.location.href = url;
  }, [agent]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Laden...</p>
    </div>
  );
}

export default function BookRedirect() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Laden...</p></div>}>
      <BookRedirectInner />
    </Suspense>
  );
}
