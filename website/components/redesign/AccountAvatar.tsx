"use client";

import Image from "next/image";
import { useState } from "react";

export function AccountAvatar({ photo }: { photo?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = photo?.startsWith("/uploads/")
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${photo}`
    : photo;
  return (
    <span className="zo-account-avatar" aria-hidden="true">
      {source && failed !== source ? (
        <Image
          src={source}
          alt=""
          width={40}
          height={40}
          unoptimized
          onError={() => setFailed(source)}
        />
      ) : (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" />
        </svg>
      )}
    </span>
  );
}
