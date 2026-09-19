import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useDashboardTab(defaultTab, aliases = {}) {
  const location = useLocation();
  const tabFromPath = () => {
    const segment = location.pathname.split('/').filter(Boolean).pop();
    return aliases[segment] || (segment === 'dashboard' ? defaultTab : segment);
  };
  const [activeTab, setActiveTab] = useState(tabFromPath);

  useEffect(() => {
    setActiveTab(tabFromPath());
  }, [location.pathname]);

  return [activeTab, setActiveTab];
}
