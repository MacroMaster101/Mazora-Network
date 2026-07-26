import type { Product } from "@/lib/types";

export function storeArtFor(
  itemOrCategory?: Product["category"] | { slug: string; category?: Product["category"]; imageUrl?: string | null }
): string {
  if (!itemOrCategory) return "/images/store/battlepass-pass.png";

  if (typeof itemOrCategory === "string") {
    const category = itemOrCategory;
    if (category === "Ranks") return "/images/store/rank-conqueror.png";
    if (category === "Crate Keys") return "/images/store/key-crate.png";
    if (category === "Battlepass") return "/images/store/battlepass-pass.png";
    if (category === "Add-ons") return "/images/store/xp-potion.png";
    return "/images/store/battlepass-pass.png";
  }

  const { slug, category } = itemOrCategory;
  const uploadedImage = itemOrCategory.imageUrl?.trim();
  if (uploadedImage) return uploadedImage;

  // Specific rank image mappings (6 unique tiers)
  if (slug.includes("rank-hero")) {
    return "/images/store/rank-hero.png";
  }
  if (slug.includes("rank-veteran")) {
    return "/images/store/rank-veteran.png";
  }
  if (slug.includes("rank-vip")) {
    return "/images/store/rank-vip.png";
  }
  if (slug.includes("rank-legend")) {
    return "/images/store/rank-legend.png";
  }
  if (slug.includes("rank-immortal")) {
    return "/images/store/rank-immortal.png";
  }
  if (slug.includes("rank-conqueror")) {
    return "/images/store/rank-conqueror.png";
  }

  // Crate keys
  if (category === "Crate Keys") {
    if (slug.includes("key-vote")) {
      return "/images/store/key-vote.png";
    }
    if (slug.includes("key-epic")) {
      return "/images/store/key-epic.png";
    }
    if (slug.includes("key-mystery")) {
      return "/images/store/key-mystery.png";
    }
    if (slug.includes("key-seasonal")) {
      return "/images/store/key-seasonal.png";
    }
    if (slug.includes("key-spawner")) {
      return "/images/store/key-spawner.png";
    }
    if (slug.includes("key-legendary")) {
      return "/images/store/key-legendary.png";
    }
    return "/images/store/key-crate.png";
  }

  // Battlepass
  if (category === "Battlepass") {
    if (slug.includes("battlepass-premium")) {
      return "/images/store/battlepass-premium.png";
    }
    if (slug.includes("battlepass-free-reset")) {
      return "/images/store/battlepass-free-reset.png";
    }
    return "/images/store/battlepass-pass.png";
  }

  // Add-ons
  if (slug.includes("addon-xp")) {
    if (slug.includes("addon-xp-500")) {
      return "/images/store/addon-xp-500.png";
    }
    if (slug.includes("addon-xp-200")) {
      return "/images/store/addon-xp-200.png";
    }
    if (slug.includes("addon-xp-50")) {
      return "/images/store/addon-xp-50.png";
    }
    return "/images/store/addon-xp-50.png";
  }
  if (slug.includes("addon-claim")) {
    if (slug.includes("addon-claim-12000")) {
      return "/images/store/addon-claim-12000.png";
    }
    if (slug.includes("addon-claim-10000")) {
      return "/images/store/addon-claim-10000.png";
    }
    if (slug.includes("addon-claim-8000")) {
      return "/images/store/addon-claim-8000.png";
    }
    if (slug.includes("addon-claim-4000")) {
      return "/images/store/addon-claim-4000.png";
    }
    if (slug.includes("addon-claim-1000")) {
      return "/images/store/addon-claim-1000.png";
    }
    return "/images/store/addon-claim-1000.png";
  }
  if (slug.includes("addon-pp")) {
    if (slug.includes("addon-pp-100")) {
      return "/images/store/addon-pp-100.png";
    }
    if (slug.includes("addon-pp-50")) {
      return "/images/store/addon-pp-50.png";
    }
    return "/images/store/addon-pp-50.png";
  }

  // Fallbacks
  if (category === "Ranks") return "/images/store/rank-conqueror.png";
  if (category === "Add-ons") return "/images/store/xp-potion.png";

  return "/images/store/battlepass-pass.png";
}

/** Map weapon bundle display names to processed artwork */
export const storeCategoryDetails: Record<
  Product["category"],
  { eyebrow: string; description: string }
> = {
  Ranks: {
    eyebrow: "Stand out",
    description: "Six Survival ranks, each available monthly or permanently.",
  },
  "Crate Keys": {
    eyebrow: "Unlock rewards",
    description: "Vote, Epic, Mystery, Seasonal, Spawner and Legendary key packs.",
  },
  Battlepass: {
    eyebrow: "Season progression",
    description: "Unlock the premium reward track or reset the free battlepass.",
  },
  "Add-ons": {
    eyebrow: "Boost your world",
    description: "XP, Claim Blocks and Player Points for your Survival journey.",
  },
};
