
import React, { useState, useEffect } from 'react';
import { Calculator as CalcIcon, DollarSign, PieChart, Settings, X, Table2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { MortgageType, TaxConfig, InterestRates, TaxResult } from '../types';

export const Calculator = () => {
    const { settings, updateSettings } = useStore();
    const [activeTab, setActiveTab] = useState<'mortgage' | 'tax'>('mortgage');
    const [showSettings, setShowSettings] = useState(false);

    // Mortgage State
    const [mType, setMType] = useState<MortgageType>('commercial');
    const [calcMode, setCalcMode] = useState<'total'|'loan'>('total');
    const [totalPrice, setTotalPrice] = useState<number>(200); // Wan
    const [loanPercent, setLoanPercent] = useState<number>(70);
    const [loanAmount, setLoanAmount] = useState<number>(140);
    const [fundAmount, setFundAmount] = useState<number>(60);
    const [years, setYears] = useState<number>(30);
    const [method, setMethod] = useState<'interest'|'principal'>('interest');
    const [isSecondHome, setIsSecondHome] = useState(false);
    
    // Custom Rates (can override defaults)
    const [customComRate, setCustomComRate] = useState<string>('');
    const [customFundRate, setCustomFundRate] = useState<string>('');

    // Tax State
    const [taxPrice, setTaxPrice] = useState<number>(200);
    const [taxArea, setTaxArea] = useState<number>(89);
    const [taxOriginal, setTaxOriginal] = useState<number>(100);
    const [isTaxSecond, setIsTaxSecond] = useState<'first'|'second'|'third'>('first');
    const [yearsHeld, setYearsHeld] = useState<'less2'|'more2'|'more5'>('more2');
    const [isUnique, setIsUnique] = useState(true);
    const [taxUsage, setTaxUsage] = useState<'residence'|'commercial'>('residence');

    // Derived Rates
    const getCommercialRate = () => {
        if (customComRate) return Number(customComRate);
        return isSecondHome ? settings.interestRates.commercialRateSecond : settings.interestRates.commercialRateFirst;
    };

    const getFundRate = () => {
        if (customFundRate) return Number(customFundRate);
        if (years <= 5) {
            return isSecondHome ? settings.interestRates.fundRateSecond5Y : settings.interestRates.fundRateFirst5Y;
        } else {
            return isSecondHome ? settings.interestRates.fundRateSecondOver5Y : settings.interestRates.fundRateFirstOver5Y;
        }
    };

    // Calculation Logic
    const calculateMortgage = () => {
        let comPrincipal = 0;
        let fundPrincipal = 0;

        if (calcMode === 'total') {
            const totalLoan = totalPrice * 10000 * (loanPercent / 100);
            if (mType === 'combined') {
                fundPrincipal = fundAmount * 10000;
                comPrincipal = totalLoan - fundPrincipal;
                if (comPrincipal < 0) comPrincipal = 0;
            } else if (mType === 'fund') {
                fundPrincipal = totalLoan;
            } else {
                comPrincipal = totalLoan;
            }
        } else {
             if (mType === 'combined') {
                 fundPrincipal = fundAmount * 10000;
                 comPrincipal = (loanAmount * 10000) - fundPrincipal;
                 if (comPrincipal < 0) comPrincipal = 0;
             } else if (mType === 'fund') {
                 fundPrincipal = loanAmount * 10000;
             } else {
                 comPrincipal = loanAmount * 10000;
             }
        }

        const months = years * 12;
        const comRateMonth = getCommercialRate() / 100 / 12;
        const fundRateMonth = getFundRate() / 100 / 12;

        const calcSingle = (principal: number, r: number) => {
            if (principal <= 0) return { monthly: 0, total: 0, interest: 0, decline: 0 };
            let monthly = 0;
            let total = 0;
            let decline = 0;
            
            if (method === 'interest') {
                 monthly = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
                 total = monthly * months;
            } else {
                 const base = principal / months;
                 monthly = base + (principal * r);
                 decline = base * r;
                 total = principal + (months + 1) * principal * r / 2;
            }
            return { monthly, total, interest: total - principal, decline };
        };

        const comRes = calcSingle(comPrincipal, comRateMonth);
        const fundRes = calcSingle(fundPrincipal, fundRateMonth);

        return {
            loanTotal: comPrincipal + fundPrincipal,
            monthlyPay: comRes.monthly + fundRes.monthly,
            monthlyDecline: comRes.decline + fundRes.decline,
            totalInterest: comRes.interest + fundRes.interest,
            totalPay: comRes.total + fundRes.total,
            comDetails: comRes,
            fundDetails: fundRes
        };
    };

    const calculateTax = () => {
        const price = taxPrice * 10000;
        const original = taxOriginal * 10000;
        
        let deedTax = 0;
        let vat = 0;
        let pit = 0;
        let lat = 0; // Land Appreciation
        let propTax = 0; // Property Tax

        // 1. Deed Tax (契税)
        // Rule: 1st home: <=140 1%, >140 1.5% (Based on prompt, though standard is 90)
        // 2nd home: <=140 1%, >140 2%
        // 3rd home: 3%
        const threshold = settings.taxConfig.deedTaxThreshold;
        if (isTaxSecond === 'third') {
            deedTax = price * 0.03;
        } else if (isTaxSecond === 'second') {
            deedTax = price * (taxArea <= threshold ? 0.01 : 0.02);
        } else {
            deedTax = price * (taxArea <= threshold ? 0.01 : 0.015);
        }

        // 2. VAT (增值税)
        // <2 years: 5%, >=2 years: Exempt
        if (yearsHeld === 'less2') {
            vat = price * 0.05;
        }

        // 3. PIT (个税)
        // Rule: Can verify cost: (Price - Original)*20%
        // Cannot verify: (Price - VAT)*1% or 1.5%
        // >5 Years & Unique: 0
        if (yearsHeld === 'more5' && isUnique && taxUsage === 'residence') {
            pit = 0;
        } else {
            // Default to 1% of total if not calculating margin
             pit = (price - vat) * (settings.taxConfig.pitRate / 100);
        }

        // 4. LAT (土地增值税) - Usually exempt for individuals standard residence
        // Prompt: Individual exempt. Enterprise 1.5-8%. We assume individual for this tool mostly.
        if (taxUsage !== 'residence') {
             lat = (price - vat) * 0.05; // Rough estimate for non-residence
        }

        // 5. Property Tax (房产税 - Holding tax)
        // Self 1.2% (Original * 70% * 1.2%)
        // Rent 12% or 4%
        // This is usually annual, not transaction. We display it separately.
        const annualPropTaxSelf = (original * 0.7) * 0.012;
        
        return {
            deedTax, vat, pit, lat, annualPropTaxSelf,
            totalTransaction: deedTax + vat + pit + lat
        };
    };

    const mResult = calculateMortgage();
    const tResult = calculateTax();

    return (
        <div className="fade-in pb-20 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2"><CalcIcon className="text-brand-600"/> 房贷与税费计算</h1>
                <button onClick={()=>setShowSettings(true)} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg"><Settings size={18}/> 利率配置</button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700">
                <button onClick={()=>setActiveTab('mortgage')} className={`pb-3 px-4 font-bold border-b-2 transition-colors ${activeTab==='mortgage'?'border-brand-600 text-brand-600':'border-transparent text-slate-500'}`}>房贷计算</button>
                <button onClick={()=>setActiveTab('tax')} className={`pb-3 px-4 font-bold border-b-2 transition-colors ${activeTab==='tax'?'border-brand-600 text-brand-600':'border-transparent text-slate-500'}`}>税费计算</button>
            </div>
            
            {activeTab === 'mortgage' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Input Panel */}
                    <div className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm space-y-5">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                             {(['commercial','fund','combined'] as const).map(t => (
                                 <button key={t} onClick={()=>setMType(t)} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mType===t?'bg-white dark:bg-slate-600 shadow text-brand-700':'text-slate-500'}`}>
                                     {t==='commercial'?'商业贷款':t==='fund'?'公积金':t==='combined'?'组合贷款':''}
                                 </button>
                             ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="text-xs font-bold text-slate-500 mb-1 block">计算方式</label>
                                 <select value={calcMode} onChange={e=>setCalcMode(e.target.value as any)} className="w-full border rounded p-2 text-sm bg-slate-50 dark:bg-slate-900">
                                     <option value="total">按房屋总价</option>
                                     <option value="loan">按贷款总额</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-slate-500 mb-1 block">房屋套数</label>
                                 <select value={isSecondHome?'second':'first'} onChange={e=>setIsSecondHome(e.target.value==='second')} className="w-full border rounded p-2 text-sm bg-slate-50 dark:bg-slate-900">
                                     <option value="first">首套房</option>
                                     <option value="second">二套房</option>
                                 </select>
                             </div>
                        </div>

                        {calcMode === 'total' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">房屋总价 (万)</label>
                                    <input type="number" value={totalPrice} onChange={e=>setTotalPrice(Number(e.target.value))} className="w-full border rounded p-2"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">贷款成数</label>
                                    <select value={loanPercent} onChange={e=>setLoanPercent(Number(e.target.value))} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                        {[30,40,50,60,70,80].map(p=><option key={p} value={p}>{p}%</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                             <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">贷款总额 (万)</label>
                                <input type="number" value={loanAmount} onChange={e=>setLoanAmount(Number(e.target.value))} className="w-full border rounded p-2"/>
                             </div>
                        )}

                        {mType === 'combined' && (
                             <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">其中公积金贷款金额 (万)</label>
                                <input type="number" value={fundAmount} onChange={e=>setFundAmount(Number(e.target.value))} className="w-full border rounded p-2"/>
                                <p className="text-xs text-slate-400 mt-1">剩余部分自动计算为商业贷款</p>
                             </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">贷款年限 (年)</label>
                                <input type="number" value={years} onChange={e=>setYears(Number(e.target.value))} className="w-full border rounded p-2"/>
                             </div>
                             <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">还款方式</label>
                                <select value={method} onChange={e=>setMethod(e.target.value as any)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                    <option value="interest">等额本息</option>
                                    <option value="principal">等额本金</option>
                                </select>
                             </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                             {mType !== 'fund' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">商贷利率 (%) <span className="font-normal text-slate-400">默认 {isSecondHome?settings.interestRates.commercialRateSecond:settings.interestRates.commercialRateFirst}</span></label>
                                    <input type="number" step="0.01" value={customComRate} onChange={e=>setCustomComRate(e.target.value)} placeholder="自定义" className="w-full border rounded p-2 bg-yellow-50 dark:bg-slate-800 dark:text-yellow-400"/>
                                </div>
                             )}
                             {mType !== 'commercial' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">公积金利率 (%) <span className="font-normal text-slate-400">默认 {years<=5?(isSecondHome?settings.interestRates.fundRateSecond5Y:settings.interestRates.fundRateFirst5Y):(isSecondHome?settings.interestRates.fundRateSecondOver5Y:settings.interestRates.fundRateFirstOver5Y)}</span></label>
                                    <input type="number" step="0.001" value={customFundRate} onChange={e=>setCustomFundRate(e.target.value)} placeholder="自定义" className="w-full border rounded p-2 bg-yellow-50 dark:bg-slate-800 dark:text-yellow-400"/>
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Result Panel */}
                    <div className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                        <div className="text-center mb-8">
                            <div className="text-slate-500 mb-1">首月月供 (元)</div>
                            <div className="text-5xl font-black text-brand-600">¥ {Math.round(mResult.monthlyPay).toLocaleString()}</div>
                            {method === 'principal' && <div className="text-sm text-green-600 mt-2 font-bold">每月递减 ¥{Math.round(mResult.monthlyDecline)}</div>}
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-dashed border-slate-300 pb-2">
                                <span className="text-slate-500">贷款总额</span>
                                <span className="font-bold">{(mResult.loanTotal/10000).toFixed(2)} 万</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-300 pb-2">
                                <span className="text-slate-500">利息总额</span>
                                <span className="font-bold text-orange-600">{(mResult.totalInterest/10000).toFixed(2)} 万</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-300 pb-2">
                                <span className="text-slate-500">还款总额</span>
                                <span className="font-bold">{(mResult.totalPay/10000).toFixed(2)} 万</span>
                            </div>
                            {calcMode === 'total' && (
                                <div className="flex justify-between pt-2">
                                    <span className="text-slate-500">参考首付</span>
                                    <span className="font-bold text-blue-600">{(totalPrice * (1 - loanPercent/100)).toFixed(2)} 万</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tax' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">成交价格 (万)</label>
                                <input type="number" value={taxPrice} onChange={e=>setTaxPrice(Number(e.target.value))} className="w-full border rounded p-2"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">建筑面积 (㎡)</label>
                                <input type="number" value={taxArea} onChange={e=>setTaxArea(Number(e.target.value))} className="w-full border rounded p-2"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">原购入价 (万)</label>
                                <input type="number" value={taxOriginal} onChange={e=>setTaxOriginal(Number(e.target.value))} className="w-full border rounded p-2"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">买方家庭拥有</label>
                                <select value={isTaxSecond} onChange={e=>setIsTaxSecond(e.target.value as any)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                    <option value="first">首套房</option>
                                    <option value="second">二套房</option>
                                    <option value="third">三套及以上</option>
                                </select>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">房产证年限</label>
                                <select value={yearsHeld} onChange={e=>setYearsHeld(e.target.value as any)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                    <option value="less2">不满2年</option>
                                    <option value="more2">满2年</option>
                                    <option value="more5">满5年</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">卖方家庭唯一</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2"><input type="radio" checked={isUnique} onChange={()=>setIsUnique(true)}/> 是</label>
                                    <label className="flex items-center gap-2"><input type="radio" checked={!isUnique} onChange={()=>setIsUnique(false)}/> 否</label>
                                </div>
                            </div>
                        </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">物业用途</label>
                            <select value={taxUsage} onChange={e=>setTaxUsage(e.target.value as any)} className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                <option value="residence">普通住宅</option>
                                <option value="commercial">非住宅 (公寓/商铺)</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-bg-card p-6 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-sm">
                        <h3 className="text-xl font-bold mb-6 text-center">税费清单预估</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                <div>
                                    <div className="font-bold">契税</div>
                                    <div className="text-xs text-slate-400">买方支付</div>
                                </div>
                                <div className="font-bold text-brand-600">{(tResult.deedTax/10000).toFixed(4)} 万</div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                <div>
                                    <div className="font-bold">增值税</div>
                                    <div className="text-xs text-slate-400">卖方支付 (不满2年5%)</div>
                                </div>
                                <div className="font-bold text-brand-600">{(tResult.vat/10000).toFixed(4)} 万</div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                <div>
                                    <div className="font-bold">个人所得税</div>
                                    <div className="text-xs text-slate-400">卖方支付 (满五唯一免)</div>
                                </div>
                                <div className="font-bold text-brand-600">{(tResult.pit/10000).toFixed(4)} 万</div>
                            </div>
                             {tResult.lat > 0 && (
                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded">
                                    <div>
                                        <div className="font-bold">土地增值税</div>
                                        <div className="text-xs text-slate-400">非住宅需缴纳</div>
                                    </div>
                                    <div className="font-bold text-brand-600">{(tResult.lat/10000).toFixed(4)} 万</div>
                                </div>
                             )}

                            <div className="border-t-2 border-dashed border-slate-300 pt-4 mt-2">
                                <div className="flex justify-between items-center">
                                    <div className="font-black text-lg">交易税费总计</div>
                                    <div className="font-black text-2xl text-red-600">{(tResult.totalTransaction/10000).toFixed(4)} 万</div>
                                </div>
                            </div>

                             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded mt-4 border border-yellow-200 dark:border-yellow-800">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-yellow-800 dark:text-yellow-200 font-bold">房产税 (持有环节)</span>
                                    <span className="font-bold text-yellow-700 dark:text-yellow-300">{(tResult.annualPropTaxSelf/10000).toFixed(4)} 万/年</span>
                                </div>
                                <div className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">按房产原值70%的1.2%计算 (自用)</div>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                     <div className="bg-bg-card w-full max-w-lg rounded-xl shadow-xl border-2 border-slate-300 p-6 animate-in zoom-in-95">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg">计算器配置</h3>
                             <button onClick={()=>setShowSettings(false)}><X/></button>
                         </div>
                         <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                             <div>
                                 <h4 className="font-bold text-sm text-brand-600 mb-2">商业贷款利率 (%)</h4>
                                 <div className="grid grid-cols-2 gap-2">
                                     <label className="text-xs">首套 <input type="number" step="0.01" className="border rounded p-1 w-20" value={settings.interestRates.commercialRateFirst} onChange={e=>updateSettings({interestRates: {...settings.interestRates, commercialRateFirst: Number(e.target.value)}})}/></label>
                                     <label className="text-xs">二套 <input type="number" step="0.01" className="border rounded p-1 w-20" value={settings.interestRates.commercialRateSecond} onChange={e=>updateSettings({interestRates: {...settings.interestRates, commercialRateSecond: Number(e.target.value)}})}/></label>
                                 </div>
                             </div>
                             <div>
                                 <h4 className="font-bold text-sm text-brand-600 mb-2">公积金利率 (%)</h4>
                                 <div className="grid grid-cols-2 gap-2 text-xs">
                                     <div>首套 ≤5年 <input type="number" className="border rounded p-1 w-16" value={settings.interestRates.fundRateFirst5Y} onChange={e=>updateSettings({interestRates: {...settings.interestRates, fundRateFirst5Y: Number(e.target.value)}})}/></div>
                                     <div>首套 &gt;5年 <input type="number" className="border rounded p-1 w-16" value={settings.interestRates.fundRateFirstOver5Y} onChange={e=>updateSettings({interestRates: {...settings.interestRates, fundRateFirstOver5Y: Number(e.target.value)}})}/></div>
                                     <div>二套 ≤5年 <input type="number" className="border rounded p-1 w-16" value={settings.interestRates.fundRateSecond5Y} onChange={e=>updateSettings({interestRates: {...settings.interestRates, fundRateSecond5Y: Number(e.target.value)}})}/></div>
                                     <div>二套 &gt;5年 <input type="number" className="border rounded p-1 w-16" value={settings.interestRates.fundRateSecondOver5Y} onChange={e=>updateSettings({interestRates: {...settings.interestRates, fundRateSecondOver5Y: Number(e.target.value)}})}/></div>
                                 </div>
                             </div>
                             <div>
                                 <h4 className="font-bold text-sm text-brand-600 mb-2">税费参数</h4>
                                 <div className="space-y-2 text-xs">
                                     <label className="flex justify-between items-center">契税面积阈值 (㎡) <input type="number" className="border rounded p-1 w-20" value={settings.taxConfig.deedTaxThreshold} onChange={e=>updateSettings({taxConfig: {...settings.taxConfig, deedTaxThreshold: Number(e.target.value)}})}/></label>
                                     <label className="flex justify-between items-center">增值税免征年限 (年) <input type="number" className="border rounded p-1 w-20" value={settings.taxConfig.vatExemptionYears} onChange={e=>updateSettings({taxConfig: {...settings.taxConfig, vatExemptionYears: Number(e.target.value)}})}/></label>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};
