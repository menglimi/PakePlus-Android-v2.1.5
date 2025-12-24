
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Property, Customer, MarketingItem, Settings, FollowUp, Todo, KeyRecord, KeyLog, Appointment, KnowledgeDoc, Lead } from '../types';
import { dbGetAll, dbSet, dbDelete, dbGet, dbClear } from '../utils';
import { DEFAULT_GARDEN_DATA } from '../constants';
import { useFileSystem } from './FileSystemContext';
import { useUI } from './UIContext';
import { PropertySchema, CustomerSchema, SettingsSchema, KeyRecordSchema, KnowledgeDocSchema, MarketingItemSchema } from '../utils/schemas';
import { z } from 'zod';

interface Notification {
    id: string;
    type: 'warning' | 'info' | 'lead';
    title: string;
    message: string;
    link?: any;
    date: number;
}

interface DataContextType {
  properties: Property[];
  customers: Customer[];
  marketingHistory: MarketingItem[];
  keys: KeyRecord[];
  keyLogs: KeyLog[];
  todos: Todo[];
  appointments: Appointment[];
  settings: Settings;
  notifications: Notification[];
  trash: { properties: Property[], customers: Customer[] };
  knowledgeDocs: KnowledgeDoc[];
  leads: Lead[];
  isSyncing: boolean;
  isInitialLoading: boolean;
  lastSyncTime: number;
  refreshData: (silent?: boolean) => Promise<void>;
  saveProperty: (p: Property) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  restoreProperty: (id: string) => Promise<void>;
  permanentDeleteProperty: (id: string) => Promise<void>;
  bulkDeleteProperties: (ids: string[]) => Promise<void>;
  saveCustomer: (c: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  restoreCustomer: (id: string) => Promise<void>;
  permanentDeleteCustomer: (id: string) => Promise<void>;
  bulkDeleteCustomers: (ids: string[]) => Promise<void>;
  addFollowUp: (customerId: string, log: FollowUp) => Promise<void>;
  saveMarketing: (item: MarketingItem) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  saveKey: (k: KeyRecord) => Promise<void>;
  deleteKey: (id: string) => Promise<void>;
  addKeyLog: (log: KeyLog) => Promise<void>;
  addTodo: (text: string, dueDate?: string, link?: any) => void;
  updateTodo: (id: string, text: string, dueDate?: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  addAppointment: (appt: Appointment) => void;
  updateAppointment: (appt: Appointment) => void;
  deleteAppointment: (id: string) => void;
  saveKnowledgeDoc: (doc: KnowledgeDoc) => Promise<void>;
  deleteKnowledgeDoc: (id: string) => Promise<void>;
  importData: (file: File, type?: 'properties' | 'customers' | 'full') => Promise<void>;
  exportAllData: () => Promise<void>;
  createSnapshot: () => Promise<void>;
  loadTrash: () => Promise<void>;
  syncOnlineLeads: () => Promise<void>;
  processLead: (leadId: string, action: 'convert' | 'ignore') => Promise<void>;
  pushToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { rootHandle, isReady, saveJson, readJson, getDirectoryHandle } = useFileSystem();
  const { showToast } = useUI();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [marketingHistory, setMarketingHistory] = useState<MarketingItem[]>([]);
  const [keys, setKeysState] = useState<KeyRecord[]>([]);
  const keysRef = useRef<KeyRecord[]>([]);
  
  const setKeys = useCallback((newKeys: KeyRecord[]) => {
      keysRef.current = newKeys;
      setKeysState(newKeys);
  }, []);

  const [keyLogs, setKeyLogs] = useState<KeyLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [trash, setTrash] = useState<{ properties: Property[], customers: Customer[] }>({ properties: [], customers: [] });
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  const [settings, setSettings] = useState<Settings>({
    gardenData: DEFAULT_GARDEN_DATA,
    buildingDict: {},
    gardenDetails: {},
    theme: 'day',
    ai: {
        marketing: { provider: 'deepseek', apiBaseUrl: 'https://api.deepseek.com', apiModel: 'deepseek-chat', apiKey: '', temperature: 1.0 },
        voice: { provider: 'openai', apiBaseUrl: 'https://api.openai.com/v1', model: 'whisper-1', apiKey: '' }
    },
    agentName: '',
    agentPhone: '',
    agentPresets: [],
    interestRates: { lpr: 3.85, commercialRateFirst: 3.6, commercialRateSecond: 4.0, fundRateFirst5Y: 2.1, fundRateFirstOver5Y: 2.6, fundRateSecond5Y: 2.525, fundRateSecondOver5Y: 3.075 },
    taxConfig: { deedTaxThreshold: 140, vatExemptionYears: 2, pitRate: 1 },
    keyConfig: { borrowerPresets: ['物业', '业主', '员工', '同行'], reasonPresets: ['带看', '拍照', '装修', '结束委托'] },
    marketingConfig: { enableTracking: true, relayEndpoint: '', relayKey: '' },
    syncConfig: { enabled: false, serverUrl: '', secretKey: '', autoPush: false }
  });

  const parseList = useCallback(<T,>(list: any[], schema: z.ZodSchema<T>): T[] => {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
          const result = schema.safeParse(item);
          if (result.success) return result.data;
          console.warn("[DataContext] Schema validation failed for item:", item, result.error);
          return null;
      }).filter((i): i is T => i !== null);
  }, []);

