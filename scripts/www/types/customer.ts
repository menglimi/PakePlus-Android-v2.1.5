
export interface FollowUp {
  id: string;
  date: string;
  type: 'call' | 'visit' | 'wechat' | 'other';
  content: string;
}

export interface Contact {
  name: string;
  phone: string;
  relation: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  gender?: 'male' | 'female';
  contacts?: Contact[];
  
  type: 'buy' | 'rent';
  budgetMin?: number;
  budgetMax?: number;
  reqGardens?: string[]; 
  reqRoom?: number;
  reqAreaMin?: number; 
  reqAreaMax?: number; 
  propertyCount?: 'first' | 'second' | 'third_plus'; 
  urgency?: 'high' | 'medium' | 'low'; 
  deadline?: string; 
  
  status: 'active' | 'archive';
  rating?: 'A' | 'B' | 'C'; 
  notes?: string;
  followUps?: FollowUp[]; 
  updatedAt: number;
  importDate?: number; 
  
  otherContacts?: { relation: string, name: string, phone: string }[];
}
