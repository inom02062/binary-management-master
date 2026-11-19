import { RotateCcw } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Block } from '../types';

export interface Map3DSettings {
  widthScale: number;
  depthScale: number;
  floorHeightScale: number;
  showFloorLines: boolean;
  showShadows: boolean;
  showFloorCount: boolean;
}

interface Map3DViewProps {
  blocks: Block[];
  settings: Map3DSettings;
  lang: 'ru' | 'en' | 'uz';
  theme: 'light' | 'dark';
  onBlockClick?: (blockId: string, floor?: number) => void;
}

const resetLabels = { en: 'Reset camera', ru: 'Сбросить камеру', uz: 'Kamerani tiklash' };

export const Map3DView: React.FC<Map3DViewProps> = ({ blocks, settings, lang, theme, onBlockClick }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onBlockClickRef = useRef(onBlockClick);
  const cameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const resetCameraRef = useRef<() => void>(() => undefined);
  onBlockClickRef.current = onBlockClick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const sceneColor = theme === 'dark' ? '#111a23' : '#e9eef3';
    scene.background = new THREE.Color(sceneColor);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = settings.showShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const minX = blocks.length ? Math.min(...blocks.map(block => block.x)) : 0;
    const minZ = blocks.length ? Math.min(...blocks.map(block => block.y)) : 0;
    const maxX = blocks.length ? Math.max(...blocks.map(block => block.x + block.width)) : 800;
    const maxZ = blocks.length ? Math.max(...blocks.map(block => block.y + block.height)) : 600;
    const mapScale = 0.035;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const mapWidth = Math.max(12, (maxX - minX) * mapScale * settings.widthScale + 12);
    const mapDepth = Math.max(12, (maxZ - minZ) * mapScale * settings.depthScale + 12);
    const floorHeight = 0.56 * settings.floorHeightScale;
    const tallestBuilding = Math.max(1, ...blocks.map(block => Math.max(1, Math.round(block.floorsCount)))) * floorHeight;
    const sceneSize = Math.max(mapWidth, mapDepth, tallestBuilding, 14);
    scene.fog = new THREE.Fog(sceneColor, sceneSize * 1.8, sceneSize * 5.5);

    scene.add(new THREE.HemisphereLight('#ffffff', '#8a9a86', 2.1));
    const sunlight = new THREE.DirectionalLight('#fff7e8', 3.2);
    sunlight.position.set(-12, 24, 14);
    sunlight.castShadow = settings.showShadows;
    sunlight.shadow.mapSize.set(2048, 2048);
    scene.add(sunlight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapDepth),
      new THREE.MeshStandardMaterial({ color: theme === 'dark' ? '#202e34' : '#dce6df', roughness: 0.94 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(
      Math.max(mapWidth, mapDepth),
      Math.ceil(Math.max(mapWidth, mapDepth) * 2),
      theme === 'dark' ? '#637c75' : '#9eafa5',
      theme === 'dark' ? '#354a48' : '#c4d0c8'
    );
    grid.position.y = -0.06;
    scene.add(grid);

    const buildingMeshes: THREE.Mesh[] = [];
    blocks.forEach(block => {
      const width = Math.max(0.8, block.width * mapScale * settings.widthScale);
      const depth = Math.max(0.8, block.height * mapScale * settings.depthScale);
      const floorCount = Math.max(1, Math.min(80, Math.round(block.floorsCount)));
      const buildingHeight = floorCount * floorHeight;
      const x = (block.x + block.width / 2 - centerX) * mapScale * settings.widthScale;
      const z = (block.y + block.height / 2 - centerZ) * mapScale * settings.depthScale;
      const baseColor = new THREE.Color(block.color || '#3b82f6');
      const wallMaterial = (color: THREE.Color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
      const floorMaterials = [
        wallMaterial(baseColor.clone().multiplyScalar(0.72)),
        wallMaterial(baseColor.clone().multiplyScalar(0.82)),
        wallMaterial(baseColor.clone().multiplyScalar(1.12)),
        wallMaterial(baseColor.clone().multiplyScalar(0.55)),
        wallMaterial(baseColor.clone().multiplyScalar(0.9)),
        wallMaterial(baseColor.clone().multiplyScalar(0.68)),
      ];
      for (let floor = 1; floor <= floorCount; floor += 1) {
        const floorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, Math.max(0.12, floorHeight - 0.045), depth),
          floorMaterials.map(material => material.clone())
        );
        floorMesh.position.set(x, (floor - 0.5) * floorHeight, z);
        floorMesh.castShadow = settings.showShadows;
        floorMesh.receiveShadow = true;
        floorMesh.userData.blockId = block.id;
        floorMesh.userData.floor = floor;
        scene.add(floorMesh);
        buildingMeshes.push(floorMesh);
      }
      floorMaterials.forEach(material => material.dispose());

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.12, 0.1, depth + 0.12),
        new THREE.MeshStandardMaterial({ color: baseColor.clone().multiplyScalar(1.18), roughness: 0.68 })
      );
      roof.position.set(x, buildingHeight + 0.05, z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      scene.add(roof);

      if (settings.showFloorLines) {
          const floorLine = new THREE.MeshStandardMaterial({ color: baseColor.clone().multiplyScalar(0.58), roughness: 0.82 });
          for (let floor = 1; floor < floorCount; floor += 1) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.055, 0.035, depth + 0.055), floorLine);
            slab.position.set(x, floor * floorHeight, z);
            slab.castShadow = settings.showShadows;
            slab.receiveShadow = true;
            scene.add(slab);
          }
      }

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512;
      labelCanvas.height = 128;
      const context = labelCanvas.getContext('2d');
      if (context) {
        context.fillStyle = theme === 'dark' ? 'rgba(18, 27, 36, 0.94)' : 'rgba(255, 255, 255, 0.92)';
        context.beginPath();
        context.roundRect(8, 8, 496, 112, 18);
        context.fill();
        context.fillStyle = theme === 'dark' ? '#f1f5f9' : '#17212b';
        context.font = 'bold 38px sans-serif';
        context.textAlign = 'center';
        context.fillText(block.name.slice(0, 24), 256, 56, 460);
        if (settings.showFloorCount) {
          context.fillStyle = theme === 'dark' ? '#b9c8d4' : '#536472';
          context.font = 'bold 24px sans-serif';
          context.fillText(`${floorCount} ${lang === 'uz' ? 'QAVAT' : lang === 'ru' ? 'ЭТАЖЕЙ' : 'FLOORS'}`, 256, 92);
        }
      }
      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
      const labelWidth = Math.max(2.2, Math.min(5, width * 1.2));
      label.scale.set(labelWidth, labelWidth / 4, 1);
      label.position.set(x, buildingHeight + 0.85, z);
      scene.add(label);
    });

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, sceneSize * 20);
    const viewDistance = sceneSize * 1.25;
    const initialPosition = new THREE.Vector3(viewDistance * 0.82, viewDistance * 0.92, viewDistance * 0.92);
    camera.position.copy(cameraStateRef.current?.position ?? initialPosition);
    camera.lookAt(cameraStateRef.current?.target ?? new THREE.Vector3(0, tallestBuilding / 2, 0));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(cameraStateRef.current?.target ?? new THREE.Vector3(0, tallestBuilding / 2, 0));
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = sceneSize * 12;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.update();
    resetCameraRef.current = () => {
      camera.position.copy(initialPosition);
      controls.target.set(0, tallestBuilding / 2, 0);
      controls.update();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number } | null = null;
    let hoveredFloor: THREE.Mesh | null = null;
    const updateFloorHover = (nextFloor: THREE.Mesh | null) => {
      if (hoveredFloor === nextFloor) return;
      if (hoveredFloor) {
        const materials = Array.isArray(hoveredFloor.material) ? hoveredFloor.material : [hoveredFloor.material];
        materials.forEach(material => {
          if (material instanceof THREE.MeshStandardMaterial) material.emissive.set('#000000');
        });
      }
      hoveredFloor = nextFloor;
      if (hoveredFloor) {
        const materials = Array.isArray(hoveredFloor.material) ? hoveredFloor.material : [hoveredFloor.material];
        materials.forEach(material => {
          if (material instanceof THREE.MeshStandardMaterial) material.emissive.set('#234a64');
        });
      }
      renderer.domElement.style.cursor = hoveredFloor ? 'pointer' : 'grab';
    };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      updateFloorHover((raycaster.intersectObjects(buildingMeshes)[0]?.object as THREE.Mesh | undefined) ?? null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      pointerStart = null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(buildingMeshes)[0];
      if (hit?.object.userData.blockId) onBlockClickRef.current?.(hit.object.userData.blockId, hit.object.userData.floor);
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(host);

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      controls.update();
      cameraStateRef.current = { position: camera.position.clone(), target: controls.target.clone() };
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      scene.traverse(object => {
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        } else if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [blocks, settings, lang, theme]);

  return (
    <div ref={hostRef} className="absolute inset-0 touch-none" aria-label="3D building map">
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200">
        {settings.showFloorCount
          ? `${blocks.length} · ${blocks.reduce((total, block) => total + Math.max(1, Math.round(block.floorsCount)), 0)} ${lang === 'uz' ? 'qavat' : lang === 'ru' ? 'этажей' : 'floors'}`
          : `${blocks.length} ${lang === 'uz' ? 'bino' : lang === 'ru' ? 'зданий' : 'buildings'}`}
      </div>
      <button
        type="button"
        onClick={() => resetCameraRef.current()}
        title={resetLabels[lang]}
        aria-label={resetLabels[lang]}
        className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <RotateCcw size={17} />
      </button>
    </div>
  );
};