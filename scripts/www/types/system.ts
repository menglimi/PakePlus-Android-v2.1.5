
import { GardenDetail, BuildingDetails } from './property';

export interface AIProfile {
  provider: 'deepseek' | 'gemini' | 'custom';
  apiKey?: string;
  apiBaseUrl?: string;
  apiModel?: string;
  temperature?: number;
}

export interface VoiceConfig {
    provider: 'openai' | 'gemini' | 'browser' | 'xunfei';
    apiBaseUrl?: string;
    apiKey?: string;
    apiSecret?: string; // 讯飞 API Secret
    appId?: string;     // 讯飞 APPID
    model?: string;
    voiceId?: string;
}

export interface Lead {
    id: string;
    propertyId: string;
    propertyName: string;
    customerName: string;
    customerPhone: string;
    action: 'view' | 'appointment' | 'call';
    duration?: number;
    timestamp: number;
    status: 'new' | 'processed' | 'ignored';
}

export interface KeyRecord {
  id: string;
  keyNo: string;
  status: 'in_store' | 'borrowed';
  propertyId?: string;
  garden: string;
  roomNo: string;
  borrower?: string;
  borrowerPhone?: string;
  borrowReason?: string;
  borrowTime?: number;
  updatedAt: number;
}

export interface KeyLog {
  id: string;
  keyNo: string;
  keyId: string;
  action: 'create' | 'borrow' | 'return' | 'delete' | 'edit';
  borrower?: string;
  phone?: string;
  reason?: string;
  operator?: string;
  timestamp: number;
  details?: string;
}

export interface KeyConfig {
    borrowerPresets: string[];
    reasonPresets: string[];
}

export interface AgentProfile {
    name: string;
    phone: string;
}

export interface KnowledgeDoc {
    id: string;
    title: string;
    content: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface Settings {
  gardenData: Record<string, string[]>; 
  buildingDict?: Record<string, Record<string, BuildingDetails>>;
  gardenDetails?: Record<string, GardenDetail>; 
  theme: 'day' | 'green' | 'tech' | 'classic';
  agentName?: string;
  agentPhone?: string;
  agentLicense?: string;
  agentPresets?: AgentProfile[];
  ai: {
    marketing: AIProfile;
    voice?: VoiceConfig;
  };
  interestRates: import('./finance').InterestRates;
  taxConfig: import('./finance').TaxConfig;
  keyConfig: KeyConfig;
  marketingConfig?: {
      enableTracking: boolean;
      relayEndpoint: string; 
      relayKey: string;
  };
  syncConfig?: {
      enabled: boolean;
      serverUrl: string;
      secretKey: string;
      autoPush: boolean;
      lastSyncTime?: number;
  };
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  dueDate?: string;
  link?: {
    type: 'property' | 'customer' | 'key';
    id: string;
    name: string;
  };
}

export interface Appointment {
    id: string;
    title: string;
    date: string;
    time?: string;
    customerId?: string;
    propertyId?: string;
    keyId?: string;
    type: 'viewing' | 'signing' | 'key_reserve' | 'other';
    note?: string;
    status: 'scheduled' | 'completed' | 'cancelled';
}

export interface ChartData {
    title: string;
    type: 'bar' | 'pie';
    data: { label: string, value: number }[];
}
