
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  KeyRound, Search, Plus, Trash2, History, ArrowRightLeft, 
  Settings, X, FileSpreadsheet, AlertTriangle, CheckCircle2, 
  User, Edit, Key as KeyIcon, MapPin, Phone, LogOut, LogIn, 
  Clock, AlertCircle, ArrowDownUp, Grid, CheckSquare, Square,
  Loader2, Filter, Save, ArrowRight, Home, Tags
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { KeyRecord, KeyLog, Appointment, Property } from '../types';
import { exportToExcel } from '../utils';
import { match } from 'pinyin-pro';

/**
 * 钥匙管理模块 (Fixed to Grid Board View)
 * 
 * 该模块负责实物钥匙的入库、借出、归还及流转日志记录。
 * 核心特性：
 * 1. 拟物化挂板：直观展示钥匙在库/借出状态。
 * 2. 冲突检测：借出时自动对比当日预约看房记录。
 * 3. 业务联动：支持“结束委托”时同步删除房源。
 * 4. 搜索增强：支持编号、地址及拼音首字母匹配。
 * 5. 特殊状态：支持房屋“正常/已租/已售”状态标记及过滤。
 */

export const Keys: React.FC = () => {
  const store = useStore();
  
  // 从全局 Store 中解构状态与方法
  const keys = Array.isArray(store.keys) ? store.keys : [];
  const keyLogs = Array.isArray(store.keyLogs) ? store.keyLogs : [];
  const appointments = store.appointments || [];
  const properties = store.properties || [];
  const settings = store.settings || { keyConfig: { borrowerPresets: [], reasonPresets: [] }, agentName: 'Agent' };
  
  // --- UI 控制状态 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'status' | 'updated'>('default');
  const [propStatusFilter, setPropStatusFilter] = useState<'all' | 'normal' | 'rented' | 'sold'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  
  // --- 弹窗与表单状态 ---
  const [actionType, setActionType] = useState<'create' | 'borrow' | 'return' | 'settings' | 'edit' | null>(null);
  const [targetKey, setTargetKey] = useState<KeyRecord | null>(null);

  // 房源关联搜索状态
  const [searchProp, setSearchProp] = useState('');
  const [selectedPropId, setSelectedPropId] = useState('');
  const [newKeyNo, setNewKeyNo] = useState('');
  const [editPropStatus, setEditPropStatus] = useState<'normal' | 'rented' | 'sold'>('normal');
  
  // 地址手动覆盖状态 (适用于非系统房源钥匙)
  const [editGarden, setEditGarden] = useState('');
  const [editRoom, setEditRoom] = useState('');

  // 借用信息状态
  const [borrower, setBorrower] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [reason, setReason] = useState('');

  // 修正借用信息状态 (编辑模式)
  const [editBorrower, setEditBorrower] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editReason, setEditReason] = useState('');

  // 设置管理状态
  const [newPresetBorrower, setNewPresetBorrower] = useState('');
  const [newPresetReason, setNewPresetReason] = useState('');

  // --- 核心搜索逻辑：支持关键词 + 拼音首字母混合检索 ---
  const filteredKeys = useMemo(() => {
      if (!Array.isArray(keys)) return [];
      
      let result = keys;
      
      // 1. 房屋状态过滤
      if (propStatusFilter !== 'all') {
          result = result.filter(k => (k.propertyStatus || 'normal') === propStatusFilter);
      }

      // 2. 文本搜索
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          result = result.filter(k => {
              const content = `${k.keyNo} ${k.garden} ${k.roomNo} ${k.borrower||''}`.toLowerCase();
              if (content.includes(lowerTerm)) return true;
              
              // 拼音首字母匹配 (针对楼盘名称和房号)
              const pinyinMatch = match(k.garden, lowerTerm, { continuous: true }) || 
                              match(k.roomNo, lowerTerm, { continuous: true });
              return !!pinyinMatch;
          });
      }
      
      // 3. 排序处理
      const sorted = [...result];
      if (sortMode === 'status') {
          // 借出状态优先展示
          sorted.sort((a, b) => (a.status === 'borrowed' ? -1 : 1) - (b.status === 'borrowed' ? -1 : 1));
      } else if (sortMode === 'updated') {
          // 最近变动优先
          sorted.sort((a, b) => b.updatedAt - a.updatedAt);
      } else {
          // 编号字母序
          sorted.sort((a, b) => a.keyNo.localeCompare(b.keyNo));
      }
      
      return sorted;
  }, [keys, searchTerm, sortMode, propStatusFilter]);
  
  // 日志筛选逻辑
  const filteredLogs = useMemo(() => {
      if (!Array.isArray(keyLogs)) return [];
      return selectedKeyId 
        ? keyLogs.filter(l => l.keyId === selectedKeyId)
        : keyLogs;
  }, [keyLogs, selectedKeyId]);
      
  // 房源智能联想
  const searchedProperties = useMemo(() => {
      if (!searchProp) return [];
      return properties.filter(p => 
        (p.garden || '').includes(searchProp) || 
        (p.room || '').includes(searchProp)
      ).slice(0, 5);
  }, [searchProp, properties]);

  // --- 表单生命周期处理 ---
  useEffect(() => {
      if (actionType === 'edit' && targetKey) {
          setNewKeyNo(targetKey.keyNo);
          setEditGarden(targetKey.garden || '');
          setEditRoom(targetKey.roomNo || '');
          setEditPropStatus(targetKey.propertyStatus || 'normal');
          
          if (targetKey.status === 'borrowed') {
              setEditBorrower(targetKey.borrower || '');
              setEditPhone(targetKey.borrowerPhone || '');
              setEditReason(targetKey.borrowReason || '');
          }

          if (targetKey.propertyId) {
              const p = properties.find(i => i.id === targetKey.propertyId);
              if (p) {
                  setSearchProp(`${p.garden} ${p.subArea||''} ${p.building} ${p.unit ? p.unit + '单元' : ''} ${p.room}`);
                  setSelectedPropId(p.id);
              }
          }
      } else if (actionType === 'create') {
          resetForms();
      }
  }, [actionType, targetKey, properties]);

  // --- 业务操作处理器 ---

  /** 新增钥匙入库 */
  const handleCreate = async () => {
      if (!newKeyNo) return store.showToast("请输入钥匙编号", "error");
      let garden = editGarden;
      let roomNo = editRoom;
      let propId = undefined;

      if (selectedPropId) {
          const p = properties.find(i => i.id === selectedPropId);
          if (p) {
              garden = p.garden;
              roomNo = `${p.building} ${p.room}`; 
              propId = p.id;
          }
      }

      const newKey: KeyRecord = {
          id: Date.now().toString(),
          keyNo: newKeyNo.toUpperCase(),
          status: 'in_store',
          propertyStatus: editPropStatus,
          propertyId: propId,
          garden,
          roomNo,
          updatedAt: Date.now()
      };

      await store.saveKey(newKey);
      await store.addKeyLog({
          id: Date.now().toString(),
          keyId: newKey.id,
          keyNo: newKey.keyNo,
          action: 'create',
          timestamp: Date.now(),
          operator: settings.agentName || '系统',
          details: `初始入库 [状态:${editPropStatus}] ${garden} ${roomNo}`
      });

      setActionType(null);
      resetForms();
      store.showToast("钥匙已入库");
  };

  /** 更新钥匙资料 */
  const handleUpdate = async () => {
      if (!targetKey || !newKeyNo) return;
      let garden = editGarden;
      let roomNo = editRoom;
      let propId = targetKey.propertyId;

      if (selectedPropId && selectedPropId !== targetKey.propertyId) {
          const p = properties.find(i => i.id === selectedPropId);
          if (p) {
              garden = p.garden;
              roomNo = `${p.building} ${p.room}`;
              propId = p.id;
          }
      } else if (!selectedPropId) {
          propId = undefined;
      }

      let borrowUpdates = {};
      if (targetKey.status === 'borrowed') {
          borrowUpdates = {
              borrower: editBorrower,
              borrowerPhone: editPhone,
              borrowReason: editReason
          };
      }

      const updatedKey: KeyRecord = {
          ...targetKey,
          keyNo: newKeyNo.toUpperCase(),
          propertyId: propId,
          propertyStatus: editPropStatus,
          garden,
          roomNo,
          ...borrowUpdates,
          updatedAt: Date.now()
      };

      await store.saveKey(updatedKey);
      await store.addKeyLog({
          id: Date.now().toString(),
          keyId: updatedKey.id,
          keyNo: updatedKey.keyNo,
          action: 'edit',
          timestamp: Date.now(),
          operator: settings.agentName,
          details: `修改资料 [状态:${editPropStatus}]`
      });
      setActionType(null);
      store.showToast("信息已更新");
  };

  /** 删除钥匙 */
  const handleDelete = async () => {
      if (!targetKey) return;
      if (confirm(`确定删除钥匙 ${targetKey.keyNo} 吗？\n此操作将同时删除该钥匙的历史日志。`)) {
          await store.deleteKey(targetKey.id);
          await store.addKeyLog({
              id: Date.now().toString(),
              keyId: targetKey.id,
              keyNo: targetKey.keyNo,
              action: 'delete',
              timestamp: Date.now(),
              operator: settings.agentName || '系统',
              details: `永久删除`
          });
          setActionType(null);
          store.showToast("钥匙已删除");
      }
  };

  /** 借出钥匙 */
  const handleBorrow = async () => {
      if (!targetKey) return;
      
      // 冲突检测逻辑
      const today = new Date().toISOString().split('T')[0];
      const reservation = appointments.find(a => 
          a.keyId === targetKey.id && 
          a.date === today && 
          a.status === 'scheduled'
      );

      if (reservation) {
          const warningMsg = `⚠️【预约冲突警告】\n\n该钥匙今日已被预约！\n\n预约信息：${reservation.title}\n时间：${reservation.time}\n\n是否忽略预约，继续借出？`;
          if (!confirm(warningMsg)) return;
      }

      // 联动删除逻辑
      if (reason === '结束委托') {
          if (confirm("【警告】借出原因为“结束委托”，是否同时删除对应房源？\n\n点击“确定”将房源移入回收站。\n点击“取消”仅登记钥匙借出。")) {
              if (targetKey.propertyId) {
                  await store.deleteProperty(targetKey.propertyId);
              }
          }
      }

      const updated: KeyRecord = {
          ...targetKey,
          status: 'borrowed',
          borrower,
          borrowerPhone,
          borrowReason: reason,
          borrowTime: Date.now(),
          updatedAt: Date.now()
      };

      await store.saveKey(updated);
      await store.addKeyLog({
          id: Date.now().toString(),
          keyId: targetKey.id,
          keyNo: targetKey.keyNo,
          action: 'borrow',
          borrower,
          phone: borrowerPhone,
          reason,
          timestamp: Date.now(),
          operator: settings.agentName
      });
      
      // 同步创建归还提醒待办
      store.addTodo(
          `[钥匙归还] ${targetKey.keyNo} - ${borrower}`, 
          new Date().toISOString().split('T')[0],
          { type: 'key', id: targetKey.id, name: targetKey.keyNo }
      );

      setActionType(null);
      resetForms();
      store.showToast("借出成功");
  };

  /** 归还钥匙 */
  const handleReturn = async () => {
      if (!targetKey) return;
      const updated: KeyRecord = {
          ...targetKey,
          status: 'in_store',
          borrower: undefined,
          borrowerPhone: undefined,
          borrowReason: undefined,
          borrowTime: undefined,
          updatedAt: Date.now()
      };
      await store.saveKey(updated);
      await store.addKeyLog({
          id: Date.now().toString(),
          keyId: targetKey.id,
          keyNo: targetKey.keyNo,
          action: 'return',
          timestamp: Date.now(),
          operator: settings.agentName
      });
      setActionType(null);
      store.showToast("归还确认成功");
  };

  /** 表单重置 */
  const resetForms = () => {
      setNewKeyNo('');
      setSearchProp('');
      setSelectedPropId('');
      setEditGarden('');
      setEditRoom('');
      setBorrower('');
      setBorrowerPhone('');
      setReason('');
      setEditBorrower('');
      setEditPhone('');
      setEditReason('');
      setEditPropStatus('normal');
  };
  
  /** 导出数据 */
  const handleExportData = () => {
      const exportItems = keyLogs.map(l => ({
          时间: l.timestamp ? new Date(l.timestamp).toLocaleString() : '-',
          钥匙编号: l.keyNo,
          动作: l.action === 'borrow' ? '借出' : l.action === 'return' ? '归还' : l.action === 'create' ? '入库' : l.action === 'edit' ? '修正' : '删除',
          借用人: l.borrower || '-',
          联系电话: l.phone || '-',
          事由: l.reason || l.details || '-',
          经办人: l.operator || '-'
      }));
      exportToExcel(exportItems, `钥匙流水_${new Date().toLocaleDateString()}`);
      store.showToast("记录已导出");
  };

  /** 预设更新 */
  const handleUpdatePresets = (type: 'borrower' | 'reason', list: string[]) => {
      const newConf = { ...settings.keyConfig };
      if (type === 'borrower') newConf.borrowerPresets = list;
      else newConf.reasonPresets = list;
      store.updateSettings({ keyConfig: newConf });
  };

  // --- 子组件渲染 ---

  const KeyHookDecoration = () => (
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-0 flex flex-col items-center">
          <div className="w-1.5 h-4 bg-slate-400 dark:bg-slate-600 rounded-full shadow-inner"></div>
          <div className="w-3 h-3 bg-slate-300 dark:bg-slate-500 rounded-full -mt-1 shadow-sm border border-slate-400"></div>
      </div>
  );

  const KeyCard: React.FC<{ keyData: KeyRecord }> = ({ keyData }) => {
      const isStored = keyData.status === 'in_store';
      const linkedProperty = properties.find(p => p.id === keyData.propertyId);
      
      const fullAddress = linkedProperty 
          ? `${linkedProperty.garden} ${linkedProperty.subArea||''} ${linkedProperty.building} ${linkedProperty.unit ? linkedProperty.unit + '单元' : ''} ${linkedProperty.room}`
          : `${keyData.garden} ${keyData.roomNo}`;

      // 智能分行处理
      const addrLines = fullAddress.split(' ').reduce((acc: string[], curr) => {
          if (acc.length === 0 || acc[acc.length-1].length > 10) acc.push(curr);
          else acc[acc.length-1] += ' ' + curr;
          return acc;
      }, []);

      const hoursPassed = keyData.borrowTime ? (Date.now() - keyData.borrowTime) / (1000 * 60 * 60) : 0;
      const isLongOverdue = hoursPassed > 72;

      const randomColors = ['bg-blue-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-violet-500'];
      const bgClass = isStored 
        ? randomColors[keyData.keyNo.charCodeAt(keyData.keyNo.length-1) % 5]
        : 'bg-transparent';

      return (
          <div className="relative w-full h-[280px] flex flex-col items-center group perspective-1000">
              <KeyHookDecoration />
              {isStored ? (
                  <div 
                      onClick={() => { setTargetKey(keyData); setActionType('borrow'); }}
                      className={`relative z-10 w-full flex-1 mt-2 cursor-pointer transition-transform duration-500 ease-in-out origin-top hover:rotate-2 hover:scale-[1.02] shadow-lg rounded-xl overflow-hidden flex flex-col border-b-4 border-r-4 border-black/20 ${bgClass}`}
                  >
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-bg-main rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] z-20 border border-white/20"></div>
                      <div className="pt-10 pb-4 px-4 text-center text-white relative shrink-0">
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                          <div className="text-4xl font-black font-mono tracking-tighter drop-shadow-md">{keyData.keyNo}</div>
                          <div className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1">MingHui Secure</div>
                      </div>
                      <div className="flex-1 bg-white dark:bg-slate-800 p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
                          <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-slate-700 absolute top-0 left-0"></div>
                          <div className="mt-2 space-y-1 w-full">
                              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                  {addrLines.map((line, i) => <div key={i} className="truncate">{line}</div>)}
                              </div>
                              <div className="flex items-center justify-center gap-2 mt-2">
                                  {keyData.propertyStatus && keyData.propertyStatus !== 'normal' && (
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${keyData.propertyStatus==='sold'?'bg-red-500 text-white shadow-sm':'bg-blue-500 text-white shadow-sm'}`}>
                                          {keyData.propertyStatus === 'rented' ? '已租' : '已售'}
                                      </span>
                                  )}
                                  <div className="text-[9px] text-slate-400 font-mono">ID: {keyData.id.slice(-6)}</div>
                              </div>
                          </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 w-full pt-2 pb-2 px-2 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-2 shrink-0">
                          <button onClick={(e)=>{ e.stopPropagation(); setTargetKey(keyData); setActionType('edit'); }} className="flex-1 py-1.5 rounded bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-500 hover:text-blue-600 border shadow-sm">编辑</button>
                          <button onClick={(e)=>{ e.stopPropagation(); setSelectedKeyId(keyData.id); setShowHistory(true); }} className="flex-1 py-1.5 rounded bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-500 hover:text-blue-600 border shadow-sm">日志</button>
                      </div>
                  </div>
              ) : (
                  <div 
                      onClick={() => { setTargetKey(keyData); setActionType('return'); }}
                      className={`relative z-10 w-full flex-1 mt-2 cursor-pointer rounded-xl border-2 border-dashed flex flex-col p-4 transition-all duration-300 group-hover:border-solid
                          ${isLongOverdue 
                              ? 'bg-red-50/50 dark:bg-red-900/10 border-red-400 dark:border-red-600 animate-[pulse_3s_infinite]' 
                              : 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800'
                          }`}
                  >
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-transparent border-2 border-slate-300 dark:border-slate-600 rounded-full opacity-50"></div>
                      <div className="flex-1 flex flex-col items-center justify-center relative opacity-80">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 rotate-[-20deg]">
                              <span className="text-6xl font-black uppercase">OUT</span>
                          </div>
                          <div className={`text-2xl font-black font-mono line-through decoration-2 ${isLongOverdue ? 'text-red-400 decoration-red-400' : 'text-slate-400 decoration-slate-400'}`}>
                              {keyData.keyNo}
                          </div>
                          <div className={`mt-4 w-full p-3 shadow-sm rotate-1 transform transition-transform group-hover:rotate-0 text-left relative overflow-hidden
                              ${isLongOverdue ? 'bg-red-100 text-red-900' : 'bg-yellow-100 text-yellow-900'}
                          `}>
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/40 rotate-2"></div>
                              <div className="flex items-center gap-1 font-bold text-sm mb-1"><User size={12}/> {keyData.borrower}</div>
                              <div className="text-xs opacity-80 mb-2 truncate">{keyData.borrowReason}</div>
                              <div className={`text-[10px] font-mono flex items-center gap-1 ${isLongOverdue ? 'text-red-700 font-bold' : 'opacity-60'}`}>{isLongOverdue && <AlertCircle size={10}/>}{Math.floor(hoursPassed)}小时前</div>
                          </div>
                          {keyData.propertyStatus && keyData.propertyStatus !== 'normal' && (
                              <div className={`mt-2 px-2 py-0.5 rounded text-[10px] font-black uppercase ${keyData.propertyStatus==='sold'?'bg-red-500 text-white':'bg-blue-500 text-white'}`}>
                                  房屋{keyData.propertyStatus === 'rented' ? '已租' : '已售'}
                              </div>
                          )}
                      </div>
                      <div className="mt-auto w-full pt-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="bg-white dark:bg-slate-700 shadow px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-200 flex items-center gap-1"><LogIn size={12}/> 确认归还</button>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col fade-in pb-10 overflow-hidden">
       {/* --- 顶部工具栏 --- */}
       <div className="flex justify-between items-center mb-6 shrink-0 px-2">
           <div className="flex items-center gap-3">
               <div className="p-2.5 bg-brand-100 dark:bg-brand-900/30 rounded-2xl text-brand-600">
                  <KeyRound size={28}/>
               </div>
               <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">钥匙系统</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Management Center</p>
               </div>
           </div>
           <div className="flex gap-3">
               <button onClick={()=>setActionType('settings')} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" title="预设配置">
                  <Settings size={20}/>
               </button>
               <button onClick={()=>{setSelectedKeyId(null); setShowHistory(true)}} className="bg-white dark:bg-slate-900 border text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                  <History size={18}/> 变动日志
               </button>
               <button onClick={()=>setActionType('create')} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all active:scale-95">
                  <Plus size={20}/> 钥匙入库
               </button>
           </div>
       </div>

       {/* --- 搜索与统计 --- */}
       <div className="bg-bg-card p-4 rounded-3xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col gap-4 shadow-sm shrink-0 mx-2">
           <div className="flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-4 items-center flex-1 max-w-3xl">
                   <div className="relative flex-1">
                       <Search className="absolute left-3.5 top-3 text-slate-400" size={18}/>
                       <input className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none focus:border-brand-500 transition-all font-medium" placeholder="极速搜索编号、地址或借用人..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                   </div>
                   
                   <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                       <button onClick={()=>setSortMode('default')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${sortMode==='default'?'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white':'text-slate-500'}`}>默认序</button>
                       <button onClick={()=>setSortMode('status')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${sortMode==='status'?'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white':'text-slate-500'}`}>借出优先</button>
                       <button onClick={()=>setSortMode('updated')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${sortMode==='updated'?'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white':'text-slate-500'}`}>最新动态</button>
                   </div>
               </div>

               <div className="flex gap-6 text-sm font-black text-slate-500 mr-4">
                   <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> 在库: {keys.filter(k=>k.status==='in_store').length}</span>
                   <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> 借出: {keys.filter(k=>k.status==='borrowed').length}</span>
               </div>
           </div>

           {/* 房屋状态过滤按钮组 */}
           <div className="flex items-center gap-2 px-2 border-t pt-4 border-slate-100 dark:border-slate-800">
               <span className="text-xs font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest"><Tags size={14}/> 房屋状态过滤:</span>
               <div className="flex gap-2">
                   {[
                       { id: 'all', label: '全部', color: 'bg-slate-200 text-slate-600' },
                       { id: 'normal', label: '正常', color: 'bg-emerald-100 text-emerald-700' },
                       { id: 'rented', label: '已租', color: 'bg-blue-100 text-blue-700' },
                       { id: 'sold', label: '已售', color: 'bg-red-100 text-red-700' }
                   ].map(btn => (
                       <button
                           key={btn.id}
                           onClick={() => setPropStatusFilter(btn.id as any)}
                           className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border-2 ${propStatusFilter === btn.id ? `${btn.color} border-current ring-2 ring-offset-2 ring-brand-500` : 'border-slate-100 dark:border-slate-800 text-slate-400 bg-transparent hover:bg-slate-50'}`}
                       >
                           {btn.label}
                       </button>
                   ))}
               </div>
           </div>
       </div>

       {/* --- 主体挂板区域 --- */}
       <div className="flex-1 min-h-0 relative px-2 overflow-y-auto custom-scrollbar pb-24">
           {filteredKeys.length === 0 ? (
               <div className="text-center text-slate-400 py-32 flex flex-col items-center">
                   <KeyRound size={64} className="mb-6 opacity-10"/>
                   <p className="text-lg font-bold">没有匹配的钥匙记录</p>
                   <p className="text-xs mt-1">尝试输入拼音首字母或切换房屋状态过滤器</p>
               </div>
           ) : (
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-8 gap-y-12 p-4">
                   {filteredKeys.map(key => <KeyCard key={key.id} keyData={key} />)}
               </div>
           )}
       </div>

       {/* --- 弹窗：入库 & 编辑 --- */}
       {(actionType === 'create' || actionType === 'edit') && (
           <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card w-full max-w-lg rounded-[2rem] p-8 shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 overflow-hidden">
                   <h3 className="text-2xl font-black mb-6 flex items-center gap-2 shrink-0">
                       {actionType === 'create' ? <Plus className="text-brand-600"/> : <Edit className="text-brand-600"/>} 
                       {actionType === 'create' ? '钥匙入库登记' : '编辑钥匙资料'}
                   </h3>
                   <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar flex-1">
                       <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">钥匙编号 *</label>
                               <input autoFocus className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-900 text-2xl font-mono font-black uppercase outline-none focus:border-brand-500 shadow-inner" placeholder="A-101" value={newKeyNo} onChange={e=>setNewKeyNo(e.target.value)}/>
                           </div>
                           <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">房屋当前业务状态</label>
                               <div className="flex gap-1 h-14 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                                   {[
                                       {id:'normal', label:'正常', activeColor: 'text-emerald-600'},
                                       {id:'rented', label:'已租', activeColor: 'text-blue-600'},
                                       {id:'sold', label:'已售', activeColor: 'text-red-600'}
                                   ].map(s => (
                                       <button key={s.id} type="button" onClick={()=>setEditPropStatus(s.id as any)} className={`flex-1 rounded-xl text-xs font-black transition-all ${editPropStatus===s.id?`bg-white dark:bg-slate-700 shadow ${s.activeColor}`:'text-slate-400 hover:text-slate-500'}`}>
                                           {s.label}
                                       </button>
                                   ))}
                               </div>
                           </div>
                       </div>
                       
                       <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                           <label className="text-[10px] font-black text-slate-500 mb-3 block flex items-center gap-1 uppercase tracking-widest"><MapPin size={12}/> 物理位置映射</label>
                           <div className="relative mb-3">
                               <input className="w-full border-2 border-white dark:border-slate-900 rounded-2xl p-3 text-sm outline-none focus:border-brand-500 shadow-sm" placeholder="搜索并关联系统已有房源..." value={searchProp} onChange={e=>{setSearchProp(e.target.value); setSelectedPropId('')}}/>
                               <Search className="absolute right-4 top-3.5 text-slate-400" size={16}/>
                           </div>
                           {selectedPropId ? (
                               <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-3 rounded-2xl text-xs flex items-center gap-2 font-bold border border-emerald-100 dark:border-emerald-800 animate-in zoom-in-95">
                                   <CheckCircle2 size={16}/> 已关联房源：地址将自动同步
                                   <button onClick={()=>setSelectedPropId('')} className="ml-auto p-1 hover:bg-emerald-100 rounded-full"><X size={14}/></button>
                               </div>
                           ) : (
                               <div className="space-y-2 animate-in fade-in">
                                   {searchProp && searchedProperties.length > 0 && (
                                       <div className="bg-white dark:bg-slate-900 border-2 border-brand-100 dark:border-slate-700 shadow-xl rounded-2xl mb-3 max-h-40 overflow-y-auto p-1.5 z-50">
                                           {searchedProperties.map(p => (
                                               <div key={p.id} onClick={()=>{setSearchProp(`${p.garden} ${p.subArea||''} ${p.building} ${p.room}`); setSelectedPropId(p.id)}} className="p-2.5 hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer text-sm rounded-xl transition-colors font-bold flex items-center gap-2">
                                                   <Home size={14} className="text-slate-400"/> {p.garden} {p.building} {p.room}
                                               </div>
                                           ))}
                                       </div>
                                   )}
                                   <div className="grid grid-cols-2 gap-3">
                                       <input className="border-2 border-white dark:border-slate-900 rounded-2xl p-3 text-sm bg-white dark:bg-slate-900 outline-none focus:border-brand-500 shadow-sm" placeholder="楼盘名称" value={editGarden} onChange={e=>setEditGarden(e.target.value)}/>
                                       <input className="border-2 border-white dark:border-slate-900 rounded-2xl p-3 text-sm bg-white dark:bg-slate-900 outline-none focus:border-brand-500 shadow-sm" placeholder="栋座房号" value={editRoom} onChange={e=>setEditRoom(e.target.value)}/>
                                   </div>
                               </div>
                           )}
                       </div>

                       {actionType === 'edit' && targetKey?.status === 'borrowed' && (
                           <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-3xl border border-red-100 dark:border-red-800 animate-in slide-in-from-top-2">
                               <label className="text-[10px] font-black text-red-600 mb-3 block flex items-center gap-1 uppercase tracking-widest"><User size={12}/> 借出信息修正</label>
                               <div className="grid grid-cols-2 gap-3 mb-3">
                                   <input className="border-2 border-white rounded-2xl p-3 text-sm bg-white dark:bg-slate-900 outline-none focus:border-red-500" placeholder="借用人" value={editBorrower} onChange={e=>setEditBorrower(e.target.value)}/>
                                   <input className="border-2 border-white rounded-2xl p-3 text-sm bg-white dark:bg-slate-900 outline-none focus:border-red-500" placeholder="电话" value={editPhone} onChange={e=>setEditPhone(e.target.value)}/>
                               </div>
                               <input className="w-full border-2 border-white rounded-2xl p-3 text-sm bg-white dark:bg-slate-900 outline-none focus:border-red-500" placeholder="借出原因" value={editReason} onChange={e=>setEditReason(e.target.value)}/>
                           </div>
                       )}
                   </div>
                   <div className="mt-8 flex gap-4 shrink-0">
                       <button onClick={()=>{setActionType(null); resetForms();}} className="flex-1 py-4 text-slate-500 font-black hover:bg-slate-50 rounded-2xl transition-colors">取消</button>
                       {actionType === 'edit' && (
                           <button onClick={handleDelete} className="px-6 py-4 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-colors">删除</button>
                       )}
                       <button onClick={actionType === 'create' ? handleCreate : handleUpdate} className="flex-[2] py-4 bg-brand-600 text-white font-black rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-500/20 active:scale-95 transition-all uppercase tracking-widest">保存入库</button>
                   </div>
               </div>
           </div>
       )}

       {/* --- 弹窗：配置管理 --- */}
       {actionType === 'settings' && (
           <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                   <div className="flex justify-between items-center mb-8 shrink-0">
                       <div className="flex items-center gap-3">
                           <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600"><Settings size={24}/></div>
                           <h3 className="text-2xl font-black tracking-tight">预设标签管理</h3>
                       </div>
                       <button onClick={()=>setActionType(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-10 pr-2 custom-scrollbar">
                       <section>
                           <h4 className="font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><User size={18} className="text-brand-500"/> 借用人身份 (如: 同行、装修)</h4>
                           <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 min-h-[80px]">
                               {(settings.keyConfig?.borrowerPresets || []).map(p => (
                                   <button 
                                       key={p} 
                                       onClick={()=>handleUpdatePresets('borrower', settings.keyConfig.borrowerPresets.filter(i=>i!==p))}
                                       className="group flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-red-300 hover:text-red-600 transition-all shadow-sm"
                                   >
                                       {p} <X size={14} className="opacity-0 group-hover:opacity-100"/>
                                   </button>
                               ))}
                           </div>
                           <div className="flex gap-2">
                               <input className="flex-1 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-3 bg-white dark:bg-slate-900 outline-none focus:border-brand-500 shadow-inner" placeholder="输入新标签..." value={newPresetBorrower} onChange={e=>setNewPresetBorrower(e.target.value)}/>
                               <button onClick={()=>{ if(newPresetBorrower.trim()){ handleUpdatePresets('borrower', [...(settings.keyConfig.borrowerPresets||[]), newPresetBorrower.trim()]); setNewPresetBorrower(''); }}} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-brand-700">添加</button>
                           </div>
                       </section>

                       <section>
                           <h4 className="font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ArrowRightLeft size={18} className="text-brand-500"/> 常用借出事由 (如: 带看、拍照)</h4>
                           <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 min-h-[80px]">
                               {(settings.keyConfig?.reasonPresets || []).map(r => (
                                   <button 
                                       key={r} 
                                       onClick={()=>handleUpdatePresets('reason', settings.keyConfig.reasonPresets.filter(i=>i!==r))}
                                       className="group flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-red-300 hover:text-red-600 transition-all shadow-sm"
                                   >
                                       {r} <X size={14} className="opacity-0 group-hover:opacity-100"/>
                                   </button>
                               ))}
                           </div>
                           <div className="flex gap-2">
                               <input className="flex-1 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-3 bg-white dark:bg-slate-900 outline-none focus:border-brand-500 shadow-inner" placeholder="输入新事由..." value={newPresetReason} onChange={e=>setNewPresetReason(e.target.value)}/>
                               <button onClick={()=>{ if(newPresetReason.trim()){ handleUpdatePresets('reason', [...(settings.keyConfig.reasonPresets||[]), newPresetReason.trim()]); setNewPresetReason(''); }}} className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-brand-700">添加</button>
                           </div>
                       </section>
                   </div>
                   <button onClick={()=>setActionType(null)} className="mt-10 w-full bg-slate-100 dark:bg-slate-800 py-3 rounded-xl font-black text-slate-600 dark:text-slate-200 hover:bg-slate-200 transition-all active:scale-[0.98]" title="完成并返回">完成配置并返回挂板</button>
               </div>
           </div>
       )}

       {/* --- 弹窗：登记借出 --- */}
       {actionType === 'borrow' && targetKey && (
           <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                   <div className="flex items-center gap-4 mb-8">
                       <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-3xl flex items-center justify-center shrink-0 shadow-sm"><LogOut size={32}/></div>
                       <div>
                           <h3 className="text-2xl font-black tracking-tight">钥匙借出登记</h3>
                           <p className="font-mono text-brand-600 font-black text-xl">{targetKey.keyNo}</p>
                       </div>
                   </div>
                   <div className="space-y-6">
                       <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">借用人身份</label>
                           <div className="flex flex-wrap gap-2">
                               {settings.keyConfig?.borrowerPresets?.map(p => (
                                   <button key={p} onClick={()=>setBorrower(p)} className={`px-4 py-2 text-xs font-black rounded-xl border-2 transition-all ${borrower===p?'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30':'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
                               ))}
                           </div>
                           <input className="w-full border-2 border-slate-50 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-900 outline-none focus:border-brand-500 font-bold shadow-inner" placeholder="或手动输入姓名" value={borrower} onChange={e=>setBorrower(e.target.value)}/>
                       </div>
                       <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">联系电话</label>
                           <input className="w-full border-2 border-slate-50 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-900 outline-none focus:border-brand-500 font-mono font-bold shadow-inner" placeholder="000 0000 0000" value={borrowerPhone} onChange={e=>setBorrowerPhone(e.target.value)}/>
                       </div>
                       <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">借出事由</label>
                           <div className="flex flex-wrap gap-2">
                               {settings.keyConfig?.reasonPresets?.map(r => (
                                   <button key={r} onClick={()=>setReason(r)} className={`px-4 py-2 text-xs font-black rounded-xl border-2 transition-all ${reason===r?'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30':'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50'}`}>{r}</button>
                               ))}
                           </div>
                           <input className="w-full border-2 border-slate-50 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-900 outline-none focus:border-brand-500 font-bold shadow-inner" placeholder="详细说明" value={reason} onChange={e=>setReason(e.target.value)}/>
                       </div>
                   </div>
                   <div className="mt-10 flex gap-4">
                       <button onClick={()=>{setActionType(null); resetForms();}} className="flex-1 py-4 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-colors">取消</button>
                       <button onClick={handleBorrow} disabled={!borrower} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-30 shadow-xl shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest">确认借出</button>
                   </div>
               </div>
           </div>
       )}

       {/* --- 弹窗：确认归还 --- */}
       {actionType === 'return' && targetKey && (
           <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                   <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm"><CheckCircle2 size={40}/></div>
                   <h3 className="text-2xl font-black mb-3">钥匙归还确认</h3>
                   <p className="text-sm text-slate-500 mb-8">请核对实物钥匙编号与系统中是否一致。</p>
                   <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl text-sm text-slate-600 dark:text-slate-300 mb-8 text-left border-2 border-white dark:border-slate-800 shadow-inner space-y-2">
                       <div className="flex justify-between"><span className="font-bold opacity-50">钥匙编号:</span> <span className="font-black text-brand-600">{targetKey.keyNo}</span></div>
                       <div className="flex justify-between"><span className="font-bold opacity-50">借用人:</span> <span className="font-black">{targetKey.borrower}</span></div>
                       <div className="flex justify-between"><span className="font-bold opacity-50">借出时间:</span> <span className="font-mono text-xs font-bold">{targetKey.borrowTime ? new Date(targetKey.borrowTime).toLocaleString() : '-'}</span></div>
                   </div>
                   <div className="flex gap-4">
                       <button onClick={()=>setActionType(null)} className="flex-1 py-4 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-colors">取消</button>
                       <button onClick={handleReturn} className="flex-[2] py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-xl shadow-green-500/20 active:scale-95 transition-all uppercase tracking-widest">确认入库</button>
                   </div>
               </div>
           </div>
       )}
       
       {/* --- 弹窗：历史记录日志 --- */}
       {showHistory && (
           <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card w-full max-w-5xl h-[85vh] rounded-[2.5rem] flex flex-col animate-in zoom-in-95 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                   <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                       <div className="flex items-center gap-3">
                           <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600"><History size={24}/></div>
                           <div>
                               <h3 className="text-xl font-black">{selectedKeyId ? '单把钥匙流转日志' : '系统钥匙全局记录'}</h3>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction History & Logs</p>
                           </div>
                       </div>
                       <div className="flex gap-3">
                           <button onClick={handleExportData} className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-green-100 transition-all border border-green-100 dark:border-green-800">
                              <FileSpreadsheet size={16}/> 导出记录
                           </button>
                           <button onClick={()=>setShowHistory(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                              <X size={24}/>
                           </button>
                       </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-slate-950">
                       <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                           <table className="w-full text-left text-sm border-collapse">
                               <thead className="bg-slate-50 dark:bg-slate-800 font-black text-slate-400 uppercase sticky top-0 z-10 border-b dark:border-slate-700">
                                   <tr>
                                       <th className="p-4 pl-8">发生时间</th>
                                       <th className="p-4">钥匙编号</th>
                                       <th className="p-4">操作类型</th>
                                       <th className="p-4">相关方</th>
                                       <th className="p-4">事由 / 详情</th>
                                       <th className="p-4 pr-8 text-right">经办</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                   {(filteredLogs || []).slice().sort((a,b) => (b.timestamp||0)-(a.timestamp||0)).map((log, idx) => (
                                       <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-in fade-in" style={{animationDelay: `${idx*30}ms`}}>
                                           <td className="p-4 pl-8 text-slate-500 font-mono text-[11px] font-bold">{new Date(log.timestamp).toLocaleString()}</td>
                                           <td className="p-4 font-mono font-black text-brand-600 text-lg">{log.keyNo}</td>
                                           <td className="p-4">
                                               <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                                                   log.action==='borrow'?'bg-blue-100 text-blue-700':
                                                   log.action==='return'?'bg-green-100 text-green-700':
                                                   log.action==='create'?'bg-slate-100 text-slate-600':
                                                   log.action==='edit'?'bg-orange-100 text-orange-700':'bg-red-100 text-red-700'
                                               }`}>
                                                   {log.action==='borrow'?'登记借出':log.action==='return'?'确认归还':log.action==='create'?'初始入库':log.action==='edit'?'资料修正':'永久删除'}
                                               </span>
                                           </td>
                                           <td className="p-4">
                                               {log.borrower ? (
                                                   <div className="flex flex-col">
                                                       <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><User size={12} className="text-slate-400"/> {log.borrower}</div>
                                                       {log.phone && <div className="text-[10px] text-slate-400 font-mono">{log.phone}</div>}
                                                   </div>
                                               ) : <span className="text-slate-300 italic">-</span>}
                                           </td>
                                           <td className="p-4 text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-xs truncate">{log.reason || log.details || '-'}</td>
                                           <td className="p-4 pr-8 text-right text-slate-400 text-xs italic font-bold">{log.operator}</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                           {(filteredLogs || []).length === 0 && (
                               <div className="py-20 text-center text-slate-400 font-bold italic">暂无历史操作记录</div>
                           )}
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
