"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BodyCategory } from "@/lib/taxonomy/types";
import { BODY_MODEL_URL, REGION_ANCHORS } from "./anchors";

/**
 * 3D 인체 뷰어 — GLB 메시(Higgsfield 생성)를 좌우 드래그로 회전.
 * 계통 핫스팟은 svg_region id 기준 앵커(./anchors, 정규화 좌표)로 데이터 기반 배치 —
 * 몸과 함께 회전한다. 'chip'/미정의 영역은 부모(BodyMapExplorer)의 칩이 담당.
 */

function NormalizedModel({ children }: { children?: React.ReactNode }) {
  const { scene } = useGLTF(BODY_MODEL_URL);

  // 바운딩 박스 기준으로 높이 2, 원점 중앙 정규화
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = size.y > 0 ? 2 / size.y : 1;
    return {
      scale: s,
      offset: new THREE.Vector3(-center.x * s, -center.y * s, -center.z * s),
    };
  }, [scene]);

  return (
    <group position={offset.toArray()}>
      <primitive object={scene} scale={scale} />
      {/* 핫스팟은 모델과 같은 그룹 — 회전 시 함께 돈다 */}
      <group scale={1}>{children}</group>
    </group>
  );
}

function HotspotMarker({
  category,
  position,
  selected,
  onSelect,
}: {
  category: BodyCategory;
  position: [number, number, number];
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <button
        type="button"
        title={category.name}
        aria-label={category.name}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(category.slug);
        }}
        /* 링 색은 brand-500(#2a7367)에서 뽑은 값이다. 임의 값 문법(shadow-[…])이라
           토큰을 못 쓰므로 팔레트를 바꾸면 여기도 같이 고쳐야 한다 — 종전 에메랄드
           rgba(16,185,129)가 그대로 남아 지도의 점만 초록으로 튀었다. */
        className={`group relative flex h-5 w-5 -translate-y-0 items-center justify-center rounded-full border-2 transition ${
          selected
            ? "scale-125 border-white bg-brand-500 shadow-[0_0_0_4px_rgba(42,115,103,0.35)]"
            : "border-white bg-brand-400/80 shadow-[0_0_0_3px_rgba(42,115,103,0.2)] hover:scale-110 hover:bg-brand-500"
        }`}
      >
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          {category.name}
        </span>
      </button>
    </Html>
  );
}

/** 첫 인터랙션 전까지 천천히 자동 회전 */
function SlowSpin({
  groupRef,
  active,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  active: boolean;
}) {
  useFrame((_, delta) => {
    if (active && groupRef.current) groupRef.current.rotation.y += delta * 0.25;
  });
  return null;
}

export default function BodyMap3D({
  categories,
  selectedSlug,
  onSelect,
}: {
  categories: BodyCategory[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [interacted, setInteracted] = useState(false);
  const anchored = categories.filter((c) => REGION_ANCHORS[c.svgRegion]);

  // 사용자가 카테고리를 고르면 자동 회전 정지 (핫스팟이 도망가지 않게)
  useEffect(() => {
    if (selectedSlug) setInteracted(true);
  }, [selectedSlug]);

  return (
    <div
      className="h-full w-full cursor-grab active:cursor-grabbing"
      onPointerDown={() => setInteracted(true)}
    >
      <Canvas
        camera={{ position: [0, 0.15, 3.1], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} />
        <directionalLight position={[-3, 1, -2]} intensity={0.5} />

        <Suspense fallback={null}>
          <group ref={groupRef}>
            <NormalizedModel>
              {anchored.map((cat) => (
                <HotspotMarker
                  key={cat.slug}
                  category={cat}
                  position={REGION_ANCHORS[cat.svgRegion]}
                  selected={cat.slug === selectedSlug}
                  onSelect={onSelect}
                />
              ))}
            </NormalizedModel>
          </group>
          <SlowSpin groupRef={groupRef} active={!interacted} />
        </Suspense>

        {/* 좌우 회전만 허용 — 상하 고정·줌/팬 비활성 */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          rotateSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(BODY_MODEL_URL);
