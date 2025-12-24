
import * as XLSX from 'xlsx';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export function digitUppercase(n: number): string {
  const integer = Math.floor(n);
  let numStr = integer.toString();
  
  if (!/^\d+$/.test(numStr)) return "数据非法";
  
  let unit = "千百拾亿千百拾万千百拾元";
  let str = "";
  
  unit = unit.substr(unit.length - numStr.length);
  
  for (let i = 0; i < numStr.length; i++) {
    str += '零壹贰叁肆伍陆柒捌玖'.charAt(parseInt(numStr.charAt(i))) + unit.charAt(i);
  }
  
  return str.replace(/零(千|百|拾)/g, "零")
    .replace(/(零)+/g, "零")
    .replace(/零(万|亿|元)/g, "$1")
    .replace(/(亿)万|壹(拾)/g, "$1$2")
    .replace(/^元零?|零分/g, "")
    .replace(/元$/g, "元整");
}

// --- INDEXED DB CONFIGURATION ---
interface MingHuiDB extends DBSchema {
  handles: {
    key: string;
    value: FileSystemDirectoryHandle;
  };
  properties: {
    key: string;
    value: any;
  };
  customers: {
    key: string;
    value: any;
  };
  marketing: {
    key: number;
    value: any;
  };
  keys: {
    key: string;
    value: any;
  };
  keyLogs: {
    key: string;
    value: any;
  };
  todos: {
    key: string;
    value: any;
  };
  appointments: {
    key: string;
    value: any;
  };
  settings: {
    key: string;
    value: any;
  };
  assets: {
    key: string;
    value: Blob;
  };
  knowledge: {
    key: string;
    value: any;
  };
  embeddings: {
    key: string;
    value: {
        key: string;
        vector: number[];
    };
  };
  leads: {
    key: string;
    value: any;
  };
  trash_properties: {
    key: string;
    value: any;
  };
  trash_customers: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'MingHuiDB';
const DB_VERSION = 5; // Incremented for Leads support

let dbInstance: Promise<IDBPDatabase<MingHuiDB>> | null = null;

export const initAppDB = () => {
  if (!dbInstance) {
    dbInstance = openDB<MingHuiDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
        if (!db.objectStoreNames.contains('properties')) db.createObjectStore('properties', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('customers')) db.createObjectStore('customers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('marketing')) db.createObjectStore('marketing', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('keyLogs')) db.createObjectStore('keyLogs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('todos')) db.createObjectStore('todos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('appointments')) db.createObjectStore('appointments', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets');
        if (!db.objectStoreNames.contains('knowledge')) db.createObjectStore('knowledge', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('trash_properties')) db.createObjectStore('trash_properties', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('trash_customers')) db.createObjectStore('trash_customers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('embeddings')) db.createObjectStore('embeddings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('leads')) db.createObjectStore('leads', { keyPath: 'id' });
      },
    });
  }
  return dbInstance;
};

export const dbGet = async (storeName: any, key: string | number) => {
  const db = await initAppDB();
  return db.get(storeName, key);
};

export const dbSet = async (storeName: any, value: any, key?: string) => {
  const db = await initAppDB();
  if (['handles', 'settings', 'assets'].includes(storeName)) {
      return db.put(storeName, value, key);
  }
  return db.put(storeName, value);
};

export const dbDelete = async (storeName: any, key: string | number) => {
  const db = await initAppDB();
  return db.delete(storeName, key);
};

export const dbGetAll = async (storeName: any) => {
  const db = await initAppDB();
  return db.getAll(storeName);
};

export const dbClear = async (storeName: any) => {
    const db = await initAppDB();
    return db.clear(storeName);
}

export const saveHandle = async (handle: FileSystemDirectoryHandle) => {
  await dbSet('handles', handle, 'rootHandle');
};

export const getHandle = async (): Promise<FileSystemDirectoryHandle | undefined> => {
  return await dbGet('handles', 'rootHandle');
};

export const exportToExcel = (data: any[], filename: string, sheetName: string = "Sheet1") => {
   const worksheet = XLSX.utils.json_to_sheet(data);
   const workbook = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
   XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const openMap = (address: string) => {
    const fullQuery = `东莞市 ${address}`; 
    const url = `https://map.baidu.com/search/${encodeURIComponent(fullQuery)}`;
    window.open(url, '_blank');
};

export const addWatermark = (file: File, text: string): Promise<File> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(img, 0, 0);
                const fontSize = Math.max(24, img.width * 0.03);
                ctx.font = `bold ${fontSize}px "Microsoft YaHei"`;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.textAlign = 'right';
                ctx.fillText(text, img.width - 20, img.height - 20);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.textAlign = 'left';
                ctx.fillText("MH Pro", 20, fontSize + 20);
                canvas.toBlob((blob) => {
                    if(blob) resolve(new File([blob], file.name, { type: file.type }));
                    else resolve(file);
                }, file.type, 0.9);
            } else {
                resolve(file);
            }
        };
        img.onerror = () => resolve(file);
    });
};

export const compressImage = async (file: File, quality = 0.8, maxWidth = 1920): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.size < 500 * 1024) return file;
    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], file.name, { type: file.type }));
                } else {
                    resolve(file);
                }
            }, 'image/jpeg', quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };
    });
};
