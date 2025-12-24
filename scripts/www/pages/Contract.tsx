
import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileText, Download, Save, Calculator, CalendarDays, Plus, Minus, ScrollText } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { digitUppercase } from '../utils';

interface FurnitureItem {
  name: string;
  count: string;
}

interface Party {
    name: string;
    id: string;
    phone: string;
}

// --- Extracted Components ---

const PartyEditor = ({ title, list, setList }: { title: string, list: Party[], setList: React.Dispatch<React.SetStateAction<Party[]>> }) => {
    const updateParty = (index: number, field: keyof Party, val: string) => {
        setList(prev => {
            const newArr = [...prev];
            newArr[index] = { ...newArr[index], [field]: val };
            return newArr;
        });
    };

    const addPartyRow = () => {
        setList(prev => [...prev, { name: '', id: '', phone: '' }]);
    };

    const removePartyRow = (index: number) => {
        setList(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="border border-slate-200 dark:border-slate-700 p-3 rounded-lg relative bg-white dark:bg-slate-900">
            <div className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-bold text-slate-500">{title}</div>
            <div className="space-y-2">
                {list.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <div className="flex-1 space-y-1">
                            <div className="flex gap-1">
                                <input className="w-1/3 border rounded p-1.5 text-xs bg-transparent" placeholder="姓名" value={p.name} onChange={e=>updateParty(i, 'name', e.target.value)}/>
                                <input className="w-1/3 border rounded p-1.5 text-xs bg-transparent" placeholder="电话" value={p.phone} onChange={e=>updateParty(i, 'phone', e.target.value)}/>
                                <input className="w-1/3 border rounded p-1.5 text-xs bg-transparent" placeholder="身份证" value={p.id} onChange={e=>updateParty(i, 'id', e.target.value)}/>
                            </div>
                        </div>
                        {i === 0 ? (
                            <button onClick={addPartyRow} className="text-blue-500 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="添加"><Plus size={16}/></button>
                        ) : (
                            <button onClick={()=>removePartyRow(i)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="删除"><Minus size={16}/></button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Component ---

export const ContractGenerator = () => {
  const { properties, customers, saveProperty, settings, showToast, addTodo } = useStore();
  const printRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [selectedPropId, setSelectedPropId] = useState('');
  const [selectedCustId, setSelectedCustId] = useState('');
  
  // Post-Action Modal
  const [showPostAction, setShowPostAction] = useState(false);

  // Dynamic Parties
  const [landlords, setLandlords] = useState<Party[]>([{name: '', id: '', phone: ''}]);
  const [tenants, setTenants] = useState<Party[]>([{name: '', id: '', phone: ''}]);

  const [leaseData, setLeaseData] = useState({
    contractNo: '', 
    
    landlordName: '', landlordId: '', landlordPhone: '',
    tenantName: '', tenantId: '', tenantPhone: '',
    
    address: '',
    usage: '居住',
    paymentMethod: '银行转账', 
    area: '',
    
    duration: '12',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    
    rent: '',
    rentUpper: '',
    payDay: '',
    overdueStop: '5',
    overdueTerm: '5',
    
    deposit: '',
    
    agentFeeLandlord: '',
    agentFeeTenant: '',
    
    signDate: new Date().toISOString().split('T')[0],
    
    waterReading: '',
    elecReading: '',
    otherReading: '甲方需在乙方入住前将水电费、管理费结清',
    
    remarks: '租金不含物业费与水电费，租赁期间水电费与物业费由乙方承担。',
    
    furniture: [
        { name: '空调', count: '2' }, { name: '餐桌', count: '1' },
        { name: '电热水器', count: '1' }, { name: '餐椅', count: '3' },
        { name: '洗衣机', count: '1' }, { name: '电视柜', count: '1' },
        { name: '冰箱', count: '1' }, { name: '电视机', count: '1' },
        { name: '抽油烟机', count: '1' }, { name: '梳妆台', count: '/' },
        { name: '燃气灶', count: '1' }, { name: '衣柜', count: '1' },
        { name: '书桌', count: '/' }, { name: '鞋柜', count: '1' },
        { name: '床', count: '1' }, { name: '机顶盒', count: '1' },
        { name: '沙发', count: '一套' }, { name: 'DVD', count: '1' },
        { name: '茶几', count: '一套' }, { name: '音响', count: '2' },
        { name: '窗帘', count: '全套' }, { name: '酒柜', count: '1' },
        { name: '风扇', count: '1' }, { name: '', count: '' }
    ] as FurnitureItem[]
  });
  
  // Sync Arrays to String Fields for Preview
  useEffect(() => {
      setLeaseData(prev => ({
          ...prev,
          landlordName: landlords.map(l => l.name).filter(Boolean).join(', '),
          landlordId: landlords.map(l => l.id).filter(Boolean).join(', '),
          landlordPhone: landlords.map(l => l.phone).filter(Boolean).join(', '),
          tenantName: tenants.map(l => l.name).filter(Boolean).join(', '),
          tenantId: tenants.map(l => l.id).filter(Boolean).join(', '),
          tenantPhone: tenants.map(l => l.phone).filter(Boolean).join(', '),
      }));
  }, [landlords, tenants]);
  
  // --- AUTO CALCULATIONS ---
  const calcFees = () => {
     const r = parseFloat(leaseData.rent);
     if (!isNaN(r)) {
         setLeaseData(prev => ({
             ...prev,
             deposit: (r * 2).toString(),
             agentFeeLandlord: (r * 0.5).toString(),
             agentFeeTenant: (r * 0.5).toString()
         }));
         showToast("费用已自动计算");
     }
  };

  useEffect(() => {
      if (leaseData.startDate && leaseData.duration) {
          const start = new Date(leaseData.startDate);
          const months = parseInt(leaseData.duration);
          if (!isNaN(months)) {
              const day = start.getDate();
              const end = new Date(start);
              end.setMonth(end.getMonth() + months);
              end.setDate(end.getDate() - 1);
              
              setLeaseData(prev => ({
                  ...prev,
                  payDay: day.toString(),
                  endDate: end.toISOString().split('T')[0]
              }));
          }
      }
  }, [leaseData.startDate, leaseData.duration]);

  // --- HANDLERS ---
  const handlePropSelect = (id: string) => {
      const p = properties.find(i => i.id === id);
      setSelectedPropId(id);
      if (p) {
          setLeaseData(prev => ({
              ...prev,
              address: `${p.garden}${p.subArea ? ' ' + p.subArea : ''} ${p.building} ${p.unit ? p.unit + '单元' : ''} ${p.room}`,
              area: p.area?.toString() || '',
              rent: p.rentPrice?.toString() || prev.rent,
          }));
          // Set primary landlord
          setLandlords([{ name: p.ownerName, id: '', phone: p.ownerContact }]);
      }
  };

  const handleCustSelect = (id: string) => {
      const c = customers.find(i => i.id === id);
      setSelectedCustId(id);
      if (c) {
          // Set primary tenant
          setTenants([{ name: c.name, id: '', phone: c.phone }]);
      }
  };

  const handleFurnitureChange = (index: number, field: keyof FurnitureItem, val: string) => {
      const newF = [...leaseData.furniture];
      newF[index] = { ...newF[index], [field]: val };
      setLeaseData({ ...leaseData, furniture: newF });
  };
  
  const addFurnitureRow = () => {
      setLeaseData(prev => ({ ...prev, furniture: [...prev.furniture, {name: '', count: ''}, {name: '', count: ''}] }));
  };

  const updatePropStatus = async () => {
      if (!selectedPropId) return;
      const p = properties.find(i => i.id === selectedPropId);
      if (p) {
          await saveProperty({
              ...p,
              status: 'rented',
              leaseEnd: leaseData.endDate,
              updatedAt: Date.now()
          });
          showToast("房源状态已更新为【已租】");
          setShowPostAction(false);
      }
  };

  const exportWord = () => {
      if (!printRef.current) return;
      
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>租赁合同</title><style>body{font-family:'SimSun'; font-size: 14px;} .page-break{page-break-after:always;}</style></head><body>";
      const footer = "</body></html>";
      
      const contentClone = printRef.current.cloneNode(true) as HTMLElement;
      
      const html = header + contentClone.innerHTML + footer;
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `租赁合同_${leaseData.landlordName || '甲方'}_${leaseData.tenantName || '乙方'}.doc`;
      link.click();
      
      setShowPostAction(true);
  };
  
  const handlePrint = () => {
      window.print();
      setShowPostAction(true);
  };
  
  const handlePushToCalendar = () => {
      if (!leaseData.signDate) return;
      addTodo(
          `合同签约: ${leaseData.address}`, 
          leaseData.signDate, 
          selectedPropId ? { type: 'property', id: selectedPropId, name: leaseData.address } : undefined
      );
      showToast("已添加到日历待办");
  };

  return (
    <div className="pb-20 fade-in">
      <style>{`
        @media print {
            @page { size: A4; margin: 15mm; }
            body { background: white; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            .print-container { 
                width: 100% !important; 
                box-shadow: none !important; 
                margin: 0 !important; 
                padding: 0 !important;
                border: none !important;
            }
            .page-break { page-break-after: always; height: 0; display: block; clear: both; }
        }
      `}</style>

      {/* --- CONTROLS --- */}
      <div className="no-print max-w-6xl mx-auto mb-8 space-y-6">
         <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText/> 租赁合同生成器</h1>
             <div className="flex gap-3">
                 <button onClick={handlePushToCalendar} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-200 transition-colors"><CalendarDays size={18}/> 推送到日历</button>
                 <button onClick={exportWord} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"><FileText size={18}/> 导出 Word</button>
                 <button onClick={handlePrint} className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800"><Download size={18}/> 下载 PDF (打印)</button>
                 <button onClick={handlePrint} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700"><Printer size={18}/> 打印合同</button>
             </div>
         </div>
         
         <div className="bg-bg-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4 text-slate-700 dark:text-slate-300">
             <div className="flex items-center gap-2 mb-2 font-bold text-lg border-b border-slate-200 dark:border-slate-700 pb-2"><Calculator size={20}/> 核心信息配置 (修改此处将同步至下方合同)</div>
             
             {/* Quick Select */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">选择房源</label>
                     <select className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" onChange={e=>handlePropSelect(e.target.value)} value={selectedPropId}>
                         <option value="">-- 自动填充甲方 --</option>
                         {properties.map(p=><option key={p.id} value={p.id}>{p.garden} {p.building} {p.room}</option>)}
                     </select>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">选择客户</label>
                     <select className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" onChange={e=>handleCustSelect(e.target.value)} value={selectedCustId}>
                         <option value="">-- 自动填充乙方 --</option>
                         {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone}</option>)}
                     </select>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">月租金 (元)</label>
                     <div className="flex gap-2">
                        <input type="number" className="w-full border rounded p-2 text-sm font-bold text-brand-600 bg-white dark:bg-slate-900" value={leaseData.rent} onChange={e=>setLeaseData({...leaseData, rent: e.target.value})}/>
                        <button onClick={calcFees} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded px-3 font-bold text-xs whitespace-nowrap">算佣金</button>
                     </div>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">支付方式</label>
                     <select className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" value={leaseData.paymentMethod} onChange={e=>setLeaseData({...leaseData, paymentMethod: e.target.value})}>
                         <option value="银行转账">银行转账</option>
                         <option value="微信支付">微信支付</option>
                         <option value="支付宝">支付宝</option>
                         <option value="现金">现金</option>
                         <option value="其他方式">其他方式</option>
                     </select>
                 </div>
             </div>

             {/* Parties Info - Optimized */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                 <PartyEditor title="甲方 (出租方)" list={landlords} setList={setLandlords} />
                 <PartyEditor title="乙方 (承租方)" list={tenants} setList={setTenants} />
             </div>
             
             {/* Date & Terms */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">起租日期</label>
                     <input type="date" className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" value={leaseData.startDate} onChange={e=>setLeaseData({...leaseData, startDate: e.target.value})}/>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">租期 (月)</label>
                     <input type="number" className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" value={leaseData.duration} onChange={e=>setLeaseData({...leaseData, duration: e.target.value})}/>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">房屋用途</label>
                     <select className="w-full border rounded p-2 text-sm bg-white dark:bg-slate-900" value={leaseData.usage} onChange={e=>setLeaseData({...leaseData, usage: e.target.value})}>
                         <option value="居住">居住</option>
                         <option value="办公">办公</option>
                         <option value="商业">商业</option>
                         <option value="仓储">仓储</option>
                     </select>
                 </div>
                 <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500">押金 (元)</label>
                     <input type="number" className="w-full border rounded p-2 text-sm font-bold bg-white dark:bg-slate-900" value={leaseData.deposit} onChange={e=>setLeaseData({...leaseData, deposit: e.target.value})}/>
                 </div>
             </div>
             
             <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500">补充备注 (条款15)</label>
                 <textarea className="w-full border rounded p-2 text-sm h-16 bg-white dark:bg-slate-900" value={leaseData.remarks} onChange={e=>setLeaseData({...leaseData, remarks: e.target.value})}/>
             </div>

             {/* Furniture Edit Toggle */}
             <details className="pt-2 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                 <summary className="cursor-pointer font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600">点击编辑家具清单 ({leaseData.furniture.length} 项)</summary>
                 <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2">
                     {leaseData.furniture.map((f, i) => (
                         <div key={i} className="flex gap-1">
                             <input className="border rounded p-1 w-full text-xs bg-white dark:bg-slate-900" value={f.name} onChange={e=>handleFurnitureChange(i, 'name', e.target.value)} placeholder="名称"/>
                             <input className="border rounded p-1 w-12 text-xs text-center bg-white dark:bg-slate-900" value={f.count} onChange={e=>handleFurnitureChange(i, 'count', e.target.value)} placeholder="数量"/>
                         </div>
                     ))}
                     <button onClick={addFurnitureRow} className="text-xs bg-slate-200 dark:bg-slate-700 rounded px-2 hover:bg-slate-300 dark:hover:bg-slate-600 py-1 font-bold">+ 添加行</button>
                 </div>
             </details>
         </div>
      </div>

      {/* ... Preview Code ... */}
      {/* Keeping the preview logic as is, just truncated for brevity as the key fix was PartyEditor extraction */}
      <div className="w-full bg-slate-100 dark:bg-slate-900/50 py-10 overflow-x-auto">
          <div 
            ref={printRef} 
            className="print-container shadow-2xl mx-auto p-[15mm] font-serif text-[14px] leading-[1.8] max-w-[210mm] min-h-[297mm]"
            style={{ backgroundColor: '#ffffff', color: '#000000' }}
          >
              
              {/* === PAGE 1: MAIN CONTRACT === */}
              <div>
                  <div className="flex justify-between items-end mb-8">
                      <h1 className="text-2xl font-bold flex-1 text-center pl-20">物业租赁合同</h1>
                      <div className="text-sm">编号：<span className="border-b border-black px-1 min-w-[80px] inline-block text-center">{leaseData.contractNo}</span></div>
                  </div>
                  
                  {/* Parties */}
                  <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold w-16">出租人:</span>
                          <span className="font-bold border-b border-black flex-1 px-2">{leaseData.landlordName}</span>
                          <span className="w-32">(以下简称甲方)</span>
                          <span className="font-bold w-16">承租人:</span>
                          <span className="font-bold border-b border-black flex-1 px-2">{leaseData.tenantName}</span>
                          <span className="w-32">(以下简称乙方)</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                          <span className="">身份证号码：</span>
                          <span className="border-b border-black flex-1 px-2">{leaseData.landlordId}</span>
                          <span className="w-32"></span>
                          <span className="">身份证号码：</span>
                          <span className="border-b border-black flex-1 px-2">{leaseData.tenantId}</span>
                          <span className="w-32"></span>
                      </div>
                      <div className="flex items-center gap-2 mb-6">
                          <span className="">联系电话：</span>
                          <span className="border-b border-black flex-1 px-2">{leaseData.landlordPhone}</span>
                          <span className="w-32"></span>
                          <span className="">联系电话：</span>
                          <span className="border-b border-black flex-1 px-2">{leaseData.tenantPhone}</span>
                          <span className="w-32"></span>
                      </div>
                  </div>

                  <p className="indent-8 mb-2">根据《中华人民共和国民法典》和相关规定，甲乙双方在自愿、平等、互利的基础上，协商一致，订立本合同，承诺共同遵守。合同内容如下：</p>
                  
                  <p className="mb-2">1、现乙方同意租赁甲方名下座落于 <span className="border-b border-black px-2 font-bold">{leaseData.address}</span> 的房屋 (以下简称“该物业”)作为合法 <span className="border-b border-black px-2 font-bold">{leaseData.usage}</span> 用途，其建筑面积为 <span className="border-b border-black px-2 font-bold">{leaseData.area}</span> 平方米。租赁期为 <span className="border-b border-black px-2 font-bold">{leaseData.duration}</span> 个月， 从 <span className="border-b border-black px-2 font-bold">{leaseData.startDate}</span> 至 <span className="border-b border-black px-2 font-bold">{leaseData.endDate}</span> 止。租赁期满，市场同等条件下乙方享有优先租赁权。</p>
                  
                  <p className="mb-2">2、双方约定该物业的租金为每月人民币：<span className="font-bold border-b border-black px-2">{digitUppercase(Number(leaseData.rent))}</span> (¥ <span className="font-bold border-b border-black px-1">{Number(leaseData.rent).toFixed(2)}</span>); 由乙方每月 <span className="border-b border-black px-2 font-bold">{leaseData.payDay}</span> 日前以 <strong>{leaseData.paymentMethod}</strong> 形式交付给甲方。如拖欠租金超过 <span className="border-b border-black px-1 font-bold">{leaseData.overdueStop}</span> 天，经甲方或甲方代理人电话通知后仍不及时交租，甲方有权对该物业采取停水停电处理；如拖欠租金超过 <span className="border-b border-black px-1 font-bold">{leaseData.overdueTerm}</span> 天，本合同视乙方违约而自行终止。甲方有权不经乙方同意收回该物业，乙方须无条件立即搬出该物业。如乙方不交回该物业的钥匙，甲方有权换锁并视乙方主动放弃室内其私人物品，全由甲方任意处置，乙方无权提出任何异议。且甲方保留进一步追究乙方居住期间所欠管理费、水费、电费、煤气费等的权力。</p>
                  
                  <p className="mb-2">3、签定此合同时，乙方需向甲方支付押金人民币：<span className="font-bold border-b border-black px-2">{digitUppercase(Number(leaseData.deposit))}</span> (¥ <span className="font-bold border-b border-black px-1">{Number(leaseData.deposit).toFixed(2)}</span>)。合同期满，乙方如续租或退租，应提前30天通知甲方。在乙方结清该物业的管理费、煤气费、清洁费、水电费、电视费等一切因使用、维护该物业及附属设施而产生的费用后，甲方应将押金(不计利息)退还给乙方。此押金不能抵扣租金，否则视为乙方违约。</p>

                  <p className="mb-2">4、乙方入住前，该物业的管理费及水电费等欠费由甲方负责交清。租赁期内，该物业每月的管理费及实际使用的水电费、煤气费、电视费、网络费，室内设施的维修费等一切因使用、维护该物业及其附属设施而产生的费用、均由乙方及时到辖区内物业管理公司或相关部门缴交与支付。如该物业每月的管理费及实际支出的水电费等拖欠达二个月不缴交，则视为乙方违约。</p>

                  <p className="mb-2">5、租赁期间，乙方若将该物业转租或分租必须先得到甲方的许可。否则视为乙方违约。</p>
                  <p className="mb-2">6、租赁期内，乙方不得在该物业内从事任何违法乱纪行为，并遵守管辖区内物业管理的各项管理规定，否则所造成的一切经济损失或法律责任全由乙方承担，同时视为乙方违约。</p>
                  <p className="mb-2">7、乙方在租赁期内不得擅自改变该物业的结构和用途，不得储存任何违禁品、易燃品、爆炸品等物品。如需装修，必须先征得业主及管理公司书面同意，否则上述行为均视为乙方违约。</p>
                  <p className="mb-2">8、乙方应保证本合同中所提供的身份证件及联系电话的真实性及准确性，若有变更应及时书面告知甲方或甲方代理人。如因联系电话改变而未能及时联络所造成的损失及一切责任全由乙方承担。</p>
                  <p className="mb-2">9、租赁期内，若乙方提前终止合同或有以上第2条至第8条款的违约事实，乙方同意所交给甲方的押金作为违约金，甲方不予退还。如因违约造成的实际损失大于违约金额的，乙方应据实赔偿。如因乙方违约造成的相关法律责任全由乙方承担。</p>
                  <p className="mb-2">10、租赁期内，若甲方提前终止合同，必须提前 30 天向乙方提出并征得乙方同意，待退租手续与相关费用结清当天，甲方需全额退还给乙方之前所交押金，并另外赔偿押金同等金额给乙方作为甲方的违约金。如因甲方违约所造成乙方的其它经济损失或相关法律责任全由甲方承担。</p>
                  <p className="mb-2">11、该物业因出租需办理《房屋租赁证》及出租税费由甲方负责，乙方必须在入住前需要配合进行莞e申报。</p>
                  <p className="mb-2">12、本合同如发生纠纷，甲、乙双方应通过友好协商解决，不能解决时可向物业所在地人民法院起诉。</p>
                  <p className="mb-2">13、甲乙双方在签署本合同时，已清楚明白各自的权利与义务，并保证履行合同内相关规定。</p>
                  <p className="mb-2">14、从签订本合同之日起，承租人是该物业的实际安全管理人，承租人与第三方在该房屋内发生的所有安全事故、意外事故均由承租人承担，与出租人无关。</p>
                  <p className="mb-2">15、本合同如有未尽事宜，甲乙双方可共同协商签定补充协议。</p>
                  
                  <div className="mb-2 font-bold flex items-start">
                      <span className="shrink-0">备 注 ：</span>
                      <p className="w-full bg-transparent border-b border-black min-h-[40px] whitespace-pre-wrap">{leaseData.remarks}</p>
                  </div>
                  
                  <p className="mb-4">16、签订本合同时，甲方应支付丙方服务费 <span className="border-b border-black px-2 font-bold">{leaseData.agentFeeLandlord}</span> 元，乙方应支付丙方服务费 <span className="border-b border-black px-2 font-bold">{leaseData.agentFeeTenant}</span> 元。</p>

                  <div className="flex justify-between mt-8 mb-4">
                       <div className="flex-1">
                           <div className="mb-8 font-bold">甲方签署：</div>
                           <div>签约日期：<span className="border-b border-black px-2">{leaseData.signDate}</span></div>
                       </div>
                       <div className="flex-1">
                           <div className="mb-8 font-bold">乙方签署：</div>
                           <div>签约日期：<span className="border-b border-black px-2">{leaseData.signDate}</span></div>
                       </div>
                   </div>
              </div>
              
              <div className="page-break"></div>

              {/* === PAGE 2: FURNITURE LIST === */}
              <div className="pt-8">
                  <h2 className="text-xl font-bold text-center mb-6">房屋租赁家具家电清单</h2>
                  <div className="mb-4">房屋地址：<span className="border-b border-black">{leaseData.address}</span></div>
                   
                  <table className="w-full border-collapse border border-black text-center text-sm mb-6">
                      <thead>
                          <tr className="bg-gray-100">
                              <th className="border border-black p-2 w-1/4">家具/家电</th><th className="border border-black p-2 w-1/4">数量</th>
                              <th className="border border-black p-2 w-1/4">家具/家电</th><th className="border border-black p-2 w-1/4">数量</th>
                          </tr>
                      </thead>
                      <tbody>
                        {Array.from({length: Math.ceil(leaseData.furniture.length/2)}).map((_, i) => (
                           <tr key={i}>
                             <td className="border border-black p-1">{leaseData.furniture[i*2]?.name}</td>
                             <td className="border border-black p-1">{leaseData.furniture[i*2]?.count}</td>
                             <td className="border border-black p-1">{leaseData.furniture[i*2+1]?.name}</td>
                             <td className="border border-black p-1">{leaseData.furniture[i*2+1]?.count}</td>
                           </tr>
                        ))}
                      </tbody>
                  </table>
                  
                  <div className="flex justify-between mb-4">
                       <div>电表数：<span className="border-b border-black px-2 min-w-[80px] inline-block">{leaseData.elecReading}</span></div>
                       <div className="flex gap-2">其他补充事项：<span className="border-b border-black px-2 min-w-[200px] inline-block">{leaseData.otherReading}</span></div>
                  </div>
                  <div className="mb-12">水表数：<span className="border-b border-black px-2 min-w-[80px] inline-block">{leaseData.waterReading}</span></div>
                  
                  <div className="flex justify-between mb-2">
                       <div>甲方确认：________________</div>
                       <div>乙方确认：________________</div>
                   </div>
                   <div className="mb-8">确认日期：<span className="border-b border-black px-2">{leaseData.signDate}</span></div>
                   
                   <div className="text-sm">
                       <p>备注：1.此家电家具清单作为《房屋租赁合同》的附件</p>
                       <p>2.以上家具经双方交接完毕，签名确认</p>
                   </div>
              </div>
              
              <div className="page-break"></div>

              {/* === PAGE 3: RECEIPT === */}
              <div className="pt-12">
                   <h2 className="text-xl font-bold text-center mb-10">收款收据</h2>
                   
                   <div className="leading-loose text-lg text-justify indent-8">
                       今由 <span className="font-bold border-b border-black px-2">{leaseData.landlordName || '________'}</span> 
                       /身份证号 <span className="border-b border-black px-2">{leaseData.landlordId || '________________'}</span> 
                       收到 <span className="font-bold border-b border-black px-2">{leaseData.tenantName || '________'}</span> 
                       /身份证号 <span className="border-b border-black px-2">{leaseData.tenantId || '________________'}</span> 
                       租赁 <span className="border-b border-black px-2">{leaseData.address || '________________________________'}</span> 
                       租金人民币 <span className="font-bold border-b border-black px-2">{digitUppercase(Number(leaseData.rent)) || '____'}</span> (￥{Number(leaseData.rent).toFixed(2)}) 
                       及押金 <span className="font-bold border-b border-black px-2">{digitUppercase(Number(leaseData.deposit)) || '____'}</span> (￥{Number(leaseData.deposit).toFixed(2)})。
                       属实！
                   </div>
                   
                   <div className="mt-16 text-right pr-20">
                       <div className="mb-8">收款人签名：________________</div>
                       <div>日期：<span className="border-b border-black px-2">{leaseData.signDate}</span></div>
                   </div>
              </div>

          </div>
      </div>
      
      {/* --- POST ACTION MODAL --- */}
      {showPostAction && selectedPropId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                  <div className="flex flex-col items-center text-center">
                      <div className="bg-green-100 p-3 rounded-full mb-4 text-green-600"><Save size={32}/></div>
                      <h3 className="text-xl font-bold mb-2 text-slate-800">合同已生成</h3>
                      <p className="text-slate-500 mb-6">是否将当前房源状态更新为 <span className="font-bold text-blue-600">已租</span> 并同步租期到日历？</p>
                      
                      <button onClick={updatePropStatus} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mb-3 hover:bg-blue-700">确认更新状态</button>
                      <button onClick={()=>setShowPostAction(false)} className="w-full text-slate-500 py-2 font-bold">暂不更新</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
