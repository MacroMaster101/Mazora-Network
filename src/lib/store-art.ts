import type { Product } from "@/lib/types";

export function storeArtFor(
  itemOrCategory?: Product["category"] | { slug: string; category?: Product["category"]; imageUrl?: string | null }
): string {
  if (!itemOrCategory) return "/images/store/battlepass-pass.webp";

  if (typeof itemOrCategory === "string") {
    const category = itemOrCategory;
    if (category === "Ranks") return "/images/store/rank-conqueror.webp";
    if (category === "Crate Keys") return "/images/store/key-crate.webp";
    if (category === "Battlepass") return "/images/store/battlepass-pass.webp";
    if (category === "Add-ons") return "/images/store/xp-potion.webp";
    return "/images/store/battlepass-pass.webp";
  }

  const { slug, category } = itemOrCategory;
  const uploadedImage = itemOrCategory.imageUrl?.trim();
  if (uploadedImage) {
    if (uploadedImage.startsWith("/images/store/") && uploadedImage.endsWith(".png")) {
      return uploadedImage.replace(/\.png$/, ".webp");
    }
    return uploadedImage;
  }

  // Specific rank image mappings (6 unique tiers)
  if (slug.includes("rank-hero")) {
    return "/images/store/rank-hero.webp";
  }
  if (slug.includes("rank-veteran")) {
    return "/images/store/rank-veteran.webp";
  }
  if (slug.includes("rank-vip")) {
    return "/images/store/rank-vip.webp";
  }
  if (slug.includes("rank-legend")) {
    return "/images/store/rank-legend.webp";
  }
  if (slug.includes("rank-immortal")) {
    return "/images/store/rank-immortal.webp";
  }
  if (slug.includes("rank-conqueror")) {
    return "/images/store/rank-conqueror.webp";
  }

  // Crate keys
  if (category === "Crate Keys") {
    if (slug.includes("key-vote")) {
      return "/images/store/key-vote.webp";
    }
    if (slug.includes("key-epic")) {
      return "/images/store/key-epic.webp";
    }
    if (slug.includes("key-mystery")) {
      return "/images/store/key-mystery.webp";
    }
    if (slug.includes("key-seasonal")) {
      return "/images/store/key-seasonal.webp";
    }
    if (slug.includes("key-spawner")) {
      return "/images/store/key-spawner.webp";
    }
    if (slug.includes("key-legendary")) {
      return "/images/store/key-legendary.webp";
    }
    return "/images/store/key-crate.webp";
  }

  // Battlepass
  if (category === "Battlepass") {
    if (slug.includes("battlepass-premium")) {
      return "/images/store/battlepass-premium.webp";
    }
    if (slug.includes("battlepass-free-reset")) {
      return "/images/store/battlepass-free-reset.webp";
    }
    return "/images/store/battlepass-pass.webp";
  }

  // Add-ons
  if (slug.includes("addon-xp")) {
    if (slug.includes("addon-xp-500")) {
      return "/images/store/addon-xp-500.webp";
    }
    if (slug.includes("addon-xp-200")) {
      return "/images/store/addon-xp-200.webp";
    }
    if (slug.includes("addon-xp-50")) {
      return "/images/store/addon-xp-50.webp";
    }
    return "/images/store/addon-xp-50.webp";
  }
  if (slug.includes("addon-claim")) {
    if (slug.includes("addon-claim-12000")) {
      return "/images/store/addon-claim-12000.webp";
    }
    if (slug.includes("addon-claim-10000")) {
      return "/images/store/addon-claim-10000.webp";
    }
    if (slug.includes("addon-claim-8000")) {
      return "/images/store/addon-claim-8000.webp";
    }
    if (slug.includes("addon-claim-4000")) {
      return "/images/store/addon-claim-4000.webp";
    }
    if (slug.includes("addon-claim-1000")) {
      return "/images/store/addon-claim-1000.webp";
    }
    return "/images/store/addon-claim-1000.webp";
  }
  if (slug.includes("addon-pp")) {
    if (slug.includes("addon-pp-100")) {
      return "/images/store/addon-pp-100.webp";
    }
    if (slug.includes("addon-pp-50")) {
      return "/images/store/addon-pp-50.webp";
    }
    return "/images/store/addon-pp-50.webp";
  }

  // Fallbacks
  if (category === "Ranks") return "/images/store/rank-conqueror.webp";
  if (category === "Add-ons") return "/images/store/xp-potion.webp";

  return "/images/store/battlepass-pass.webp";
}
