
import React from 'react';
import { UIProvider, useUI } from './UIContext';
import { FileSystemProvider, useFileSystem } from './FileSystemContext';
import { DataProvider, useData } from './DataContext';

// This is a compatibility layer.
// Ideally, components should migrate to useUI, useData, useFileSystem directly to minimize re-renders.

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <UIProvider>
      <FileSystemProvider>
        <DataProvider>
           {children}
        </DataProvider>
      </FileSystemProvider>
    </UIProvider>
  );
};

export const useStore = () => {
  const ui = useUI();
  const fs = useFileSystem();
  const data = useData();

  // Combine all contexts into one object for backward compatibility
  return React.useMemo(() => ({
    ...ui,
    ...fs,
    ...data,
    // Define a global loading state that covers both filesystem permission and data parsing
    isLoading: fs.isLoading || data.isInitialLoading
  }), [ui, fs, data]);
};
