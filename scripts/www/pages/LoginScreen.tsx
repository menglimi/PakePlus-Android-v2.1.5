
import React, { useRef } from 'react';
import { FolderOpen, Loader2, History, Smartphone, Upload, HardDrive, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const LoginScreen = () => {
  const { initFileSystem, importData, isLoading, error, persistedHandleAvailable } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 自动检测浏览器是否支持 File System Access API
  const isMobile = !('showDirectoryPicker' in window);

  const handleMobileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await initFileSystem(false);
      await importData(file, 'full');
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-main p-6 text-center fade-in">
      <div className="bg-bg-card p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 relative overflow-hidden">
         {isLoading && (
             <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center">
                 <div className="flex flex-col items-center gap-3">
                     <Loader2 className="animate-spin text-brand-600" size={40}/>
                     <span className="text-sm font-bold text-slate-600 dark:text-slate-300">系统正全速启动...</span>
                 </div>
             </div>
         )}

         <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-brand-500/30">MH</div>
         </div>
         <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">明惠地产Pro</h1>
         <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
             {isMobile ? '移动端离线浏览模式' : '本地化存储架构：数据由您掌控，不经过服务器。'}
         </p>
         
         {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-xl text-left border border-red-100 dark:border-red-800 flex gap-2">
               <ShieldCheck size={16} className="shrink-0"/>
               <span><strong>启动中断:</strong> {error}</span>
            </div>
         )}
         
         <div className="space-y-4">
             {!isMobile ? (
                 <>
                     {persistedHandleAvailable && (
                        <button 
                            onClick={() => initFileSystem(true)} 
                            disabled={isLoading}
                            className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-brand-200 dark:border-brand-900 text-brand-700 dark:text-brand-300 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow hover:bg-brand-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <History size={24}/>
                            打开上次工作区
                        </button>
                     )}

                     <button 
                        onClick={() => initFileSystem(false)} 
                        disabled={isLoading}
                        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-brand-500/30 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                     >
                        <FolderOpen size={24}/>
                        选择本地数据文件夹
                     </button>
                 </>
             ) : (
                 <>
                     <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isLoading}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-green-500/30 transition-all active:scale-95"
                     >
                        <Upload size={24}/>
                        导入电脑端备份 (.json)
                     </button>
                     <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleMobileImport}/>

                     <button 
                        onClick={() => initFileSystem(false)} 
                        disabled={isLoading}
                        className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                     >
                        <Smartphone size={20}/>
                        进入离线查看模式
                     </button>
                 </>
             )}
         </div>

         <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
             {!isMobile ? (
                 <p>提示：建议选择 OneDrive 或 坚果云 的本地同步目录，即可实现多端实时互通。</p>
             ) : (
                 <p>提示：手机端通过 IndexedDB 存储数据，建议定期从电脑端导出全量备份。</p>
             )}
         </div>
      </div>
    </div>
  );
};
