import * as THREE from 'three';

/**
 * 3D Lighting System
 * Configurable and extensible lighting for professional 3D visualization
 */

export interface LightingConfig {
  ambient: {
    intensity: number; // 0.0 - 1.0
    color: number; // Hex color
  };
  directional: {
    intensity: number;
    color: number;
    position: { x: number; y: number; z: number };
    castShadow: boolean;
    shadowMapSize?: number;
  };
  hemisphere?: {
    skyColor: number;
    groundColor: number;
    intensity: number;
  };
}

export interface LightingSystem {
  lights: Map<string, THREE.Light>;
  config: LightingConfig;
}

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  ambient: { intensity: 0.6, color: 0xffffff },
  directional: {
    intensity: 0.8,
    color: 0xffffff,
    position: { x: 10, y: 10, z: 10 },
    castShadow: true,
    shadowMapSize: 2048
  }
};

/**
 * Create a complete lighting system for the 3D scene
 */
export function createLightingSystem(
  scene: THREE.Scene,
  config: LightingConfig = DEFAULT_LIGHTING_CONFIG
): LightingSystem {
  const lights = new Map<string, THREE.Light>();

  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(
    config.ambient.color,
    config.ambient.intensity
  );
  scene.add(ambientLight);
  lights.set('ambient', ambientLight);

  // Directional light for depth and shadows
  const directionalLight = new THREE.DirectionalLight(
    config.directional.color,
    config.directional.intensity
  );
  directionalLight.position.set(
    config.directional.position.x,
    config.directional.position.y,
    config.directional.position.z
  );
  directionalLight.castShadow = config.directional.castShadow;

  if (config.directional.castShadow) {
    const shadowMapSize = config.directional.shadowMapSize || 2048;
    directionalLight.shadow.mapSize.width = shadowMapSize;
    directionalLight.shadow.mapSize.height = shadowMapSize;
    directionalLight.shadow.camera.far = 50;
  }

  scene.add(directionalLight);
  lights.set('directional', directionalLight);

  // Optional hemisphere light for more natural outdoor lighting
  if (config.hemisphere) {
    const hemisphereLight = new THREE.HemisphereLight(
      config.hemisphere.skyColor,
      config.hemisphere.groundColor,
      config.hemisphere.intensity
    );
    scene.add(hemisphereLight);
    lights.set('hemisphere', hemisphereLight);
  }

  return {
    lights,
    config
  };
}

/**
 * Update lighting configuration
 */
export function updateLighting(
  system: LightingSystem,
  scene: THREE.Scene,
  newConfig: Partial<LightingConfig>
): void {
  const config = { ...system.config, ...newConfig };

  // Update ambient light
  if (newConfig.ambient) {
    const ambientLight = system.lights.get('ambient');
    if (ambientLight instanceof THREE.AmbientLight) {
      ambientLight.color.setHex(newConfig.ambient.color ?? config.ambient.color);
      ambientLight.intensity = newConfig.ambient.intensity ?? config.ambient.intensity;
    }
  }

  // Update directional light
  if (newConfig.directional) {
    const directionalLight = system.lights.get('directional');
    if (directionalLight instanceof THREE.DirectionalLight) {
      directionalLight.color.setHex(newConfig.directional.color ?? config.directional.color);
      directionalLight.intensity = newConfig.directional.intensity ?? config.directional.intensity;

      if (newConfig.directional.position) {
        const pos = newConfig.directional.position;
        directionalLight.position.set(pos.x, pos.y, pos.z);
      }
    }
  }

  // Update hemisphere light if present
  if (newConfig.hemisphere) {
    let hemisphereLight = system.lights.get('hemisphere');
    if (!hemisphereLight && newConfig.hemisphere) {
      hemisphereLight = new THREE.HemisphereLight(
        newConfig.hemisphere.skyColor ?? 0xffffff,
        newConfig.hemisphere.groundColor ?? 0xffffff,
        newConfig.hemisphere.intensity ?? 0.5
      );
      scene.add(hemisphereLight);
      system.lights.set('hemisphere', hemisphereLight);
    } else if (hemisphereLight instanceof THREE.HemisphereLight) {
      hemisphereLight.color.setHex(newConfig.hemisphere.skyColor ?? config.hemisphere?.skyColor ?? 0xffffff);
      hemisphereLight.groundColor.setHex(newConfig.hemisphere.groundColor ?? config.hemisphere?.groundColor ?? 0xffffff);
      hemisphereLight.intensity = newConfig.hemisphere.intensity ?? config.hemisphere?.intensity ?? 0.5;
    }
  }

  system.config = config;
}

/**
 * Dispose of all lights in the system
 */
export function disposeLighting(
  system: LightingSystem,
  scene: THREE.Scene
): void {
  for (const [, light] of system.lights) {
    scene.remove(light);

    // Dispose shadow map if it exists
    if ('shadow' in light && light.shadow?.map) {
      light.shadow.map.dispose();
    }
  }

  system.lights.clear();
}
