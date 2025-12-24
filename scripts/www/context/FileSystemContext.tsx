
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { saveHandle, getHandle, dbSet, dbGet, compressImage } from '../utils';
import { useUI } from './UIContext';

interface FileSystemContextType {
  rootHandle: FileSystemDirectoryHandle | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  persistedHandleAvailable: boolean;
  initFileSystem: (usePersisted?: boolean) => Promise<void>;
  saveJson: (dirHandle: FileSystemDirectoryHandle, filename: string, data: any) => Promise<void>;
  readJson: (dirHandle: FileSystemDirectoryHandle, filename: string) => Promise<any>;
  uploadAsset: (propId: string, file: File) => Promise<string | null>;
  getAssetUrl: (filename: string) => Promise<string | null>;
  getDirectoryHandle: (name: string, create?: boolean) => Promise<FileSystemDirectoryHandle | null>;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useUI();
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedHandleAvailable, setPersistedHandleAvailable] = useState(false);
  
  // 核心锁：防止并发初始化冲突的底层物理锁
  const initInProgressRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    const checkPersisted = async () => {
        try {
            const h = await getHandle();
            if (h && isMountedRef.current) {
                setPersistedHandleAvailable(true);
            }
        } catch (err) {
            console.warn("Check persisted handle failed", err);
        }
    };
    checkPersisted();
    return () => { isMountedRef.current = false; };
  }, []);

  const initFileSystem = useCallback(async (usePersisted = false) => {
    // 严格检查锁，防止在 showDirectoryPicker 异步等待期间重复触发导致弹窗循环
    if (initInProgressRef.current) {
        console.log("[FileSystem] 核心系统初始化已在进行中，忽略重复调用。");
        return;
    }
    
    console.log("[FileSystem] 启动初始化序列...", { usePersisted });
    initInProgressRef.current = true;
    setError(null);
    setIsLoading(true);
    
    try {
      // 检查浏览器 API 支持
      if (!('showDirectoryPicker' in window)) {
           console.log("[FileSystem] 环境不支持 DirectoryPicker，回退至 IDB 模式");
           setRootHandle(null);
           if (isMountedRef.current) {
               setIsReady(true);
               showToast("系统已进入移动端 IndexedDB 存储模式", 'info');
           }
           setIsLoading(false);
           initInProgressRef.current = false;
           return;
      }
      
      let handle: FileSystemDirectoryHandle;
      if (usePersisted) {
         const persisted = await getHandle();
         if (!persisted) {
             throw new Error("未找到之前使用的本地文件夹");
         }
         
         // @ts-ignore
         const perm = await persisted.requestPermission({ mode: 'readwrite' });
         if (perm !== 'granted') {
             throw new Error("文件夹访问授权失败，请重新选择");
         }
         handle = persisted;
      } else {
         // @ts-ignore
         handle = await window.showDirectoryPicker();
      }
      
      if (isMountedRef.current) {
          setRootHandle(handle);
          await saveHandle(handle); 
          setPersistedHandleAvailable(true);
          setIsReady(true);
          console.log("[FileSystem] 核心通道建立成功");
          showToast("本地核心数据通道已建立");
      }
    } catch (e: any) {
      // 静默处理用户取消操作
      if (e.name === 'AbortError') {
          console.log("[FileSystem] 用户取消了文件夹选择器。");
      } else {
          console.error("[FileSystem] 初始化异常:", e);
          if (isMountedRef.current) {
            setError(e.message);
            showToast(e.message, 'error');
          }
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
      // 适当延迟释放锁，确保 React 状态同步周期已完成
      setTimeout(() => { 
        initInProgressRef.current = false; 
        console.log("[FileSystem] 释放初始化锁");
      }, 500);
    }
  }, [showToast]);

  const saveJson = useCallback(async (dirHandle: FileSystemDirectoryHandle, filename: string, data: any) => {
    try {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    } catch (e) {
        console.error(`[FileSystem] 保存文件失败: ${filename}`, e);
        throw e;
    }
  }, []);
  
  const readJson = useCallback(async (dirHandle: FileSystemDirectoryHandle, filename: string) => {
      try {
          const fileHandle = await dirHandle.getFileHandle(filename);
          const file = await fileHandle.getFile();
          const text = await file.text();
          return JSON.parse(text);
      } catch(e) { 
          return null; 
      }
  }, []);

  const getDirectoryHandle = useCallback(async (name: string, create = true) => {
      if (!rootHandle) return null;
      try {
          return await rootHandle.getDirectoryHandle(name, { create });
      } catch (e) { 
          return null; 
      }
  }, [rootHandle]);

  const uploadAsset = useCallback(async (propId: string, file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const filename = `${propId}_${Date.now()}.${ext}`;
    let fileToSave = file;
    if (file.type.startsWith('image/')) {
        try { fileToSave = await compressImage(file); } catch(e) {}
    }
    if (!rootHandle) {
        try {
            await dbSet('assets', fileToSave, filename);
            return filename;
        } catch (e) { return null; }
    }
    try {
      const assetsDir = await rootHandle.getDirectoryHandle('assets', { create: true });
      const fileHandle = await assetsDir.getFileHandle(filename, { create: true });
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      await writable.write(fileToSave);
      await writable.close();
      return filename;
    } catch (e) { return null; }
  }, [rootHandle]);

  const getAssetUrl = useCallback(async (filename: string): Promise<string | null> => {
    if (!filename) return null;
    if (!rootHandle) {
        const blob = await dbGet('assets', filename);
        return blob instanceof Blob ? URL.createObjectURL(blob) : null;
    }
    try {
      const assetsDir = await rootHandle.getDirectoryHandle('assets', { create: true });
      const fileHandle = await assetsDir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) { return null; }
  }, [rootHandle]);

  const value = useMemo(() => ({ 
      rootHandle, isReady, isLoading, error, persistedHandleAvailable, initFileSystem, 
      saveJson, readJson, uploadAsset, getAssetUrl, getDirectoryHandle 
  }), [rootHandle, isReady, isLoading, error, persistedHandleAvailable, initFileSystem, saveJson, readJson, uploadAsset, getAssetUrl, getDirectoryHandle]);

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) throw new Error('useFileSystem must be used within FileSystemProvider');
  return context;
};
