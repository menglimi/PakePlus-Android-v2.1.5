
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, Loader2, Database, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../context/StoreContext';
import { retrieveRelevantContext, formatContextForPrompt } from '../utils/rag';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export const AIChat = () => {
  const { properties, customers, settings } = useStore();
  const [messages, setMessages] = useState<Message[]>([
      { role: 'assistant', content: '你好！我是你的房产业务助手。我已经读取了本地的房源和客源数据，你可以问我任何问题，例如：\n\n“帮我找一下总价300-500万的3房”\n“张三这个客户的需求是什么？”', time: new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
      if (!input.trim() || loading) return;
      
      const userMsg: Message = { role: 'user', content: input, time: new Date().toLocaleTimeString() };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
          const { apiKey, temperature } = settings.ai.marketing; 

          // --- OPTIMIZATION: Client-side RAG ---
          // Instead of dumping all data, we retrieve only what's relevant to the specific question.
          const { props, custs } = await retrieveRelevantContext(userMsg.content, properties, customers, 20);
          const relevantContext = formatContextForPrompt(props, custs);
          
          const systemPrompt = `
            You are "MingHui AI", a professional real estate assistant. 
            
            Current System Stats:
            - Total Properties in DB: ${properties.length}
            - Total Customers in DB: ${customers.length}

            BELOW IS THE RETRIEVED DATA RELEVANT TO THE USER'S QUESTION:
            ------------------------------------------------------------
            ${relevantContext}
            ------------------------------------------------------------

            Instructions:
            1. Answer the user's question based strictly on the retrieved data above.
            2. If the user asks for a property/customer that is NOT in the retrieved list, simply state you couldn't find it in the local database.
            3. Be professional, concise, and helpful.
            4. Reply in Chinese.
          `;

          let replyText = '';
          
          if (settings.ai.marketing.provider === 'gemini') {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const response = await ai.models.generateContent({
                  model: settings.ai.marketing.apiModel || 'gemini-2.5-flash',
                  contents: userMsg.content,
                  config: { systemInstruction: systemPrompt, temperature: temperature ?? 1.3 }
              });
              replyText = response.text || '我无法回答这个问题。';
          } else {
               if (!apiKey) throw new Error("请先在设置中配置 AI API Key");
               // Generic OpenAI/DeepSeek
               let url = settings.ai.marketing.apiBaseUrl || 'https://api.deepseek.com';
               // Ensure no trailing slash to prevent double slash in fetch
               if (url.endsWith('/')) url = url.slice(0, -1);
               
               const model = settings.ai.marketing.apiModel || 'deepseek-chat';
               const res = await fetch(`${url}/chat/completions`, {
                   method: 'POST',
                   headers: { 
                       'Content-Type': 'application/json', 
                       'Authorization': `Bearer ${apiKey}` 
                   },
                   body: JSON.stringify({
                       model: model,
                       messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userMsg.content } ],
                       temperature: temperature ?? 1.3
                   })
               });
               
               if (!res.ok) {
                   const errData = await res.json().catch(() => null);
                   throw new Error(`API Error ${res.status}: ${errData?.error?.message || res.statusText}`);
               }
               
               const data = await res.json();
               replyText = data.choices?.[0]?.message?.content || 'AI 无响应';
          }

          setMessages(prev => [...prev, { role: 'assistant', content: replyText, time: new Date().toLocaleTimeString() }]);

      } catch (e: any) {
          console.error(e);
          setMessages(prev => [...prev, { role: 'assistant', content: `请求失败: ${e.message}`, time: new Date().toLocaleTimeString() }]);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col fade-in">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Bot className="text-brand-600"/> AI 智能助手 (RAG)</h1>
        
        <div className="flex-1 bg-bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 border-b flex justify-between items-center text-xs text-slate-500">
                <div className="flex items-center gap-1"><Database size={12}/> 已加载: {properties.length} 套房源, {customers.length} 位客户 (智能检索模式)</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-purple-600 text-white'}`}>
                                {m.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
                            </div>
                            <div>
                                <div className={`p-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${m.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-tl-none'}`}>
                                    {m.content}
                                </div>
                                <div className={`text-[10px] text-slate-400 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>{m.time}</div>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                         <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center"><Bot size={16}/></div>
                            <div className="bg-white dark:bg-slate-700 p-3 rounded-xl rounded-tl-none border flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 size={16} className="animate-spin"/> AI 正在检索本地数据并思考...
                            </div>
                         </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <div className="flex gap-2 relative">
                    <input 
                        className="flex-1 border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                        placeholder="输入问题，例如：帮我找一套碧桂园的二手房..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') handleSend() }}
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={loading || !input.trim()}
                        className="bg-brand-600 text-white rounded-xl px-6 font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <Send size={20}/>}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
