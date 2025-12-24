
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, CheckCircle2, AlertTriangle, Info, UserCheck, ArrowRight, LayoutDashboard, Building2, Users, Bot, MoreHorizontal, Loader2, ShieldCheck } from 'lucide-react';
import { useStore } from './context/StoreContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Customers } from './pages/Customers';
import { ContractGenerator } from './pages/Contract';
import { SaleContractGenerator } from './pages/SaleContract';
import { Marketing } from './pages/Marketing';
import { Calculator } from './pages/Calculator';
import { LoginScreen } from './pages/LoginScreen';
import { Calendar } from './pages/Calendar';
import { Dictionary } from './pages/Dictionary';
import { AgentAssistant } from './pages/AgentAssistant';
import { Keys } from './pages/Keys';
import { RecycleBin } from './pages/RecycleBin';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';

const ToastContainer = () => {
   const { toasts, removeToast } = useStore();
   return (
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
         {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto min-w-[300px] p-4 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-right-full fade-in duration-300 ${t.type==='success'?'bg-white border-l-4 border-green-500 text-slate-800':t.type==='error'?'bg-red-50 border-l-4 border-red-500 text-red-800':'bg-blue-50 border-l-4 border-blue-500 text-blue-800'}`}>
               {t.type==='success' && <CheckCircle2 className="text-green-500" size={20}/>}
               {t.type==='error' && <AlertTriangle className="text-red-500" size={20}/>}
               {t.type==='info' && <Info className="text-blue-500" size={20}/>}
               <span className="flex-1 font-medium text-sm">{t.text}</span>
               <button onClick={()=>removeToast(t.id)}><X size={16} className="opacity-50 hover:opacity-100"/></button>
            </div>
         ))}
      </div>
   );
};

const App = () => {
  const { isReady, settings, sidebarOpen, setSidebarOpen, isInitialLoading } = useStore();
  const [isAgentSelected, setIsAgentSelected] = useState(false);

  useEffect(() => {
     const themeClass = `theme-${settings.theme}`;
     document.body.className = themeClass;
     if (settings.theme === 'tech') document.documentElement.classList.add('dark');
     else document.documentElement.classList.remove('dark');
  }, [settings.theme]);

  useEffect(() => {
      if (isReady && !isInitialLoading && settings.agentName) setIsAgentSelected(true);
  }, [isReady, isInitialLoading, settings.agentName]);

  if (!isReady) return (
     <ErrorBoundary>
       <LoginScreen />
       <ToastContainer />
     </ErrorBoundary>
  );

  if (isInitialLoading) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center bg-bg-main fixed inset-0 z-[100] backdrop-blur-md">
              <div className="relative">
                  <div className="absolute -inset-4 bg-brand-500/20 blur-2xl animate-pulse rounded-full"></div>
                  <Loader2 className="animate-spin text-brand-600 relative z-10" size={64} />
              </div>
              <div className="text-center mt-8">
                  <p className="text-slate-800 dark:text-slate-100 font-black text-2xl mb-2 tracking-tight">核心引擎初始化中</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm flex items-center justify-center gap-2">
                      <ShieldCheck size={14}/> 正在验证本地 JSON 数据库完整性
                  </p>
              </div>
          </div>
      );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <div className="flex h-full font-sans bg-bg-main text-text-main overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)} />
          <main className="flex-1 flex flex-col h-full overflow-hidden relative z-0">
             <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-8 pb-24 md:pb-8 transition-colors duration-300">
               <Routes>
                 <Route path="/" element={<Dashboard />} />
                 <Route path="/properties" element={<Properties />} />
                 <Route path="/customers" element={<Customers />} />
                 <Route path="/keys" element={<Keys />} />
                 <Route path="/calendar" element={<Calendar />} />
                 <Route path="/dictionary" element={<Dictionary />} />
                 <Route path="/ai-chat" element={<AgentAssistant />} />
                 <Route path="/contract" element={<ContractGenerator />} />
                 <Route path="/sale-contract" element={<SaleContractGenerator />} />
                 <Route path="/calculator" element={<Calculator />} />
                 <Route path="/marketing" element={<Marketing />} />
                 <Route path="/recycle-bin" element={<RecycleBin />} />
               </Routes>
             </div>
          </main>
          <ToastContainer />
          <CommandPalette />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
