
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Users, Search, Settings2, X, CheckSquare, Plus, Trash2, Link as LinkIcon, Home, Clock, KeyRound, ArrowRightLeft, History, Bot, RefreshCw, Upload, Zap, ArrowRight, Coffee, Save, Monitor, Moon, Sun, Smartphone, User, Phone, Brain, Volume2, HardDrive, Download, FileJson, Loader2, Sparkles, Eye, EyeOff, FolderOpen, Globe, MessageSquare, ChevronRight, Cloud, CloudLightning, ShieldCheck, Radar, Radio, UserPlus, Check, Send, Database } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Fuse from 'fuse.js';
import { useStore } from '../context/StoreContext';
import { AIProfile, VoiceConfig, Property, Customer, Lead } from '../types';
import { SoulmateMatcher } from '../components/SoulmateMatcher';
import { MODEL_OPTIONS } from '../constants';
import { retrieveRelevantContext, formatContextForPrompt } from '../utils/rag';

const TiltCard: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className, onClick }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;
        setRotation({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => { setRotation({ x: 0, y: 0 }); };

    return (
        <div 
            ref={cardRef}
            className={`relative transition-all duration-200 ease-out transform preserve-3d ${className}`}
            style={{ transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1.02, 1.02, 1.02)` }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

// --- Embedded Chat Widget (Refactored from Modal) ---
const EmbeddedChatWidget: React.FC = () => {
    const { properties, customers, settings, showToast, knowledgeDocs } = useStore();
    const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string, time: string}[]>(() => {
        try {
            const saved = localStorage.getItem('mh_agent_chat');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        localStorage.setItem('mh_agent_chat', JSON.stringify(messages));
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = { role: 'user' as const, content: input, time: new Date().toLocaleTimeString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // RAG Context Retrieval
            const { props, custs, docs } = await retrieveRelevantContext(userMsg.content, properties, customers, 5, knowledgeDocs);
            const context = formatContextForPrompt(props, custs, docs);
            
            const systemPrompt = `You are "MingHui AI", a helpful real estate assistant.
            Use the following context to answer the user's question.
            Context:
            ${context}
            
            Answer concisely and professionally in Chinese.`;

            let reply = '';
            const { provider, apiKey, apiBaseUrl, apiModel, temperature } = settings.ai.marketing;

            if (provider === 'gemini') {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const res = await ai.models.generateContent({
                    model: apiModel || 'gemini-3-flash-preview',
                    contents: userMsg.content,
                    config: { systemInstruction: systemPrompt, temperature: temperature ?? 0.7 }
                });
                reply = res.text || '无回复';
            } else {
                if (!apiKey) throw new Error("请配置 API Key");
                const res = await fetch(`${apiBaseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: apiModel || 'deepseek-chat',
                        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-4).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMsg.content }],
                        temperature: temperature ?? 0.7
                    })
                });
                const data = await res.json();
                reply = data.choices?.[0]?.message?.content || 'API Error';
            }
            setMessages(prev => [...prev, { role: 'assistant', content: reply, time: new Date().toLocaleTimeString() }]);
        } catch (e: any) {
            showToast(e.message, 'error');
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 relative">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-brand-600 text-white p-1.5 rounded-lg"><Bot size={18}/></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">AI 业务助理</h3>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1"><Database size={10}/> 已连接本地知识库</div>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-10">
                        <Bot size={40} className="mx-auto mb-3 opacity-20"/>
                        <p>你好，我是你的 AI 助理。<br/>请问有什么可以帮你？</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${m.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none'}`}>
                            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                            <div className={`text-[9px] mt-1 opacity-60 ${m.role==='user'?'text-right':'text-left'}`}>{m.time}</div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 size={14} className="animate-spin text-brand-600"/> 思考中...
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex gap-2">
                    <input 
                        className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                        placeholder="输入问题..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') handleSend() }}
                    />
                    <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-brand-600 text-white p-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 shadow-md transition-colors">
                        <Send size={18}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Dashboard = () => {
  const { properties, customers, settings, updateSettings, exportAllData, importData, todos, addTodo, toggleTodo, deleteTodo, keys, keyLogs, initFileSystem, createSnapshot, isLoading, appointments, notifications, leads, syncOnlineLeads, processLead, pushToCloud, pullFromCloud, isSyncing, showToast } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showSoulmateMatcher, setShowSoulmateMatcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'basic'|'ai'|'sync'|'leads'|'cloud'|'voice'|'logs'>('basic'); 
  const [showApiKey, setShowApiKey] = useState(false); 
  
  const [newTodo, setNewTodo] = useState('');
  const [tempLink, setTempLink] = useState<{type: 'property'|'customer'|'key', id: string, name: string} | undefined>(undefined);
  
  // Agent Management State
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPhone, setNewPresetPhone] = useState('');

  const [briefing, setBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const searchResults = useMemo<{ props: Property[], custs: Customer[] }>(() => {
      if (!searchTerm.trim()) return { props: [], custs: [] };
      const propFuse = new Fuse<Property>(properties, { keys: ['garden', 'building', 'room', 'layout'], threshold: 0.4 });
      const custFuse = new Fuse<Customer>(customers, { keys: ['name', 'phone'], threshold: 0.4 });
      return { props: propFuse.search(searchTerm).map(r => r.item), custs: custFuse.search(searchTerm).map(r => r.item) };
  }, [searchTerm, properties, customers]);

  const newLeads = useMemo(() => leads.filter(l => l.status === 'new'), [leads]);

  const generateBriefing = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Optimization: Check cache first
      const cached = localStorage.getItem('mh_daily_briefing');
      if (cached) {
          try {
              const parsed = JSON.parse(cached);
              if (parsed.date === todayStr && parsed.content && parsed.content.length > 5) {
                  setBriefing(parsed.content);
                  return;
              }
          } catch(e) {}
      }

      const todayAppts = appointments.filter(a => a.date === todayStr && a.status === 'scheduled');
      if (todayAppts.length === 0 && newLeads.length === 0) {
          const defaultMsg = "今天暂无紧急安排，祝您开单顺利！";
          setBriefing(defaultMsg);
          localStorage.setItem('mh_daily_briefing', JSON.stringify({ date: todayStr, content: defaultMsg }));
          return;
      }
      
      setBriefingLoading(true);
      try {
          const prompt = `你是明惠房产管家。今天有${todayAppts.length}个看房预约，${newLeads.length}条新线索。请写一段简短的晨间鼓励语。`;
          const { provider, apiKey, apiBaseUrl, apiModel } = settings.ai.marketing;
          let text = '';
          if (provider === 'gemini') {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const res = await ai.models.generateContent({ model: apiModel || 'gemini-3-flash-preview', contents: prompt });
              text = res.text || '';
          } else if(apiKey) {
              const res = await fetch(`${apiBaseUrl}/chat/completions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                  body: JSON.stringify({ model: apiModel, messages: [{ role: 'user', content: prompt }] })
              });
              const data = await res.json();
              text = data.choices?.[0]?.message?.content || '';
          }
          const finalBriefing = text || "早安！新的一天也要充满活力。";
          setBriefing(finalBriefing);
          localStorage.setItem('mh_daily_briefing', JSON.stringify({ date: todayStr, content: finalBriefing }));
      } catch (e) { 
          setBriefing("早安！请查看今日任务。"); 
      } finally { 
          setBriefingLoading(false); 
      }
  };

  useEffect(() => { if (!isLoading) generateBriefing(); }, [isLoading, newLeads.length]);

  const isTechTheme = settings.theme === 'tech';

  const StatCard = ({ title, value, icon: Icon, colorClass, className }: any) => {
      const CardWrapper = isTechTheme ? TiltCard : 'div';
      return (
          <CardWrapper className={`bg-bg-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all group ${isTechTheme ? 'border-cyan-900/50 bg-slate-900/50 backdrop-blur' : ''} ${className}`}>
             <div className="flex justify-between items-start">
               <div className="space-y-1 z-10">
                 <p className={`font-medium ${isTechTheme ? 'text-cyan-400' : 'text-slate-500'}`}>{title}</p>
                 <div className="flex items-baseline gap-4 mt-1">{value}</div>
               </div>
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner z-10 ${colorClass}`}><Icon size={24}/></div>
             </div>
          </CardWrapper>
      );
  };

  return (
    <div className={`space-y-8 fade-in h-full overflow-y-auto custom-scrollbar pr-2 pb-20 ${isTechTheme ? 'text-cyan-50' : ''}`}>
      {showSoulmateMatcher && <SoulmateMatcher customers={customers} properties={properties} onClose={()=>setShowSoulmateMatcher(false)} />}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${isTechTheme ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : ''}`}>工作台</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-lg">{settings.agentName ? `欢迎回来，${settings.agentName}` : '欢迎回来'}</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative w-full md:w-[420px]">
               <Search className="absolute left-4 top-4 text-slate-400" size={24}/>
               <input className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:outline-none focus:ring-1 text-lg shadow-sm ${isTechTheme ? 'bg-slate-900/80 border-cyan-900 text-cyan-100 focus:border-cyan-500 focus:ring-cyan-500' : 'bg-bg-card border-slate-300 focus:border-brand-500 text-slate-800 dark:text-slate-200'}`} placeholder="全域搜索房源、客户、钥匙..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
               {searchTerm && searchResults.props.length > 0 && (
                 <div className="absolute top-16 left-0 right-0 bg-bg-card shadow-2xl rounded-2xl p-2 z-50 border-2 border-slate-300 dark:border-slate-700 max-h-96 overflow-y-auto">
                    {searchResults.props.map(p => (
                        <Link to="/properties" key={p.id} className="block p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">
                            <div className="font-bold">{p.garden} {p.room}</div>
                            <div className="text-xs text-slate-400">{p.layout} | {p.salePrice || p.rentPrice}</div>
                        </Link>
                    ))}
                 </div>
               )}
            </div>
            <button onClick={() => setShowSettings(true)} className="p-4 rounded-2xl border-2 shadow-sm bg-bg-card border-slate-300 hover:bg-slate-50 transition-all"><Settings2 size={24}/></button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-2">
          {/* Compressed Sync Card */}
          <div className={`lg:col-span-2 p-4 rounded-2xl border shadow-lg flex items-center gap-3 relative overflow-hidden ${isTechTheme ? 'bg-slate-900 border-cyan-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
              <div className={`p-3 rounded-xl shrink-0 shadow-inner relative z-10 ${isTechTheme ? 'bg-cyan-900/50 text-cyan-400' : 'bg-brand-50 text-brand-600'}`}>
                  {isSyncing ? <RefreshCw className="animate-spin" size={24}/> : <ShieldCheck size={24}/>}
              </div>
              <div className="flex-1 relative z-10">
                  <div className="flex justify-between items-center mb-0.5">
                        <h3 className="font-black text-base tracking-tight">数据同步桥接器</h3>
                        {settings.syncConfig?.enabled && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">Active</span>}
                  </div>
                  <p className="text-xs opacity-60 mb-2 font-medium leading-relaxed line-clamp-2">
                      {settings.syncConfig?.enabled 
                        ? `上次推送: ${settings.syncConfig.lastSyncTime ? new Date(settings.syncConfig.lastSyncTime).toLocaleString() : '从未备份'}`
                        : '云端同步未开启。本地化存储架构支持直接读写本地磁盘文件夹。您可以随时切换本地工作区目录。'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                      {settings.syncConfig?.enabled && (
                        <>
                            <button onClick={pushToCloud} className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg transition-all"><Upload size={12}/> 推送快照</button>
                            <button onClick={pullFromCloud} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"><RefreshCw size={12}/> 从云端拉取</button>
                        </>
                      )}
                      <button 
                        onClick={() => initFileSystem(false)} 
                        className="px-3 py-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:text-brand-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm group/btn"
                      >
                          <FolderOpen size={12} className="text-slate-400 group-hover/btn:text-brand-500"/> 
                          更改本地存储目录
                      </button>
                  </div>
              </div>
          </div>
          
          {/* Compressed Radar Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                      <Radar size={16} className="animate-pulse text-indigo-200"/>
                      <h3 className="font-black tracking-tight text-sm">获客雷达</h3>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-3xl font-black">{newLeads.length}</span>
                      <span className="text-[10px] opacity-80 font-bold uppercase tracking-widest">New Leads</span>
                  </div>
              </div>
              <button 
                onClick={syncOnlineLeads}
                disabled={isSyncing}
                className="relative z-10 mt-2 bg-white/10 hover:bg-white/25 backdrop-blur-lg py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border border-white/20 active:scale-95 disabled:opacity-50"
              >
                  {isSyncing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                  同步中转站线索
              </button>
              <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700"><Globe size={100}/></div>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
        <StatCard title="房源库存" icon={Building2} colorClass="bg-blue-100 text-blue-600" value={
           <div className="flex items-baseline gap-4 mt-1">
               <div><span className="text-3xl font-black text-slate-800 dark:text-slate-200">{properties.filter(p=>p.isSale && p.status==='active').length}</span><span className="text-xs text-slate-400 ml-1 font-bold">在售</span></div>
               <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
               <div><span className="text-3xl font-black text-slate-800 dark:text-slate-200">{properties.filter(p=>p.isRent && p.status==='active').length}</span><span className="text-xs text-slate-400 ml-1 font-bold">在租</span></div>
           </div>
        }/>
        <StatCard title="待办任务" icon={CheckSquare} colorClass="bg-green-100 text-green-600" value={<h3 className="text-4xl font-black text-slate-800 dark:text-slate-200">{todos.filter(t=>!t.done).length}</h3>}/>
        <StatCard title="活跃客源" icon={Users} colorClass="bg-purple-100 text-purple-600" value={<h3 className="text-4xl font-black text-slate-800 dark:text-slate-200">{customers.length}</h3>}/>
        <div onClick={() => setShowSoulmateMatcher(true)} className="cursor-pointer"><StatCard title="智能匹配" icon={Sparkles} colorClass="bg-amber-100 text-amber-600" value={<span className="text-sm font-bold">点击启动引擎</span>}/></div>
      </div>
      
      {/* Workflow: Todo & Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-2">
         {/* Left: Todo */}
         <div className="p-6 rounded-2xl shadow-sm border bg-bg-card border-slate-200 dark:border-slate-700 flex flex-col h-[600px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl flex items-center gap-2"><Clock className="text-brand-500" size={24}/> 今日日程与待办</h3>
                <div className="flex gap-2 text-sm">
                    <Link to="/keys" className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold flex items-center gap-1 transition-colors"><KeyRound size={14}/> 钥匙挂板</Link>
                </div>
            </div>
            <div className="space-y-4 mb-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
               {todos.length === 0 ? (
                   <div className="text-center text-slate-400 py-20 flex flex-col items-center">
                       <CheckSquare size={48} className="mb-4 opacity-20"/>
                       <p>太棒了！今日待办已全部完成</p>
                   </div>
               ) : (
                   todos.map(t => (
                      <div key={t.id} className="flex items-start gap-4 p-3 rounded-xl group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                         <button onClick={()=>toggleTodo(t.id)} className={`mt-1 w-6 h-6 border-2 rounded-lg flex items-center justify-center transition-colors ${t.done ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-brand-500'}`}>{t.done && <CheckSquare size={16} className="text-white"/>}</button>
                         <div className="flex-1">
                             <div className={`text-base ${t.done ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200 font-medium'}`}>{t.text}</div>
                             {t.dueDate && <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock size={10}/> {t.dueDate}</div>}
                         </div>
                         <button onClick={()=>deleteTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-2 transition-opacity"><Trash2 size={18}/></button>
                      </div>
                   ))
               )}
            </div>
            <div className="relative pt-4 border-t border-slate-100 dark:border-slate-700">
               <div className="flex gap-3">
                   <input className="flex-1 border-2 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 outline-none focus:border-brand-500 text-sm font-medium" placeholder="添加新任务 (按回车快速添加)..." value={newTodo} onChange={e=>setNewTodo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') {addTodo(newTodo); setNewTodo('')}}}/>
                   <button onClick={()=>{addTodo(newTodo); setNewTodo('')}} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl w-12 flex items-center justify-center shadow-sm"><Plus size={24}/></button>
               </div>
            </div>
         </div>
         
         {/* Right: Chat */}
         <div className="rounded-2xl shadow-sm border bg-bg-card border-slate-200 dark:border-slate-700 h-[600px] overflow-hidden flex flex-col relative">
            <EmbeddedChatWidget />
         </div>
      </div>

      {/* Settings Modal (Added Voice Tab) */}
      {showSettings && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-bg-card w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                  <div className="w-48 bg-slate-50 dark:bg-slate-900 border-r flex flex-col p-4 gap-2 shrink-0">
                      <button onClick={()=>setSettingsTab('basic')} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${settingsTab==='basic'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-200'}`}>基础信息</button>
                      <button onClick={()=>setSettingsTab('ai')} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${settingsTab==='ai'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-200'}`}>营销 AI</button>
                      <button onClick={()=>setSettingsTab('voice')} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${settingsTab==='voice'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-200'}`}>语音助手</button>
                      <button onClick={()=>setSettingsTab('sync')} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${settingsTab==='sync'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-200'}`}>云端同步</button>
                      <button onClick={()=>setSettingsTab('logs')} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${settingsTab==='logs'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-200'}`}>系统日志</button>
                      <div className="mt-auto pt-4 border-t space-y-2">
                          <button onClick={exportAllData} className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg flex items-center gap-2"><Download size={14}/> 备份全量数据</button>
                          <button onClick={()=>fileInputRef.current?.click()} className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg flex items-center gap-2"><Upload size={14}/> 恢复备份</button>
                          <input type="file" ref={fileInputRef} hidden accept=".json" onChange={e=>e.target.files?.[0] && importData(e.target.files[0])}/>
                      </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col min-w-0">
                      <div className="p-6 border-b flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                          <h2 className="text-xl font-bold">系统设置</h2>
                          <button onClick={()=>setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50 dark:bg-slate-950">
                          {settingsTab === 'logs' && (
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center mb-2">
                                       <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700 dark:text-slate-200"><History size={20} className="text-brand-500"/> 系统操作日志</h3>
                                       <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">最近 100 条</span>
                                  </div>
                                  <div className="space-y-3">
                                      {keyLogs.slice(0, 100).map(log => (
                                          <div key={log.id} className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm flex flex-col gap-2 shadow-sm">
                                              <div className="flex justify-between items-start">
                                                  <span className="font-bold flex items-center gap-2">
                                                      {log.action === 'borrow' ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">🔑 借出</span> : 
                                                       log.action === 'return' ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✅ 归还</span> : 
                                                       log.action === 'create' ? <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">✨ 入库</span> :
                                                       log.action === 'delete' ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">🗑️ 删除</span> :
                                                       <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">📝 更新</span>}
                                                      <span className="font-mono text-slate-700 dark:text-slate-200">{log.keyNo}</span>
                                                  </span>
                                                  <span className="text-xs text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs">
                                                  <span className="text-slate-500 dark:text-slate-400">{log.details || log.borrower || '无备注'}</span>
                                                  <span className="text-slate-300 italic">操作员: {log.operator || 'System'}</span>
                                              </div>
                                          </div>
                                      ))}
                                      {keyLogs.length === 0 && <div className="text-center text-slate-400 py-10">暂无日志记录</div>}
                                  </div>
                              </div>
                          )}

                          {settingsTab === 'basic' && (
                              <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div><label className="text-xs font-bold text-slate-400 block mb-1">姓名</label><input className="w-full border rounded-xl p-3 bg-white dark:bg-slate-900 outline-none" value={settings.agentName} onChange={e=>updateSettings({agentName: e.target.value})}/></div>
                                      <div><label className="text-xs font-bold text-slate-400 block mb-1">电话</label><input className="w-full border rounded-xl p-3 bg-white dark:bg-slate-900 outline-none" value={settings.agentPhone} onChange={e=>updateSettings({agentPhone: e.target.value})}/></div>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 block mb-2">系统主题</label>
                                      <div className="grid grid-cols-4 gap-3">
                                          {['day', 'green', 'tech', 'classic'].map(t => (
                                              <button key={t} onClick={()=>updateSettings({theme: t as any})} className={`py-3 rounded-xl border-2 font-bold text-xs capitalize ${settings.theme===t?'border-brand-600 bg-brand-50 text-brand-600':'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>{t}</button>
                                          ))}
                                      </div>
                                  </div>

                                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                          <Users size={16} className="text-brand-600"/> 经纪人团队 / 多账号切换
                                      </h4>
                                      
                                      <div className="grid grid-cols-1 gap-3 mb-4">
                                          {settings.agentPresets?.map((agent, idx) => (
                                              <div key={idx} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-600 flex items-center justify-center font-bold">
                                                          {agent.name[0]}
                                                      </div>
                                                      <div>
                                                          <div className="font-bold text-sm">{agent.name}</div>
                                                          <div className="text-xs text-slate-500 font-mono">{agent.phone}</div>
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-2">
                                                      <button onClick={() => updateSettings({ agentName: agent.name, agentPhone: agent.phone })} className="px-3 py-1.5 bg-white dark:bg-slate-700 text-xs font-bold rounded-lg shadow-sm hover:text-brand-600 flex items-center gap-1">
                                                          <Check size={12}/> 切换
                                                      </button>
                                                      <button onClick={() => {
                                                          const newPresets = settings.agentPresets?.filter((_, i) => i !== idx);
                                                          updateSettings({ agentPresets: newPresets });
                                                      }} className="p-1.5 text-slate-400 hover:text-red-500">
                                                          <Trash2 size={14}/>
                                                      </button>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>

                                      <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                          <div className="flex-1">
                                              <label className="text-[10px] text-slate-400 font-bold uppercase">新增姓名</label>
                                              <input className="w-full bg-transparent border-b border-slate-300 dark:border-slate-600 py-1 text-sm outline-none" value={newPresetName} onChange={e=>setNewPresetName(e.target.value)} placeholder="姓名"/>
                                          </div>
                                          <div className="flex-1">
                                              <label className="text-[10px] text-slate-400 font-bold uppercase">新增电话</label>
                                              <input className="w-full bg-transparent border-b border-slate-300 dark:border-slate-600 py-1 text-sm outline-none" value={newPresetPhone} onChange={e=>setNewPresetPhone(e.target.value)} placeholder="电话"/>
                                          </div>
                                          <button 
                                              onClick={() => {
                                                  if(newPresetName && newPresetPhone) {
                                                      const newPresets = [...(settings.agentPresets || []), { name: newPresetName, phone: newPresetPhone }];
                                                      updateSettings({ agentPresets: newPresets });
                                                      setNewPresetName('');
                                                      setNewPresetPhone('');
                                                  }
                                              }}
                                              disabled={!newPresetName || !newPresetPhone}
                                              className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                                          >
                                              <Plus size={16}/>
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {settingsTab === 'voice' && (
                              <div className="space-y-6">
                                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                                      <h3 className="font-bold flex items-center gap-2 mb-2"><Volume2 size={18} className="text-blue-600"/> 语音引擎配置</h3>
                                      <p className="text-sm text-blue-600/80">控制 AI 助手的发音服务。支持浏览器原生合成及讯飞、OpenAI 高级语音。</p>
                                  </div>
                                  
                                  <div className="space-y-4">
                                      <div>
                                          <label className="text-xs font-bold text-slate-400 block mb-2">服务商 (Provider)</label>
                                          <div className="grid grid-cols-3 gap-3">
                                              {[
                                                  { id: 'browser', label: '浏览器原生', desc: '免费/稳定' },
                                                  { id: 'openai', label: 'OpenAI TTS', desc: '极高品质' },
                                                  { id: 'xunfei', label: '讯飞 WebAPI', desc: '专业中文' }
                                              ].map(p => (
                                                  <button key={p.id} onClick={()=>updateSettings({ ai: { ...settings.ai, voice: { ...(settings.ai.voice || {provider: 'browser'}), provider: p.id as any } } })} className={`p-4 rounded-2xl border-2 text-left transition-all ${settings.ai.voice?.provider === p.id ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200'}`}>
                                                      <div className="font-bold text-sm">{p.label}</div>
                                                      <div className="text-[10px] text-slate-500">{p.desc}</div>
                                                  </button>
                                              ))}
                                          </div>
                                      </div>

                                      {settings.ai.voice?.provider === 'xunfei' && (
                                          <div className="space-y-4 p-5 border-2 border-slate-100 dark:border-slate-800 rounded-2xl animate-in slide-in-from-top-2 bg-white dark:bg-slate-900">
                                              <div className="grid grid-cols-2 gap-4">
                                                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">APPID</label><input className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" placeholder="讯飞 APPID" value={settings.ai.voice.appId || ''} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, appId: e.target.value}}})}/></div>
                                                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">APIKey</label><input className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" placeholder="讯飞 APIKey" value={settings.ai.voice.apiKey || ''} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, apiKey: e.target.value}}})}/></div>
                                              </div>
                                              <div><label className="text-xs font-bold text-slate-500 mb-1 block">APISecret</label><input type="password" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" placeholder="讯飞 APISecret" value={settings.ai.voice.apiSecret || ''} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, apiSecret: e.target.value}}})}/></div>
                                          </div>
                                      )}

                                      {settings.ai.voice?.provider === 'openai' && (
                                          <div className="space-y-4 p-5 border-2 border-slate-100 dark:border-slate-800 rounded-2xl animate-in slide-in-from-top-2 bg-white dark:bg-slate-900">
                                              <div><label className="text-xs font-bold text-slate-500 mb-1 block">API Key</label><input type="password" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" placeholder="sk-..." value={settings.ai.voice.apiKey || ''} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, apiKey: e.target.value}}})}/></div>
                                              <div className="grid grid-cols-2 gap-4">
                                                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">模型</label><select className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" value={settings.ai.voice.model || 'tts-1'} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, model: e.target.value}}})}><option value="tts-1">tts-1 (极速)</option><option value="tts-1-hd">tts-1-hd (高保真)</option></select></div>
                                                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">音色</label><select className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" value={settings.ai.voice.voiceId || 'alloy'} onChange={e=>updateSettings({ai: {...settings.ai, voice: {...settings.ai.voice!, voiceId: e.target.value}}})}><option value="alloy">Alloy</option><option value="echo">Echo</option><option value="nova">Nova</option><option value="shimmer">Shimmer</option></select></div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {settingsTab === 'ai' && (
                              <div className="space-y-6">
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 block mb-2">模型提供商</label>
                                      <div className="flex gap-2">
                                          {(['deepseek', 'gemini', 'custom'] as const).map(p => (
                                              <button key={p} onClick={()=>updateSettings({ai: {...settings.ai, marketing: {...settings.ai.marketing, provider: p}}})} className={`px-4 py-2 rounded-xl border-2 font-bold text-xs capitalize ${settings.ai.marketing.provider===p?'border-brand-600 bg-brand-50 text-brand-600':'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>{p}</button>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="space-y-4">
                                      {settings.ai.marketing.provider !== 'gemini' && (
                                          <div><label className="text-xs font-bold text-slate-400 block mb-1">API Endpoint</label><input className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" value={settings.ai.marketing.apiBaseUrl} onChange={e=>updateSettings({ai: {...settings.ai, marketing: {...settings.ai.marketing, apiBaseUrl: e.target.value}}})}/></div>
                                      )}
                                      <div>
                                          <label className="text-xs font-bold text-slate-400 block mb-1">API Key</label>
                                          <div className="relative">
                                              <input type={showApiKey?'text':'password'} className="w-full border rounded-xl p-3 text-sm pr-10 dark:bg-slate-800 outline-none" value={settings.ai.marketing.apiKey} onChange={e=>updateSettings({ai: {...settings.ai, marketing: {...settings.ai.marketing, apiKey: e.target.value}}})}/>
                                              <button onClick={()=>setShowApiKey(!showApiKey)} className="absolute right-3 top-3 text-slate-400">{showApiKey?<EyeOff size={16}/>:<Eye size={16}/>}</button>
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-1">注：Gemini 需在环境变量设置 GEMINI_API_KEY。此处填写的 Key 适用于 DeepSeek 或 Custom 路径。</p>
                                      </div>
                                  </div>
                              </div>
                          )}
                          
                          {settingsTab === 'sync' && (
                              <div className="space-y-6">
                                  <label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-brand-500/30 transition-all">
                                      <input type="checkbox" checked={settings.syncConfig?.enabled} onChange={e=>updateSettings({syncConfig: {...settings.syncConfig!, enabled: e.target.checked}})} className="w-5 h-5 accent-brand-600"/>
                                      <div><div className="font-bold">开启云端同步桥接器</div><div className="text-xs text-slate-500">允许 PC 与手机间通过私有中转服务器同步数据</div></div>
                                  </label>
                                  {settings.syncConfig?.enabled && (
                                      <div className="space-y-4 animate-in slide-in-from-top-2 p-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl">
                                          <div><label className="text-xs font-bold text-slate-400 block mb-1">中转服务器地址 (Server URL)</label><input className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" placeholder="https://your-sync-relay.vercel.app" value={settings.syncConfig.serverUrl} onChange={e=>updateSettings({syncConfig: {...settings.syncConfig!, serverUrl: e.target.value}})}/></div>
                                          <div><label className="text-xs font-bold text-slate-400 block mb-1">通讯密钥 (Secret Key)</label><input type="password" className="w-full border rounded-xl p-3 text-sm dark:bg-slate-800 outline-none" value={settings.syncConfig.secretKey} onChange={e=>updateSettings({syncConfig: {...settings.syncConfig!, secretKey: e.target.value}})}/></div>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                      
                      <div className="p-6 border-t bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 shrink-0">
                          <button onClick={()=>setShowSettings(false)} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 active:scale-95 transition-all">保存并关闭</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