  const loadData = useCallback(async () => {
    console.info("[DataContext] 数据加载任务启动...");
    setIsInitialLoading(true);
    
    // Case A: Offline (IndexedDB)
    if (!rootHandle) {
        try {
            console.info("[DataContext] 从 IndexedDB 加载...");
            const [p, c, m, k, kl, t, a, kd, ld] = await Promise.all([
                dbGetAll('properties'), dbGetAll('customers'), dbGetAll('marketing'),
                dbGetAll('keys'), dbGetAll('keyLogs'), dbGetAll('todos'),
                dbGetAll('appointments'), dbGetAll('knowledge'), dbGetAll('leads')
            ]);
            setProperties(parseList(p, PropertySchema).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as Property[]);
            setCustomers(parseList(c, CustomerSchema).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as Customer[]);
            setMarketingHistory(parseList(m, MarketingItemSchema).sort((a: any, b: any) => (b.id || 0) - (a.id || 0)) as MarketingItem[]);
            setKeys(parseList(k, KeyRecordSchema) as KeyRecord[]);
            setKeyLogs((kl || []).sort((a: any, b: any) => (b.timestamp||0) - (a.timestamp||0)));
            setTodos(t || []);
            setAppointments(a || []);
            setKnowledgeDocs(parseList(kd, KnowledgeDocSchema).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as KnowledgeDoc[]);
            setLeads((ld || []).sort((a: any, b: any) => b.timestamp - a.timestamp));
            const savedSettings = await dbGet('settings', 'config');
            if(savedSettings) {
                const parsedSettings = SettingsSchema.safeParse(savedSettings);
                if (parsedSettings.success) setSettings(prev => ({...prev, ...parsedSettings.data} as Settings));
            }
        } catch(e) { 
            console.error("[DataContext] IDB 数据提取失败:", e); 
        } finally { 
            setIsInitialLoading(false); 
            console.info("[DataContext] IDB 数据加载完成。");
        }
        return;
    }

    // Case B: FileSystem
    const loadDir = async <T,>(dirName: string, schema: z.ZodSchema<T>): Promise<T[]> => {
      const items: T[] = [];
      const dir = await getDirectoryHandle(dirName);
      if(!dir) return [];
      // @ts-ignore
      for await (const entry of dir.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.json')) {
             try {
                const file = await (entry as any).getFile();
                const json = JSON.parse(await file.text());
                const parsed = schema.safeParse(json);
                if (parsed.success) items.push(parsed.data);
                else {
                    console.warn(`[DataContext] 文件 ${entry.name} 结构验证失败:`, parsed.error);
                }
             } catch (e) {
                 console.error(`[DataContext] 文件读取失败 ${entry.name}:`, e);
             }
          }
      }
      return items;
    };

    try {
      console.info("[DataContext] 从 FileSystem 加载...");
      const setDir = await getDirectoryHandle('settings');
      if (setDir) {
          const config = await readJson(setDir, 'config.json');
          if (config) {
              const parsed = SettingsSchema.safeParse(config);
              if (parsed.success) setSettings(s => ({ ...s, ...parsed.data } as Settings));
          }
      }
      
      const [props, custs, market, kDocs] = await Promise.all([
          loadDir('properties', PropertySchema), loadDir('customers', CustomerSchema), 
          loadDir('marketing', MarketingItemSchema), loadDir('knowledge', KnowledgeDocSchema)
      ]);
      
      setProperties(props.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as Property[]);
      setCustomers(custs.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as Customer[]);
      setMarketingHistory(market.sort((a: any, b: any) => (b.id || 0) - (a.id || 0)) as MarketingItem[]);
      setKnowledgeDocs(kDocs.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)) as KnowledgeDoc[]);
      
