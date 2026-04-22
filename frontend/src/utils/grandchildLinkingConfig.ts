/**
 * Configuration for linking grandchild files to specific child nodes
 * Maps grandchild file names to their parent child node IDs
 * Child node IDs are in format: child-{motherIndex}-{childIndex}
 */
export const grandchildLinkingConfig: Record<string, string> = {
  'actors_members.xlsx': 'child-0-0', // Link to first child of first mother (actors)
  'city_districts.xlsx': 'child-1-0', // Link to first child of second mother (city)
  'nature_animals.xlsx': 'child-2-0', // Link to first child of third mother (nature)
};
