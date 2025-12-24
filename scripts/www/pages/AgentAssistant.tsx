
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, User, Sparkles, Loader2, CheckCircle2, Trash2, Mic, StopCircle, BarChart3, PieChart, Wrench, X, Activity, Waves, ExternalLink, AlertTriangle, BookOpen, Plus, FileText, Upload, Database, MessageSquare, Calculator, Building2, Phone, KeyRound, ArrowRight } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../context/StoreContext';
import { Property, Customer, KeyRecord, FollowUp, KnowledgeDoc, ChartData } from '../types';
import { retrieveRelevantContext, formatContextForPrompt } from '../utils/rag';
import { CHART_COLORS, TOOLS_DEFINITION } from '../constants';

interface MortgageData {
    principal: number; // Wan
    years: number;
    rate: number;
    monthly: number; // Yuan
    totalInterest: number; // Wan
    totalPayment: number; // Wan
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  time: string;
  isAction?: boolean; 
  chartData?: ChartData; 
  properties?: Property[]; // For rich display
  customers?: Customer[]; // For rich display
  mortgage?: MortgageData; // For rich display
  toolUsed?: string; // Track which tool was used for custom icons
}

interface ToolResult {
    text: string;
    data?: any;
    type?: 'property_list' | 'customer_list' | 'key_list' | 'mortgage_result';
}

