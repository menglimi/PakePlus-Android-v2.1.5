
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, AlertTriangle, Key, ArrowRightLeft, Edit2, Trash2, X, Check, Save, User, Home, MapPin, Grid, List, AlignJustify, Lock, Download } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Appointment, Todo } from '../types';

interface CalendarEvent {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'todo' | 'appointment' | 'customer' | 'lease' | 'log';
    title: string;
    time?: string;
    details?: string;
    data: any;
}

export const Calendar = () => {
  const { customers, properties, todos, addTodo, updateTodo, deleteTodo, keys, keyLogs, appointments, addAppointment, updateAppointment, deleteAppointment, addFollowUp, showToast } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'todo' | 'appointment' | 'key_reserve'>('appointment');
  
  // New Appointment State
  const [newApptData, setNewApptData] = useState<Partial<Appointment>>({ type: 'viewing' });
  const [newTodoText, setNewTodoText] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({ todo: true, appt: true, log: true, system: true });

  // Helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const getWeekDays = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday to start on Monday
      const monday = new Date(d.setDate(diff));
      
      const days = [];
      // Show 2 weeks (14 days) to prevent missing weekend/next week context
      for(let i=0; i<14; i++) {
          const temp = new Date(monday);
          temp.setDate(monday.getDate() + i);
          days.push(temp);
      }
      return days;
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const prevPeriod = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      else newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
  };
  
  const nextPeriod = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      else newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
  };

  // --- DATA AGGREGATION ---
  const allEvents = useMemo(() => {
      const events: CalendarEvent[] = [];
      
      if (filters.todo) {
          todos.forEach(t => events.push({ id: t.id, date: t.dueDate || '', type: 'todo', title: t.text, data: t }));
      }
      
      if (filters.appt) {
          appointments.forEach(a => events.push({ 
              id: a.id, date: a.date, type: 'appointment', 
              title: a.title, time: a.time, 
              details: a.note, data: a 
          }));
      }
      
      if (filters.system) {
          customers.forEach(c => {
              if (c.deadline) events.push({ id: `c_${c.id}`, date: c.deadline, type: 'customer', title: `客户截止: ${c.name}`, data: c });
          });
          properties.forEach(p => {
              if (p.leaseEnd) events.push({ id: `p_${p.id}`, date: p.leaseEnd, type: 'lease', title: `租约到期: ${p.room}`, data: p });
          });
      }
      
      if (filters.log) {
          keyLogs.forEach(l => {
              const d = new Date(l.timestamp);
              const dateStr = formatDate(d);
              events.push({ 
                  id: `l_${l.id}`, date: dateStr, type: 'log', 
                  title: `${l.action==='borrow'?'借出':'归还'}: ${l.keyNo}`, 
                  time: d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
                  data: l 
              });
          });
      }
      
      return events;
  }, [todos, appointments, customers, properties, keyLogs, filters]);

  const getEventsForDay = (dateStr: string) => allEvents.filter(e => e.date === dateStr);

  // --- DRAG & DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
      if (event.type !== 'todo' && event.type !== 'appointment') return;
      e.dataTransfer.setData("application/json", JSON.stringify(event));
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
      e.preventDefault();
      try {
          const data = e.dataTransfer.getData("application/json");
          if (!data) return;
          const event = JSON.parse(data) as CalendarEvent;
          
          if (event.date === targetDate) return;

          if (event.type === 'todo') {
              updateTodo(event.id, event.title, targetDate);
          } else if (event.type === 'appointment') {
              const appt = event.data as Appointment;
              updateAppointment({ ...appt, date: targetDate });
          }
      } catch (err) { console.error("Drop failed", err); }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  // --- EXPORT ICS ---
  const handleExportICS = () => {
      let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MingHui//Real Estate Pro//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

      const formatICSDate = (dateStr: string, timeStr?: string) => {
          // dateStr is YYYY-MM-DD
          const d = dateStr.replace(/-/g, '');
          if (timeStr) {
              // timeStr is HH:mm
              const t = timeStr.replace(/:/g, '') + '00';
              return `DTSTART:${d}T${t}`; // Local time
          }
          return `DTSTART;VALUE=DATE:${d}`; // All day
      };

      // 1. Appointments
      appointments.filter(a => a.status === 'scheduled').forEach(a => {
          icsContent += `BEGIN:VEVENT
UID:appt_${a.id}@minghui.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
${formatICSDate(a.date, a.time)}
SUMMARY:${a.title}
DESCRIPTION:${a.note || ''} (客户: ${customers.find(c=>c.id===a.customerId)?.name || '无'})
STATUS:CONFIRMED
END:VEVENT
`;
      });

      // 2. Todos
      todos.filter(t => !t.done && t.dueDate).forEach(t => {
          icsContent += `BEGIN:VEVENT
UID:todo_${t.id}@minghui.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
${formatICSDate(t.dueDate!)}
SUMMARY:${t.text}
STATUS:CONFIRMED
END:VEVENT
`;
      });

      icsContent += "END:VCALENDAR";

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `minghui_export_${new Date().toISOString().split('T')[0]}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("已导出 ICS 文件，请发送至手机打开");
  };

  // --- CRUD Handlers ---
  const handleSaveAppointment = async () => {
      if (!newApptData.title || !selectedDate) return;
      const startTime = newApptData.time || '10:00';
      
      // 1. Key Conflict
      if (modalType === 'key_reserve' && newApptData.keyId) {
          const conflict = appointments.find(a => 
              a.id !== newApptData.id && 
              a.keyId === newApptData.keyId && 
              a.date === selectedDate && 
              a.status !== 'cancelled'
          );
          if (conflict) {
              if(!confirm(`⚠️ 冲突警告：该钥匙在 ${selectedDate} 已被预约 (${conflict.time} ${conflict.title})。\n\n是否仍要继续预约？`)) return;
          }
      }

      // 2. Smart Location Conflict Detection
      if (modalType === 'appointment' && newApptData.propertyId) {
          const todayAppts = appointments.filter(a => a.date === selectedDate && a.status === 'scheduled').sort((a,b) => (a.time || '') > (b.time || '') ? 1 : -1);
          
          if (todayAppts.length > 0) {
              const currentMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
              
              // Find adjacent appointments
              let prevAppt: Appointment | null = null;
              
              for (const a of todayAppts) {
                  if (!a.time) continue;
                  const aMinutes = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
                  if (aMinutes < currentMinutes) {
                      prevAppt = a;
                  } else {
                      break;
                  }
              }

              // Check travel time from previous
              if (prevAppt && prevAppt.propertyId && prevAppt.propertyId !== newApptData.propertyId) {
                  const prevProp = properties.find(p => p.id === prevAppt!.propertyId);
                  const currProp = properties.find(p => p.id === newApptData.propertyId);
                  
                  if (prevProp && currProp && prevProp.garden !== currProp.garden) {
                      const prevEndMinutes = parseInt(prevAppt.time!.split(':')[0]) * 60 + parseInt(prevAppt.time!.split(':')[1]) + 60; // Assume 1h duration
                      const gap = currentMinutes - prevEndMinutes;
                      
                      if (gap < 60) {
                          const msg = `⚠️ 智能行程警告：\n\n上一个行程在【${prevProp.garden}】（约 ${prevAppt.time} 开始），结束到本次【${currProp.garden}】只有 ${gap > 0 ? gap : 0} 分钟间隔。\n\n路程时间可能不足，建议调整时间。是否仍要保存？`;
                          if (!confirm(msg)) return;
                      }
                  }
              }
          }
      }

      const appt: Appointment = {
          id: Date.now().toString(),
          title: newApptData.title,
          date: selectedDate,
          time: startTime,
          type: modalType === 'key_reserve' ? 'key_reserve' : (newApptData.type || 'viewing'),
          customerId: newApptData.customerId,
          propertyId: newApptData.propertyId,
          keyId: newApptData.keyId,
          note: newApptData.note,
          status: 'scheduled'
      };
      
      addAppointment(appt);
      
      if (appt.customerId && appt.type === 'viewing') {
          const content = `预约带看: ${appt.title} (时间: ${appt.date} ${appt.time})`;
          await addFollowUp(appt.customerId, { id: Date.now().toString(), date: new Date().toISOString(), type: 'visit', content });
          showToast("已自动添加客户跟进记录", "success");
      } else {
          showToast("预约已保存");
      }

      setShowAddModal(false);
      setNewApptData({ type: 'viewing' });
  };

  const handleSaveTodo = () => {
      if (newTodoText.trim()) {
          addTodo(newTodoText, selectedDate);
          setNewTodoText('');
          setShowAddModal(false);
      }
  };

  const handleDeleteEvent = (e: CalendarEvent) => {
      if (!confirm("确定删除吗？")) return;
      if (e.type === 'todo') deleteTodo(e.id);
      if (e.type === 'appointment') deleteAppointment(e.id);
  };

  // --- RENDERERS ---
  // Fix: Explicitly typed as React.FC to handle the special 'key' prop correctly in TypeScript
  const EventChip: React.FC<{ event: CalendarEvent; compact?: boolean }> = ({ event, compact = false }) => {
      const isDraggable = event.type === 'todo' || event.type === 'appointment';
      const apptData = event.data as Appointment;
      
      const bgColors = {
          todo: 'bg-green-100 text-green-800 border-green-200',
          appointment: apptData?.type === 'key_reserve' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200',
          customer: 'bg-red-100 text-red-800 border-red-200',
          lease: 'bg-orange-100 text-orange-800 border-orange-200',
          log: 'bg-slate-100 text-slate-700 border-slate-200'
      };

      return (
          <div 
              draggable={isDraggable}
              onDragStart={(e) => handleDragStart(e, event)}
              className={`text-[10px] px-1.5 py-0.5 rounded border mb-1 truncate cursor-pointer transition-transform active:scale-95 ${bgColors[event.type]} ${isDraggable ? 'hover:shadow-md' : 'opacity-80'}`}
              title={event.title}
          >
              <div className="flex items-center gap-1">
                  {event.type === 'appointment' && (apptData.type==='key_reserve' ? <Lock size={8}/> : <Clock size={8}/>)}
                  {event.type === 'log' && <Key size={8}/>}
                  {event.time && <span className="font-mono font-bold opacity-70">{event.time}</span>}
                  <span className="font-medium truncate">{event.title}</span>
              </div>
          </div>
      );
  };

  const renderMonthView = () => {
      const totalDays = daysInMonth(currentDate);
      const startDay = firstDayOfMonth(currentDate);
      const days = [];
      
      for (let i = 0; i < startDay; i++) {
          days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-slate-50/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800"></div>);
      }
      
      for (let d = 1; d <= totalDays; d++) {
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const events = getEventsForDay(dateStr);
          
          days.push(
              <div 
                  key={d} 
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dateStr)}
                  className={`h-24 md:h-32 border border-slate-200 dark:border-slate-700 p-1 relative cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'ring-2 ring-brand-500 z-10' : ''} ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-bg-card'}`}
              >
                  <div className="flex justify-between items-start">
                      <div className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}>{d}</div>
                      {events.length > 0 && <div className="text-[10px] text-slate-400 font-mono">{events.length}</div>}
                  </div>
                  <div className="mt-1 overflow-y-auto max-h-[calc(100%-24px)] custom-scrollbar">
                      {events.slice(0, 4).map((e, i) => <EventChip key={i} event={e} />)}
                      {events.length > 4 && <div className="text-[10px] text-slate-400 pl-1">...</div>}
                  </div>
              </div>
          );
      }
      return days;
  };

  const renderWeekView = () => {
      const days = getWeekDays(currentDate);
      return days.map(d => {
          const dateStr = formatDate(d);
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const events = getEventsForDay(dateStr);
          
          return (
              <div 
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dateStr)}
                  className={`flex-1 min-w-[120px] border-r border-slate-200 dark:border-slate-700 flex flex-col h-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isSelected ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
              >
                  <div className={`p-2 text-center border-b ${isToday ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 font-bold' : 'text-slate-500'}`}>
                      <div className="text-xs uppercase">{['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}</div>
                      <div className="text-xl">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                      {events.sort((a,b) => (a.time||'') > (b.time||'') ? 1 : -1).map((e, i) => (
                          <EventChip key={i} event={e} />
                      ))}
                  </div>
              </div>
          );
      });
  };

  return (
    <div className="h-full flex flex-col fade-in pb-10">
       <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon className="text-brand-600"/> 工作日历</h1>
           
           <div className="flex gap-4">
               {/* Export ICS */}
               <button onClick={handleExportICS} className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700">
                   <Download size={16}/> 导出ICS
               </button>

               {/* Filters */}
               <div className="hidden md:flex items-center gap-2 bg-bg-card border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                   <button onClick={()=>setFilters({...filters, todo: !filters.todo})} className={`px-2 py-1 text-xs rounded ${filters.todo ? 'bg-green-100 text-green-700' : 'text-slate-400'}`}>待办</button>
                   <button onClick={()=>setFilters({...filters, appt: !filters.appt})} className={`px-2 py-1 text-xs rounded ${filters.appt ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>预约</button>
                   <button onClick={()=>setFilters({...filters, log: !filters.log})} className={`px-2 py-1 text-xs rounded ${filters.log ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>日志</button>
               </div>

               {/* View Switcher */}
               <div className="flex items-center bg-bg-card border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                   <button onClick={()=>setViewMode('month')} className={`p-1.5 rounded ${viewMode==='month'?'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200':'text-slate-400'}`}><Grid size={16}/></button>
                   <button onClick={()=>setViewMode('week')} className={`p-1.5 rounded ${viewMode==='week'?'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200':'text-slate-400'}`}><AlignJustify size={16}/></button>
               </div>

               {/* Nav */}
               <div className="flex items-center gap-2 bg-bg-card p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                   <button onClick={prevPeriod} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronLeft size={20}/></button>
                   <span className="font-bold text-sm w-24 text-center">{currentDate.getFullYear()}年 {currentDate.getMonth()+1}月</span>
                   <button onClick={nextPeriod} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><ChevronRight size={20}/></button>
               </div>
           </div>
       </div>

       <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
           {/* Calendar Grid */}
           <div className="flex-1 bg-bg-card rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
               {viewMode === 'month' ? (
                   <>
                       <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                           {['日','一','二','三','四','五','六'].map(d => (
                               <div key={d} className="p-2 text-center text-xs font-bold text-slate-500">{d}</div>
                           ))}
                       </div>
                       <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
                           {renderMonthView()}
                       </div>
                   </>
               ) : (
                   <div className="flex h-full overflow-x-auto">
                       {renderWeekView()}
                   </div>
               )}
           </div>

           {/* Side Panel */}
           <div className="w-full lg:w-80 bg-bg-card rounded-xl shadow border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{selectedDate}</h3>
                   <button onClick={()=>setShowAddModal(true)} className="bg-brand-600 text-white rounded-full p-2 hover:bg-brand-700 shadow-md"><Plus size={20}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                   {getEventsForDay(selectedDate).length === 0 && <div className="text-center text-slate-400 py-10 text-sm">今日无安排</div>}
                   
                   {getEventsForDay(selectedDate).map((e, i) => (
                       <div key={i} className="group relative p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                           <div className="flex items-start gap-3">
                               <div className={`w-1 self-stretch rounded-full ${e.type==='todo'?'bg-green-500':(e.data as Appointment)?.type==='key_reserve'?'bg-amber-500':e.type==='appointment'?'bg-blue-500':'bg-slate-400'}`}></div>
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-center mb-1">
                                       <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                                           {e.type === 'appointment' ? ((e.data as Appointment).type==='key_reserve'?'钥匙预留':'预约') : e.type === 'todo' ? '待办' : e.type==='log'?'日志':'提醒'}
                                           {e.time && <span>· {e.time}</span>}
                                       </span>
                                       {(e.type === 'todo' || e.type === 'appointment') && (
                                           <button onClick={()=>handleDeleteEvent(e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                       )}
                                   </div>
                                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 break-words">{e.title}</div>
                                   {e.details && <div className="text-xs text-slate-500 mt-1">{e.details}</div>}
                                   
                                   {/* Context Info for Appointments */}
                                   {e.type === 'appointment' && (
                                       <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                           {(e.data as Appointment).keyId && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Lock size={10}/> 钥匙</span>}
                                           {(e.data as Appointment).propertyId && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Home size={10}/> 房源</span>}
                                           {(e.data as Appointment).customerId && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1"><User size={10}/> 客户</span>}
                                       </div>
                                   )}
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       </div>

       {/* ADD EVENT MODAL */}
       {showAddModal && (
           <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
               <div className="bg-bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                   <div className="flex border-b border-slate-200 dark:border-slate-700">
                       <button onClick={()=>setModalType('appointment')} className={`flex-1 py-3 font-bold text-sm ${modalType==='appointment'?'bg-blue-50 text-blue-600 border-b-2 border-blue-600':'text-slate-500 hover:bg-slate-50'}`}>新建预约</button>
                       <button onClick={()=>setModalType('key_reserve')} className={`flex-1 py-3 font-bold text-sm ${modalType==='key_reserve'?'bg-amber-50 text-amber-600 border-b-2 border-amber-600':'text-slate-500 hover:bg-slate-50'}`}>钥匙预留</button>
                       <button onClick={()=>setModalType('todo')} className={`flex-1 py-3 font-bold text-sm ${modalType==='todo'?'bg-green-50 text-green-600 border-b-2 border-green-600':'text-slate-500 hover:bg-slate-50'}`}>普通待办</button>
                   </div>
                   
                   <div className="p-6 space-y-4">
                       {modalType !== 'todo' ? (
                           <>
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-1">
                                       <label className="text-xs font-bold text-slate-500">时间</label>
                                       <input type="time" className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900" value={newApptData.time || '10:00'} onChange={e=>setNewApptData({...newApptData, time: e.target.value})}/>
                                   </div>
                                   <div className="space-y-1">
                                       <label className="text-xs font-bold text-slate-500">类型</label>
                                       <select disabled={modalType === 'key_reserve'} className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900" value={modalType === 'key_reserve' ? 'key_reserve' : newApptData.type} onChange={e=>setNewApptData({...newApptData, type: e.target.value as any})}>
                                           <option value="viewing">带看</option>
                                           <option value="signing">签约</option>
                                           <option value="key_reserve">钥匙预留</option>
                                           <option value="other">其他</option>
                                       </select>
                                   </div>
                               </div>
                               
                               <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500">标题</label>
                                   <input className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900" placeholder={modalType==='key_reserve'?"预留说明":"如: 带看碧桂园"} value={newApptData.title || ''} onChange={e=>setNewApptData({...newApptData, title: e.target.value})}/>
                               </div>

                               {modalType === 'key_reserve' && (
                                   <div className="space-y-1">
                                       <label className="text-xs font-bold text-slate-500">选择钥匙</label>
                                       <select className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900 text-sm font-mono" value={newApptData.keyId || ''} onChange={e=>setNewApptData({...newApptData, keyId: e.target.value, title: newApptData.title || `预留钥匙: ${keys.find(k=>k.id===e.target.value)?.keyNo}`})}>
                                           <option value="">-- 选择钥匙 --</option>
                                           {keys.map(k=><option key={k.id} value={k.id}>{k.keyNo} - {k.garden} {k.roomNo}</option>)}
                                       </select>
                                   </div>
                               )}

                               {modalType === 'appointment' && (
                                   <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">关联客户 {newApptData.type === 'viewing' && <span className="text-green-600 text-[10px]">(自动记录跟进)</span>}</label>
                                        <select className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900 text-sm" value={newApptData.customerId || ''} onChange={e=>setNewApptData({...newApptData, customerId: e.target.value})}>
                                            <option value="">-- 选择客户 --</option>
                                            {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">关联房源</label>
                                        <select className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900 text-sm" value={newApptData.propertyId || ''} onChange={e=>setNewApptData({...newApptData, propertyId: e.target.value})}>
                                            <option value="">-- 选择房源 --</option>
                                            {properties.map(p=><option key={p.id} value={p.id}>{p.garden} {p.building}-{p.room}</option>)}
                                        </select>
                                    </div>
                                   </>
                               )}
                               
                               <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500">备注</label>
                                   <textarea className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900 h-20" placeholder="详情..." value={newApptData.note || ''} onChange={e=>setNewApptData({...newApptData, note: e.target.value})}/>
                               </div>
                           </>
                       ) : (
                           <div className="space-y-2">
                               <label className="text-xs font-bold text-slate-500">待办内容</label>
                               <textarea autoFocus className="w-full border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 h-32" placeholder="输入待办事项..." value={newTodoText} onChange={e=>setNewTodoText(e.target.value)}/>
                           </div>
                       )}
                   </div>

                   <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-900">
                       <button onClick={()=>setShowAddModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">取消</button>
                       <button onClick={modalType !== 'todo' ? handleSaveAppointment : handleSaveTodo} className="flex-1 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-md">保存</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
