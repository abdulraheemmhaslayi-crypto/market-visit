export interface PowerSkuDefinition {
  skuCode: string;
  skuName: string;
  channel: 'MT' | 'TT';
  skuType?: string;
  businessVertical: 'Dairy' | 'Ice Cream' | 'Beverage';
}

/**
 * Canonical MT Power SKUs (Strictly 24 Items) - matches official Master List
 */
export const MT_POWER_SKUS: PowerSkuDefinition[] = [
  { skuCode: 'FGDYC120', skuName: 'YOGHURT FC 170GMX6 -SLEEVES', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLS202', skuName: 'LABAN SHARAB 225 MLX12', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDYC122', skuName: 'FRESH YOGHURT NEW TASTE170GMX6 -SLEEVES', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDYC121', skuName: 'YOGHURT LF 170GMX6 -SLEEVES', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDYF153', skuName: 'YOGHURT 2 K.G', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLS210', skuName: 'LABAN SHARAB SWEET - LASSI 225ML X 12', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDYF151', skuName: 'YOGHURT 1 KG.', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLF217', skuName: 'FRESH LABAN 180 ML PET BOTTLE', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLA242', skuName: 'LABAN AIRAN 180ML PET', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGJFR351', skuName: 'FRUTTI CUP 225 ML - FLAMTU', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFR352', skuName: 'FRUTTI CUP 225 ML - ORANGE', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFP333', skuName: 'MANGO NECTAR 1.35 LTR', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFP334', skuName: 'MIXED BERRY NECTAR 1.35 LTR', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFP331', skuName: 'LEMON & MINT DRINK 1.35 LTR', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFP328', skuName: 'APPLE JUICE 1.35 LTR 100%', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJFP336', skuName: 'MIXED FRUIT NECTAR 1.35 LTR', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGISW942', skuName: 'SANDWICH FAMILY PACK 100 ML X6', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST906', skuName: 'ALMOND DELIGHT 100 ML X 6 PCS', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIBT601', skuName: 'BON BON 17MLX14  238 ML X 1', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST909', skuName: 'ICE CREAM 50:50 NUS NUS 100MLX6', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGICO820', skuName: 'ICE CREAM CHOCOLATE CONE 110ML 1X6 FP', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGICO821', skuName: 'ICE CREAM VANILA CONE 110ML 1X6 FP', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIFP542', skuName: 'ICE CREAM SCOTCH VANILLA 1 LTR', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST911', skuName: 'PEANUT DELIGHT 100 ML X 6', channel: 'MT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
];

/**
 * Canonical TT Power SKUs (Strictly 22 Items) - matches official Master List
 */
export const TT_POWER_SKUS: PowerSkuDefinition[] = [
  { skuCode: 'FGICU519', skuName: 'ICE CREAM SCOTCH VANILLA 125ML 1X27', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIFP542', skuName: 'ICE CREAM SCOTCH VANILLA 1 LTR', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGICO821 / FGICO806', skuName: 'ICE CREAM VANILA CONE 110ML 1X6 FP / ICE CREAM VANILA CONE 110ML 1X20', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGICO820 / FGICO803', skuName: 'ICE CREAM CHOCOLATE CONE 110ML 1X6 FP / ICE CREAM CHOCOLATE CONE 110ML 1X20', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST911 / FGIST903', skuName: 'PEANUT DELIGHT 100 ML X 6 / PEANUT DELIGHT - 100 ML X 16', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGISW942 / FGISW941', skuName: 'SANDWICH FAMILY PACK 100 ML X6 / ICE CREAM SANDWITCH 100MLX24', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST906 / FGIST905', skuName: 'ALMOND DELIGHT 100 ML X 6 PCS / ALMOND DELIGHT 100 ML X 16', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGIST912', skuName: 'CHOCOBAR PLAIN 60 ML X 24', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Ice Cream' },
  { skuCode: 'FGJFR352', skuName: 'FRUTTI CUP 225 ML - ORANGE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS425', skuName: 'LEMON & MINT 200 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS413', skuName: 'MANGO NECTAR 200 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS414', skuName: 'MIXED FRUIT 200 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS412', skuName: 'APPLE JUICE 200 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS417', skuName: 'MIXED BERRY 200 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGJSS439', skuName: 'WATERMELON DRINK 200 ML', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Beverage' },
  { skuCode: 'FGDLS210', skuName: 'LABAN SHARAB SWEET - LASSI 225ML X 12', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDYC111 / FGDYC120', skuName: 'YOGHURT FC 170GMX6 / YOGHURT FC 170GMX6 -SLEEVES', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLS202', skuName: 'LABAN SHARAB 225 MLX12', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLF217', skuName: 'FRESH LABAN 180 ML PET BOTTLE', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLA242', skuName: 'LABAN AIRAN 180ML PET', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLA236', skuName: 'LABAN STRAWBERRY 180 ML X 1', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
  { skuCode: 'FGDLA237', skuName: 'LABAN MANGO 180 ML X 1', channel: 'TT', skuType: 'Power Sku', businessVertical: 'Dairy' },
];

export const ALL_CANONICAL_POWER_SKUS: PowerSkuDefinition[] = [
  ...MT_POWER_SKUS,
  ...TT_POWER_SKUS,
];

// Helper to expand slash codes into a Set of individual and full codes
function expandCodes(skus: PowerSkuDefinition[]): Set<string> {
  const set = new Set<string>();
  for (const s of skus) {
    const raw = s.skuCode.toUpperCase().trim();
    set.add(raw);
    if (raw.includes('/')) {
      raw.split('/').forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) set.add(trimmed);
      });
    }
  }
  return set;
}

export const MT_POWER_SKU_CODES = expandCodes(MT_POWER_SKUS);
export const TT_POWER_SKU_CODES = expandCodes(TT_POWER_SKUS);

export function getCanonicalPowerSkusForChannel(channel?: string | null): PowerSkuDefinition[] {
  const norm = String(channel || '').trim().toUpperCase();
  if (
    norm === 'MT' ||
    norm.startsWith('MT') ||
    norm.includes('MODERN') ||
    norm === 'KEY ACCOUNT' ||
    norm.includes('HYPER')
  ) {
    return MT_POWER_SKUS;
  }
  return TT_POWER_SKUS;
}
