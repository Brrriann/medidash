"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { BodyCategory } from "@/lib/taxonomy/types";
import { BodyMapSvg } from "./BodyMapSvg";
import { BODY_MODEL_URL } from "./anchors";

/**
 * 인체 지도 뷰 스위처.
 * GLB 3D 모델(public/models/body.glb)이 있으면 좌우 회전 3D 뷰어,
 * 없거나 WebGL 실패 시 2D SVG 실루엣으로 폴백한다.
 */

const BodyMap3D = dynamic(() => import("./BodyMap3D"), {
  ssr: false,
  loading: () => <MapLoading />,
});

interface ViewProps {
  categories: BodyCategory[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

export function BodyMapView(props: ViewProps) {
  // null = 확인 중, true = 3D 사용, false = 2D 폴백
  const [use3d, setUse3d] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BODY_MODEL_URL, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setUse3d(res.ok);
      })
      .catch(() => {
        if (!cancelled) setUse3d(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (use3d === null) return <MapLoading />;

  if (!use3d) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <BodyMapSvg {...props} />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          3D 모델 준비 중 — public/models/body.glb 추가 시 회전 뷰어로 전환됩니다
        </p>
      </div>
    );
  }

  return (
    <WebGLBoundary fallback={<BodyMapSvg {...props} />}>
      <BodyMap3D {...props} />
    </WebGLBoundary>
  );
}

function MapLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}

/** WebGL/GLB 로드 실패 시 2D 폴백 */
class WebGLBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
