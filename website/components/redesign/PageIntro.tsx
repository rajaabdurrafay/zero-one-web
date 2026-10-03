import Image from "next/image";
import { PillLink } from "./ui";

export function PageIntro({
  label,
  title,
  description,
  image,
  alt,
}: {
  label: string;
  title: string;
  description: string;
  image?: string;
  alt?: string;
}) {
  return (
    <header
      className={`zo-page-intro zo-container ${image ? "zo-page-intro-visual" : ""}`}
    >
      <div className="zo-page-intro-copy" data-reveal>
        <span className="zo-eyebrow">ZeroOne / {label}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <PillLink href="/book">Find your session</PillLink>
      </div>
      {image && (
        <div className="zo-page-intro-image" data-reveal>
          <Image
            src={image}
            alt={alt || "Inside ZeroOne Cue & Play"}
            fill
            sizes="(max-width: 760px) 92vw, 44vw"
            priority
          />
          <span>
            Gulistan-e-Jauhar, Karachi <b>Open 24/7 ↗</b>
          </span>
        </div>
      )}
    </header>
  );
}
