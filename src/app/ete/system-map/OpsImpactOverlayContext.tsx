'use client';

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type OpsImpactOverlayContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  activeNodeId: string | null;
  setHoveredNodeId: (nodeId: string | null) => void;
  togglePinnedNodeId: (nodeId: string) => void;
  pinnedNodeId: string | null;
};

const OpsImpactOverlayContext = createContext<OpsImpactOverlayContextValue | null>(null);

export function OpsImpactOverlayProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHoveredNodeId(null);
      setPinnedNodeId(null);
    }
  }, [enabled]);

  const value = useMemo<OpsImpactOverlayContextValue>(
    () => ({
      enabled,
      setEnabled,
      activeNodeId: pinnedNodeId ?? hoveredNodeId,
      setHoveredNodeId,
      togglePinnedNodeId: (nodeId: string) => setPinnedNodeId((current) => (current === nodeId ? null : nodeId)),
      pinnedNodeId,
    }),
    [enabled, hoveredNodeId, pinnedNodeId],
  );

  return <OpsImpactOverlayContext.Provider value={value}>{children}</OpsImpactOverlayContext.Provider>;
}

export function useOpsImpactOverlay() {
  const context = useContext(OpsImpactOverlayContext);

  if (!context) {
    throw new Error("useOpsImpactOverlay must be used within an OpsImpactOverlayProvider");
  }

  return context;
}
