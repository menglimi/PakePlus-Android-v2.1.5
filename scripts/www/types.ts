
export * from './types/property';
export * from './types/customer';
export * from './types/marketing';
export * from './types/finance';
export * from './types/system';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}
