
import React, { useState, useRef, useMemo, useEffect, CSSProperties } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useSearchParams } from 'react-router-dom';
import { Building2, Search, Plus, MapPin, KeyRound, FileText, Sparkles, Loader2, Upload, Trash2, X, ChevronsUpDown, Zap, Droplets, Grid, List as ListIcon, Share2, Filter, ArrowRightLeft, FileSpreadsheet, CheckSquare, Square, ChevronDown, ChevronUp, Bot, Signal, Settings2, Layers, RotateCcw } from 'lucide-react';
import * as ReactWindow from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStore } from '../context/StoreContext';
import { Property } from '../types';
import { addWatermark, exportToExcel } from '../utils';
import { WeChatShare } from '../components/WeChatShare';
import { LazyImage } from '../components/LazyImage';

// Fix: Cast react-window to any to avoid "no exported member" TS errors if types are missing/incorrect
const FixedSizeGrid = (ReactWindow as any).FixedSizeGrid;
const FixedSizeList = (ReactWindow as any).FixedSizeList;

// Extracted Components moved to top to fix hoisting and type inference issues
const AssetDisplay: React.FC<{ 
    filename: string, 
    onRemove: () => void, 
    getAssetUrl: (f: string) => Promise<string | null> 
}> = ({ filename, onRemove, getAssetUrl }) => {
      const [url, setUrl] = useState<string>('');
      React.useEffect(() => { getAssetUrl(filename).then(u => u && setUrl(u)); }, [filename, getAssetUrl]);
      
      if (!url) return <div className="w-20 h-20 bg-slate-100 rounded animate-pulse"></div>;
      
      const isVideo = filename.endsWith('.mp4') || filename.endsWith('.mov');
      return (
          <div className="relative group w-20 h-20 shrink-0">
              {isVideo ? (
                  <video src={url} className="w-full h-full object-cover rounded border"/>
              ) : (
                  <img src={url} className="w-full h-full object-cover rounded border" alt="asset"/>
              )}
              <button 
                  type="button"
                  onClick={onRemove}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                  <X size={12}/>
              </button>
          </div>
      );
};

const SmartImportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { settings, saveProperty, updateSettings, showToast } = useStore();
    const [rawText, setRawText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [parsedProps, setParsedProps] = useState<Property[]>([]);
    const [step, setStep] = useState<'input' | 'preview'>('input');

    const { provider, apiKey, apiBaseUrl, apiModel, temperature } = settings.ai.marketing;
    
    const handleTestConnection = async () => {
        setIsAnalyzing(true);
        try {
            if (provider === 'gemini') {
                if (!process.env.API_KEY) throw new Error("环境变量中未检测到 Gemini API Key");
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                await ai.models.generateContent({
                    model: apiModel || 'gemini-2.5-flash',
                    contents: "Hi",
                });
            } else {
                if (!apiKey) throw new Error("请先在设置中配置 AI Key");
                let baseUrl = apiBaseUrl || 'https://api.deepseek.com';
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: apiModel || 'deepseek-chat',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5,
                        temperature: temperature ?? 1.3
                    })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
            showToast("API 连接成功！配置正确。", "success");
        } catch (e: any) {
            console.error(e);
            showToast(`连接失败: ${e.message}`, "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyze = async () => {
        if (!rawText.trim()) return;
        setIsAnalyzing(true);
        try {
            const systemPrompt = `You are a real estate data extraction assistant.
            The user will provide unstructured text or a table of real estate listings.
            Extract the following fields for each property into a JSON array:
            - garden (string): Name of the community/garden.
            - subArea (string): Zone/Phase name if any (e.g. "帝城苑").
            - building (string): Building/Block name (e.g. "1栋", "C座").
            - unit (string): Unit name if present (e.g. "1单元").
            - room (string): Room number.
            - layout (string): Full string e.g. "3室2厅".
            - layoutRoom (number): Bedrooms count.
            - layoutHall (number): Living rooms count. Default 1 if unknown.
            - layoutBath (number): Bathrooms count. Default 1 if unknown.
            - layoutBalcony (number): Balconies count. Default 1.
            - area (number): Area in sqm.
            - salePrice (number): Total sale price in Wan.
            - rentPrice (number): Rent price.
            - isSale (boolean): true if selling.
            - isRent (boolean): true if renting.
            - ownerName (string): Owner name if available.
            
            Return ONLY the JSON array.`;

            let jsonStr = '';

            if (provider === 'gemini') {
                if (!process.env.API_KEY) throw new Error("环境变量中未检测到 Gemini API Key。");
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                    model: apiModel || 'gemini-2.5-flash',
                    contents: rawText,
                    config: { systemInstruction: systemPrompt, responseMimeType: 'application/json', temperature: temperature ?? 1.3 }
                });
                jsonStr = response.text || '[]';
            } else {
                if (!apiKey) throw new Error("请先在设置中配置 AI Key");
                let baseUrl = apiBaseUrl || 'https://api.deepseek.com';
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                const model = apiModel || 'deepseek-chat';
                const targetUrl = `${baseUrl}/chat/completions`;
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: rawText }],
                        response_format: { type: 'json_object' },
                        temperature: temperature ?? 1.3
                    })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                jsonStr = data.choices[0].message.content;
            }

            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            let parsed = JSON.parse(jsonStr);
            if (!Array.isArray(parsed) && parsed.properties) parsed = parsed.properties;
            if (!Array.isArray(parsed)) throw new Error("无法解析 AI 返回的 JSON 格式");

            const formatted: Property[] = parsed.map((p: any) => {
                let floor = '';
                if (p.room) {
                    const roomStr = p.room.toString();
                    const numericMatch = roomStr.match(/^(\d+)(\d{2})$/);
                    if (numericMatch) {
                        floor = numericMatch[1];
                    } else {
                        const letterMatch = roomStr.match(/^(\d+)[a-zA-Z\u4e00-\u9fa5]+$/);
                        if (letterMatch) {
                            floor = letterMatch[1];
                        }
                    }
                }
                
                return {
                    id: Date.now().toString() + Math.random().toString().slice(2, 6),
                    garden: p.garden || '未命名',
                    subArea: p.subArea || '',
                    building: p.building || '',
                    unit: p.unit || '',
                    room: p.room || '',
                    layout: p.layout || `${p.layoutRoom || 0}室${p.layoutHall || 0}厅`,
                    layoutRoom: p.layoutRoom || 0,
                    layoutHall: p.layoutHall || 0,
                    layoutBath: p.layoutBath || 1,
                    layoutBalcony: p.layoutBalcony || 1,
                    area: Number(p.area) || 0,
                    salePrice: Number(p.salePrice) || undefined,
                    rentPrice: Number(p.rentPrice) || undefined,
                    isSale: !!p.isSale,
                    isRent: !!p.isRent,
                    ownerName: p.ownerName || '未知',
                    ownerContact: '',
                    status: 'active',
                    floor: floor,
                    updatedAt: Date.now(),
                    importDate: Date.now()
                };
            });

            setParsedProps(formatted);
            setStep('preview');

        } catch (e: any) {
            console.error("AI Import Error:", e);
            showToast("分析失败: " + e.message, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirmImport = async () => {
        const newGardenData = { ...settings.gardenData };
        let dictModified = false;

        for (const p of parsedProps) {
            await saveProperty(p);
            if (p.garden) {
                if (!newGardenData[p.garden]) {
                    newGardenData[p.garden] = [];
                    dictModified = true;
                }
                if (p.subArea && !newGardenData[p.garden].includes(p.subArea)) {
                    newGardenData[p.garden] = [...newGardenData[p.garden], p.subArea];
                    dictModified = true;
                }
            }
        }
        
        if (dictModified) {
            await updateSettings({ gardenData: newGardenData });
            showToast("检测到新楼盘结构，已同步至字典");
        }

        showToast(`成功导入 ${parsedProps.length} 套房源`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className="bg-bg-card w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
                <div className="p-6 border-b flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-brand-600"/> 智能导入房源</h2>
                    <button onClick={onClose}><X/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'input' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <p className="text-sm text-slate-500">请粘贴房源文本。</p>
                                <div className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border flex flex-col gap-1 min-w-[200px]">
                                    <div className="flex items-center justify-between font-bold text-slate-600 dark:text-slate-300">
                                        <span className="flex items-center gap-1"><Settings2 size={12}/> AI 驱动中</span>
                                        <button onClick={handleTestConnection} className="text-brand-600 hover:underline text-[10px] flex items-center gap-1" disabled={isAnalyzing}>
                                            <Signal size={10}/> {isAnalyzing ? '...' : '测试连接'}
                                        </button>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">源: {provider}</div>
                                </div>
                            </div>
                            <textarea 
                                className="w-full h-64 border rounded-xl p-4 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-mono"
                                placeholder="出售 松山湖 铂越府 5栋 602 4房 114平 155万..."
                                value={rawText}
                                onChange={e=>setRawText(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold">预览 ({parsedProps.length}套)</h3>
                                <button onClick={()=>setStep('input')} className="text-sm text-brand-600 hover:underline">返回修改</button>
                            </div>
                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <th className="p-3">楼盘</th>
                                            <th className="p-3">完整地址</th>
                                            <th className="p-3">户型/面积</th>
                                            <th className="p-3">价格</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedProps.map((p, i) => (
                                            <tr key={i}>
                                                <td className="p-3">{p.garden}</td>
                                                <td className="p-3">{p.subArea} {p.building} {p.unit?p.unit+'单元':''} {p.room}</td>
                                                <td className="p-3">{p.layout} / {p.area}㎡</td>
                                                <td className="p-3 font-bold text-brand-600">{p.isSale ? `${p.salePrice}万` : `${p.rentPrice}元`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 dark:bg-slate-800 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">取消</button>
                    {step === 'input' ? (
                        <button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing || !rawText.trim()}
                            className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={18}/> : <Bot size={18}/>}
                            {isAnalyzing ? 'AI 分析中...' : '开始识别'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleConfirmImport}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <CheckSquare size={18}/> 确认导入
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Properties = () => {
  const { properties, saveProperty, deleteProperty, bulkDeleteProperties, settings, uploadAsset, getAssetUrl, showToast, saveKey, keys, refreshData } = useStore();
  const [searchParams] = useSearchParams();
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
      const q = searchParams.get('q');
      if (q) setSearchTerm(q);
  }, [searchParams]);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      type: 'all' as 'all' | 'sale' | 'rent',
      garden: '',
      roomCount: '',
      priceMin: '',
      priceMax: '',
      areaMin: '',
      areaMax: '',
      floorMin: '',
      floorMax: ''
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  const [editingProp, setEditingProp] = useState<Partial<Property> | null>(null);
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [sharingProp, setSharingProp] = useState<Property | null>(null);
  const [showSmartImport, setShowSmartImport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFullAddress = (p: Property) => {
      let addr = `${p.garden}`;
      if (p.subArea) addr += ` ${p.subArea}`;
      addr += ` ${p.building}`;
      if (p.unit) addr += ` ${p.unit}单元`;
      addr += ` ${p.room}`;
      return addr;
  };

  const getCardAddress = (p: Property) => {
      let main = '';
      if (p.subArea) main += `${p.subArea} `;
      main += p.building;
      if (p.unit) main += ` ${p.unit}单元`; 
      main += ` ${p.room}`;
      return {
          main: main,
          garden: p.garden
      };
  };

  const availableSubAreas = useMemo(() => {
     if (!editingProp?.garden) return [];
     return settings.gardenData[editingProp.garden] || [];
  }, [editingProp?.garden, settings.gardenData]);

  const availableBuildings = useMemo(() => {
     if (!editingProp?.garden || !editingProp?.subArea) return [];
     const bData = settings.buildingDict?.[editingProp.garden]?.[editingProp.subArea];
     return bData?.units?.map(u => u.name) || [];
  }, [editingProp?.garden, editingProp?.subArea, settings.buildingDict]);

  const propertyTypes = ['flat', 'duplex', 'skip', 'villa', 'shop'];

  const filteredProps = useMemo(() => {
      return properties.filter(p => {
          if (searchTerm) {
              const fullStr = `${p.garden} ${p.subArea||''} ${p.building} ${p.room} ${p.keys || ''} ${p.ownerName} ${p.ownerContact}`.toLowerCase();
              const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t);
              const matchesSearch = terms.every(term => fullStr.includes(term));
              if (!matchesSearch) return false;
          }
          if (filters.type !== 'all') {
              if (filters.type === 'sale' && !p.isSale) return false;
              if (filters.type === 'rent' && !p.isRent) return false;
          }
          if (filters.garden && p.garden !== filters.garden) return false;
          if (filters.roomCount && p.layoutRoom !== Number(filters.roomCount)) return false;
          
          const price = filters.type === 'rent' ? p.rentPrice : (p.isSale ? p.salePrice : 0);
          if (filters.priceMin && (!price || price < Number(filters.priceMin))) return false;
          if (filters.priceMax && (!price || price > Number(filters.priceMax))) return false;

          if (filters.areaMin && p.area < Number(filters.areaMin)) return false;
          if (filters.areaMax && p.area > Number(filters.areaMax)) return false;

          const floorVal = parseInt(p.floor);
          if (filters.floorMin && (!floorVal || floorVal < Number(filters.floorMin))) return false;
          if (filters.floorMax && (!floorVal || floorVal > Number(filters.floorMax))) return false;

          return true;
      });
  }, [properties, searchTerm, filters]);

  const handleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
      if (selectedIds.size === filteredProps.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredProps.map(p => p.id)));
  };

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      if (confirm(`确定删除选中的 ${selectedIds.size} 套房源吗？`)) {
          await bulkDeleteProperties(Array.from(selectedIds));
          setSelectedIds(new Set());
      }
  };

  const handleExport = () => {
      const targetProps = selectedIds.size > 0 ? properties.filter(p => selectedIds.has(p.id)) : filteredProps;
      const data = targetProps.map(p => ({
          楼盘: p.garden,
          完整地址: getFullAddress(p),
          状态: p.status === 'active' ? '在售/租' : p.status === 'sold' ? '已售' : '已租',
          售价: p.isSale ? `${p.salePrice}万` : '-',
          租金: p.isRent ? `${p.rentPrice}元` : '-',
          面积: p.area,
          户型: p.layout,
          钥匙: p.keys || '-',
          业主: p.ownerName,
          电话: p.ownerContact
      }));
      exportToExcel(data, `房源列表_${new Date().toLocaleDateString()}`);
      showToast("导出成功");
  };

  const handleCompare = () => {
      if (selectedIds.size < 2 || selectedIds.size > 4) {
          showToast("请选择 2-4 套房源进行对比", "error");
          return;
      }
      setShowCompare(true);
  };

  const handleGardenChange = (val: string) => setEditingProp(prev => prev ? ({ ...prev, garden: val, subArea: '', building: '', unit: '' }) : null);
  const handleChange = (field: keyof Property, val: any) => setEditingProp(prev => prev ? ({ ...prev, [field]: val }) : null);
  
  const handleRoomChange = (val: string) => {
      let updates: Partial<Property> = { room: val };
      let extractedFloor = '';
      const numericMatch = val.match(/^(\d+)(\d{2})$/);
      if (numericMatch) {
          extractedFloor = numericMatch[1];
      } else {
          const letterMatch = val.match(/^(\d+)[a-zA-Z\u4e00-\u9fa5]+$/);
          if (letterMatch) {
              extractedFloor = letterMatch[1];
          }
      }
      if (extractedFloor) updates.floor = extractedFloor;
      setEditingProp(prev => prev ? ({ ...prev, ...updates }) : null);
  };
  
  const handleBuildingChange = (val: string) => {
       const bData = settings.buildingDict?.[editingProp?.garden!]?.[editingProp?.subArea!];
       const uData = bData?.units?.find(u => u.name === val);
       setEditingProp(prev => prev ? ({ 
           ...prev, 
           building: val, 
           orientation: uData?.orientation || prev?.orientation,
           remarks: uData?.remark ? (prev?.remarks ? prev.remarks + ' ' + uData.remark : uData.remark) : prev?.remarks
       }) : null);
  };

  const updateLayout = (field: keyof Property, val: number) => {
      setEditingProp(prev => {
          if (!prev) return null;
          const next = { ...prev, [field]: val };
          const layoutStr = `${next.layoutRoom||0}室${next.layoutHall||0}厅${next.layoutBath||0}卫${next.layoutBalcony||0}阳`;
          return { ...next, layout: layoutStr };
      });
  };
  const generateKeyNo = () => handleChange('keys', `K${Math.floor(100 + Math.random() * 900)}`);

  const generateAIRemarks = async () => {
      if (!editingProp) return;
      setIsGeneratingDesc(true);
      try {
          const prompt = `为一套位于${editingProp.garden}的房源写一段推广文案...`;
          const { provider, apiKey, apiBaseUrl, apiModel, temperature } = settings.ai.marketing;
          let text = '';
          if (provider === 'gemini') {
              if (!process.env.API_KEY) throw new Error("Missing Gemini Key");
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const res = await ai.models.generateContent({ model: apiModel || 'gemini-2.5-flash', contents: prompt, config: { temperature: temperature ?? 1.3 } });
              text = res.text || '';
          } else {
              if (!apiKey) throw new Error("Missing API Key");
              const url = (apiBaseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
              const res = await fetch(`${url}/chat/completions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                  body: JSON.stringify({ model: apiModel || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: temperature ?? 1.3 })
              });
              if(!res.ok) throw new Error(res.statusText);
              const data = await res.json();
              text = data.choices?.[0]?.message?.content || '';
          }
          handleChange('remarks', text);
      } catch(e: any) { showToast(`AI Error: ${e.message}`, "error"); } 
      finally { setIsGeneratingDesc(false); }
  };

  const handleFiles = async (files: File[]) => {
      if (!editingProp?.id) return;
      const newAssets: string[] = [...(editingProp.assets || [])];
      for (const file of files) {
          let fileToUpload = file;
          if (enableWatermark && file.type.startsWith('image/')) {
              fileToUpload = await addWatermark(file, `${settings.agentName} ${settings.agentPhone}`);
          }
          const filename = await uploadAsset(editingProp.id, fileToUpload);
          if (filename) newAssets.push(filename);
      }
      handleChange('assets', newAssets);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files && handleFiles(Array.from(e.target.files));
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); e.dataTransfer.files && handleFiles(Array.from(e.dataTransfer.files)); };
  
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProp) return;
      await saveProperty(editingProp as Property);
      if (editingProp.keys) {
          const existingKey = keys.find(k => k.keyNo === editingProp.keys);
          if (!existingKey) {
              await saveKey({
                  id: Date.now().toString(),
                  keyNo: editingProp.keys,
                  status: 'in_store',
                  propertyId: editingProp.id,
                  garden: editingProp.garden || '',
                  roomNo: `${editingProp.building}-${editingProp.room}`,
                  updatedAt: Date.now()
              });
          }
      }
      setEditingProp(null);
      await refreshData(true); 
  };

  return (
    <div className="h-full flex flex-col fade-in pb-20 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="text-brand-600"/> 房源管理</h1>
        <div className="flex gap-3">
            <button onClick={() => setShowSmartImport(true)} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold hover:bg-purple-200 flex items-center gap-2"><Sparkles size={20}/> 智能导入</button>
            <button onClick={() => setEditingProp({ id: Date.now().toString(), isSale: true, layoutRoom: 3, layoutHall: 2, layoutBath: 1, layoutBalcony: 1, status: 'active', assets: [] })} className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2"><Plus size={20}/> 新增房源</button>
        </div>
      </div>

      <div className="bg-bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
           <div className="p-4 flex flex-wrap gap-4 items-center justify-between border-b border-slate-100 dark:border-slate-800">
               <div className="relative w-full md:w-80">
                   <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                   <input className="w-full pl-10 pr-4 py-2 rounded-lg border bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-brand-500" placeholder="空格分隔多关键词搜索..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
               </div>
               <div className="flex gap-2 items-center">
                   <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold border border-slate-200 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 transition-colors">
                       <FileSpreadsheet size={18}/> <span className="hidden sm:inline">导出</span>
                   </button>
                   <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                   <button onClick={()=>setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-colors ${showFilters ? 'bg-brand-50 border-brand-500 text-brand-600' : 'border-slate-200 hover:bg-slate-50'}`}><Filter size={18}/> 筛选 {showFilters ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
                   <div className="h-8 w-px bg-slate-200 mx-2"></div>
                   <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                       <button onClick={()=>setViewMode('list')} className={`p-2 rounded transition-all ${viewMode==='list'?'bg-white dark:bg-slate-600 shadow text-brand-600':'text-slate-400'}`}><ListIcon size={20}/></button>
                       <button onClick={()=>setViewMode('grid')} className={`p-2 rounded transition-all ${viewMode==='grid'?'bg-white dark:bg-slate-600 shadow text-brand-600':'text-slate-400'}`}><Grid size={20}/></button>
                   </div>
               </div>
           </div>
           
           {showFilters && (
               <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">交易类型</label>
                           <select className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value as any, priceMin: '', priceMax: '' })}><option value="all">全部</option><option value="sale">仅出售</option><option value="rent">仅出租</option></select>
                       </div>
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">楼盘</label>
                           <select className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" value={filters.garden} onChange={e => setFilters({ ...filters, garden: e.target.value })}><option value="">全部楼盘</option>{Object.keys(settings.gardenData).map(g => <option key={g} value={g}>{g}</option>)}</select>
                       </div>
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">户型</label>
                           <select className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" value={filters.roomCount} onChange={e => setFilters({ ...filters, roomCount: e.target.value })}><option value="">不限</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}房</option>)}</select>
                       </div>
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">{filters.type === 'rent' ? '租金范围 (元)' : filters.type === 'sale' ? '售价范围 (万)' : '价格范围'}</label>
                           <div className="flex items-center gap-1">
                               <input type="number" disabled={filters.type === 'all'} className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900 disabled:opacity-50 disabled:bg-slate-100" placeholder={filters.type === 'all' ? '需选类型' : 'Min'} value={filters.priceMin} onChange={e => setFilters({ ...filters, priceMin: e.target.value })} />
                               <span className="text-slate-400">-</span>
                               <input type="number" disabled={filters.type === 'all'} className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900 disabled:opacity-50 disabled:bg-slate-100" placeholder={filters.type === 'all' ? '需选类型' : 'Max'} value={filters.priceMax} onChange={e => setFilters({ ...filters, priceMax: e.target.value })} />
                           </div>
                       </div>
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">面积范围 (㎡)</label>
                           <div className="flex items-center gap-1"><input type="number" className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" placeholder="Min" value={filters.areaMin} onChange={e => setFilters({ ...filters, areaMin: e.target.value })} /><span className="text-slate-400">-</span><input type="number" className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" placeholder="Max" value={filters.areaMax} onChange={e => setFilters({ ...filters, areaMax: e.target.value })} /></div>
                       </div>
                       <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">楼层范围</label>
                           <div className="flex items-center gap-1"><input type="number" className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" placeholder="Min" value={filters.floorMin} onChange={e => setFilters({ ...filters, floorMin: e.target.value })} /><span className="text-slate-400">-</span><input type="number" className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-slate-900" placeholder="Max" value={filters.floorMax} onChange={e => setFilters({ ...filters, floorMax: e.target.value })} /></div>
                       </div>
                   </div>
                   <div className="flex justify-end mt-4">
                        <button onClick={()=>setFilters({type: 'all', garden: '', roomCount: '', priceMin: '', priceMax: '', areaMin: '', areaMax: '', floorMin: '', floorMax: ''})} className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border shadow-sm transition-colors">
                            <RotateCcw size={12}/> 清除筛选条件
                        </button>
                   </div>
               </div>
           )}
      </div>

      <div className="flex-1">
        {filteredProps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Building2 size={48} className="mb-4 opacity-20"/><p>暂无符合条件的房源</p></div>
        ) : (
            <AutoSizer>
                {({ height, width }) => {
                    if (viewMode === 'grid') {
                        const columnWidth = 320;
                        const columnCount = Math.floor(width / columnWidth) || 1;
                        const rowHeight = 310;
                        const rowCount = Math.ceil(filteredProps.length / columnCount);

                        return (
                            <FixedSizeGrid
                                columnCount={columnCount}
                                columnWidth={width / columnCount}
                                height={height}
                                rowCount={rowCount}
                                rowHeight={rowHeight}
                                width={width}
                            >
                                {({ columnIndex, rowIndex, style }) => {
                                    const index = rowIndex * columnCount + columnIndex;
                                    if (index >= filteredProps.length) return null;
                                    const p = filteredProps[index];
                                    const isSelected = selectedIds.has(p.id);
                                    const addr = getCardAddress(p);
                                    
                                    return (
                                        <div style={{ ...style, padding: '10px' }}>
                                            <div 
                                                onClick={() => handleSelection(p.id)} 
                                                className={`bg-bg-card rounded-xl border h-full flex flex-col transition-all cursor-pointer overflow-hidden group relative hover:shadow-lg ${isSelected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200 dark:border-slate-700'}`}
                                            >
                                                <div className="h-32 bg-slate-200 dark:bg-slate-700 relative shrink-0">
                                                    <LazyImage 
                                                        filename={p.assets?.[0]} 
                                                        className="w-full h-full"
                                                        placeholder={<Building2 size={32} className="opacity-20"/>}
                                                    />
                                                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">{p.status === 'active' ? '在售/租' : p.status === 'sold' ? '已售' : '已租'}</div>
                                                    {isSelected && <div className="absolute top-2 left-2 bg-brand-600 text-white rounded p-1"><CheckSquare size={16}/></div>}
                                                </div>
                                                <div className="p-4 flex-1 flex flex-col min-h-0">
                                                    <div className="flex justify-between items-start mb-1 shrink-0">
                                                        <div className="text-sm font-bold text-slate-500 truncate pr-2" title={addr.garden}>{addr.garden}</div>
                                                        <div className="text-brand-600 font-black whitespace-nowrap text-sm">{p.isSale ? `${p.salePrice}万` : `${p.rentPrice}/月`}</div>
                                                    </div>
                                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 truncate shrink-0" title={addr.main}>
                                                        {addr.main}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mb-3 flex items-center gap-2 overflow-hidden whitespace-nowrap shrink-0">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{p.floor}层</span>
                                                        <span>|</span>
                                                        <span>{p.layout}</span>
                                                        <span>|</span>
                                                        <span>{p.area}㎡</span>
                                                        {p.keys && <span className="ml-auto flex items-center gap-1 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200"><KeyRound size={10}/> {p.keys}</span>}
                                                    </div>
                                                    <div className="mt-auto flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0" onClick={e=>e.stopPropagation()}>
                                                        <button onClick={()=>setSharingProp(p)} className="flex-1 py-1.5 bg-green-50 text-green-600 rounded text-xs font-bold hover:bg-green-100 flex items-center justify-center gap-1"><Share2 size={12}/> 分享</button>
                                                        <button onClick={()=>setEditingProp(p)} className="flex-1 py-1.5 bg-slate-50 text-slate-600 rounded text-xs font-bold hover:bg-slate-100">编辑</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            </FixedSizeGrid>
                        );
                    } else {
                        return (
                            <div style={{ height, width }} className="border rounded-xl overflow-hidden border-slate-200 dark:border-slate-700 bg-bg-card">
                                <div className="flex bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 border-b dark:border-slate-700 text-sm h-12 items-center px-2" style={{ height: 48 }}>
                                    <div className="w-10 text-center"><button onClick={handleSelectAll}>{selectedIds.size === filteredProps.length && filteredProps.length > 0 ? <CheckSquare size={18}/> : <Square size={18}/>}</button></div>
                                    <div className="flex-1">楼盘</div>
                                    <div className="flex-[2]">具体地址</div>
                                    <div className="flex-1">价格</div>
                                    <div className="flex-1">楼层/户型</div>
                                    <div className="flex-1">面积</div>
                                    <div className="flex-1">钥匙</div>
                                    <div className="w-24 text-center">操作</div>
                                </div>
                                <FixedSizeList
                                    height={height - 48} 
                                    itemCount={filteredProps.length}
                                    itemSize={60}
                                    width={width}
                                >
                                    {({ index, style }) => {
                                        const p = filteredProps[index];
                                        const isSelected = selectedIds.has(p.id);
                                        return (
                                            <div style={style} className={`flex items-center px-2 text-sm border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`} onClick={() => handleSelection(p.id)}>
                                                <div className={`w-10 text-center ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}</div>
                                                <div className="flex-1 font-bold text-slate-500 truncate">{p.garden}</div>
                                                <div className="flex-[2] font-black text-slate-800 dark:text-slate-200 truncate pr-2">
                                                    {p.subArea} {p.building} {p.unit&&p.unit!=='/'?`${p.unit}单元`:''} <span className="text-brand-600">{p.room}</span>
                                                </div>
                                                <div className="flex-1 font-bold text-brand-600">{p.isSale ? `${p.salePrice}万` : `${p.rentPrice}/月`}</div>
                                                <div className="flex-1 truncate">{p.floor}层 / {p.layout}</div>
                                                <div className="flex-1">{p.area}㎡</div>
                                                <div className="flex-1 font-mono text-xs">{p.keys || '-'}</div>
                                                <div className="w-24 flex gap-2 justify-center" onClick={e=>e.stopPropagation()}>
                                                    <button onClick={()=>setSharingProp(p)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Share2 size={16}/></button>
                                                    <button onClick={()=>setEditingProp(p)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">编辑</button>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </FixedSizeList>
                            </div>
                        );
                    }
                }}
            </AutoSizer>
        )}
      </div>

      {selectedIds.size > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3 flex items-center gap-6 z-20 animate-in slide-in-from-bottom-10 fade-in">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">已选 {selectedIds.size} 项</span>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
              <button onClick={handleCompare} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors"><ArrowRightLeft size={18}/> 对比</button>
              <button onClick={handleExport} className="flex items-center gap-2 text-sm font-bold text-green-600 hover:bg-green-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors"><FileSpreadsheet size={18}/> 导出</button>
              <button onClick={handleBulkDelete} className="flex items-center gap-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"><Trash2 size={18}/> 删除</button>
              <button onClick={()=>setSelectedIds(new Set())} className="p-1 hover:bg-slate-100 rounded-full"><X size={16}/></button>
          </div>
      )}

      {showCompare && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-bg-card w-full max-w-5xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft/> 房源对比</h2>
                      <button onClick={()=>setShowCompare(false)}><X/></button>
                  </div>
                  <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr>
                                  <th className="p-3 border-b dark:border-slate-700 w-32 bg-slate-50 dark:bg-slate-800">对比项</th>
                                  {Array.from(selectedIds).map(id => {
                                      const p = properties.find(i=>i.id===id);
                                      return p ? <th key={id} className="p-3 border-b dark:border-slate-700 min-w-[200px]">{getFullAddress(p)}</th> : null;
                                  })}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              <tr><td className="p-3 font-bold bg-slate-50">总价</td>{Array.from(selectedIds).map(id => { const p = properties.find(i=>i.id===id); return p ? <td key={id} className="p-3 font-bold text-brand-600 text-lg">{p.isSale ? p.salePrice+'万' : '-'}</td> : null; })}</tr>
                              <tr><td className="p-3 font-bold bg-slate-50">单价</td>{Array.from(selectedIds).map(id => { const p = properties.find(i=>i.id===id); return p ? <td key={id} className="p-3">{(p.isSale && p.salePrice) ? Math.round(p.salePrice*10000/p.area) + '元/㎡' : '-'}</td> : null; })}</tr>
                              <tr><td className="p-3 font-bold bg-slate-50">面积/户型</td>{Array.from(selectedIds).map(id => { const p = properties.find(i=>i.id===id); return p ? <td key={id} className="p-3">{p.area}㎡ / {p.layout}</td> : null; })}</tr>
                              <tr><td className="p-3 font-bold bg-slate-50">楼层/电梯</td>{Array.from(selectedIds).map(id => { const p = properties.find(i=>i.id===id); return p ? <td key={id} className="p-3">{p.floor}层 ({p.elevator||'-'})</td> : null; })}</tr>
                              <tr><td className="p-3 font-bold bg-slate-50">朝向/装修</td>{Array.from(selectedIds).map(id => { const p = properties.find(i=>i.id===id); return p ? <td key={id} className="p-3">{p.orientation} / {p.renovation}</td> : null; })}</tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {editingProp && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingProp(null)}></div>
           <div className="flex min-h-full items-center justify-center p-0 md:p-4">
               <div className="relative bg-bg-card w-full max-w-3xl rounded-none md:rounded-2xl shadow-2xl my-0 md:my-8 text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom-8 duration-300 border-0 md:border-2 border-slate-300 dark:border-slate-600 flex flex-col h-screen md:h-auto max-h-screen">
                  
                  <div className="relative h-64 shrink-0 bg-slate-800 overflow-hidden group rounded-t-none md:rounded-t-2xl">
                        {editingProp.assets && editingProp.assets.length > 0 ? (
                            <>
                                <LazyImage filename={editingProp.assets[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-purple-700"></div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-3xl font-black mb-1">{editingProp.garden || '新房源'} {editingProp.layout}</h2>
                                    <p className="text-white/80 font-medium text-sm flex items-center gap-2">
                                        {editingProp.subArea} {editingProp.building} {editingProp.room}
                                        <span className="w-1 h-1 rounded-full bg-white/50"></span>
                                        {editingProp.area}㎡
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-brand-300">{editingProp.isSale ? editingProp.salePrice : editingProp.rentPrice}<span className="text-lg text-white/80">{editingProp.isSale ? '万' : '元'}</span></div>
                                    <div className="text-xs bg-white/20 px-2 py-1 rounded backdrop-blur-sm inline-block mt-1">
                                        {editingProp.status === 'active' ? '在售/租' : editingProp.status === 'sold' ? '已售' : '已租'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            type="button" 
                            onClick={()=>setEditingProp(null)} 
                            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
                        >
                            <X size={24}/>
                        </button>
                  </div>

                  <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200"><MapPin size={16} className="text-brand-600"/> 位置信息</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="space-y-1 relative group">
                              <label className="text-xs font-bold text-slate-500">楼盘</label>
                              <input list="gardenList" name="garden" value={editingProp.garden || ''} onChange={e => handleGardenChange(e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-brand-500 transition-all" placeholder="选择或输入楼盘"/>
                              <datalist id="gardenList">{Object.keys(settings.gardenData).map(k=><option key={k} value={k}/>)}</datalist>
                           </div>
                           <div className="space-y-1"><label className="text-xs font-bold text-slate-500">分区 </label><input list="subAreaList" name="subArea" value={editingProp.subArea || ''} onChange={e => handleChange('subArea', e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-brand-500 transition-all" placeholder="选择分区"/><datalist id="subAreaList">{availableSubAreas.map(s => <option key={s} value={s}/>)}</datalist></div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                             <div className="space-y-1"><label className="text-xs font-bold text-slate-500">栋座 </label><input list="buildingList" name="building" value={editingProp.building || ''} onChange={e => handleBuildingChange(e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900" placeholder="栋座"/><datalist id="buildingList">{availableBuildings.map(u => <option key={u} value={u}/>)}</datalist></div>
                             <div className="space-y-1"><label className="text-xs font-bold text-slate-500">单元 </label><input name="unit" value={editingProp.unit || ''} onChange={e => handleChange('unit', e.target.value)} placeholder="如: 1" className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900"/></div>
                             <div className="space-y-1"><label className="text-xs font-bold text-slate-500">房号 (自动提取楼层)</label><input name="room" value={editingProp.room || ''} onChange={e => handleRoomChange(e.target.value)} placeholder="如: 602" className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900 font-bold text-brand-600" required/></div>
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">楼层</label>
                                <input disabled value={editingProp.floor || '-'} className="w-full border rounded p-2 bg-slate-100 dark:bg-slate-800 text-slate-500"/>
                             </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 flex items-center gap-4">
                            <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><KeyRound size={14}/> 钥匙管理</label>
                            <div className="flex-1 flex gap-2"><input className="border rounded p-1.5 text-sm flex-1 bg-slate-50 dark:bg-slate-900 uppercase font-mono font-bold" placeholder="钥匙编号 (如 A-101)" value={editingProp.keys || ''} onChange={e => handleChange('keys', e.target.value)}/><button type="button" onClick={generateKeyNo} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-200">自动生成</button></div>
                        </div>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <label className="flex flex-col"><span className="text-xs text-slate-500 font-bold mb-1">几房</span><select value={editingProp.layoutRoom} onChange={e=>updateLayout('layoutRoom', Number(e.target.value))} className="border rounded p-2 bg-slate-50 dark:bg-slate-900">{[0,1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                            <label className="flex flex-col"><span className="text-xs text-slate-500 font-bold mb-1">几厅</span><select value={editingProp.layoutHall} onChange={e=>updateLayout('layoutHall', Number(e.target.value))} className="border rounded p-2 bg-slate-50 dark:bg-slate-900">{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                            <label className="flex flex-col"><span className="text-xs text-slate-500 font-bold mb-1">几卫</span><select value={editingProp.layoutBath} onChange={e=>updateLayout('layoutBath', Number(e.target.value))} className="border rounded p-2 bg-slate-50 dark:bg-slate-900">{[0,1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                            <label className="flex flex-col"><span className="text-xs text-slate-500 font-bold mb-1">几阳台</span><select value={editingProp.layoutBalcony} onChange={e=>updateLayout('layoutBalcony', Number(e.target.value))} className="border rounded p-2 bg-slate-50 dark:bg-slate-900">{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-xs font-bold text-slate-500">面积 (平米)</label><input name="area" type="number" value={editingProp.area || ''} onChange={e => handleChange('area', e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900" required/></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-slate-500">装修</label><input list="renovationList" name="renovation" value={editingProp.renovation || ''} onChange={e => handleChange('renovation', e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900" placeholder="选择或输入装修"/><datalist id="renovationList"><option value="毛坯"/><option value="简装"/><option value="精装"/><option value="豪装"/></datalist></div>
                        </div>
                     </div>
                     <div className="space-y-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                         <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><FileText size={14}/> 房源备注</label><button type="button" onClick={generateAIRemarks} disabled={isGeneratingDesc} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-purple-200 transition-colors">{isGeneratingDesc ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} AI 生成文案</button></div>
                         <textarea name="remarks" value={editingProp.remarks || ''} onChange={e => handleChange('remarks', e.target.value)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900 h-24 text-sm resize-none"/>
                     </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                        <div className="flex gap-4 items-center flex-wrap">
                           <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="isSale" checked={editingProp.isSale || false} onChange={e => handleChange('isSale', e.target.checked)}/> 出售</label>
                           <input name="salePrice" type="number" value={editingProp.salePrice || ''} onChange={e => handleChange('salePrice', e.target.value)} placeholder="售价(万)" className="border rounded p-1 w-24 bg-slate-50 dark:bg-slate-900"/>
                           <label className="flex items-center gap-2 font-bold ml-4"><input type="checkbox" name="isRent" checked={editingProp.isRent || false} onChange={e => handleChange('isRent', e.target.checked)}/> 出租</label>
                           <input name="rentPrice" type="number" value={editingProp.rentPrice || ''} onChange={e => handleChange('rentPrice', e.target.value)} placeholder="租金(元)" className="border rounded p-1 w-24 bg-slate-50 dark:bg-slate-900"/>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <input name="ownerName" value={editingProp.ownerName || ''} onChange={e => handleChange('ownerName', e.target.value)} placeholder="业主姓名" className="border rounded p-2 bg-slate-50 dark:bg-slate-900" required/>
                        <input name="ownerContact" value={editingProp.ownerContact || ''} onChange={e => handleChange('ownerContact', e.target.value)} placeholder="业主电话" className="border rounded p-2 bg-slate-50 dark:bg-slate-900" required/>
                     </div>
                     <div className="pt-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-center mb-2"><label className="font-bold">图片/视频资料</label></div>
                        <div className="space-y-4">
                            <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors cursor-pointer ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}`} onDragOver={handleDragOver} onDragLeave={()=>setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                                <Upload size={32} className={`mb-2 ${isDragging ? 'text-brand-500' : 'text-slate-400'}`}/>
                                <div className="text-sm font-bold text-slate-600 dark:text-slate-400">点击上传 或 拖拽文件至此</div>
                                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,video/*" onChange={handleFileSelect}/>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                               {editingProp.assets?.map((f, i) => <AssetDisplay key={i} filename={f} onRemove={() => handleChange('assets', editingProp.assets?.filter(a => a !== f))} getAssetUrl={getAssetUrl}/>)}
                            </div>
                        </div>
                     </div>
                  </form>
                  
                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 md:rounded-b-2xl shadow-lg z-10">
                        <button type="button" onClick={() => { if(confirm('确认删除?')) { deleteProperty(editingProp.id!); setEditingProp(null); } }} className="text-red-500 flex items-center gap-1 hover:bg-red-50 px-3 py-2 rounded transition-colors"><Trash2 size={16}/> 删除房源</button>
                        <div className="flex gap-3">
                           <button type="button" onClick={()=>setEditingProp(null)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors">取消</button>
                           <button onClick={handleSubmit} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 hover:shadow-brand-500/30 transition-all transform hover:-translate-y-0.5">保存更改</button>
                        </div>
                  </div>
               </div>
           </div>
        </div>
      )}

      {sharingProp && <WeChatShare property={sharingProp} onClose={()=>setSharingProp(null)}/>}
      {showSmartImport && <SmartImportModal onClose={()=>setShowSmartImport(false)}/>}
    </div>
  );
};
