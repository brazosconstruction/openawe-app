import React, { createContext, useContext, useState, useCallback } from 'react';

interface AppContextValue {
  isPaired: boolean;
  setIsPaired: (paired: boolean) => void;
}

const AppContext = createContext<AppContextValue>({
  isPaired: false,
  setIsPaired: () => {},
});

export function AppProvider({
  children,
  initialPaired,
}: {
  children: React.ReactNode;
  initialPaired: boolean;
}) {
  const [isPaired, setIsPairedState] = useState(initialPaired);

  const setIsPaired = useCallback((paired: boolean) => {
    setIsPairedState(paired);
  }, []);

  return (
    <AppContext.Provider value={{ isPaired, setIsPaired }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export default AppContext;
