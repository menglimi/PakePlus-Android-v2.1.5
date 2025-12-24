
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Grid, List as ListIcon, Upload, MessageSquare, Phone, FileSpreadsheet, ClipboardCheck, History, Plus, X, Users, AlertCircle, MapPin, Target, Wallet, Home, FileText, CheckSquare, Square } from 'lucide-react';
// Fix: Import react-window as a namespace and cast to any to avoid "no exported member" errors in some environments
import * as ReactWindow from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStore } from '../context/StoreContext';
import { Customer, Contact, FollowUp } from '../types';
import { exportToExcel } from '../utils';

// Fix: Extract components from the any-casted namespace
const FixedSizeList = (ReactWindow as any).FixedSizeList;

export const Customers = () => {
  const { customers, saveCustomer, deleteCustomer, bulkDeleteCustomers, settings, importData, addFollowUp } = useStore();
  const [editingCust, setEditingCust] = useState<Partial<Customer> | null>(null);
  
  // Follow Up State
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [activeCustomerForFollowUp, setActiveCustomerForFollowUp] = useState<Customer | null>(null);
  const [newLogContent, setNewLogContent] = useState('');
  
  // Assessment
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentScores, setAssessmentScores] = useState({ budget: 0, urgency: 0, motivation: 0 });

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'rent'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  const [showGardenDropdown, setShowGardenDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter Logic
  const filteredCustomers = useMemo(() => {
      if (!Array.isArray(customers)) return [];
      return customers.filter(c => {
          if (typeFilter !== 'all' && c.type !== typeFilter) return false;
          return true;
      });
  }, [customers, typeFilter]);

  const calculateRating = () => {
      const total = assessmentScores.budget + assessmentScores.urgency + assessmentScores.motivation;
      if (total >= 8) return 'A';
      if (total >= 5) return 'B';
      return 'C';
  };

  const handleAssessmentComplete = () => {
      if (editingCust) {
          setEditingCust({...editingCust, rating: calculateRating()});
      }
      setShowAssessment(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust) return;
    await saveCustomer(editingCust as Customer);
    setEditingCust(null);
  };

  const handleDelete = async (id: string, name: string) => {
      if (confirm(`确定要删除客户 ${name} 吗？`)) {
          await deleteCustomer(id);
          if (selectedIds.has(id)) toggleSelect(id);
      }
  };

  const handleBulkDelete = async () => {
      if (confirm(`确定删除选中的 ${selectedIds.size} 位客户吗？`)) {
          await bulkDeleteCustomers(Array.from(selectedIds));
          setSelectedIds(new Set());
      }
  };
  
  const handleExportExcel = () => {
      const data = (selectedIds.size > 0 ? customers.filter(c => selectedIds.has(c.id)) : filteredCustomers).map(c => ({
          姓名: c.name,
          性别: c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '-',
          类型: c.type === 'buy' ? '求购' : '求租',
          电话: c.phone,
          级别: c.rating || '-',
          预算: `${c.budgetMin}-${c.budgetMax}${c.type === 'rent' ? '元' : '万'}`,
          意向楼盘: c.reqGardens?.join(', '),
          户型: `${c.reqRoom}房`,
          面积需求: `${c.reqAreaMin || 0}-${c.reqAreaMax || '∞'}㎡`,
          急迫度: c.urgency === 'high' ? '高' : c.urgency === 'medium' ? '中' : '低',
          备注: c.notes
      }));
      exportToExcel(data, "客源列表");
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files?.[0]) {
        importData(e.target.files[0], 'customers');
     }
  };

  const handleAddFollowUp = async () => {
      if (!activeCustomerForFollowUp || !newLogContent.trim()) return;
      const log: FollowUp = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: 'other', 
          content: newLogContent
      };
      await addFollowUp(activeCustomerForFollowUp.id, log);
      setNewLogContent('');
      setActiveCustomerForFollowUp(prev => prev ? {...prev, followUps: [log, ...(prev.followUps||[])]} : null);
  };

  const addContact = () => {
      setEditingCust(prev => ({
          ...prev, 
          contacts: [...(prev?.contacts || []), { name: '', phone: '', relation: '' }]
      }));
  };
  
  const updateContact = (index: number, field: keyof Contact, val: string) => {
      const newContacts = [...(editingCust?.contacts || [])];
      newContacts[index] = { ...newContacts[index], [field]: val };
      setEditingCust(prev => ({ ...prev, contacts: newContacts }));
  };
  
  const removeContact = (index: number) => {
      const newContacts = (editingCust?.contacts || []).filter((_, i) => i !== index);
      setEditingCust(prev => ({ ...prev, contacts: newContacts }));
  };

  const toggleGarden = (garden: string) => {
      setEditingCust(prev => {
          if (!prev) return null;
          const current = prev.reqGardens || [];
          if (current.includes(garden)) {
              return { ...prev, reqGardens: current.filter(g => g !== garden) };
          } else {
              return { ...prev, reqGardens: [...current, garden] };
          }
      });
      setShowGardenDropdown(false);
  };

  return (
    <div className="space-y-6 fade-in h-full flex flex-col pb-20 overflow-hidden">
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex justify-between items-center flex-wrap gap-4 px-2">
            <h1 className="text-3xl font-bold tracking-tight">客源系统</h1>
            <div className="flex gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2">
                    <Upload size={20}/> 导入
                </button>
                <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleImport} />
                <button onClick={() => setEditingCust({ id: Date.now().toString(), status: 'active', urgency: 'medium', type: 'buy', contacts: [] })} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-transform transform active:scale-95">
                    <UserPlus size={22}/> 新增客户
                </button>
            </div>
        </div>
        
        <div className="bg-bg-card border-2 border-slate-300 dark:border-slate-700 p-2 rounded-2xl flex justify-between items-center flex-wrap gap-2 mx-2">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={()=>setTypeFilter('all')} className={`px-4 py-2 rounded-lg font-bold transition-all ${typeFilter==='all'?'bg-white shadow text-brand-600':'text-slate-500'}`}>全部</button>
                <button onClick={()=>setTypeFilter('buy')} className={`px-4 py-2 rounded-lg font-bold transition-all ${typeFilter==='buy'?'bg-white shadow text-red-600':'text-slate-500'}`}>求购</button>
                <button onClick={()=>setTypeFilter('rent')} className={`px-4 py-2 rounded-lg font-bold transition-all ${typeFilter==='rent'?'bg-white shadow text-blue-600':'text-slate-500'}`}>求租</button>
            </div>
            
            <div className="flex gap-2 items-center">
                 {selectedIds.size > 0 && (
                    <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-sm text-red-600 font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                        <Trash2 size={18}/> 批量删除 ({selectedIds.size})
                    </button>
                 )}
                 <div className="h-8 w-px bg-slate-200 mx-1"></div>
                 <button onClick={handleExportExcel} className="flex items-center gap-1.5 text-sm text-green-600 font-bold hover:bg-green-50 px-3 py-2 rounded-lg transition-colors">
                    <FileSpreadsheet size={18}/> 导出
                </button>
                <div className="h-8 w-px bg-slate-200 mx-1"></div>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                    <button onClick={()=>setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode==='list'?'bg-white dark:bg-slate-600 shadow text-brand-600':'text-slate-400 hover:text-slate-600'}`}><ListIcon size={20}/></button>
                    <button onClick={()=>setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode==='grid'?'bg-white dark:bg-slate-600 shadow text-brand-600':'text-slate-400 hover:text-slate-600'}`}><Grid size={20}/></button>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0 relative">
         <AutoSizer>
            {({ height, width }) => {
                if (height === 0 || width === 0) return null;

                if (filteredCustomers.length === 0) {
                    return (
                        <div style={{ height, width }} className="flex flex-col items-center justify-center text-slate-400">
                            <Users size={64} className="mb-4 opacity-20" />
                            <p className="text-lg">暂无匹配客户数据</p>
                        </div>
                    );
                }

                if (viewMode === 'grid') {
                    const columnWidth = 350;
                    const columnCount = Math.floor(width / columnWidth) || 1;

                    return (
                      <div className="h-full overflow-y-auto px-2 pb-10 custom-scrollbar" style={{ height }}>
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
                            {filteredCustomers.map(c => {
                                const isSelected = selectedIds.has(c.id);
                                return (
                                    <div key={c.id} onClick={()=>toggleSelect(c.id)} className={`bg-bg-card p-5 rounded-2xl border-2 relative group hover:shadow-xl transition-all cursor-pointer ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="font-bold text-xl flex items-center gap-2 overflow-hidden">
                                                <span className="truncate">{c.name}</span>
                                                <span className="shrink-0 flex gap-1">
                                                    {c.gender === 'male' && <span className="text-blue-500 text-sm">👨</span>}
                                                    {c.gender === 'female' && <span className="text-pink-500 text-sm">👩</span>}
                                                    <span className={`text-sm px-1.5 py-0.5 rounded text-white ${c.type==='buy'?'bg-red-500':'bg-blue-500'}`}>{c.type==='buy'?'购':'租'}</span>
                                                </span>
                                            </div>
                                            {c.rating && <span className={`shrink-0 px-2.5 py-1 rounded-lg text-sm font-black ${c.rating==='A'?'bg-red-100 text-red-600':c.rating==='B'?'bg-blue-100 text-blue-600':'bg-slate-100 text-slate-600'}`}>{c.rating}类</span>}
                                        </div>
                                        <div className="text-base text-slate-500 mb-4 flex items-center gap-2 font-medium"><Phone size={16}/> {c.phone}</div>
                                        <div className="space-y-2 text-base bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-4">
                                            <div className="flex justify-between"><span>急迫度:</span> <span className={`${c.urgency==='high'?'text-red-500 font-black':''}`}>{c.urgency==='high'?'高':c.urgency==='low'?'低':'中'}</span></div>
                                            <div className="flex justify-between items-center">
                                                <span>预算:</span> 
                                                <span className="text-brand-600 font-bold text-lg">
                                                    {c.budgetMin}-{c.budgetMax}{c.type === 'rent' ? '元' : '万'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800 pt-3" onClick={e=>e.stopPropagation()}>
                                                <button onClick={()=>{setActiveCustomerForFollowUp(c); setShowFollowUp(true);}} className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors"><MessageSquare size={16}/> 跟进</button>
                                                <button onClick={()=>setEditingCust(c)} className="p-2 text-slate-400 hover:text-brand-600 bg-slate-50 rounded-lg hover:bg-slate-100"><Edit size={18}/></button>
                                                <button onClick={()=>handleDelete(c.id, c.name)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg hover:bg-red-100"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                    );
                } else {
                    return (
                        <div style={{ height, width }} className="border rounded-xl overflow-hidden border-slate-200 dark:border-slate-700 bg-bg-card flex flex-col mx-2">
                            <div className="flex bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 border-b dark:border-slate-700 text-base h-12 items-center px-4 overflow-hidden w-full shrink-0">
                                <div className="w-10 min-w-[40px]">选择</div>
                                <div className="flex-1 min-w-[100px] truncate">姓名</div>
                                <div className="flex-1 min-w-[80px]">需求类型</div>
                                <div className="flex-1 min-w-[120px] truncate">电话</div>
                                <div className="flex-1 min-w-[60px]">等级</div>
                                <div className="flex-[2] min-w-[200px] truncate">预算/需求</div>
                                <div className="w-32 min-w-[128px] text-center shrink-0">操作</div>
                            </div>
                            <div className="flex-1">
                                <FixedSizeList
                                    height={height - 48}
                                    itemCount={filteredCustomers.length}
                                    itemSize={72}
                                    width={width - 16}
                                >
                                    {({ index, style }: any) => {
                                        const c = filteredCustomers[index];
                                        const isSelected = selectedIds.has(c.id);
                                        return (
                                            <div style={style} className={`flex items-center px-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer w-full ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`} onClick={()=>toggleSelect(c.id)}>
                                                <div className={`w-10 min-w-[40px] ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}</div>
                                                <div className="flex-1 min-w-[100px] font-bold text-lg flex items-center gap-2 truncate">
                                                    <span className="truncate">{c.name}</span>
                                                    {c.gender === 'male' && <span className="text-blue-500 text-sm flex-shrink-0">👨</span>}
                                                    {c.gender === 'female' && <span className="text-pink-500 text-sm flex-shrink-0">👩</span>}
                                                </div>
                                                <div className="flex-1 min-w-[80px]"><span className={`px-2 py-1 rounded text-sm font-bold text-white whitespace-nowrap ${c.type==='buy'?'bg-red-500':'bg-blue-500'}`}>{c.type==='buy'?'求购':'求租'}</span></div>
                                                <div className="flex-1 min-w-[120px] text-slate-600 dark:text-slate-300 font-medium truncate">{c.phone}</div>
                                                <div className="flex-1 min-w-[60px]"><span className={`px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap ${c.rating==='A'?'bg-red-100 text-red-600':c.rating==='B'?'bg-blue-100 text-blue-600':'bg-slate-100'}`}>{c.rating || '-'}</span></div>
                                                <div className="flex-[2] min-w-[200px]">
                                                    <div className="text-brand-600 font-bold text-lg truncate">
                                                        {c.budgetMin}-{c.budgetMax}{c.type === 'rent' ? '元' : '万'}
                                                    </div>
                                                    <div className="text-base text-slate-500 mt-1 flex gap-2 truncate">
                                                        {c.reqGardens?.length ? <span className="truncate max-w-[150px]">{c.reqGardens[0]}等</span> : '不限'} 
                                                        <span className="whitespace-nowrap">{c.reqRoom}房</span>
                                                        <span className="whitespace-nowrap">{c.reqAreaMin}㎡+</span>
                                                    </div>
                                                </div>
                                                <div className="w-32 flex gap-3 justify-center" onClick={e=>e.stopPropagation()}>
                                                    <button onClick={()=>{setActiveCustomerForFollowUp(c); setShowFollowUp(true);}} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><MessageSquare size={20}/></button>
                                                    <button onClick={()=>setEditingCust(c)} className="text-slate-400 hover:text-brand-600 p-2"><Edit size={20}/></button>
                                                    <button onClick={()=>handleDelete(c.id, c.name)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </FixedSizeList>
                            </div>
                        </div>
                    );
                }
            }}
         </AutoSizer>
      </div>

      {editingCust && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-bg-card w-full max-w-3xl rounded-2xl shadow-xl my-4 flex flex-col max-h-[95vh] animate-in zoom-in-95 border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="bg-brand-100 text-brand-600 p-2 rounded-xl"><Users size={24}/></div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">客户资料编辑</h3>
                      </div>
                  </div>
                  <button onClick={()=>setEditingCust(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="text-slate-400"/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 custom-scrollbar">
                  <form id="custForm" onSubmit={handleSubmit} className="space-y-6">
                     <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                            <Target size={18} className="text-brand-600"/> 基本概况
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">客户姓名 *</label>
                                    <div className="flex gap-2">
                                        <input 
                                            value={editingCust.name || ''} 
                                            onChange={e=>setEditingCust({...editingCust, name: e.target.value})} 
                                            className="flex-1 border rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-brand-500 outline-none font-bold" 
                                            placeholder="输入姓名"
                                            required
                                        />
                                        <select 
                                            className="w-24 border rounded-xl px-2 py-2.5 bg-slate-50 dark:bg-slate-900 outline-none" 
                                            value={editingCust.gender || ''} 
                                            onChange={e=>setEditingCust({...editingCust, gender: e.target.value as any})}
                                        >
                                            <option value="">性别</option>
                                            <option value="male">先生</option>
                                            <option value="female">女士</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">联系电话 *</label>
                                    <input 
                                        value={editingCust.phone || ''} 
                                        onChange={e=>setEditingCust({...editingCust, phone: e.target.value})} 
                                        className="w-full border rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-brand-500 outline-none font-mono tracking-wide" 
                                        placeholder="11位手机号"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">需求类型</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                                        <button type="button" onClick={()=>setEditingCust({...editingCust, type: 'buy'})} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${editingCust.type==='buy'?'bg-white dark:bg-slate-800 shadow text-red-600':'text-slate-400 hover:text-slate-600'}`}>求购房源</button>
                                        <button type="button" onClick={()=>setEditingCust({...editingCust, type: 'rent'})} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${editingCust.type==='rent'?'bg-white dark:bg-slate-800 shadow text-blue-600':'text-slate-400 hover:text-slate-600'}`}>求租房源</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">当前状态 / 急迫度</label>
                                    <div className="flex gap-2">
                                        <select value={editingCust.status} onChange={e=>setEditingCust({...editingCust, status: e.target.value as any})} className="flex-1 border rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none text-sm">
                                            <option value="active">🟢 活跃跟进</option>
                                            <option value="archive">⚪ 已归档/成交</option>
                                        </select>
                                        <select value={editingCust.urgency} onChange={e=>setEditingCust({...editingCust, urgency: e.target.value as any})} className="flex-1 border rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none text-sm">
                                            <option value="high">🔥 高急迫</option>
                                            <option value="medium">⚖️ 中等</option>
                                            <option value="low">🧊 低急迫</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                         <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                            <Wallet size={18} className="text-brand-600"/> 详细需求
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">预算范围 ({editingCust.type === 'buy' ? '万元' : '元/月'})</label>
                                <div className="flex items-center gap-2">
                                   <div className="relative flex-1">
                                       <span className="absolute left-3 top-2.5 text-slate-400 text-xs">Min</span>
                                       <input type="number" value={editingCust.budgetMin} onChange={e=>setEditingCust({...editingCust, budgetMin: Number(e.target.value)})} className="w-full border rounded-xl pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-brand-600"/>
                                   </div>
                                   <span className="text-slate-300">—</span>
                                   <div className="relative flex-1">
                                       <span className="absolute left-3 top-2.5 text-slate-400 text-xs">Max</span>
                                       <input type="number" value={editingCust.budgetMax} onChange={e=>setEditingCust({...editingCust, budgetMax: Number(e.target.value)})} className="w-full border rounded-xl pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-brand-600"/>
                                   </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">空间需求</label>
                                <div className="flex items-center gap-2">
                                   <div className="relative flex-1">
                                       <input type="number" value={editingCust.reqRoom} onChange={e=>setEditingCust({...editingCust, reqRoom: Number(e.target.value)})} className="border rounded-xl px-3 py-2.5 w-full bg-slate-50 dark:bg-slate-950"/>
                                       <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">房</span>
                                   </div>
                                   <div className="relative flex-1">
                                       <input type="number" value={editingCust.reqAreaMin} onChange={e=>setEditingCust({...editingCust, reqAreaMin: Number(e.target.value)})} className="border rounded-xl px-3 py-2.5 w-full bg-slate-50 dark:bg-slate-950"/>
                                       <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">㎡ 起</span>
                                   </div>
                                </div>
                            </div>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block">意向楼盘 (点击添加)</label>
                            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 min-h-[50px] bg-slate-50 dark:bg-slate-950 flex flex-wrap gap-2 relative transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/50">
                                {(editingCust.reqGardens || []).map(g => (
                                    <span key={g} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg text-sm flex items-center gap-1 shadow-sm">
                                        <MapPin size={10} className="text-brand-500"/> {g} 
                                        <button type="button" onClick={()=>toggleGarden(g)} className="hover:text-red-500 ml-1"><X size={12}/></button>
                                    </span>
                                ))}
                                <button type="button" onClick={()=>setShowGardenDropdown(!showGardenDropdown)} className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-lg hover:bg-brand-100 font-bold flex items-center gap-1">
                                    <Plus size={12}/> 添加意向
                                </button>
                                {showGardenDropdown && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-xl z-50 max-h-48 overflow-y-auto p-1 animate-in zoom-in-95">
                                        {Object.keys(settings.gardenData).map(g => (
                                            <button key={g} type="button" onClick={()=>toggleGarden(g)} className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex justify-between items-center ${editingCust.reqGardens?.includes(g)?'text-brand-600 font-bold bg-brand-50 dark:bg-brand-900/10':''}`}>
                                                {g} {editingCust.reqGardens?.includes(g) && <div className="w-2 h-2 bg-brand-500 rounded-full"></div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                         </div>
                     </div>
                  </form>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl flex justify-between items-center shrink-0">
                  <button type="button" onClick={()=>setShowAssessment(true)} className="text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-800">
                      <ClipboardCheck size={18}/> 智能画像评估
                  </button>
                  <div className="flex gap-4">
                      <button type="button" onClick={()=>setEditingCust(null)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">取消</button>
                      <button type="button" onClick={handleSubmit} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 hover:-translate-y-0.5 transition-all">保存客户</button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {showFollowUp && activeCustomerForFollowUp && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-bg-card w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[80vh] animate-in zoom-in-95">
                  <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2"><History className="text-blue-500"/>跟进记录 - {activeCustomerForFollowUp.name}</h3>
                      <button onClick={()=>setShowFollowUp(false)}><X/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
                      <div className="space-y-4">
                          {(!activeCustomerForFollowUp.followUps || activeCustomerForFollowUp.followUps.length === 0) && <div className="text-center text-slate-400 py-10">暂无跟进记录</div>}
                          {activeCustomerForFollowUp.followUps?.map((log, i) => (
                              <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                                      <span>{new Date(log.date).toLocaleString()}</span>
                                      <span className="uppercase font-bold">{log.type}</span>
                                  </div>
                                  <div className="text-sm text-slate-700 dark:text-slate-300">{log.content}</div>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  <div className="p-4 border-t bg-white dark:bg-slate-800">
                      <textarea 
                        className="w-full border rounded-xl p-3 text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                        placeholder="输入本次跟进情况..."
                        value={newLogContent}
                        onChange={e => setNewLogContent(e.target.value)}
                      />
                      <button onClick={handleAddFollowUp} className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md">添加跟进</button>
                  </div>
              </div>
          </div>
      )}

      {showAssessment && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-8 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><ClipboardCheck className="text-purple-600" size={28}/> 客源等级评估</h3>
                  <div className="space-y-5">
                      <div>
                          <label className="block font-bold mb-2 text-sm text-slate-600 dark:text-slate-300">1. 预算充足程度 (首付/流水)</label>
                          <select className="w-full border rounded-xl p-3 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" onChange={e=>setAssessmentScores({...assessmentScores, budget: Number(e.target.value)})}>
                              <option value="0">-- 请选择 --</option>
                              <option value="3">资金已到位 (3分)</option>
                              <option value="2">需卖房置换 (2分)</option>
                              <option value="1">首付凑集中 (1分)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block font-bold mb-2 text-sm text-slate-600 dark:text-slate-300">2. 购房急迫性</label>
                          <select className="w-full border rounded-xl p-3 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" onChange={e=>setAssessmentScores({...assessmentScores, urgency: Number(e.target.value)})}>
                              <option value="0">-- 请选择 --</option>
                              <option value="3">婚房/上学 (3分)</option>
                              <option value="2">改善自住 (2分)</option>
                              <option value="1">投资/养老 (1分)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block font-bold mb-2 text-sm text-slate-600 dark:text-slate-300">3. 配合度</label>
                          <select className="w-full border rounded-xl p-3 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none" onChange={e=>setAssessmentScores({...assessmentScores, motivation: Number(e.target.value)})}>
                              <option value="0">-- 请选择 --</option>
                              <option value="3">随时看房 (3分)</option>
                              <option value="2">周末看房 (2分)</option>
                              <option value="1">很难约 (1分)</option>
                          </select>
                      </div> 
                  </div>
                  <div className="mt-8 flex justify-end gap-4">
                      <button onClick={()=>setShowAssessment(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                      <button onClick={handleAssessmentComplete} className="bg-purple-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition-colors">完成评估</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
