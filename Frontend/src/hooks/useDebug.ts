import { useState, useCallback } from 'react';

/**
 * Custom hook to force component re-render
 * Useful for debugging state issues or forcing updates
 */
export const useForceUpdate = () => {
  const [, updateState] = useState<object>();
  const forceUpdate = useCallback(() => updateState({}), []);
  return forceUpdate;
};

/**
 * Custom hook to debug component renders
 * Logs whenever the component re-renders with the reason
 */
export const useRenderLogger = (componentName: string, props?: any) => {
  console.log(`[Render] ${componentName} rendered`, props ? { props } : '');
};

/**
 * Hook to check if component is mounting for the first time
 */
export const useIsFirstRender = () => {
  const [isFirst, setIsFirst] = useState(true);
  if (isFirst) {
    setIsFirst(false);
    return true;
  }
  return false;
};
