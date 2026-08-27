/**
 * Asset Category and Size/Model Configuration
 */

export const ASSET_CATEGORIES: string[] = ['Chillers', 'Freezers', 'Assets'];

export const CATEGORY_SIZE_MODELS_MAP: Record<string, string[]> = {
  Chillers: ['Double Door', 'Open Chiller', 'Single Door'],
  Chiller: ['Double Door', 'Open Chiller', 'Single Door'],
  Freezers: ['100', '300', '400', '600', 'VERTICAL'],
  Freezer: ['100', '300', '400', '600', 'VERTICAL'],
  Assets: ['Standard Asset', 'Custom Display Rack', 'Counter Chiller'],
  All: [
    'Double Door',
    'Open Chiller',
    'Single Door',
    '100',
    '300',
    '400',
    '600',
    'VERTICAL',
    'Standard Asset',
    'Custom Display Rack',
    'Counter Chiller',
  ],
};

/**
 * Returns available Size/Model options for a given Asset Category.
 * When "Chillers" is selected, returns ['Double Door', 'Open Chiller', 'Single Door'].
 * When changed to another category (e.g. Freezers), updates to that category's configuration.
 */
export function getSizeModelsForCategory(category: string): string[] {
  if (!category || category === 'All' || category === 'All Categories') {
    return CATEGORY_SIZE_MODELS_MAP.All;
  }
  const matchKey = Object.keys(CATEGORY_SIZE_MODELS_MAP).find(
    (key) => key.toLowerCase() === category.toLowerCase().trim()
  );
  return matchKey ? CATEGORY_SIZE_MODELS_MAP[matchKey] : CATEGORY_SIZE_MODELS_MAP.All;
}
