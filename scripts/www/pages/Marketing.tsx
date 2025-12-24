
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { ArrowDown, ArrowUp, Plus, Trash2, Video, Star, ArrowLeft, ArrowRight, Layout, Wand2, Copy, FileText, Sparkles, MessageCircle, Smartphone, Megaphone, Check, ShieldCheck, Zap } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Shot } from '../types';
import { VIDEO_FORMS, VIDEO_STYLES, VIDEO_DURATIONS, ROOM_PRESETS } from '../constants';

// --- Extracted Components ---

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
      {copied ? <Check size={14}/> : <Copy size={14}/>}
      {copied ? '已复制' : '复制内容'}
    </button>
  );
}

export const Marketing = () => {
  const { properties, marketingHistory, saveMarketing, settings, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<'rewriter' | 'generator' | 'history'>('rewriter');
  
  // Script Generator States
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('AI 正在思考...');
  const [selectedPropId, setSelectedPropId] = useState('');
  const [videoForm, setVideoForm] = useState(VIDEO_FORMS[0].id);
  const [videoStyle, setVideoStyle] = useState(VIDEO_STYLES[0]);
  const [videoDuration, setVideoDuration] = useState(VIDEO_DURATIONS[1].value);
  const [shots, setShots] = useState<Shot[]>([]);
  const [outlines, setOutlines] = useState<any[]>([]);
  const [finalResult, setFinalResult] = useState<any>(null);

  // “一键洗稿” 核心状态
  const [rawContent, setRawContent] = useState('');
  const [rewriteResults, setRewriteResults] = useState<{style: string, content: string}[]>([]);
  const [isRewriting, setIsRewriting] = useState(false);

  const selectedProp = properties.find(p => p.id === selectedPropId);

  useEffect(() => {
    if (selectedProp && step === 1 && shots.length === 0) {
      const newShots: Shot[] = [];
      const layout = selectedProp.layout || '';
      
      const halls = layout.match(/(\d+)厅/);
      const rooms = layout.match(/(\d+)房/);
      const baths = layout.match(/(\d+)卫/);

      if (halls) {
        newShots.push({ id: 's1', name: '客厅', description: '宽敞明亮，连接阳台', type: 'pan', vibe: 'descriptive', isHighlight: true });
      } else {
         newShots.push({ id: 's1', name: '起居室', description: '', type: 'pan', vibe: 'descriptive', isHighlight: true });
      }
      
      const roomCount = rooms ? parseInt(rooms[1]) : 1;
      for(let i=1; i<=roomCount; i++) {
        newShots.push({ id: `r${i}`, name: i===1 ? '主卧' : `次卧${i-1}`, description: '温馨舒适', type: 'pan', vibe: 'imaginative', isHighlight: i===1 });
      }
      
      newShots.push({ id: 'balcony', name: '阳台', description: '景观开阔', type: 'pov', vibe: 'imaginative', isHighlight: false });
      setShots(newShots);
    }
  }, [selectedProp, step]);

  const callAI = async (systemPrompt: string, userPrompt: string, useSchema = true): Promise<string> => {
     const { provider, apiKey, apiBaseUrl, apiModel, temperature } = settings.ai.marketing;
     
     if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const config: any = { 
            systemInstruction: systemPrompt, 
            temperature: temperature ?? 1.3,
            responseMimeType: 'application/json'
        };

        if (useSchema) {
            config.responseSchema = {
                type: Type.OBJECT,
                properties: {
                    styles: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                style: { type: Type.STRING },
                                content: { type: Type.STRING }
                            },
                            required: ["style", "content"]
                        }
                    }
                },
                required: ["styles"]
            };
        }

        const response = await ai.models.generateContent({
           model: apiModel || 'gemini-3-flash-preview',
           contents: userPrompt,
           config
        });
        return response.text || '{}';
     } else {
        let url = apiBaseUrl || 'https://api.deepseek.com';
        if (url.endsWith('/')) url = url.slice(0, -1);
        const key = apiKey;
        if (!key) throw new Error("请在设置中配置 AI API Key");
        
        const response = await fetch(`${url}/chat/completions`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
           body: JSON.stringify({
              model: apiModel || 'deepseek-chat',
              messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ],
              response_format: { type: 'json_object' },
              temperature: temperature ?? 1.3
           })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(`AI 请求失败: ${err?.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
     }
  };

  const handleRewrite = async () => {
      if (!rawContent.trim()) return;
      setIsRewriting(true);
      setRewriteResults([]);
      try {
          const systemPrompt = `你是一位房地产营销专家。你的任务是针对用户从外部平台复制的房源原文进行“智能洗稿”。
          
          核心要求：
          1. 剔除敏感词：识别并彻底清除文中出现的外部平台（如安居客、贝壳、链家、我爱我家）的名称及水印描述。
          2. 重置身份：移除原经纪人姓名及电话。
          3. 注入品牌：将作者身份替换为：${settings.agentName || '资深置业专家'}，联系方式：${settings.agentPhone || ''}。
          4. 矩阵生成：为同一房源生成 4 种风格的文案。
          
          风格分类：
          - moments: 朋友圈短文（多表情，强调真实，强调紧急性）
          - xiaohongshu: 小红书种草（高颜值修辞，注重生活感，含 # 话题标签）
          - official: 专业公文（客观中立，强调户型图、地段、升值空间，适合群发）
          - urgent: 捡漏促销（直白标题党，强调业主亏本急卖，手慢无）
          
          必须返回 JSON 格式。`;
          
          const jsonStr = await callAI(systemPrompt, `外部采集文案如下：\n${rawContent}`);
          const data = JSON.parse(jsonStr);
          setRewriteResults(data.styles || []);
          showToast("文案深度重组完成", "success");
      } catch (e: any) {
          showToast(`洗稿失败: ${e.message}`, "error");
      } finally {
          setIsRewriting(false);
      }
  };

  return (
    <div className="h-full flex flex-col fade-in pb-20 overflow-hidden">
       <div className="flex justify-between items-center mb-6 shrink-0 px-2">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Megaphone className="text-brand-600" size={32}/>
              智能内容中心 Pro
          </h1>
          <div className="flex bg-bg-card p-1 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
             <button onClick={()=>setActiveTab('rewriter')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab==='rewriter'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:text-slate-700'}`}>一键洗稿</button>
             <button onClick={()=>setActiveTab('generator')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab==='generator'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:text-slate-700'}`}>视频策划</button>
             <button onClick={()=>setActiveTab('history')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab==='history'?'bg-brand-600 text-white shadow-lg':'text-slate-500 hover:text-slate-700'}`}>作品库</button>
          </div>
       </div>

       {activeTab === 'rewriter' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 animate-in fade-in duration-500 min-h-0 px-2">
               <div className="bg-bg-card p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-xl flex flex-col h-full relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><FileText size={160}/></div>
                   <h2 className="text-xl font-bold mb-4 flex items-center gap-2 relative z-10"><ShieldCheck className="text-emerald-500"/> 外部房源采集</h2>
                   <p className="text-sm text-slate-500 mb-6 relative z-10">粘贴贝壳/安居客等平台的描述，AI 自动去水印并重构多端文案。</p>
                   <textarea 
                        className="flex-1 w-full border-2 rounded-2xl p-6 bg-slate-50 dark:bg-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all text-base leading-relaxed resize-none custom-scrollbar font-medium"
                        placeholder="在此直接粘贴从手机端复制的完整房源描述..."
                        value={rawContent}
                        onChange={e=>setRawContent(e.target.value)}
                   />
                   <div className="mt-6 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-mono italic">源文本长度: {rawContent.length} 字符</span>
                        <button 
                            onClick={handleRewrite} 
                            disabled={isRewriting || !rawContent.trim()}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-brand-500/30 flex items-center gap-3 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                        >
                            {isRewriting ? <Zap className="animate-pulse text-yellow-300" size={20}/> : <Wand2 size={20}/>}
                            {isRewriting ? '正在重构语感...' : '启动智能洗稿'}
                        </button>
                   </div>
               </div>
               
               <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
                   {rewriteResults.length === 0 ? (
                       <div className="flex-1 border-4 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                           <Smartphone size={64} className="mb-4 opacity-20"/>
                           <p className="font-bold text-lg italic">等待输入采集源</p>
                           <p className="text-sm mt-2 opacity-60">AI 生成的结果将在这里形成文案矩阵</p>
                       </div>
                   ) : (
                       rewriteResults.map((res, i) => (
                           <div key={i} className="bg-bg-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-in slide-in-from-right-4 group hover:border-brand-500 transition-colors" style={{animationDelay: `${i*100}ms`}}>
                               <div className="flex justify-between items-center mb-4">
                                   <div className="flex items-center gap-2">
                                       <span className={`w-2 h-6 rounded-full ${i%2===0?'bg-brand-500':'bg-purple-500'}`}></span>
                                       <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-sm">
                                           {res.style === 'moments' ? '朋友圈风格' : 
                                            res.style === 'xiaohongshu' ? '小红书种草' : 
                                            res.style === 'official' ? '专业官宣' : '急售话术'}
                                       </h3>
                                   </div>
                                   <CopyBtn text={res.content}/>
                               </div>
                               <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium border border-slate-100 dark:border-slate-800">
                                   {res.content}
                               </div>
                           </div>
                       ))
                   )}
               </div>
           </div>
       )}

       {activeTab === 'generator' && (
          <div className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm flex-1 relative overflow-hidden min-h-0 flex flex-col mx-2">
             {loading && (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-20 flex items-center justify-center flex-col animate-in fade-in duration-300">
                   <div className="loading-spin w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full mb-4"></div>
                   <p className="text-slate-700 dark:text-slate-300 font-bold text-lg">{loadingText}</p>
                </div>
             )}
             
             {step === 1 && (
                <div className="max-w-4xl mx-auto w-full animate-in slide-in-from-right-4 overflow-y-auto custom-scrollbar">
                   <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200"><Layout/> 视频创作配置</h2>
                   <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                         <div>
                            <label className="font-bold block mb-2 text-slate-700 dark:text-slate-300">选择目标房源</label>
                            <select className="w-full border rounded p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500" value={selectedPropId} onChange={e=>setSelectedPropId(e.target.value)}>
                               <option value="">-- 请选择本地房源 --</option>
                               {properties.map(p => <option key={p.id} value={p.id}>{p.garden} {p.layout}</option>)}
                            </select>
                         </div>
                         <div>
                             <label className="font-bold block mb-2 text-slate-700 dark:text-slate-300">时长预估</label>
                             <select className="w-full border rounded p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500" value={videoDuration} onChange={e=>setVideoDuration(e.target.value)}>{VIDEO_DURATIONS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select>
                         </div>
                      </div>
                      <div className="space-y-6">
                          <div>
                             <label className="font-bold block mb-2 text-slate-700 dark:text-slate-300">拍摄形式</label>
                             <div className="space-y-2">
                                 {VIDEO_FORMS.map(f => (
                                     <div key={f.id} onClick={()=>setVideoForm(f.id)} className={`p-3 rounded border cursor-pointer flex items-center gap-3 ${videoForm===f.id?'bg-brand-50 dark:bg-brand-900/30 border-brand-500 text-brand-700':'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                         <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${videoForm===f.id?'border-brand-500':'border-slate-400'}`}>{videoForm===f.id && <div className="w-2 h-2 bg-brand-500 rounded-full"></div>}</div>
                                         <div className="font-bold text-sm">{f.label}</div>
                                     </div>
                                 ))}
                             </div>
                          </div>
                      </div>
                   </div>
                   <div className="mt-8 flex justify-end">
                      <button onClick={()=>setStep(2)} disabled={!selectedPropId} className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-brand-700 flex items-center gap-2 shadow-lg">进入分镜设计 <ArrowRight size={20}/></button>
                   </div>
                </div>
             )}
             
             {step > 1 && (
                <div className="flex flex-col h-full overflow-hidden">
                   <button onClick={()=>setStep(1)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-4"><ArrowLeft size={16}/> 返回配置</button>
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic">
                       脚本分镜模块正在重载...
                   </div>
                </div>
             )}
          </div>
       )}

       {activeTab === 'history' && (
          <div className="grid gap-6 overflow-y-auto custom-scrollbar px-2">
             {marketingHistory.length === 0 ? (
                 <div className="p-20 text-center text-slate-400 italic">暂无历史作品</div>
             ) : marketingHistory.map(item => (
                <div key={item.id} className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm flex justify-between items-center group">
                   <div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{item.propName}</h3>
                      <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-400 font-mono">{item.date}</span>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{item.duration}</span>
                      </div>
                   </div>
                   <div className="flex gap-2">
                       <CopyBtn text={JSON.stringify(item.content)} />
                   </div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
};