      const keyDir = await getDirectoryHandle('keys');
      if (keyDir) {
          const kData = await readJson(keyDir, 'data.json');
          if (kData && Array.isArray(kData)) setKeys(parseList(kData, KeyRecordSchema) as KeyRecord[]);
          const kLogs = await readJson(keyDir, 'logs.json');
          if (kLogs) setKeyLogs(Array.isArray(kLogs) ? kLogs : []);
      }
      
      const leadDir = await getDirectoryHandle('leads');
      if (leadDir) {
          const ldData = await readJson(leadDir, 'data.json');
          if (ldData && Array.isArray(ldData)) setLeads(ldData);
      }
      
      const calDir = await getDirectoryHandle('calendar');
      if (calDir) {
          const calData = await readJson(calDir, 'data.json');
          if (calData) {
              if (calData.appointments) setAppointments(calData.appointments);
              if (calData.todos) setTodos(calData.todos);
          }
      }
      setLastSyncTime(Date.now());
    } catch (e) { 
        console.error("[DataContext] FS 数据提取失败:", e); 
    } finally { 
        setIsInitialLoading(false); 
        console.info("[DataContext] FS 数据加载完成。");
    }
  }, [rootHandle, getDirectoryHandle, readJson, parseList, setKeys]);

  const pushToCloud = async () => {
      if (!settings.syncConfig?.enabled || !settings.syncConfig.serverUrl) {
          showToast("请先在设置中启用云端同步并填写地址", "error");
          return;
      }
      setIsSyncing(true);
      try {
          const fullData = {
              properties, customers, keys, keyLogs, todos, appointments, knowledgeDocs,
              gardenData: settings.gardenData,
              gardenDetails: settings.gardenDetails,
              buildingDict: settings.buildingDict,
              timestamp: Date.now(),
              agentName: settings.agentName
          };
          const res = await fetch(`${settings.syncConfig.serverUrl}/sync?key=${settings.syncConfig.secretKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fullData)
          });
          if (res.ok) {
              showToast("本地数据已成功推送至云端");
              updateSettings({ syncConfig: { ...settings.syncConfig, lastSyncTime: Date.now() } });
          } else throw new Error("推送失败");
      } catch (e) { showToast("同步失败：请检查中转站连接", "error"); }
      finally { setIsSyncing(false); }
  };

  const pullFromCloud = async () => {
      if (!settings.syncConfig?.enabled || !settings.syncConfig.serverUrl) return;
      if (!confirm("从云端拉取将覆盖本地所有数据。确认继续吗？")) return;
      setIsSyncing(true);
      try {
          const res = await fetch(`${settings.syncConfig.serverUrl}/sync?key=${settings.syncConfig.secretKey}`);
          if (res.ok) {
              const data = await res.json();
              if (data.properties) {
                  for(const p of data.properties) await saveProperty(p);
                  for(const c of data.customers) await saveCustomer(c);
                  
                  // Fix: Keys Persistence with Validation
                  if(data.keys && Array.isArray(data.keys)) {
                      // Ensure valid schema before saving
                      const validKeys = data.keys.map((k: any) => {
                          const result = KeyRecordSchema.safeParse(k);
                          return result.success ? result.data : null;
                      }).filter((k: any) => k !== null) as KeyRecord[];

                      setKeys(validKeys); // Update state

                      if (rootHandle) {
                          const dir = await getDirectoryHandle('keys', true);
                          if(dir) await saveJson(dir, 'data.json', validKeys);
                      } else {
                          // Clear DB to ensure sync and avoid duplicates/ghosts
                          await dbClear('keys');
                          for(const k of validKeys) await dbSet('keys', k);
                      }
                  }

                  // Fix: Todos Persistence
                  if(data.todos && Array.isArray(data.todos)) {
                      setTodos(data.todos);
                      if (!rootHandle) {
                          await dbClear('todos');
                          for(const t of data.todos) await dbSet('todos', t);
                      }
                  }

                  // Fix: Appointments Persistence
                  if(data.appointments && Array.isArray(data.appointments)) {
                      setAppointments(data.appointments);
                      if (!rootHandle) {
                           await dbClear('appointments');
                           for(const a of data.appointments) await dbSet('appointments', a);
                      }
                  }

                  // FileSystem Calendar Sync
                  if (rootHandle && (data.todos || data.appointments)) {
                      const dir = await getDirectoryHandle('calendar', true);
                      if(dir) await saveJson(dir, 'data.json', { 
                          todos: data.todos || todos, 
                          appointments: data.appointments || appointments 
                      });
                  }

                  if(data.gardenData) await updateSettings({ gardenData: data.gardenData, gardenDetails: data.gardenDetails, buildingDict: data.buildingDict });
                  showToast("云端数据拉取并合并成功");
              }
          } else throw new Error("拉取失败");
      } catch (e) { showToast("拉取失败：请检查连接", "error"); }
      finally { setIsSyncing(false); }
  };

  const syncOnlineLeads = async () => {
      setIsSyncing(true);
      try {
          let onlineLeads: Lead[] = [];
          if (settings.marketingConfig?.relayEndpoint) {
              const res = await fetch(`${settings.marketingConfig.relayEndpoint}/leads?key=${settings.marketingConfig.relayKey}`);
              if (res.ok) onlineLeads = await res.json();
          }
          const existingIds = new Set(leads.map(l => l.id));
          const filteredNew = onlineLeads.filter(l => !existingIds.has(l.id));
          if (filteredNew.length > 0) {
              const merged = [...filteredNew, ...leads];
              setLeads(merged);
              if (rootHandle) {
                  const dir = await getDirectoryHandle('leads', true);
                  if (dir) await saveJson(dir, 'data.json', merged);
              } else { for(const l of filteredNew) await dbSet('leads', l); }
              showToast(`发现 ${filteredNew.length} 条新线索`, "info");
          }
      } catch (e) {} finally { setIsSyncing(false); }
  };

  const processLead = async (leadId: string, action: 'convert' | 'ignore') => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;
      if (action === 'convert') {
          const existingCust = customers.find(c => c.phone === lead.customerPhone);
          if (existingCust) {
              await addFollowUp(existingCust.id, { id: Date.now().toString(), date: new Date().toISOString(), type: 'other', content: `[H5线索转化] ${lead.action}` });
          } else {
              const newCust: Customer = { id: Date.now().toString(), name: lead.customerName, phone: lead.customerPhone, type: 'buy', status: 'active', notes: `来源于 H5 转化 (${lead.propertyName})`, updatedAt: Date.now() };
              await saveCustomer(newCust);
          }
      }
      const updatedLeads = leads.map(l => l.id === leadId ? { ...l, status: (action === 'convert' ? 'processed' : 'ignored') as any } : l);
      setLeads(updatedLeads);
      if (rootHandle) {
          const dir = await getDirectoryHandle('leads', true);
          if (dir) await saveJson(dir, 'data.json', updatedLeads);
      } else { await dbSet('leads', updatedLeads.find(l=>l.id===leadId)); }
  };

  const hasLoadedRef = useRef(false);
  const loadingLock = useRef(false);

  useEffect(() => {
      if (isReady && !hasLoadedRef.current && !loadingLock.current) {
          loadingLock.current = true;
          hasLoadedRef.current = true;
          loadData().finally(() => { loadingLock.current = false; });
      }
  }, [isReady, loadData]);

  const refreshData = async (silent = false) => {
      if (!silent) setIsSyncing(true);
      await loadData();
      if (!silent) setIsSyncing(false);
  };

  const persistCalendar = async (newTodos: Todo[], newAppts: Appointment[]) => {
      if (rootHandle) {
          const dir = await getDirectoryHandle('calendar', true);
          if (dir) await saveJson(dir, 'data.json', { todos: newTodos, appointments: newAppts });
      }
  };

  const saveProperty = async (prop: Property) => {
      const p = { ...prop, updatedAt: Date.now(), id: prop.id || Date.now().toString() };
      const valid = PropertySchema.parse(p) as Property;
      if (rootHandle) {
          const dir = await getDirectoryHandle('properties', true);
          if(dir) await saveJson(dir, `${valid.id}.json`, valid);
      } else await dbSet('properties', valid);
      setProperties(prev => {
          const exists = prev.find(i => i.id === valid.id);
          return exists ? prev.map(i => i.id === valid.id ? valid : i) : [valid, ...prev];
      });
  };

  const deleteProperty = async (id: string) => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      if (rootHandle) {
          const dir = await getDirectoryHandle('properties');
          const trashRoot = await getDirectoryHandle('trash', true);
          const trashDir = trashRoot && await trashRoot.getDirectoryHandle('properties', { create: true });
          if (dir && trashDir) {
              await saveJson(trashDir, `${id}.json`, prop);
              await dir.removeEntry(`${id}.json`);
          }
      } else {
          await dbSet('trash_properties', prop);
          await dbDelete('properties', id);
      }
      setProperties(prev => prev.filter(p => p.id !== id));
  };

  const saveCustomer = async (c: Customer) => {
      const cust = { ...c, updatedAt: Date.now() };
      const valid = CustomerSchema.parse(cust) as Customer;
      if (rootHandle) {
          const dir = await getDirectoryHandle('customers', true);
          if(dir) await saveJson(dir, `${valid.id}.json`, valid);
      } else await dbSet('customers', valid);
      setCustomers(prev => {
          const exists = prev.find(i => i.id === valid.id);
          return exists ? prev.map(i => i.id === valid.id ? valid : i) : [valid, ...prev];
      });
  };

  const deleteCustomer = async (id: string) => {
      const cust = customers.find(c => c.id === id);
      if (!cust) return;
      if (rootHandle) {
          const dir = await getDirectoryHandle('customers');
          const trashRoot = await getDirectoryHandle('trash', true);
          const trashDir = trashRoot && await trashRoot.getDirectoryHandle('customers', { create: true });
          if(dir && trashDir) {
              await saveJson(trashDir, `${id}.json`, cust);
              await dir.removeEntry(`${id}.json`);
          }
      } else {
          await dbSet('trash_customers', cust);
          await dbDelete('customers', id);
      }
      setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const saveKey = async (key: KeyRecord) => {
      const updatedKey = { ...key, updatedAt: Date.now() };
      const currentKeys = keysRef.current;
      const newKeys = currentKeys.map(k => k.id === updatedKey.id ? updatedKey : k);
      if (!newKeys.find(k => k.id === updatedKey.id)) newKeys.unshift(updatedKey);
      setKeys(newKeys);
      if (rootHandle) {
          const dir = await getDirectoryHandle('keys', true);
          if(dir) await saveJson(dir, 'data.json', newKeys);
      } else await dbSet('keys', updatedKey);
  };

  const deleteKey = async (id: string) => {
      const currentKeys = keysRef.current;
      const newKeys = currentKeys.filter(k => k.id !== id);
      setKeys(newKeys);
      if (rootHandle) {
          const dir = await getDirectoryHandle('keys', true);
          if(dir) await saveJson(dir, 'data.json', newKeys);
      } else await dbDelete('keys', id);
  };

  const addKeyLog = async (log: KeyLog) => {
      const newLogs = [log, ...keyLogs];
      setKeyLogs(newLogs);
      if (rootHandle) {
          const dir = await getDirectoryHandle('keys', true);
          if(dir) await saveJson(dir, 'logs.json', newLogs);
      } else await dbSet('keyLogs', log);
  };

  const saveKnowledgeDoc = async (doc: KnowledgeDoc) => {
      const updatedDoc = { ...doc, updatedAt: Date.now() };
      const valid = KnowledgeDocSchema.parse(updatedDoc) as KnowledgeDoc;
      if (rootHandle) {
          const dir = await getDirectoryHandle('knowledge', true);
          if(dir) await saveJson(dir, `${valid.id}.json`, valid);
      } else await dbSet('knowledge', valid);
      setKnowledgeDocs(prev => {
          const exists = prev.find(d => d.id === valid.id);
          return exists ? prev.map(d => d.id === valid.id ? valid : d) : [valid, ...prev];
      });
  };

  const deleteKnowledgeDoc = async (id: string) => {
      if (rootHandle) {
          const dir = await getDirectoryHandle('knowledge');
          if (dir) await dir.removeEntry(`${id}.json`);
      } else await dbDelete('knowledge', id);
      setKnowledgeDocs(prev => prev.filter(d => d.id !== id));
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      if (rootHandle) {
          const dir = await getDirectoryHandle('settings', true);
          if(dir) await saveJson(dir, 'config.json', merged);
      } else await dbSet('settings', merged, 'config');
  };

  const addTodo = (text: string, dueDate?: string, link?: any) => {
      const todo = {id: Date.now().toString(), text, done: false, createdAt: Date.now(), dueDate, link};
      const newTodos = [todo, ...todos];
      setTodos(newTodos);
      if(rootHandle) persistCalendar(newTodos, appointments);
      else dbSet('todos', todo);
  };
  const updateTodo = (id: string, text: string, dueDate?: string) => {
      const item = todos.find(t=>t.id===id);
      if (!item) return;
      const updated = { ...item, text, dueDate } as Todo;
      const newTodos = todos.map(t => t.id === id ? updated : t);
      setTodos(newTodos);
      if(rootHandle) persistCalendar(newTodos, appointments);
      else dbSet('todos', updated);
  };
  const toggleTodo = (id: string) => {
      const item = todos.find(t=>t.id===id);
      if (!item) return;
      const updated = { ...item, done: !item.done } as Todo;
      const newTodos = todos.map(t => t.id===id ? updated : t);
      setTodos(newTodos);
      if(rootHandle) persistCalendar(newTodos, appointments);
      else dbSet('todos', updated);
  };
  const deleteTodo = (id: string) => {
      const newTodos = todos.filter(t => t.id!==id);
      setTodos(newTodos);
      if(rootHandle) persistCalendar(newTodos, appointments);
      else dbDelete('todos', id);
  };
  const addAppointment = (appt: Appointment) => {
      const newAppts = [...appointments, appt];
      setAppointments(newAppts);
      if(rootHandle) persistCalendar(todos, newAppts);
      else dbSet('appointments', appt);
  };
  const updateAppointment = (appt: Appointment) => {
      const newAppts = appointments.map(a => a.id === appt.id ? appt : a);
      setAppointments(newAppts);
      if(rootHandle) persistCalendar(todos, newAppts);
      else dbSet('appointments', appt);
  };
  const deleteAppointment = (id: string) => {
      const newAppts = appointments.filter(a => a.id !== id);
      setAppointments(newAppts);
      if(rootHandle) persistCalendar(todos, newAppts);
      else dbDelete('appointments', id);
  };

  const createSnapshot = async () => {
      if (!rootHandle) return showToast("离线模式不支持快照", "info");
      const snapshotsDir = await getDirectoryHandle('snapshots', true);
      const folderName = `snapshot_${Date.now()}`;
      const targetDir = snapshotsDir && await snapshotsDir.getDirectoryHandle(folderName, { create: true });
      if (targetDir) {
          const saveList = async (list: any[], sub: string) => {
              const subDir = await targetDir.getDirectoryHandle(sub, { create: true });
              for (const item of list) await saveJson(subDir, `${item.id}.json`, item);
          };
          await saveList(properties, 'properties');
          await saveList(customers, 'customers');
          await saveList(knowledgeDocs, 'knowledge');
          const sDir = await targetDir.getDirectoryHandle('settings', { create: true });
          await saveJson(sDir, 'config.json', settings);
          showToast(`快照已创建`);
      }
  };

  const loadTrash = async () => {
      if (rootHandle) {
          const trashRoot = await getDirectoryHandle('trash');
          if (!trashRoot) { setTrash({ properties: [], customers: [] }); return; }
          const loadTrashDir = async (type: 'properties' | 'customers') => {
              const items: any[] = [];
              try {
                  const subDir = await trashRoot.getDirectoryHandle(type);
                  // @ts-ignore
                  for await (const entry of subDir.values()) {
                      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                          try {
                              const file = await (entry as any).getFile();
                              items.push(JSON.parse(await file.text()));
                          } catch (e) {}
                      }
                  }
              } catch(e) {}
              return items;
          };
          setTrash({ properties: await loadTrashDir('properties'), customers: await loadTrashDir('customers') });
      } else {
          setTrash({ properties: await dbGetAll('trash_properties'), customers: await dbGetAll('trash_customers') });
      }
  };

  const restoreProperty = async (id: string) => {
      const prop = trash.properties.find(p => p.id === id);
      if (!prop) return;
      await saveProperty(prop);
      if (rootHandle) {
          const trashRoot = await getDirectoryHandle('trash');
          const subDir = await trashRoot?.getDirectoryHandle('properties');
          await subDir?.removeEntry(`${id}.json`);
      } else await dbDelete('trash_properties', id);
      setTrash(prev => ({...prev, properties: prev.properties.filter(p => p.id !== id)}));
  };

  const permanentDeleteProperty = async (id: string) => {
      if (rootHandle) {
          const trashRoot = await getDirectoryHandle('trash');
          const subDir = await trashRoot?.getDirectoryHandle('properties');
          await subDir?.removeEntry(`${id}.json`);
      } else await dbDelete('trash_properties', id);
      setTrash(prev => ({...prev, properties: prev.properties.filter(p => p.id !== id)}));
  };

  const restoreCustomer = async (id: string) => {
      const cust = trash.customers.find(c => c.id === id);
      if (!cust) return;
      await saveCustomer(cust);
      if (rootHandle) {
          const trashRoot = await getDirectoryHandle('trash');
          const subDir = await trashRoot?.getDirectoryHandle('customers');
          await subDir?.removeEntry(`${id}.json`);
      } else await dbDelete('trash_customers', id);
      setTrash(prev => ({...prev, customers: prev.customers.filter(c => c.id !== id)}));
  };

  const permanentDeleteCustomer = async (id: string) => {
      if (rootHandle) {
          const trashRoot = await getDirectoryHandle('trash');
          const subDir = await trashRoot?.getDirectoryHandle('customers');
          await subDir?.removeEntry(`${id}.json`);
      } else await dbDelete('trash_customers', id);
      setTrash(prev => ({...prev, customers: prev.customers.filter(c => c.id !== id)}));
  };

  const bulkDeleteProperties = async (ids: string[]) => { for(const id of ids) await deleteProperty(id); };
  const bulkDeleteCustomers = async (ids: string[]) => { for(const id of ids) await deleteCustomer(id); };

  const importData = async (file: File, type: 'properties' | 'customers' | 'full' = 'full') => {
      try {
         const text = await file.text();
         const json = JSON.parse(text);
         if (json.properties) {
             await updateSettings(json.settings);
             const props = json.properties.map((p: any) => PropertySchema.parse({...p, importDate: Date.now()}));
             for(const p of props) await saveProperty(p);
             const custs = json.customers.map((c: any) => CustomerSchema.parse({...c, importDate: Date.now()}));
             for(const c of custs) await saveCustomer(c);
             showToast("数据恢复成功");
         }
      } catch(e) { showToast("导入失败", "error"); }
  };

  const exportAllData = async () => {
      const backup = { settings, properties, customers, keys, keyLogs, marketingHistory, todos, appointments, knowledgeDocs, leads };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `MH_Backup_${Date.now()}.json`;
      a.click();
  };

  const saveMarketing = async (item: MarketingItem) => { 
      setMarketingHistory(prev => [item, ...prev]);
      if(rootHandle) {
          const dir = await getDirectoryHandle('marketing', true);
          if(dir) await saveJson(dir, `${item.id}.json`, item);
      } else await dbSet('marketing', item);
  };
  const addFollowUp = async (id: string, log: FollowUp) => {
      const c = customers.find(x => x.id === id);
      if(c) await saveCustomer({ ...c, followUps: [log, ...(c.followUps||[])] });
  };

  const value = useMemo(() => ({
      properties, customers, marketingHistory, keys, keyLogs, todos, appointments, settings, notifications, trash, knowledgeDocs, leads,
      isSyncing, isInitialLoading, lastSyncTime, refreshData,
      saveProperty, deleteProperty, restoreProperty, permanentDeleteProperty, bulkDeleteProperties,
      saveCustomer, deleteCustomer, restoreCustomer, permanentDeleteCustomer, bulkDeleteCustomers, addFollowUp,
      saveMarketing, updateSettings, saveKey, deleteKey, addKeyLog,
      addTodo, updateTodo, toggleTodo, deleteTodo,
      addAppointment, updateAppointment, deleteAppointment,
      saveKnowledgeDoc, deleteKnowledgeDoc,
      importData, exportAllData, createSnapshot, loadTrash, syncOnlineLeads, processLead,
      pushToCloud, pullFromCloud
  }), [
      properties, customers, marketingHistory, keys, keyLogs, todos, appointments, settings, notifications, trash, knowledgeDocs, leads,
      isSyncing, isInitialLoading, lastSyncTime, refreshData,
      saveProperty, deleteProperty, restoreProperty, permanentDeleteProperty, bulkDeleteProperties,
      saveCustomer, deleteCustomer, restoreCustomer, permanentDeleteCustomer, bulkDeleteCustomers, addFollowUp,
      saveMarketing, updateSettings, saveKey, deleteKey, addKeyLog,
      addTodo, updateTodo, toggleTodo, deleteTodo,
      addAppointment, updateAppointment, deleteAppointment,
      saveKnowledgeDoc, deleteKnowledgeDoc,
      importData, exportAllData, createSnapshot, loadTrash, syncOnlineLeads, processLead,
      pushToCloud, pullFromCloud
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
