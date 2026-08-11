import Image from "next/image";

export function LegalHeroIllustration() {
  return (
    <div className="group relative p-2">
      <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full pointer-events-none" />
      <Image
        src="/images/mazora-logo.webp"
        alt="Mazora Network Logo"
        width={310}
        height={207}
        priority
        className="animate-float relative object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}
