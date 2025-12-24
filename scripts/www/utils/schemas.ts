
import { z } from 'zod';
import { DEFAULT_GARDEN_DATA } from '../constants';

// --- Helpers ---
const LooseNumber = z.preprocess((val) => {
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof val === 'number') return val;
    return 0;
}, z.number());

const LooseString = z.preprocess((val) => {
    if (val === null || val === undefined) return '';
    return String(val);
}, z.string());

const LooseBoolean = z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return Boolean(val);
}, z.boolean());

// --- Property Schema ---
export const PropertySchema = z.object({
    id: LooseString,
    garden: LooseString,
    subArea: LooseString,
    building: LooseString,
    unit: LooseString,
    room: LooseString,
    floor: LooseString,
    totalFloors: LooseString.optional(),
    layout: LooseString, 
    
    layoutRoom: LooseNumber,
    layoutHall: LooseNumber,
    layoutBath: LooseNumber,
    layoutBalcony: LooseNumber,
    
    area: LooseNumber,
    orientation: z.string().optional(),
    renovation: z.string().optional(),
    elevator: z.string().optional(),
    
    ownerName: LooseString,
    ownerContact: LooseString,
    
    salePrice: LooseNumber.optional(),
    rentPrice: LooseNumber.optional(),
    
    isSale: LooseBoolean,
    isRent: LooseBoolean,
    
    keys: z.string().optional(),
    remarks: z.string().optional(),
    
    status: z.enum(['active', 'sold', 'rented', 'off']).catch('active').default('active'),
    
    features: z.array(z.string()).catch([]).default([]),
    assets: z.array(z.string()).catch([]).default([]),
    
    updatedAt: LooseNumber.default(() => Date.now()),
    importDate: z.number().optional(),
    leaseEnd: z.string().optional(),
    
    waterPrice: z.number().optional(),
    elecPrice: z.number().optional(),
    propertyType: z.string().optional().default('flat'),
}).passthrough();

// --- Customer Schema ---
export const ContactSchema = z.object({
    name: LooseString,
    phone: LooseString,
    relation: LooseString
});

export const FollowUpSchema = z.object({
    id: LooseString,
    date: z.string().default(() => new Date().toISOString()),
    type: z.enum(['call', 'visit', 'wechat', 'other']).catch('other').default('other'),
    content: LooseString
});

export const CustomerSchema = z.object({
    id: LooseString,
    name: LooseString,
    phone: LooseString,
    gender: z.enum(['male', 'female']).optional(),
    contacts: z.array(ContactSchema).catch([]).default([]),
    
    type: z.enum(['buy', 'rent']).catch('buy').default('buy'),
    budgetMin: LooseNumber.optional(),
    budgetMax: LooseNumber.optional(),
    reqGardens: z.array(z.string()).catch([]).default([]),
    reqRoom: LooseNumber.optional(),
    reqAreaMin: LooseNumber.optional(),
    reqAreaMax: LooseNumber.optional(),
    
    urgency: z.enum(['high', 'medium', 'low']).catch('medium').default('medium'),
    status: z.enum(['active', 'archive']).catch('active').default('active'),
    rating: z.enum(['A', 'B', 'C']).optional(),
    
    notes: z.string().optional(),
    followUps: z.array(FollowUpSchema).catch([]).default([]),
    
    updatedAt: LooseNumber.default(() => Date.now()),
    importDate: z.number().optional()
}).passthrough();

// --- Key Schema ---
export const KeyRecordSchema = z.object({
    id: LooseString,
    keyNo: LooseString,
    status: z.enum(['in_store', 'borrowed']).catch('in_store').default('in_store'),
    propertyStatus: z.enum(['normal', 'rented', 'sold']).catch('normal').default('normal'), // 房屋业务状态
    propertyId: z.string().optional(),
    garden: LooseString,
    roomNo: LooseString,
    borrower: z.string().optional(),
    borrowerPhone: z.string().optional(),
    borrowReason: z.string().optional(),
    borrowTime: z.number().optional(),
    updatedAt: LooseNumber.default(() => Date.now()),
}).passthrough();

// --- Settings Schema ---
export const SettingsSchema = z.object({
    gardenData: z.record(z.string(), z.array(z.string())).default(DEFAULT_GARDEN_DATA),
    buildingDict: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    gardenDetails: z.record(z.string(), z.any()).optional(),
    
    theme: z.enum(['day', 'green', 'tech', 'classic']).catch('day').default('day'),
    agentName: z.string().optional(),
    agentPhone: z.string().optional(),
    agentLicense: z.string().optional(),
    agentPresets: z.array(z.object({ name: z.string(), phone: z.string() })).optional(),
    
    ai: z.object({
        marketing: z.object({
            provider: z.enum(['deepseek', 'gemini', 'custom']).catch('deepseek').default('deepseek'),
            apiKey: z.string().optional(),
            apiBaseUrl: z.string().optional(),
            apiModel: z.string().optional(),
            temperature: z.number().optional()
        }).optional().default({ provider: 'deepseek' }),
        voice: z.object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiBaseUrl: z.string().optional(),
            model: z.string().optional()
        }).optional()
    }).default({ marketing: { provider: 'deepseek' } }),
    
    aiProvider: z.any().optional(),
    apiKey: z.any().optional(),
    apiBaseUrl: z.any().optional(),
    apiModel: z.any().optional(),

    interestRates: z.object({
        lpr: z.number(),
        commercialRateFirst: z.number(),
        commercialRateSecond: z.number(),
        fundRateFirst5Y: z.number(),
        fundRateFirstOver5Y: z.number(),
        fundRateSecond5Y: z.number(),
        fundRateSecondOver5Y: z.number()
    }).optional(),
    
    taxConfig: z.object({
        deedTaxThreshold: z.number(),
        vatExemptionYears: z.number(),
        pitRate: z.number()
    }).optional(),
    
    keyConfig: z.object({
        borrowerPresets: z.array(z.string()),
        reasonPresets: z.array(z.string())
    }).optional()
}).passthrough(); 

// --- Knowledge Doc Schema ---
export const KnowledgeDocSchema = z.object({
    id: LooseString,
    title: LooseString,
    content: LooseString,
    tags: z.array(z.string()).catch([]).default([]),
    createdAt: LooseNumber.default(() => Date.now()),
    updatedAt: LooseNumber.default(() => Date.now()),
}).passthrough();

// --- Marketing Item Schema ---
export const MarketingItemSchema = z.object({
    id: z.number(),
    date: z.string(),
    propName: z.string(),
    duration: z.string(),
    content: z.any()
}).passthrough();
