import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Building2, Users, ScrollText, Film, X, Calculator, CalendarDays, BookOpen, Bot, KeyRound, ChevronDown, ChevronRight, LayoutDashboard, Database, Wrench, Sparkles, Trash2, RefreshCw, Loader2, FileText, PanelLeftClose, PanelLeftOpen, Cloud, CloudOff, ChevronLeft } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { refreshData, isLoading, isSyncing, lastSyncTime, rootHandle, sidebarCollapsed, toggleSidebarCollapse, settings } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['info', 'ai', 'tools']);

  const isCloudEnabled = settings.syncConfig?.enabled && settings.syncConfig.serverUrl;

  const toggleGroup = (group: string) => {
      if (sidebarCollapsed) return; 
      setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };

  const navGroups = [
      {
          id: 'info',
          title: '信息管理',
          icon: Database,
          items: [
              { path: '/', icon: LayoutDashboard, label: '工作台' },
              { path: '/properties', icon: Building2, label: '房源管理' },
              { path: '/customers', icon: Users, label: '客源系统' },
              { path: '/keys', icon: KeyRound, label: '钥匙管理' },
              { path: '/dictionary', icon: BookOpen, label: '楼盘字典' },
          ]
      },
      {
          id: 'ai',
          title: 'AI 功能',
          icon: Sparkles,
          items: [
              { path: '/ai-chat', icon: Bot, label: 'AI 助手' },
              { path: '/marketing', icon: Film, label: '智能营销' },
          ]
      },
      {
          id: 'tools',
          title: '实用工具',
          icon: Wrench,
          items: [
              { path: '/calendar', icon: CalendarDays, label: '工作日历' },
              { path: '/contract', icon: ScrollText, label: '租赁合同' },
              { path: '/sale-contract', icon: FileText, label: '买卖合同' },
              { path: '/calculator', icon: Calculator, label: '房贷计算' },
              { path: '/recycle-bin', icon: Trash2, label: '回收站' },
          ]
      }
  ];

  const Logo = () => (
    <div className={`flex items-center gap-3 transition-all duration-300 ${sidebarCollapsed ? 'justify-center w-full px-0' : 'px-6'}`}>
       <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg transform transition-transform hover:scale-105 shrink-0">MH</div>
       {!sidebarCollapsed && (
           <div className="flex flex-col overflow-hidden whitespace-nowrap animate-in fade-in duration-300">
             <span className="font-black text-xl tracking-tight leading-none text-white">明惠地产Pro</span>
             <span className="text-[10px] text-slate-300 tracking-wider font-bold opacity-80 mt-0.5">本地数据版</span>
           </div>
       )}
    </div>
 );

  const NavLinkItem: React.FC<{ item: any, isChild?: boolean }> = ({ item, isChild }) => {
      const isActive = location.pathname === item.path;
      return (
          <Link 
            to={item.path} 
            onClick={onClose}
            title={sidebarCollapsed ? item.label : ''}
            className={`flex items-center gap-3 py-3 rounded-xl transition-all font-bold group relative
            ${sidebarCollapsed ? 'justify-center px-2' : `px-4 text-sm ${isChild ? 'ml-0' : ''}`}
            ${isActive 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <item.icon size={20} className={`transition-colors shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            
            {sidebarCollapsed && (
                <div className="absolute left-full ml-4 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-600">
                    {item.label}
                </div>
            )}
          </Link>
      );
  };

  const SidebarContent = () => (
      <div className="flex flex-col h-full text-slate-100">
        <div className="h-20 flex items-center border-b border-white/10 shrink-0 relative">
          <Logo />
          <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-30">
              <button 
                onClick={toggleSidebarCollapse}
                className="bg-bg-sidebar border border-slate-600 rounded-full p-1 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-md"
              >
                  {sidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
              </button>
          </div>
        </div>

        <nav className={`flex-1 space-y-2 overflow-y-auto custom-scrollbar ${sidebarCollapsed ? 'px-2 py-4' : 'p-4'}`}>
           {navGroups.map(group => (
               <div key={group.id} className={`${sidebarCollapsed ? 'mb-4 border-b border-white/5 pb-2 last:border-0' : 'mb-1'}`}>
                   {!sidebarCollapsed ? (
                       <button 
                          onClick={() => toggleGroup(group.id)} 
                          className="w-full flex items-center justify-between px-2 py-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                       >
                           <span className="flex items-center gap-2"><group.icon size={14}/> {group.title}</span>
                           {expandedGroups.includes(group.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                       </button>
                   ) : (
                       <div className="w-full h-px bg-white/10 my-2 mx-auto w-1/2 hidden"></div>
                   )}

                   {(sidebarCollapsed || expandedGroups.includes(group.id)) && (
                       <div className={`space-y-1 ${!sidebarCollapsed ? 'pl-0 mt-1' : ''}`}>
                           {group.items.map(item => <NavLinkItem key={item.path} item={item} isChild={!sidebarCollapsed} />)}
                       </div>
                   )}
               </div>
           ))}
        </nav>
        
        <div className={`border-t border-white/10 bg-black/20 shrink-0 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            {!sidebarCollapsed && (
                <div className="flex items-center justify-between px-2 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    <span className="flex items-center gap-1">
                        {isCloudEnabled ? <Cloud size={10} className="text-emerald-400"/> : <CloudOff size={10}/>}
                        {isCloudEnabled ? '云端已连接' : '本地离线模式'}
                    </span>
                    {isCloudEnabled && <span className="text-emerald-500 flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE</span>}
                </div>
            )}

            <button 
                onClick={() => refreshData(false)} 
                disabled={isLoading || isSyncing}
                title={sidebarCollapsed ? "刷新本地数据" : ""}
                className={`w-full bg-slate-800 border border-slate-600 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${sidebarCollapsed ? 'py-3 px-0' : 'py-3 px-4'}`}
            >
                {(isLoading || isSyncing) ? <Loader2 size={18} className="animate-spin text-brand-400"/> : <RefreshCw size={18}/>}
                {!sidebarCollapsed && (isLoading ? '正在读取...' : isSyncing ? '同步中...' : '刷新本地数据')}
            </button>
        </div>
      </div>
  );

  return (
    <>
      <aside className={`bg-bg-sidebar flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 shadow-xl z-30 transition-all duration-300 border-r border-white/10 ease-in-out ${sidebarCollapsed ? 'w-20' : 'w-64'}`}><SidebarContent /></aside>
      {isOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-bg-sidebar flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 border-r border-white/10">
             <div className="absolute right-4 top-4 z-50">
                 <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
             </div>
             <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
};