// --- VISUALIZATION COMPONENTS ---
const ChartComponent = ({ data }: { data: ChartData }) => {
    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        return <div className="text-xs text-red-400 p-2 border border-red-200 rounded">图表数据格式错误</div>;
    }

    const renderBarChart = () => {
        const maxValue = Math.max(...data.data.map(d => d.value)) || 1;
        return (
            <div className="space-y-3 pt-2">
                {data.data.map((item, idx) => (
                    <div key={idx} className="group">
                        <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                            <span className="font-bold truncate max-w-[70%]">{item.label}</span>
                            <span className="font-mono">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all duration-1000 ease-out" 
                                style={{ 
                                    width: `${Math.max(5, (item.value / maxValue) * 100)}%`,
                                    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                                }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderPieChart = () => {
        const total = data.data.reduce((sum, item) => sum + item.value, 0) || 1;
        let currentAngle = 0;
        
        const gradientSegments = data.data.map((item, idx) => {
            const percentage = (item.value / total) * 100;
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            const start = currentAngle;
            currentAngle += percentage;
            return `${color} ${start}% ${currentAngle}%`;
        }).join(', ');

        return (
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center pt-2">
                <div 
                    className="w-32 h-32 rounded-full shrink-0 shadow-inner border-4 border-slate-50 dark:border-slate-800"
                    style={{ background: `conic-gradient(${gradientSegments})` }}
                ></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {data.data.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[80px]" title={item.label}>{item.label}</span>
                            <span className="font-mono font-bold">{Math.round((item.value / total) * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="mt-3 p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 shadow-sm w-full max-w-md animate-in zoom-in-95 duration-300">
            <h4 className="font-bold text-center mb-4 text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 text-sm">
                {data.type === 'pie' ? <PieChart size={16}/> : <BarChart3 size={16}/>}
                {data.title}
            </h4>
            {data.type === 'pie' ? renderPieChart() : renderBarChart()}
        </div>
    );
};

// Fix: Use React.FC to handle the 'key' prop correctly when rendering in a list
const PropertyMiniCard: React.FC<{ prop: Property }> = ({ prop }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(`/properties?q=${encodeURIComponent(prop.garden + ' ' + prop.room)}`)}
            className="flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer min-w-[200px] w-full max-w-[240px]"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{prop.garden}</div>
                <div className="text-brand-600 font-black whitespace-nowrap text-sm">
                    {prop.isSale ? `${prop.salePrice}万` : `${prop.rentPrice}/月`}
                </div>
            </div>
            <div className="text-xs text-slate-500 mb-2 truncate">
                {prop.subArea} {prop.building} {prop.room}
            </div>
            <div className="flex gap-2 text-[10px] text-slate-400 mb-2">
                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{prop.layout}</span>
                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{prop.area}㎡</span>
                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{prop.floor}层</span>
            </div>
            {prop.features && prop.features.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                    {prop.features.slice(0, 2).map((f, i) => (
                        <span key={i} className="text-[10px] bg-red-50 text-red-600 px-1 py-0.5 rounded border border-red-100">{f}</span>
                    ))}
                </div>
            )}
            <button className="mt-auto w-full py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-100 flex items-center justify-center gap-1">
                查看详情 <ArrowRight size={10}/>
            </button>
        </div>
    );
};

// Fix: Use React.FC to handle the 'key' prop correctly when rendering in a list
const CustomerMiniCard: React.FC<{ cust: Customer }> = ({ cust }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(`/customers?q=${encodeURIComponent(cust.name)}`)}
            className="flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer min-w-[200px] w-full max-w-[240px]"
        >
            <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">{cust.name}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${cust.type==='buy'?'bg-red-500':'bg-blue-500'}`}>{cust.type==='buy'?'购':'租'}</span>
            </div>
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Phone size={10}/> {cust.phone}
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg text-xs space-y-1 mb-2">
                <div className="flex justify-between"><span className="text-slate-400">预算:</span> <span className="font-bold text-brand-600">{cust.budgetMin}-{cust.budgetMax}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">意向:</span> <span className="truncate max-w-[80px]">{cust.reqGardens?.[0] || '不限'}</span></div>
            </div>
            <button className="mt-auto w-full py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1">
                跟进客户 <MessageSquare size={10}/>
            </button>
        </div>
    );
};

const MortgageCard = ({ data }: { data: MortgageData }) => {
    return (
        <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm w-full max-w-xs">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><Calculator size={14} className="text-brand-600"/> 房贷计算结果</h4>
            <div className="flex justify-between items-end mb-4 pb-4 border-b border-dashed border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500">月供 (元)</div>
                <div className="text-2xl font-black text-brand-600">¥ {Math.round(data.monthly).toLocaleString()}</div>
            </div>
            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-slate-500">贷款总额</span>
                    <span className="font-mono">{data.principal} 万</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">年限/利率</span>
                    <span className="font-mono">{data.years}年 / {data.rate}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">利息总额</span>
                    <span className="font-mono text-orange-500">{data.totalInterest.toFixed(2)} 万</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">还款总额</span>
                    <span className="font-mono">{data.totalPayment.toFixed(2)} 万</span>
                </div>
            </div>
        </div>
    );
};

// --- VOICE HUD COMPONENT ---
const VoiceHUD: React.FC<{ status: 'listening' | 'processing' | 'idle', onClose: () => void }> = ({ status, onClose }) => {
    if (status === 'idle') return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                <X size={32}/>
            </button>
            
            <div className="relative mb-12">
                <div className={`absolute -inset-16 rounded-full border border-cyan-500/20 w-80 h-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${status === 'processing' ? 'animate-[spin_3s_linear_infinite]' : 'opacity-0'}`}></div>
                <div className={`absolute -inset-12 rounded-full border border-dashed border-cyan-400/30 w-72 h-72 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${status === 'processing' ? 'animate-[spin_4s_linear_infinite_reverse]' : 'opacity-0'}`}></div>
                <div className={`w-48 h-48 rounded-full blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors duration-500 ${status === 'listening' ? 'bg-cyan-500/30' : 'bg-purple-600/40'}`}></div>
                <div className={`relative w-32 h-32 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(6,182,212,0.4)] transition-all duration-500 ${status === 'listening' ? 'scale-110 bg-gradient-to-br from-cyan-400 to-blue-600 border-4 border-cyan-200/50' : 'scale-100 bg-gradient-to-br from-purple-500 to-indigo-700 border-4 border-purple-200/50 animate-pulse'}`}>
                    {status === 'listening' ? <Mic size={40} className="text-white drop-shadow-md" /> : <Bot size={40} className="text-white drop-shadow-md" />}
                </div>
            </div>

            <div className="text-center space-y-4 relative z-10">
                <h2 className={`text-3xl font-black tracking-[0.2em] uppercase transition-colors duration-300 ${status === 'listening' ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.8)]'}`}>
                    {status === 'listening' ? 'LISTENING' : 'PROCESSING'}
                </h2>
                <p className="text-white/60 text-sm font-mono tracking-widest">
                    {status === 'listening' ? '正在接收语音指令...' : '正在分析数据并生成回答...'}
                </p>
                {status === 'listening' && (
                    <div className="flex justify-center gap-1.5 h-8 items-center mt-6">
                        {[1,2,3,4,5,6,7].map(i => (
                            <div key={i} className="w-1.5 bg-cyan-400 rounded-full animate-[bounce_1s_infinite]" style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*24+8}px`}}></div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const AgentAssistant = () => {
  const store = useStore();
  const { properties, customers, keys, settings, saveProperty, saveCustomer, saveKey, addKeyLog, addFollowUp, addTodo, updateSettings, showToast, knowledgeDocs, saveKnowledgeDoc, deleteKnowledgeDoc } = store;
  
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  
  const [messages, setMessages] = useState<Message[]>(() => {
      try {
          const saved = localStorage.getItem('mh_agent_chat');
          return saved ? JSON.parse(saved) : [
            { 
                id: 'init', 
                role: 'assistant', 
                content: '我是您的全能业务助理。我可以帮您：\n\n🔹 查房源 / 查客源 / 查钥匙 (支持模糊搜索)\n🔹 修改资料 (如: 改价格/备注)\n🔹 钥匙借还\n🔹 📊 数据分析 & 💰 房贷计算\n\n按住麦克风图标可直接语音对话 🎙️', 
                time: new Date().toLocaleTimeString() 
            }
          ];
      } catch (e) {
          console.warn("Failed to parse chat history", e);
          return [
            { 
                id: 'init', 
                role: 'assistant', 
                content: '我是您的全能业务助理。我可以帮您：\n\n🔹 查房源 / 查客源 / 查钥匙 (支持模糊搜索)\n🔹 修改资料 (如: 改价格/备注)\n🔹 钥匙借还\n🔹 📊 数据分析 & 💰 房贷计算\n\n按住麦克风图标可直接语音对话 🎙️', 
                time: new Date().toLocaleTimeString() 
            }
          ];
      }
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false); 
  
  // Knowledge Base State
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      try {
          localStorage.setItem('mh_agent_chat', JSON.stringify(messages));
      } catch (e) { console.error("Failed to save chat history", e); }
      
      if (scrollRef.current && activeTab === 'chat') scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeTab]);

  const statsContext = useMemo(() => {
      const gardenCounts: Record<string, number> = {};
      properties.forEach(p => { gardenCounts[p.garden] = (gardenCounts[p.garden] || 0) + 1; });
      return `[Stats] Total Properties: ${properties.length}, Total Customers: ${customers.length}, Total Keys: ${keys.length}, Total Knowledge Docs: ${knowledgeDocs.length}. Garden Distribution: ${JSON.stringify(gardenCounts)}`;
  }, [properties, customers, knowledgeDocs, keys]);

  // Dictionary Context for Accurate Mapping
  const dictionaryContext = useMemo(() => {
      const entries = Object.entries(settings.gardenData).map(([garden, buildings]) => {
          const bldgList = buildings && (buildings as string[]).length > 0 ? `[${(buildings as string[]).join(',')}]` : '(No buildings)';
          return `${garden}: ${bldgList}`;
      });
      return entries.slice(0, 50).join('\n');
  }, [settings.gardenData]);

  const clearHistory = () => {
      if(confirm("确定清空对话记忆吗？")) {
          const initMsg: Message = { id: Date.now().toString(), role: 'assistant', content: '记忆已重置。', time: new Date().toLocaleTimeString() };
          setMessages([initMsg]);
      }
  };

  // --- Voice Handlers ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          mediaRecorder.onstop = handleAudioStop;
          mediaRecorder.start();
          setIsRecording(true);
      } catch (e) { showToast("无法访问麦克风", "error"); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
  };

  const handleAudioStop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
      if (audioBlob.size < 100) return; 
      
      setLoading(true);
      setIsVoiceProcessing(true);

      try {
          const voiceConfig = settings.ai.voice || { provider: 'openai' };
          let transcription = '';
          if (voiceConfig.provider === 'gemini') {
              if (!process.env.API_KEY) throw new Error("Missing Gemini Key");
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve) => { reader.onloadend = () => { resolve((reader.result as string).split(',')[1]); }; reader.readAsDataURL(audioBlob); });
              const base64Audio = await base64Promise;
              const response = await ai.models.generateContent({ 
                  model: 'gemini-2.5-flash', 
                  contents: {
                      parts: [
                          { inlineData: { mimeType: 'audio/webm', data: base64Audio } }, 
                          { text: "Transcribe audio exactly." }
                      ]
                  } 
              });
              transcription = response.text || '';
          } else {
              // Placeholder for OpenAI-compatible transcription if needed, or prompt user to type.
              transcription = "（语音识别功能需配置 Gemini Key 或其他服务）"; 
          }
          if (transcription) {
              setInput(transcription);
          }
      } catch (e: any) { showToast(`语音识别失败: ${e.message}`, 'error'); } 
      finally { 
          setLoading(false);
          setIsVoiceProcessing(false);
      }
  };

  const findCustomerFuzzy = (query: string): Customer | null => {
      if (!query) return null;
      const q = query.toLowerCase();
      let found = customers.find(c => c.name === query);
      if (found) return found;
      found = customers.find(c => c.name.startsWith(q));
      if (found) return found;
      return null;
  };

  // --- Knowledge Base Handlers ---
  const handleAddDoc = async () => {
      if (!newDocTitle.trim() || !newDocContent.trim()) return;
      await saveKnowledgeDoc({
          id: Date.now().toString(),
          title: newDocTitle,
          content: newDocContent,
          createdAt: Date.now(),
          updatedAt: Date.now()
      });
      setNewDocTitle('');
      setNewDocContent('');
      showToast("文档已添加，AI 现在可以检索此内容");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const text = ev.target?.result as string;
          if (text) {
              setNewDocTitle(file.name);
              setNewDocContent(text);
          }
      };
      reader.readAsText(file);
  };

  const executeTool = async (toolName: string, args: any): Promise<ToolResult> => {
      try {
          switch (toolName) {
              case 'search_properties': {
                  const props = properties.filter(p => {
                       if (p.status !== 'active') return false;
                       if (args.type && ((args.type === 'sale' && !p.isSale) || (args.type === 'rent' && !p.isRent))) return false;
                       if (args.minPrice) {
                           const price = p.isSale ? p.salePrice : p.rentPrice;
                           if (!price || price < args.minPrice) return false;
                       }
                       if (args.maxPrice) {
                           const price = p.isSale ? p.salePrice : p.rentPrice;
                           if (!price || price > args.maxPrice) return false;
                       }
                       if (args.rooms && p.layoutRoom !== args.rooms) return false;
                       if (args.keyword) {
                           const kw = args.keyword.toLowerCase();
                           if (!p.garden.toLowerCase().includes(kw) && !p.layout.toLowerCase().includes(kw)) return false;
                       }
                       return true;
                  }).slice(0, 8);
                  if (props.length === 0) return { text: "未找到符合条件的房源。是否需要【新增房源】？" };
                  return { 
                      text: `找到 ${props.length} 套房源:`,
                      data: props,
                      type: 'property_list'
                  };
              }
              case 'search_customers': {
                  const custs = customers.filter(c => c.name.includes(args.keyword) || c.phone.includes(args.keyword)).slice(0, 5);
                  if (custs.length === 0) return { text: "未找到客户。是否需要【新增客户】？" };
                  return {
                      text: `找到 ${custs.length} 位客户:`,
                      data: custs,
                      type: 'customer_list'
                  };
              }
              case 'search_keys': {
                  const kw = (args.keyword || '').toLowerCase();
                  const foundKeys = keys.filter(k => 
                      k.keyNo.toLowerCase().includes(kw) || 
                      k.garden.toLowerCase().includes(kw) || 
                      k.roomNo.toLowerCase().includes(kw) ||
                      (k.borrower && k.borrower.toLowerCase().includes(kw))
                  ).slice(0, 5);
                  
                  if (foundKeys.length === 0) return { text: `🔍 模糊搜索 "${args.keyword}" 未找到相关钥匙。\n\n💡 建议：\n1. 确认编号/地址是否正确\n2. 回复 "新增钥匙" 来录入新钥匙` };
                  
                  const text = `找到 ${foundKeys.length} 把钥匙:\n` + foundKeys.map(k => 
                      `- [${k.keyNo}] ${k.garden} ${k.roomNo} | 状态: ${k.status==='in_store'?'🟢 在库':`🔴 借出给 ${k.borrower}`}`
                  ).join('\n');
                  return { text };
              }
              case 'update_customer': {
                  const cust = customers.find(c => c.id === args.id);
                  if (!cust) return { text: "❌ 未找到该客户，请确认 ID。" };
                  const newCust = { ...cust, ...args.updates };
                  await saveCustomer(newCust);
                  return { text: `✅ 客户信息已更新: ${newCust.name}` };
              }
              case 'update_property': {
                  const prop = properties.find(p => p.id === args.id);
                  if (!prop) return { text: "❌ 未找到该房源，请确认 ID。" };
                  const newProp = { ...prop, ...args.updates };
                  await saveProperty(newProp);
                  return { text: `✅ 房源信息已更新: ${newProp.garden} ${newProp.room}` };
              }
              case 'render_chart': return { text: `✅ 图表 "${args.title}" 已生成。` }; 
              case 'add_property': 
                  const newProp: Property = {
                      id: Date.now().toString() + Math.random().toString().slice(2,5),
                      garden: args.garden,
                      subArea: args.subArea || '',
                      building: args.building || '',
                      unit: args.unit || '',
                      room: args.room,
                      layout: args.layout || '',
                      area: Number(args.area) || 0,
                      isSale: args.type === 'sale',
                      isRent: args.type === 'rent',
                      salePrice: args.type === 'sale' ? Number(args.price) : undefined,
                      rentPrice: args.type === 'rent' ? Number(args.price) : undefined,
                      ownerName: args.ownerName || '未知',
                      ownerContact: args.ownerPhone || '',
                      status: 'active',
                      floor: args.floor || '',
                      propertyType: args.propertyType || 'flat',
                      updatedAt: Date.now()
                  };
                  await saveProperty(newProp);
                  return { text: `✅ 房源已添加: ${newProp.garden} ${newProp.room}` };
              case 'add_customer': {
                  const newCust: Customer = { id: Date.now().toString(), name: args.name, phone: args.phone, type: args.type || 'buy', budgetMin: args.budgetMin, budgetMax: args.budgetMax, reqGardens: args.reqGardens || [], status: 'active', urgency: 'medium', updatedAt: Date.now() };
                  await saveCustomer(newCust);
                  return { text: `✅ 客户已录入：${newCust.name}` };
              }
              case 'add_key': {
                  const newKey: KeyRecord = {
                      id: Date.now().toString(),
                      keyNo: args.keyNo.toUpperCase(),
                      status: 'in_store',
                      garden: args.garden,
                      roomNo: args.roomNo,
                      updatedAt: Date.now()
                  };
                  await saveKey(newKey);
                  await addKeyLog({ id: Date.now().toString(), keyId: newKey.id, keyNo: newKey.keyNo, action: 'create', timestamp: Date.now(), operator: 'AI Assistant', details: 'AI 自动录入' });
                  return { text: `✅ 钥匙已录入库: [${newKey.keyNo}] ${newKey.garden} ${newKey.roomNo}` };
              }
              case 'add_garden': {
                  const currentGardens = { ...settings.gardenData };
                  if (currentGardens[args.name]) return { text: `ℹ️ 楼盘 "${args.name}" 已存在。` };
                  currentGardens[args.name] = args.buildings || [];
                  await updateSettings({ gardenData: currentGardens });
                  return { text: `✅ 楼盘字典已更新，新增: ${args.name}` };
              }
              case 'borrow_key': {
                  const targetKey = keys.find(k => k.keyNo.toUpperCase() === args.keyNo.toUpperCase());
                  if (!targetKey) return { text: `❌ 失败：找不到编号为 ${args.keyNo} 的钥匙。` };
                  if (targetKey.status === 'borrowed') return { text: `⚠️ 警告：钥匙 ${targetKey.keyNo} 当前已被 ${targetKey.borrower} 借出。` };
                  const updatedKey: KeyRecord = { ...targetKey, status: 'borrowed', borrower: args.borrower, borrowerPhone: args.phone, borrowReason: args.reason || 'AI 登记借出', borrowTime: Date.now(), updatedAt: Date.now() };
                  await saveKey(updatedKey);
                  await addKeyLog({ id: Date.now().toString(), keyId: targetKey.id, keyNo: targetKey.keyNo, action: 'borrow', borrower: args.borrower, phone: args.phone, reason: args.reason, operator: 'AI Assistant', timestamp: Date.now() });
                  return { text: `✅ 钥匙 ${args.keyNo} 已登记借出给 ${args.borrower}` };
              }
              case 'return_key': {
                  const targetKey = keys.find(k => k.keyNo.toUpperCase() === args.keyNo.toUpperCase());
                  if (!targetKey) return { text: `❌ 失败：找不到编号为 ${args.keyNo} 的钥匙。` };
                  if (targetKey.status === 'in_store') return { text: `ℹ️ 提示：钥匙 ${targetKey.keyNo} 已经在库中。` };
                  const updatedKey: KeyRecord = { ...targetKey, status: 'in_store', borrower: undefined, borrowerPhone: undefined, borrowReason: undefined, borrowTime: undefined, updatedAt: Date.now() };
                  await saveKey(updatedKey);
                  await addKeyLog({ id: Date.now().toString(), keyId: targetKey.id, keyNo: targetKey.keyNo, action: 'return', timestamp: Date.now(), operator: 'AI Assistant' });
                  return { text: `✅ 钥匙 ${args.keyNo} 已归还入库。` };
              }
              case 'add_followup': {
                  const cust = findCustomerFuzzy(args.customerName);
                  if (!cust) return { text: `❌ 未找到客户 "${args.customerName}"` };
                  await addFollowUp(cust.id, { id: Date.now().toString(), date: new Date().toISOString(), type: 'wechat', content: args.content });
                  return { text: `✅ 已为 ${cust.name} 添加跟进记录。` };
              }
              case 'add_todo': {
                  addTodo(args.text, args.dueDate);
                  return { text: `✅ 待办事项已添加: ${args.text}` };
              }
              case 'calculate_mortgage': {
                  const principalWan = args.loanAmount || 100;
                  const principal = principalWan * 10000;
                  const years = args.years || 30;
                  const ratePercent = args.rate || 3.25;
                  const monthlyRate = ratePercent / 100 / 12;
                  const months = years * 12;
                  
                  // Monthly Payment (Standard amortization)
                  const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
                  const totalPayment = monthlyPayment * months;
                  const totalInterest = totalPayment - principal;
                  
                  const result: MortgageData = {
                      principal: principalWan,
                      years,
                      rate: ratePercent,
                      monthly: monthlyPayment,
                      totalInterest: totalInterest / 10000,
                      totalPayment: totalPayment / 10000
                  };
                  return {
                      text: `房贷计算完成`,
                      data: result,
                      type: 'mortgage_result'
                  };
              }
              default: return { text: "未知的工具指令。" };
          }
      } catch (e: any) {
          console.error(e);
          return { text: `❌ 执行出错: ${e.message}` };
      }
  };

  const handleSend = async () => {
      if (!input.trim() || loading) return;
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, time: new Date().toLocaleTimeString() };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
          const { props, custs, docs, keys: relevantKeys } = await retrieveRelevantContext(userMsg.content, properties, customers, 5, knowledgeDocs, keys);
          const ragContext = formatContextForPrompt(props, custs, docs, relevantKeys);
          
          const systemPrompt = `
${TOOLS_DEFINITION}

[IMPORTANT PROTOCOL]
- If a user wants to RECORD or REGISTER a KEY (录入/增加/登记钥匙), you MUST use the "add_key" tool. 
- Do NOT just acknowledge the request without calling the tool.
- If you call a tool, your response should be ONLY the JSON for that tool, unless you need to ask for missing info.

[Current System Data Overview]
${statsContext}

[Dictionary / Location Mapping]
${dictionaryContext}

[Retrieval Context]
${ragContext}

Current Time: ${new Date().toLocaleString()}
Agent Name: ${settings.agentName || 'Partner'}
`;

          let responseText = '';
          const { provider, apiKey, apiBaseUrl, apiModel, temperature } = settings.ai.marketing;

          if (provider === 'gemini') {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const result = await ai.models.generateContent({
                  model: apiModel || 'gemini-2.5-flash',
                  contents: userMsg.content,
                  config: { systemInstruction: systemPrompt, temperature: temperature ?? 0.7 }
              });
              responseText = result.text || '';
          } else {
              if (!apiKey) throw new Error("Please configure API Key in settings.");
              let url = apiBaseUrl || 'https://api.deepseek.com';
              if (url.endsWith('/')) url = url.slice(0, -1);
              
              const res = await fetch(`${url}/chat/completions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                  body: JSON.stringify({
                      model: apiModel || 'deepseek-chat',
                      messages: [
                          { role: 'system', content: systemPrompt },
                          ...messages.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
                          { role: 'user', content: userMsg.content }
                      ],
                      temperature: temperature ?? 0.7
                  })
              });
              const data = await res.json();
              responseText = data.choices?.[0]?.message?.content || '';
          }

          // Check if response is tool call (JSON)
          let toolCall: any = null;
          let assistantText = responseText;
          
          // Try to extract JSON block
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
              try {
                  const potentialJson = jsonMatch[1] || jsonMatch[0];
                  const parsed = JSON.parse(potentialJson);
                  if (parsed.tool && parsed.args) {
                      toolCall = parsed;
                      assistantText = responseText.replace(jsonMatch[0], '').trim(); // Remove JSON from text display
                  }
              } catch (e) {
                  // Not valid JSON, ignore
              }
          }

          // Add assistant message if there is text
          if (assistantText) {
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: assistantText, time: new Date().toLocaleTimeString() }]);
          }

          // Execute Tool
          if (toolCall) {
              setProcessingAction(true);
              const toolMsgId = Date.now().toString() + '_tool';
              setMessages(prev => [...prev, { id: toolMsgId, role: 'system', content: `正在执行操作: ${toolCall.tool}...`, time: new Date().toLocaleTimeString(), isAction: true, toolUsed: toolCall.tool }]);
              
              const result = await executeTool(toolCall.tool, toolCall.args);
              
              // Update message with result AND potentially rich data
              setMessages(prev => prev.map(m => {
                  if (m.id === toolMsgId) {
                      const baseMsg = { ...m, content: result.text, isAction: false };
                      // Attach rich data if available
                      if (result.type === 'property_list') baseMsg.properties = result.data;
                      if (result.type === 'customer_list') baseMsg.customers = result.data;
                      if (result.type === 'mortgage_result') baseMsg.mortgage = result.data;
                      return baseMsg;
                  }
                  return m;
              }));
              setProcessingAction(false);
              
              // Handle Chart Rendering specially
              if (toolCall.tool === 'render_chart') {
                  const chartData: ChartData = toolCall.args;
                  setMessages(prev => [...prev, { id: Date.now().toString() + '_chart', role: 'assistant', content: '', time: new Date().toLocaleTimeString(), chartData }]);
              }
          }

      } catch (e: any) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col relative fade-in">
        <VoiceHUD status={isRecording ? 'listening' : isVoiceProcessing ? 'processing' : 'idle'} onClose={stopRecording} />
        
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="text-brand-600"/> 智能业务助理</h1>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white dark:bg-slate-700 shadow text-brand-600' : 'text-slate-500'}`}>
                    <MessageSquare size={16}/> 对话
                </button>
                <button onClick={() => setActiveTab('knowledge')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'knowledge' ? 'bg-white dark:bg-slate-700 shadow text-brand-600' : 'text-slate-500'}`}>
                    <Database size={16}/> 知识库
                </button>
            </div>
            <div className="flex gap-2">
                <button onClick={clearHistory} className="p-2 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"><Trash2 size={20}/></button>
            </div>
        </div>

        {activeTab === 'chat' ? (
            <div className="flex-1 bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                    {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 transition-all ${m.role === 'user' ? 'bg-brand-600 text-white' : m.role === 'system' ? (m.toolUsed?.includes('key') ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-slate-500 text-white') : 'bg-purple-600 text-white'}`}>
                                    {m.role === 'user' ? <User size={16}/> : m.role === 'system' ? (m.toolUsed?.includes('key') ? <KeyRound size={16}/> : <Wrench size={16}/>) : <Bot size={16}/>}
                                </div>
                                <div className="flex flex-col gap-1 w-full">
                                    {m.content && (
                                        <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${m.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : m.role === 'system' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-xs' : 'bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-tl-none text-slate-800 dark:text-slate-100'}`}>
                                            {m.content}
                                        </div>
                                    )}
                                    {/* Rich Content Renderers */}
                                    {m.chartData && <ChartComponent data={m.chartData} />}
                                    
                                    {m.mortgage && <MortgageCard data={m.mortgage} />}
                                    
                                    {m.properties && m.properties.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 w-full">
                                            {m.properties.map(p => <PropertyMiniCard key={p.id} prop={p} />)}
                                        </div>
                                    )}
                                    
                                    {m.customers && m.customers.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 w-full">
                                            {m.customers.map(c => <CustomerMiniCard key={c.id} cust={c} />)}
                                        </div>
                                    )}

                                    <div className={`text-[10px] text-slate-400 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>{m.time}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(loading || processingAction) && (
                        <div className="flex justify-start animate-in fade-in">
                             <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center"><Bot size={16}/></div>
                                <div className="bg-white dark:bg-slate-700 p-3 rounded-2xl rounded-tl-none border flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 size={16} className="animate-spin text-purple-600"/> 
                                    {processingAction ? '正在执行业务操作...' : 'AI 正在思考...'}
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 relative z-10">
                    <div className="flex gap-2 items-end">
                        <button 
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`p-3 rounded-xl transition-all duration-200 ${isRecording ? 'bg-red-500 text-white scale-110 shadow-red-500/50 shadow-lg' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-brand-600'}`}
                        >
                            {isRecording ? <Activity className="animate-pulse"/> : <Mic size={20}/>}
                        </button>
                        <div className="flex-1 relative">
                            <textarea 
                                className="w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 focus:border-brand-500 focus:ring-0 outline-none transition-all resize-none h-12 max-h-32 min-h-[48px]"
                                placeholder="输入指令 (如: 帮我把A-101钥匙借给张三，或者 查询碧桂园的钥匙)"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            />
                            <button 
                                onClick={handleSend} 
                                disabled={loading || !input.trim()}
                                className="absolute right-2 bottom-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:bg-slate-300 transition-colors"
                            >
                                <Send size={16}/>
                            </button>
                        </div>
                    </div>
                    <div className="text-[10px] text-center text-slate-400 mt-2">
                        支持语音输入 · 自动关联本地数据 · 请确保 API Key 已配置
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex-1 bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex flex-col overflow-hidden animate-in fade-in">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h2 className="font-bold text-lg mb-2">📚 业务知识库 (RAG)</h2>
                    <p className="text-sm text-slate-500 mb-4">在此添加公司内部文档（如：销售话术、小区评测、政策法规）。AI 将在回答时自动参考这些内容。</p>
                    
                    <div className="flex gap-4 items-start">
                        <div className="flex-1 space-y-2">
                            <input 
                                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                                placeholder="文档标题 (如: 碧桂园优缺点分析)"
                                value={newDocTitle}
                                onChange={e => setNewDocTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full border rounded-lg px-3 py-2 text-sm h-24 bg-white dark:bg-slate-800 resize-none"
                                placeholder="文档内容..."
                                value={newDocContent}
                                onChange={e => setNewDocContent(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleAddDoc} 
                                disabled={!newDocTitle || !newDocContent}
                                className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-brand-700 disabled:opacity-50"
                            >
                                <Plus size={16}/> 添加文档
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-50"
                            >
                                <Upload size={16}/> 导入文本
                            </button>
                            <input type="file" ref={fileInputRef} hidden accept=".txt,.md,.json" onChange={handleFileUpload}/>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {knowledgeDocs.length === 0 ? (
                        <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                            <BookOpen size={48} className="mb-4 opacity-20"/>
                            <p>知识库为空，请添加第一条文档</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {knowledgeDocs.map(doc => (
                                <div key={doc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow bg-white dark:bg-slate-800 group relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate pr-6">{doc.title}</h3>
                                        <button 
                                            onClick={() => deleteKnowledgeDoc(doc.id)} 
                                            className="text-slate-400 hover:text-red-500 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{doc.content}</p>
                                    <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                                        <span>ID: {doc.id.slice(-4)}</span>
                                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
