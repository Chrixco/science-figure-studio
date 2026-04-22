import { parseBaubleExcelFile } from './baubleExcelParser';
import { LoadedBaubleFile } from '../types/bauble';
import { grandchildLinkingConfig } from './grandchildLinkingConfig';

/**
 * Load default bauble files from the public/data folder
 * Includes both root mother files and grandchild files with automatic linking
 */
export async function loadDefaultBaubleFiles(): Promise<LoadedBaubleFile[]> {
  const motherFiles = ['actors.xlsx', 'city.xlsx', 'nature.xlsx'];
  const grandchildFiles = ['actors_members.xlsx', 'city_districts.xlsx', 'nature_animals.xlsx'];
  const loadedFiles: LoadedBaubleFile[] = [];

  // Load mother files
  for (const fileName of motherFiles) {
    try {
      const response = await fetch(`/data/${fileName}`);
      if (!response.ok) {
        console.warn(`Failed to load ${fileName}: ${response.statusText}`);
        continue;
      }

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const result = await parseBaubleExcelFile(file);
      if (result) {
        loadedFiles.push(result.result);
      }
    } catch (error) {
      console.warn(`Error loading ${fileName}:`, error);
    }
  }

  // Load grandchild files with parent linking
  for (const fileName of grandchildFiles) {
    try {
      const response = await fetch(`/data/${fileName}`);
      if (!response.ok) {
        console.warn(`Failed to load ${fileName}: ${response.statusText}`);
        continue;
      }

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const result = await parseBaubleExcelFile(file);
      if (result) {
        const loadedFile = result.result;
        // Apply grandchild linking if configured
        if (grandchildLinkingConfig[fileName]) {
          loadedFile.parentChildNodeId = grandchildLinkingConfig[fileName];
        }
        loadedFiles.push(loadedFile);
      }
    } catch (error) {
      console.warn(`Error loading ${fileName}:`, error);
    }
  }

  return loadedFiles;
}
