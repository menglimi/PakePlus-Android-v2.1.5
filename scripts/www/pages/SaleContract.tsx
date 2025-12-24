
import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileText, Download, Save, Calculator, CalendarDays, MapPin, User, ArrowLeft, PenTool, LayoutGrid, AlertCircle, RotateCcw, Plus, Trash2, CreditCard } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { digitUppercase } from '../utils';

// --- Extracted Component ---
interface InputGroupProps {
    label: string;
    field: string;
    width?: string;
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (val: string) => void;
}

const InputGroup = ({ label, field, width = 'w-full', type = 'text', placeholder = '', value, onChange }: InputGroupProps) => (
    <div className={width}>
        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
        <input 
          type={type}
          className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
          placeholder={placeholder}
          value={value} 
          onChange={e => onChange(e.target.value)}
        />
    </div>
);

export const SaleContractGenerator = () => {
  const { properties, customers, saveProperty, settings, showToast, addTodo } = useStore();
  const printRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [selectedPropId, setSelectedPropId] = useState('');
  const [selectedCustId, setSelectedCustId] = useState('');
  const [showPostAction, setShowPostAction] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'property' | 'payment' | 'terms'>('basic');

  const [contractData, setContractData] = useState({
    contractNo: `88${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
    
    // --- Party A (Seller) ---
    sellerName: '', sellerNationality: '中国', 
    sellerIDType: '居民身份证', sellerID: '', 
    sellerAddress: '', sellerZip: '', sellerPhone: '',
    sellerShareType: '单独所有', sellerShareAmount: '全部',
    
    sellerProxyName: '', sellerProxyNationality: '', sellerProxyIDType: '', sellerProxyID: '', sellerProxyAddress: '', sellerProxyZip: '', sellerProxyPhone: '',

    // --- Party B (Buyer) ---
    buyerName: '', buyerNationality: '中国', 
    buyerIDType: '居民身份证', buyerID: '', 
    buyerAddress: '', buyerZip: '', buyerPhone: '',
    buyerShareType: '单独所有', buyerShareAmount: '全部',
    
    buyerProxyName: '', buyerProxyNationality: '', buyerProxyIDType: '', buyerProxyID: '', buyerProxyAddress: '', buyerProxyZip: '', buyerProxyPhone: '',

    // --- Article 1: Property ---
    propAddress: '',
    transferShare: '全部',
    landUseType: '共用', // [共用] 土地使用权
    landArea: '',
    landType: '国有建设用地使用权', 
    buildingArea: '', innerArea: '', publicArea: '',
    
    certDateYear: '', certDateMonth: '', certDateDay: '',
    certOrg: '东莞市不动产登记部门',
    certNo: '', sharedCertNo: '×',

    // --- Article 2: Price & Payment ---
    totalPrice: '', 
    deposit: '50000', depositDays: '3',
    
    payStage1Date: '×', payStage1Amount: '×',
    payStage2Date: '×', payStage2Amount: '×',
    
    finalPayment: '', finalPaymentMethod: '汇款',

    // --- Article 3: Transfer ---
    transferDeadline: '30',
    transferOrg: '东莞市不动产登记部门',

    // --- Article 4: Delivery ---
    deliveryDateYear: '2025', deliveryDateMonth: '12', deliveryDateDay: '31',

    // --- Article 6: Default ---
    penaltySeller: '100000', 
    penaltyBuyer: '100000', 

    // --- Article 8: Dispute ---
    disputeMethod: '2', // 1=Arbitration, 2=Court
    arbitrationComm: '×',

    // --- Signatures ---
    signDateYear: new Date().getFullYear().toString(), 
    signDateMonth: (new Date().getMonth()+1).toString(), 
    signDateDay: new Date().getDate().toString(),
    signLocation: '常平镇政务服务中心',

    // --- Annexes ---
    annex3Content: '1、交易双方确认，本合同所涉房产的实际转让人为：XXX（证件号：XXX），实际受让人为：XXX（证件号：XXX）。\n2、双方同意，本次交易的税费由乙方承担。\n3、甲方承诺配合乙方办理贷款及过户手续。',
    rightsTable: [
        { name: '', idType: '居民身份证', idNo: '', authority: '', country: '中国', type: '单独所有', share: '全部' }
    ]
  });

  // --- AUTO FILL HANDLERS ---
  const handlePropSelect = (id: string) => {
      const p = properties.find(i => i.id === id);
      setSelectedPropId(id);
      if (p) {
          setContractData(prev => ({
              ...prev,
              sellerName: p.ownerName,
              sellerPhone: p.ownerContact,
              propAddress: `${p.garden}${p.subArea ? ' ' + p.subArea : ''} ${p.building} ${p.unit ? p.unit + '单元' : ''} ${p.room}`,
              buildingArea: p.area?.toString() || '',
              // Estimates
              innerArea: p.area ? (p.area * 0.8).toFixed(2) : '',
              publicArea: p.area ? (p.area * 0.2).toFixed(2) : '',
              totalPrice: p.salePrice ? (p.salePrice * 10000).toString() : prev.totalPrice,
              
              // Fill Rights Table
              rightsTable: [{
                  name: p.ownerName,
                  idType: '居民身份证',
                  idNo: '',
                  authority: '',
                  country: '中国',
                  type: '单独所有',
                  share: '全部'
              }]
          }));
      }
  };

  const handleCustSelect = (id: string) => {
      const c = customers.find(i => i.id === id);
      setSelectedCustId(id);
      if (c) {
          setContractData(prev => ({
              ...prev,
              buyerName: c.name,
              buyerPhone: c.phone
          }));
      }
  };

  const calcPayments = () => {
      const total = Number(contractData.totalPrice);
      if (!isNaN(total) && total > 0) {
          const deposit = Number(contractData.deposit) || 50000;
          const final = total - deposit; 
          
          setContractData(prev => ({
              ...prev,
              deposit: deposit.toString(),
              finalPayment: final.toString(),
              penaltySeller: (total * 0.1).toString(), // 10%
              penaltyBuyer: (total * 0.1).toString()
          }));
          showToast("已自动计算尾款与违约金(10%)");
      }
  };

  const updatePropStatus = async () => {
      if (!selectedPropId) return;
      const p = properties.find(i => i.id === selectedPropId);
      if (p) {
          await saveProperty({
              ...p,
              status: 'sold',
              updatedAt: Date.now()
          });
          showToast("房源状态已更新为【已售】");
          setShowPostAction(false);
      }
  };

  const handlePushToCalendar = () => {
      if (!contractData.signDateYear) return;
      const dateStr = `${contractData.signDateYear}-${contractData.signDateMonth.padStart(2,'0')}-${contractData.signDateDay.padStart(2,'0')}`;
      addTodo(
          `房产签约: ${contractData.propAddress}`, 
          dateStr, 
          selectedPropId ? { type: 'property', id: selectedPropId, name: contractData.propAddress } : undefined
      );
      showToast("已添加到日历待办");
  };

  const exportWord = () => {
      if (!printRef.current) return;
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>房地产买卖合同</title><style>body{font-family:'SimSun'; font-size: 14px;} .page-break{page-break-after:always;} input{border:none;border-bottom:1px solid #000;}</style></head><body>";
      const footer = "</body></html>";
      
      const contentClone = printRef.current.cloneNode(true) as HTMLElement;
      
      // Replace Inputs with Spans
      const inputs = contentClone.querySelectorAll('input');
      inputs.forEach((input: HTMLInputElement) => {
          const span = document.createElement('span');
          span.innerText = input.value;
          span.style.borderBottom = "1px solid black";
          span.style.padding = "0 5px";
          span.style.display = "inline-block";
          span.style.minWidth = input.style.width || "50px";
          span.style.textAlign = "center";
          if(input.parentNode) input.parentNode.replaceChild(span, input);
      });
      // Replace textareas
      const textareas = contentClone.querySelectorAll('textarea');
      textareas.forEach((ta: HTMLTextAreaElement) => {
          const div = document.createElement('div');
          div.innerText = ta.value;
          div.style.whiteSpace = 'pre-wrap';
          div.style.border = '1px solid black';
          div.style.padding = '10px';
          div.style.minHeight = ta.style.height;
          if(ta.parentNode) ta.parentNode.replaceChild(div, ta);
      });

      const html = header + contentClone.innerHTML + footer;
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `买卖合同_${contractData.sellerName}_${contractData.buyerName}.doc`;
      link.click();
      setShowPostAction(true);
  };

  const handlePrint = () => {
      window.print();
      setShowPostAction(true);
  };

  const updateField = (field: string, value: string) => {
      setContractData(prev => ({ ...prev, [field]: value }));
  };

  // Fix: Cast field to any to avoid 'string | number | symbol' error when calling updateField
  const bind = (field: keyof typeof contractData) => ({
      value: contractData[field] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => updateField(field as any, e.target.value)
  });

  // Fix: Cast field to any to satisfy the updateField signature and avoid 'string | number | symbol' error
  const bindFixed = (field: keyof typeof contractData) => ({
      value: contractData[field] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => updateField(field as any, e.target.value)
  });

  const updateRightsTable = (idx: number, field: string, val: string) => {
      const newTable = [...contractData.rightsTable];
      (newTable[idx] as any)[field] = val;
      setContractData({...contractData, rightsTable: newTable});
  };
  
  const addRightsRow = () => {
      setContractData(prev => ({
          ...prev, 
          rightsTable: [...prev.rightsTable, { name: '', idType: '居民身份证', idNo: '', authority: '', country: '中国', type: '单独所有', share: '全部' }]
      }));
  };
  
  const removeRightsRow = (idx: number) => {
      setContractData(prev => ({
          ...prev,
          rightsTable: prev.rightsTable.filter((_, i) => i !== idx)
      }));
  };

  return (
    <div className="pb-20 fade-in">
        <style>{`
            @media print {
                @page { size: A4; margin: 20mm; }
                body { background: white; -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
                .print-container { width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; border: none !important; }
                .page-break { page-break-after: always; height: 0; display: block; clear: both; }
                input { border: none; border-bottom: 1px solid #000; background: transparent; font-family: inherit; font-size: inherit; color: #000; text-align: center; }
                input:focus { outline: none; }
                textarea { border: none; width: 100%; resize: none; font-family: inherit; font-size: inherit; overflow: hidden; }
                .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
            }
            .contract-font { font-family: "SimSun", "Songti SC", serif; }
            .input-line {
                border: none;
                border-bottom: 1px solid #000;
                background: transparent;
                outline: none;
                padding: 0 4px;
                text-align: center;
                color: #000;
                font-family: inherit;
                font-weight: bold;
                transition: background 0.2s;
            }
            .input-line:focus { background: rgba(0,0,0,0.05); }
            .title-box { border: 4px solid black; padding: 4px; display: inline-block; margin-bottom: 60px; margin-top: 60px; }
            .title-inner { border: 2px solid black; padding: 20px 40px; font-size: 32px; font-weight: 900; letter-spacing: 0.5em; }
        `}</style>

        {/* --- TOP CONTROLS --- */}
        <div className="no-print max-w-7xl mx-auto mb-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2"><FileText/> 房地产买卖合同 (标准版)</h1>
                <div className="flex gap-3">
                    <button onClick={handlePushToCalendar} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-200"><CalendarDays size={18}/> 日历</button>
                    <button onClick={exportWord} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"><Download size={18}/> 导出 Word</button>
                    <button onClick={handlePrint} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700"><Printer size={18}/> 打印</button>
                </div>
            </div>

            {/* INTEGRATED EDITOR PANEL */}
            <div className="bg-bg-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-x-auto">
                    <button onClick={()=>setActiveTab('basic')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab==='basic'?'bg-white dark:bg-slate-900 border-t-2 border-brand-500 text-brand-600':'text-slate-500 hover:bg-slate-100'}`}><User size={16}/> 基础信息</button>
                    <button onClick={()=>setActiveTab('property')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab==='property'?'bg-white dark:bg-slate-900 border-t-2 border-brand-500 text-brand-600':'text-slate-500 hover:bg-slate-100'}`}><LayoutGrid size={16}/> 房产细节</button>
                    <button onClick={()=>setActiveTab('payment')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab==='payment'?'bg-white dark:bg-slate-900 border-t-2 border-brand-500 text-brand-600':'text-slate-500 hover:bg-slate-100'}`}><CreditCard size={16}/> 款项约定</button>
                    <button onClick={()=>setActiveTab('terms')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab==='terms'?'bg-white dark:bg-slate-900 border-t-2 border-brand-500 text-brand-600':'text-slate-500 hover:bg-slate-100'}`}><AlertCircle size={16}/> 条款与附件</button>
                </div>
                
                <div className="p-6">
                    {activeTab === 'basic' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">智能填充甲方 (卖方)</label>
                                    <select className="w-full border rounded p-1.5 text-sm bg-white dark:bg-slate-900" onChange={e=>handlePropSelect(e.target.value)} value={selectedPropId}>
                                        <option value="">-- 选择系统房源 --</option>
                                        {properties.map(p=><option key={p.id} value={p.id}>{p.garden} {p.building} {p.room}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">智能填充乙方 (买方)</label>
                                    <select className="w-full border rounded p-1.5 text-sm bg-white dark:bg-slate-900" onChange={e=>handleCustSelect(e.target.value)} value={selectedCustId}>
                                        <option value="">-- 选择系统客户 --</option>
                                        {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <InputGroup label="合同编号" field="contractNo" value={contractData.contractNo} onChange={v => updateField('contractNo', v)} />
                                <InputGroup label="签约地点" field="signLocation" value={contractData.signLocation} onChange={v => updateField('signLocation', v)} />
                                <InputGroup label="签约日期(年)" field="signDateYear" value={contractData.signDateYear} onChange={v => updateField('signDateYear', v)} />
                                <div className="flex gap-2">
                                    <InputGroup label="(月)" field="signDateMonth" value={contractData.signDateMonth} onChange={v => updateField('signDateMonth', v)} />
                                    <InputGroup label="(日)" field="signDateDay" value={contractData.signDateDay} onChange={v => updateField('signDateDay', v)} />
                                </div>
                            </div>
                            <hr className="border-dashed border-slate-200"/>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">甲方 (卖方) 信息</h3>
                                    <div className="flex gap-2"><InputGroup label="姓名" field="sellerName" value={contractData.sellerName} onChange={v => updateField('sellerName', v)} /><InputGroup label="电话" field="sellerPhone" value={contractData.sellerPhone} onChange={v => updateField('sellerPhone', v)} /></div>
                                    <div className="flex gap-2"><InputGroup label="证件号" field="sellerID" value={contractData.sellerID} onChange={v => updateField('sellerID', v)} /><InputGroup label="国籍" field="sellerNationality" value={contractData.sellerNationality} onChange={v => updateField('sellerNationality', v)} /></div>
                                    <InputGroup label="地址" field="sellerAddress" value={contractData.sellerAddress} onChange={v => updateField('sellerAddress', v)} />
                                    <div className="pt-2 border-t border-dashed">
                                        <label className="text-xs font-bold text-slate-400 mb-1 block">甲方代理人</label>
                                        <div className="flex gap-2 mb-2"><InputGroup label="姓名" field="sellerProxyName" value={contractData.sellerProxyName} onChange={v => updateField('sellerProxyName', v)} /><InputGroup label="电话" field="sellerProxyPhone" value={contractData.sellerProxyPhone} onChange={v => updateField('sellerProxyPhone', v)} /></div>
                                        <InputGroup label="证件号" field="sellerProxyID" value={contractData.sellerProxyID} onChange={v => updateField('sellerProxyID', v)} />
                                    </div>
                                </div>
                                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">乙方 (买方) 信息</h3>
                                    <div className="flex gap-2"><InputGroup label="姓名" field="buyerName" value={contractData.buyerName} onChange={v => updateField('buyerName', v)} /><InputGroup label="电话" field="buyerPhone" value={contractData.buyerPhone} onChange={v => updateField('buyerPhone', v)} /></div>
                                    <div className="flex gap-2"><InputGroup label="证件号" field="buyerID" value={contractData.buyerID} onChange={v => updateField('buyerID', v)} /><InputGroup label="国籍" field="buyerNationality" value={contractData.buyerNationality} onChange={v => updateField('buyerNationality', v)} /></div>
                                    <InputGroup label="地址" field="buyerAddress" value={contractData.buyerAddress} onChange={v => updateField('buyerAddress', v)} />
                                    <div className="pt-2 border-t border-dashed">
                                        <label className="text-xs font-bold text-slate-400 mb-1 block">乙方代理人</label>
                                        <div className="flex gap-2 mb-2"><InputGroup label="姓名" field="buyerProxyName" value={contractData.buyerProxyName} onChange={v => updateField('buyerProxyName', v)} /><InputGroup label="电话" field="buyerProxyPhone" value={contractData.buyerProxyPhone} onChange={v => updateField('buyerProxyPhone', v)} /></div>
                                        <InputGroup label="证件号" field="buyerProxyID" value={contractData.buyerProxyID} onChange={v => updateField('buyerProxyID', v)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'property' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputGroup label="房产地址" field="propAddress" value={contractData.propAddress} onChange={v => updateField('propAddress', v)} />
                                <div className="grid grid-cols-3 gap-2">
                                    <InputGroup label="建筑面积" field="buildingArea" value={contractData.buildingArea} onChange={v => updateField('buildingArea', v)} />
                                    <InputGroup label="套内面积" field="innerArea" value={contractData.innerArea} onChange={v => updateField('innerArea', v)} />
                                    <InputGroup label="公摊面积" field="publicArea" value={contractData.publicArea} onChange={v => updateField('publicArea', v)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mb-1">土地使用权</label>
                                    <select className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900" value={contractData.landUseType} onChange={e=>setContractData({...contractData, landUseType: e.target.value})}>
                                        <option value="共用">共用</option>
                                        <option value="独用">独用</option>
                                    </select>
                                </div>
                                <InputGroup label="土地面积" field="landArea" value={contractData.landArea} onChange={v => updateField('landArea', v)} />
                                <InputGroup label="土地性质" field="landType" placeholder="国有建设用地使用权" value={contractData.landType} onChange={v => updateField('landType', v)} />
                                <InputGroup label="登记部门" field="certOrg" value={contractData.certOrg} onChange={v => updateField('certOrg', v)} />
                            </div>
                            <div className="grid grid-cols-4 gap-4 bg-slate-50 p-3 rounded">
                                <InputGroup label="登记日期(年)" field="certDateYear" value={contractData.certDateYear} onChange={v => updateField('certDateYear', v)} />
                                <InputGroup label="登记日期(月)" field="certDateMonth" value={contractData.certDateMonth} onChange={v => updateField('certDateMonth', v)} />
                                <InputGroup label="登记日期(日)" field="certDateDay" value={contractData.certDateDay} onChange={v => updateField('certDateDay', v)} />
                                <InputGroup label="不动产权证号" field="certNo" value={contractData.certNo} onChange={v => updateField('certNo', v)} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex gap-4 items-end mb-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <InputGroup label="成交总价 (元)" field="totalPrice" type="number" width="w-48" value={contractData.totalPrice} onChange={v => updateField('totalPrice', v)} />
                                <InputGroup label="定金 (元)" field="deposit" type="number" width="w-32" value={contractData.deposit} onChange={v => updateField('deposit', v)} />
                                <InputGroup label="定金支付期限 (天)" field="depositDays" width="w-24" value={contractData.depositDays} onChange={v => updateField('depositDays', v)} />
                                <button onClick={calcPayments} className="bg-slate-100 hover:bg-slate-200 border px-3 py-1.5 rounded text-xs font-bold h-9 mb-0.5 whitespace-nowrap">自动计算尾款</button>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="首期款支付时间" field="payStage1Date" placeholder="如: 2025年1月1日前" value={contractData.payStage1Date} onChange={v => updateField('payStage1Date', v)} />
                                    <InputGroup label="首期款金额 (元)" field="payStage1Amount" value={contractData.payStage1Amount} onChange={v => updateField('payStage1Amount', v)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="二期款支付时间" field="payStage2Date" placeholder="如: 过户当天" value={contractData.payStage2Date} onChange={v => updateField('payStage2Date', v)} />
                                    <InputGroup label="二期款金额 (元)" field="payStage2Amount" value={contractData.payStage2Amount} onChange={v => updateField('payStage2Amount', v)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="尾款支付条件" field="finalPaymentMethod" placeholder="如: 银行放款" value={contractData.finalPaymentMethod} onChange={v => updateField('finalPaymentMethod', v)} />
                                    <InputGroup label="尾款金额 (元)" field="finalPayment" value={contractData.finalPayment} onChange={v => updateField('finalPayment', v)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'terms' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-3 gap-4">
                                <InputGroup label="过户时限 (天)" field="transferDeadline" value={contractData.transferDeadline} onChange={v => updateField('transferDeadline', v)} />
                                <InputGroup label="过户登记部门" field="transferOrg" value={contractData.transferOrg} onChange={v => updateField('transferOrg', v)} />
                                <div className="flex gap-1 items-end">
                                    <InputGroup label="交房日期(Y)" field="deliveryDateYear" width="w-16" value={contractData.deliveryDateYear} onChange={v => updateField('deliveryDateYear', v)} />
                                    <InputGroup label="(M)" field="deliveryDateMonth" width="w-12" value={contractData.deliveryDateMonth} onChange={v => updateField('deliveryDateMonth', v)} />
                                    <InputGroup label="(D)" field="deliveryDateDay" width="w-12" value={contractData.deliveryDateDay} onChange={v => updateField('deliveryDateDay', v)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="甲方违约金" field="penaltySeller" value={contractData.penaltySeller} onChange={v => updateField('penaltySeller', v)} />
                                <InputGroup label="乙方违约金" field="penaltyBuyer" value={contractData.penaltyBuyer} onChange={v => updateField('penaltyBuyer', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mb-1">争议解决方式</label>
                                    <select className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900" value={contractData.disputeMethod} onChange={e=>setContractData({...contractData, disputeMethod: e.target.value})}>
                                        <option value="2">方式2: 向人民法院起诉</option>
                                        <option value="1">方式1: 提交仲裁委员会</option>
                                    </select>
                                </div>
                                {contractData.disputeMethod === '1' && (
                                    <InputGroup label="仲裁委员会名称" field="arbitrationComm" value={contractData.arbitrationComm} onChange={v => updateField('arbitrationComm', v)} />
                                )}
                            </div>
                            
                            {/* Attachment 2: Rights Table */}
                            <div className="border rounded-lg p-3 bg-white dark:bg-slate-900">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500">附件二：权利人信息表</label>
                                    <button onClick={addRightsRow} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1"><Plus size={12}/> 添加权利人</button>
                                </div>
                                {contractData.rightsTable.map((row, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2 items-center">
                                        <input className="w-16 border rounded p-1 text-xs" placeholder="姓名" value={row.name} onChange={e=>updateRightsTable(idx, 'name', e.target.value)}/>
                                        <input className="w-24 border rounded p-1 text-xs" placeholder="证件号" value={row.idNo} onChange={e=>updateRightsTable(idx, 'idNo', e.target.value)}/>
                                        <input className="flex-1 border rounded p-1 text-xs" placeholder="发证机关" value={row.authority} onChange={e=>updateRightsTable(idx, 'authority', e.target.value)}/>
                                        <input className="w-16 border rounded p-1 text-xs" placeholder="份额" value={row.share} onChange={e=>updateRightsTable(idx, 'share', e.target.value)}/>
                                        <button onClick={()=>removeRightsRow(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">附件三：补充协议内容</label>
                                <textarea 
                                    className="w-full border rounded p-2 text-sm h-20 bg-white dark:bg-slate-900"
                                    value={contractData.annex3Content}
                                    onChange={e=>setContractData({...contractData, annex3Content: e.target.value})}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ... Preview Code ... */}
        <div className="w-full bg-slate-100 dark:bg-slate-900/50 py-10 overflow-x-auto">
            <div 
                ref={printRef} 
                className="print-container shadow-2xl mx-auto p-[20mm] contract-font text-[15px] leading-[1.8] max-w-[210mm] min-h-[297mm]"
                style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
                {/* 封面 */}
                <div className="text-center h-[1050px] flex flex-col items-center relative">
                    <div className="title-box">
                        <div className="title-inner">房 地 产 买 卖 合 同</div>
                    </div>
                    <div className="mt-auto mb-20 w-full px-10 text-left">
                        <div className="flex flex-col items-center gap-4 mb-20 font-bold text-xl">
                            <div>广 东 省 建 设 厅</div>
                            <div>广东省工商行政管理局</div>
                            <div className="mt-4">制定</div>
                        </div>
                    </div>
                </div>
                <div className="page-break"></div>

                {/* 说明页 */}
                <div>
                    <h2 className="text-xl font-bold text-center mb-6">房地产买卖合同说明</h2>
                    <div className="text-[14px] leading-8 space-y-4 text-justify">
                        <p>1、本合同文本为示范文本，也可作为签约使用文本。签约之前，乙方应当仔细阅读本合同内容，对合同条款及专业用词理解不一致的，可向当地主管部门咨询。</p>
                        <p>2、本合同所称房地产是指单位和个人拥有完全产权， 领取了房地产管理部门核发的《房地产权证》的房屋及其所占用的土地使用权。</p>
                        <p>3、对合同文本【 】中选择内容、空格部位填写及其他需要约定的内容， 双方应当协商确定。【 】中未选择内容，以划 √方式选定；对于实际情况未发生或买卖双方不作约定时，应在空格部位打× , 以示删除。合同签订生效后， 未被修改的文本印刷文字视为双方同意内容。</p>
                        <p>4、本合同文本中涉及到的选择、填写内容以手写项为优先。</p>
                        <p>5、在签订合同前，甲方应当向乙方出示应当由甲方提供的有关证书、证明文件。</p>
                        <p>6、本合同条款由广东省建设厅和广东省工商行政管理局负责解释。</p>
                    </div>
                </div>
                <div className="page-break"></div>

                {/* 合同正文 */}
                <div>
                    <h2 className="text-2xl font-bold text-center mb-4">房 地 产 买 卖 合 同</h2>
                    <div className="text-center text-sm mb-4">（适用于二手楼买卖）</div>
                    <div className="mb-6 text-right">（合同编号：<input className="input-line font-bold" style={{width:'180px'}} {...bindFixed('contractNo')}/>）</div>
                    
                    <div className="mb-4">
                        <p className="font-bold mb-2">本合同双方当事人：</p>
                        {/* 甲方 */}
                        <div className="mb-2">
                            <p><strong>甲方（转让方）：姓名：</strong><input className="input-line" style={{width:'120px'}} {...bindFixed('sellerName')}/><strong> 国籍：</strong><input className="input-line" style={{width:'80px'}} {...bindFixed('sellerNationality')}/></p>
                            <p>证件类型：<input className="input-line" style={{width:'120px'}} {...bindFixed('sellerIDType')}/> 证号：<input className="input-line" style={{width:'200px'}} {...bindFixed('sellerID')}/></p>
                            <p>居住地址：<input className="input-line" style={{width:'380px'}} {...bindFixed('sellerAddress')}/></p>
                            <p>邮政编码：<input className="input-line" style={{width:'100px'}} {...bindFixed('sellerZip')}/> 联系电话：<input className="input-line" style={{width:'150px'}} {...bindFixed('sellerPhone')}/></p>
                            <p>共有方式：<input className="input-line" style={{width:'120px'}} {...bindFixed('sellerShareType')}/> 共有份额：<input className="input-line" style={{width:'80px'}} {...bindFixed('sellerShareAmount')}/></p>
                            {/* 甲方代理 */}
                            <p><strong>委托代理人： 姓名：</strong><input className="input-line" style={{width:'100px'}} {...bindFixed('sellerProxyName')}/><strong> 国籍：</strong><input className="input-line" style={{width:'80px'}} {...bindFixed('sellerProxyNationality')}/></p>
                            <p>证件类型：<input className="input-line" style={{width:'120px'}} {...bindFixed('sellerProxyIDType')}/> 证号：<input className="input-line" style={{width:'200px'}} {...bindFixed('sellerProxyID')}/></p>
                            <p>地址：<input className="input-line" style={{width:'380px'}} {...bindFixed('sellerProxyAddress')}/></p>
                            <p>邮政编码：<input className="input-line" style={{width:'100px'}} {...bindFixed('sellerProxyZip')}/> 联系电话：<input className="input-line" style={{width:'150px'}} {...bindFixed('sellerProxyPhone')}/></p>
                        </div>
                        
                        <div className="border-t border-dashed border-black/30 my-2"></div>

                        {/* 乙方 */}
                        <div className="mb-2">
                            <p><strong>乙方（受让方）：姓名：</strong><input className="input-line" style={{width:'120px'}} {...bindFixed('buyerName')}/><strong> 国籍：</strong><input className="input-line" style={{width:'80px'}} {...bindFixed('buyerNationality')}/></p>
                            <p>证件类型：<input className="input-line" style={{width:'120px'}} {...bindFixed('buyerIDType')}/> 证号：<input className="input-line" style={{width:'200px'}} {...bindFixed('buyerID')}/></p>
                            <p>共有方式：<input className="input-line" style={{width:'120px'}} {...bindFixed('buyerShareType')}/> 共有份额：<input className="input-line" style={{width:'80px'}} {...bindFixed('buyerShareAmount')}/></p>
                            <p>居住地址：<input className="input-line" style={{width:'380px'}} {...bindFixed('buyerAddress')}/></p>
                            <p>邮政编码：<input className="input-line" style={{width:'100px'}} {...bindFixed('buyerZip')}/> 联系电话：<input className="input-line" style={{width:'150px'}} {...bindFixed('buyerPhone')}/></p>
                            {/* 乙方代理 */}
                            <p><strong>委托代理人： 姓名：</strong><input className="input-line" style={{width:'100px'}} {...bindFixed('buyerProxyName')}/><strong> 国籍：</strong><input className="input-line" style={{width:'80px'}} {...bindFixed('buyerProxyNationality')}/></p>
                            <p>证件类型：<input className="input-line" style={{width:'120px'}} {...bindFixed('buyerProxyIDType')}/> 证号：<input className="input-line" style={{width:'200px'}} {...bindFixed('buyerProxyID')}/></p>
                            <p>地址：<input className="input-line" style={{width:'380px'}} {...bindFixed('buyerProxyAddress')}/></p>
                            <p>邮政编码：<input className="input-line" style={{width:'100px'}} {...bindFixed('buyerProxyZip')}/> 联系电话：<input className="input-line" style={{width:'150px'}} {...bindFixed('buyerProxyPhone')}/></p>
                        </div>
                    </div>

                    <p className="indent-8 my-4 text-justify">根据国家和省法律、法规和有关规定，甲、乙双方在平等、自愿、协商一致的基础上就下列房地产买卖达成如下协议：</p>

                    {/* Article 1 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第一条  买卖房地产情况</h3>
                        <p className="text-justify leading-7">
                            甲方拟将位于 <input className="input-line" style={{width:'280px'}} {...bindFixed('propAddress')}/> 的房地产（房屋平面图见附件一）转让 <input className="input-line" style={{width:'60px'}} {...bindFixed('transferShare')}/> 份额给乙方。乙方对甲方拟转让的房地产作了了解， 愿意购买该房地产。
                        </p>
                        <p className="text-justify leading-7">
                            该房地产 <input className="input-line" style={{width:'60px'}} {...bindFixed('landUseType')}/> 土地使用权面积为 <input className="input-line" style={{width:'80px'}} {...bindFixed('landArea')}/> 平方米，土地使用权类型为 <input className="input-line" style={{width:'150px'}} {...bindFixed('landType')}/> ，房屋建筑面积为 <input className="input-line" style={{width:'80px'}} {...bindFixed('buildingArea')}/> 平方米，其中 套内 的建筑面积为 <input className="input-line" style={{width:'80px'}} {...bindFixed('innerArea')}/> 平方米，公共部位与公用房屋分摊建筑面积为 <input className="input-line" style={{width:'80px'}} {...bindFixed('publicArea')}/> 平方米（以上面积均以《不动产权证》登记的面积为准）。
                        </p>
                        <p className="text-justify leading-7">
                            该房地产甲方于 <input className="input-line" style={{width:'50px'}} {...bindFixed('certDateYear')}/> 年 <input className="input-line" style={{width:'40px'}} {...bindFixed('certDateMonth')}/> 月 <input className="input-line" style={{width:'40px'}} {...bindFixed('certDateDay')}/> 日 向 <input className="input-line" style={{width:'180px'}} {...bindFixed('certOrg')}/> 申请产权登记，领取了《不动产权证》， 证书号码为 <input className="input-line" style={{width:'220px'}} {...bindFixed('certNo')}/> ，房地产权共有（用）证号码为 <input className="input-line" style={{width:'80px'}} {...bindFixed('sharedCertNo')}/>。
                        </p>
                    </div>

                    {/* Article 2 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第二条  买卖房地产价格、付款方式</h3>
                        <p className="text-justify leading-7">
                            甲、乙双方议定该房地产交易总金额为（ 人民 币） <input className="input-line" style={{width:'100px'}} {...bindFixed('totalPrice')}/> 元（大写：<span className="input-line min-w-[200px] inline-block">{digitUppercase(Number(contractData.totalPrice))}</span>）。乙方应于合同签订后 <input className="input-line" style={{width:'40px'}} {...bindFixed('depositDays')}/> 天内支付甲方定金（ 人民 币） <input className="input-line" style={{width:'80px'}} {...bindFixed('deposit')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.deposit))}</span>）。
                        </p>
                        <p className="text-justify leading-7 mt-2">
                            乙方于 <input className="input-line" style={{width:'120px'}} {...bindFixed('payStage1Date')}/> 前支付第一期房款（ 人民 币 ） <input className="input-line" style={{width:'80px'}} {...bindFixed('payStage1Amount')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.payStage1Amount)) || '×'}</span> )。
                        </p>
                        <p className="text-justify leading-7">
                            乙方于 <input className="input-line" style={{width:'120px'}} {...bindFixed('payStage2Date')}/> 前支付第二期房款（ 人民 币） <input className="input-line" style={{width:'80px'}} {...bindFixed('payStage2Amount')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.payStage2Amount)) || '×'}</span> )。
                        </p>
                        <p className="text-justify leading-7">
                            最后一期付款（ 人民 币） <input className="input-line" style={{width:'80px'}} {...bindFixed('finalPayment')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.finalPayment))}</span>），在办理好转让手续并核发新的《房地产权证》时付清。已付定金将在最后一期付款时冲抵，付款方式：<input className="input-line" style={{width:'80px'}} {...bindFixed('finalPaymentMethod')}/>。
                        </p>
                    </div>

                    {/* Article 3 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第三条 登记过户手续办理</h3>
                        <p className="text-justify leading-7">
                            本合同签订之日起 <input className="input-line" style={{width:'40px'}} {...bindFixed('transferDeadline')}/> 日内，甲、乙双方应携带有关资料到 <input className="input-line" style={{width:'180px'}} {...bindFixed('transferOrg')}/> 办理过户手续。乙方支付最后一期购房款时，甲方应同时将过户后的《房地产权证》交付给乙方。
                        </p>
                    </div>

                    {/* Article 4 & 5 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第四条  房地产交易</h3>
                        <p className="text-justify leading-7">
                            双方同意于 <input className="input-line" style={{width:'50px'}} {...bindFixed('deliveryDateYear')}/> 年 <input className="input-line" style={{width:'40px'}} {...bindFixed('deliveryDateMonth')}/> 月 <input className="input-line" style={{width:'40px'}} {...bindFixed('deliveryDateDay')}/> 日 由甲方将该房地产交付给乙方使用。
                        </p>
                        <h3 className="font-bold mt-4 mb-2">第五条  权利保证约定</h3>
                        <p className="text-justify leading-7">
                            甲方保证上述房地产没有产权纠纷和财务纠纷或其他权利限制，若发生买卖前即已存在任何纠纷或权利障碍的，概由甲方负责处理，并承担相应法律责任，由此给乙方造成经济损失的，由甲方负责赔偿。
                        </p>
                    </div>

                    {/* Article 6 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第六条  违约责任</h3>
                        <p className="text-justify leading-7">
                            甲方决定中途不卖及逾期 15 天仍未交付房地产时，作甲方中途悔约处理，本合同即告解除，甲方应在悔约之日起七日内将所收定金及购房款退还给乙方，另赔偿乙方（ 人民 币） <input className="input-line" style={{width:'100px'}} {...bindFixed('penaltySeller')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.penaltySeller))}</span>）的违约金。
                        </p>
                        <p className="text-justify leading-7 mt-2">
                            乙方决定中途不买及逾期 15 天仍未付清应缴购房款时，作乙方悔约处理，本合同即告解除，乙方所交定金，甲方不予退回，已付购房款甲方在七日内退回乙方，另赔偿甲方（ 人民币） <input className="input-line" style={{width:'100px'}} {...bindFixed('penaltyBuyer')}/> 元（大写：<span className="input-line min-w-[150px] inline-block">{digitUppercase(Number(contractData.penaltyBuyer))}</span>）的违约金，由甲方在乙方已付房款中扣除。
                        </p>
                    </div>

                    {/* Article 7, 8, 9, 10 */}
                    <div className="mb-4">
                        <h3 className="font-bold mb-2">第七条  税务承担</h3>
                        <p className="text-justify leading-7">办理上述房地产过户所需缴纳的税费，由甲、乙双方按规定各自负责。</p>
                        
                        <h3 className="font-bold mt-4 mb-2">第八条  合同争议的解决办法</h3>
                        <p className="text-justify leading-7">本合同在履行过程中如发生争议，双方应及时协商解决，协商不成的，按下述第 <input className="input-line" style={{width:'30px'}} {...bindFixed('disputeMethod')}/>种方式解决：</p>
                        <p className="leading-7">1、提交 <input className="input-line" style={{width:'150px'}} {...bindFixed('arbitrationComm')}/> 仲裁委员会仲裁。</p>
                        <p className="leading-7">2、依法向人民法院起诉。</p>

                        <h3 className="font-bold mt-4 mb-2">第九条 合同未尽事宜处置及生效</h3>
                        <p className="text-justify leading-7">本合同未尽事宜，双方可协商签订补充协议（附件三），补充协议与本合同具有同等法律效力。</p>

                        <h3 className="font-bold mt-4 mb-2">第十条 本合同保存</h3>
                        <p className="text-justify leading-7">本合同一式二份，甲、乙方双方各存一份，当地房地产交易管理部门留存双方签章的电子扫描合同。</p>
                    </div>

                    {/* Signatures */}
                    <div className="mt-12 flex justify-between px-4">
                        <div className="w-[45%] space-y-8">
                            <div>甲方（签章）：</div>
                            <div>法定代表人：</div>
                            <div>委托代理人：（盖章）</div>
                            <div className="mt-8">签订时间： <input className="input-line" style={{width:'50px'}} {...bindFixed('signDateYear')}/> 年 <input className="input-line" style={{width:'30px'}} {...bindFixed('signDateMonth')}/> 月 <input className="input-line" style={{width:'30px'}} {...bindFixed('signDateDay')}/> 日</div>
                            <div>签订地点： <input className="input-line" style={{width:'150px'}} {...bindFixed('signLocation')}/></div>
                        </div>
                        <div className="w-[45%] space-y-8">
                            <div>乙方（签章）：</div>
                            <div>法定代表人：</div>
                            <div>委托代理人：（盖章）</div>
                            <div className="mt-8">签订时间： <input className="input-line" style={{width:'50px'}} {...bindFixed('signDateYear')}/> 年 <input className="input-line" style={{width:'30px'}} {...bindFixed('signDateMonth')}/> 月 <input className="input-line" style={{width:'30px'}} {...bindFixed('signDateDay')}/> 日</div>
                            <div>签订地点： <input className="input-line" style={{width:'150px'}} {...bindFixed('signLocation')}/></div>
                        </div>
                    </div>
                </div>
                <div className="page-break"></div>

                {/* Annexes */}
                <div className="pt-8">
                    <div className="mb-12 font-bold">附件一：房屋平面图（与《房地产权证》记载的一致）</div>
                    
                    <div className="mb-12">
                        <div className="font-bold mb-4">附件二：权利人信息</div>
                        <table className="w-full border-collapse border border-black text-center text-sm">
                            <thead>
                                <tr>
                                    <th className="border border-black p-2">姓名</th>
                                    <th className="border border-black p-2">证件类型</th>
                                    <th className="border border-black p-2">证件号码</th>
                                    <th className="border border-black p-2">发证机关</th>
                                    <th className="border border-black p-2">国籍</th>
                                    <th className="border border-black p-2">共有情况</th>
                                    <th className="border border-black p-2">份额</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contractData.rightsTable.map((row, i) => (
                                    <tr key={i}>
                                        <td className="border border-black p-2">{row.name}</td>
                                        <td className="border border-black p-2">{row.idType}</td>
                                        <td className="border border-black p-2">{row.idNo}</td>
                                        <td className="border border-black p-2">{row.authority}</td>
                                        <td className="border border-black p-2">{row.country}</td>
                                        <td className="border border-black p-2">{row.type}</td>
                                        <td className="border border-black p-2">{row.share}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <div className="font-bold mb-4">附件三：合同补充协议</div>
                        <div className="whitespace-pre-wrap leading-7 text-justify p-2 min-h-[300px] border-none">{contractData.annex3Content}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- POST ACTION MODAL --- */}
        {showPostAction && selectedPropId && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 max-sm w-full shadow-2xl animate-in zoom-in-95">
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-green-100 p-3 rounded-full mb-4 text-green-600"><Save size={32}/></div>
                        <h3 className="text-xl font-bold mb-2 text-slate-800">合同已生成</h3>
                        <p className="text-slate-500 mb-6">是否将当前房源状态更新为 <span className="font-bold text-blue-600">已售</span>？</p>
                        <button onClick={updatePropStatus} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mb-3 hover:bg-blue-700">确认更新状态</button>
                        <button onClick={()=>setShowPostAction(false)} className="w-full text-slate-500 py-2 font-bold">暂不更新</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
