import Image from "next/image";

/** Canonical right-side PageHero brand mark. Keep every public hero in sync. */
export function FloatingBrandLogo() {
  return (
    <div className="group relative p-2">
      <Image
        src="/images/mazora-logo.webp"
        alt="Mazora Network Logo"
        width={310}
        height={207}
        sizes="(max-width: 767px) 68vw, 310px"
        priority
        className="relative h-auto w-[min(68vw,310px)] animate-float object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105 md:w-[310px]"
      />
    </div>
  );
}
