"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Reveal } from "./Reveal";
import { venueImages } from "./content";

const accessPages = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export function CustomerPageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return children;
  const accountAccess = accessPages.includes(pathname);
  return (
    <div className="zo-home zo-pages" data-page={pathname.slice(1)}>
      <Reveal key={pathname}>
        {accountAccess ? (
          <div className="zo-account-stage zo-container">
            <aside className="zo-account-art">
              <Image
                src={venueImages.hero}
                alt="Snooker tables inside ZeroOne"
                fill
                sizes="(max-width: 850px) 0px, 48vw"
              />
              <div>
                <span className="zo-eyebrow">
                  Your next great night starts here
                </span>
                <h2>
                  More play.
                  <br />
                  Your way.
                </h2>
                <p>One account. Your bookings, all in one place.</p>
                <span className="zo-account-signature" aria-hidden="true">
                  01
                </span>
              </div>
            </aside>
            <div className="zo-account-form">{children}</div>
          </div>
        ) : (
          children
        )}
      </Reveal>
    </div>
  );
}
