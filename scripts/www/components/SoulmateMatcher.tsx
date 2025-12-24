
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Zap, MapPin, Home, DollarSign, Trophy, ArrowRight, Building2, User } from 'lucide-react';
import { Customer, Property } from '../types';

interface Props {
    customers: Customer[];
    properties: Property[];
    onClose: () => void;
}

interface MatchResult {
    property: Property;
    score: number;
    reasons: string[];
}

export const SoulmateMatcher: React.FC<Props> = ({ customers, properties, onClose }) => {
    const navigate = useNavigate();
    // Stage: 'intro' -> 'scanning' -> 'reveal'
    const [stage, setStage] = useState<'intro' | 'scanning' | 'reveal'>('intro');
    const [targetCustomer, setTargetCustomer] = useState<Customer | null>(null);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    
    // Animation Refs
    const [scanProgress, setScanProgress] = useState(0);

    // 1. Select a Target Customer (Priority: High Urgency)
    useEffect(() => {
        const candidates = customers.filter(c => c.status === 'active');
        // Sort by urgency then random
        const selected = candidates.sort((a,b) => (a.urgency === 'high' ? -1 : 1))[0] || candidates[0];
        setTargetCustomer(selected);
    }, [customers]);

    // 2. Calculate Matches
    useEffect(() => {
        if (!targetCustomer) return;
        const results: MatchResult[] = properties
            .filter(p => p.status === 'active')
            .map(p => {
                let score = 0;
                const reasons: string[] = [];
                
                // Type Check
                if ((targetCustomer.type === 'buy' && p.isSale) || (targetCustomer.type === 'rent' && p.isRent)) {
                    score += 20;
                } else {
                    return { property: p, score: 0, reasons: [] };
                }

                // Budget Check
                const price = targetCustomer.type === 'buy' ? p.salePrice : p.rentPrice;
                if (price && targetCustomer.budgetMin && targetCustomer.budgetMax) {
                    if (price >= targetCustomer.budgetMin && price <= targetCustomer.budgetMax) {
                        score += 30;
                        reasons.push("💰 预算完美契合");
                    } else if (price >= targetCustomer.budgetMin * 0.9 && price <= targetCustomer.budgetMax * 1.1) {
                        score += 15;
                        reasons.push("💵 价格在浮动范围内");
                    }
                }

                // Room Check
                if (targetCustomer.reqRoom) {
                    if (p.layoutRoom === targetCustomer.reqRoom) {
                        score += 25;
                        reasons.push("🏠 户型需求一致");
                    } else if (Math.abs((p.layoutRoom || 0) - targetCustomer.reqRoom) <= 1) {
                        score += 10;
                    }
                }

                // Location Check
                if (targetCustomer.reqGardens && targetCustomer.reqGardens.length > 0) {
                    if (targetCustomer.reqGardens.some(g => p.garden.includes(g))) {
                        score += 25;
                        reasons.push("📍 意向楼盘命中");
                    }
                }

                return { property: p, score, reasons };
            })
            .filter(r => r.score > 30) // Lowered threshold from 40 to 30 to include softer matches
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Top 3

        setMatches(results);
    }, [targetCustomer, properties]);

    const startScan = () => {
        setStage('scanning');
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            setScanProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => setStage('reveal'), 500);
            }
        }, 30); // 1.5s duration
    };

    const nextCustomer = () => {
        // Simple rotation for demo: pick random
        const candidates = customers.filter(c => c.id !== targetCustomer?.id && c.status === 'active');
        if (candidates.length > 0) {
            setTargetCustomer(candidates[Math.floor(Math.random() * candidates.length)]);
            setStage('intro');
            setScanProgress(0);
        } else {
            onClose();
        }
    };

    const handleNavigate = (p: Property) => {
        onClose();
        // Navigate to properties page with search query
        navigate(`/properties?q=${encodeURIComponent(p.garden + ' ' + p.room)}`);
    };

    if (!targetCustomer) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-white overflow-hidden animate-in fade-in duration-500">
            {/* Background Grid FX */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] pointer-events-none"></div>
            
            <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors z-50">
                <X size={32}/>
            </button>

            <div className="w-full max-w-6xl flex items-center justify-between px-10 relative z-10">
                
                {/* LEFT: Customer Card */}
                <div className={`w-1/3 transition-all duration-700 ${stage === 'scanning' ? 'translate-x-20 scale-90 opacity-50 blur-sm' : 'translate-x-0 opacity-100'}`}>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                        <div className="relative bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-3xl font-bold shadow-lg">
                                    {targetCustomer.name[0]}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300">{targetCustomer.name}</h2>
                                    <div className="flex items-center gap-2 mt-1 text-pink-200/70 font-mono">
                                        <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-500/30 text-xs">{targetCustomer.type === 'buy' ? '购房' : '租房'}</span>
                                        <span>{targetCustomer.phone}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <span className="text-slate-400">预算范围</span>
                                    <span className="text-xl font-bold font-mono text-pink-400">
                                        {targetCustomer.budgetMin}-{targetCustomer.budgetMax}
                                        <span className="text-sm ml-1">{targetCustomer.type === 'buy' ? '万' : '元'}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <span className="text-slate-400">户型需求</span>
                                    <span className="text-lg font-bold">{targetCustomer.reqRoom ? `${targetCustomer.reqRoom}房` : '不限'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <span className="text-slate-400">意向区域</span>
                                    <span className="text-sm text-right max-w-[150px] truncate">{targetCustomer.reqGardens?.join(', ') || '全城搜索'}</span>
                                </div>
                                <div className="pt-2">
                                    <span className="text-slate-400 block mb-1 text-sm">客户画像关键词</span>
                                    <div className="flex flex-wrap gap-2">
                                        {[targetCustomer.urgency === 'high' ? '急迫' : '稳健', '资金到位', '配合度高'].map((tag, i) => (
                                            <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-slate-300 border border-white/10">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER: The Core / Connector */}
                <div className="flex-1 flex flex-col items-center justify-center px-10 relative h-[400px]">
                    {stage === 'intro' && (
                        <div className="animate-in zoom-in duration-500 flex flex-col items-center gap-6">
                            <div className="w-1 h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                            <button 
                                onClick={startScan}
                                className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-110"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute inset-0 blur-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50 group-hover:opacity-80 animate-pulse"></div>
                                <span className="relative flex items-center gap-2 font-black text-xl tracking-widest uppercase text-white">
                                    <Sparkles className="animate-spin-slow" /> 启动灵境匹配
                                </span>
                            </button>
                            <p className="text-white/40 text-sm font-mono tracking-widest">AI NEURAL LINK READY</p>
                        </div>
                    )}

                    {stage === 'scanning' && (
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Radar Rings */}
                            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-[ping_1.5s_linear_infinite]"></div>
                            <div className="absolute inset-4 rounded-full border border-purple-500/30 animate-[ping_2s_linear_infinite]"></div>
                            <div className="absolute inset-0 rounded-full border-t-4 border-cyan-400 animate-[spin_1s_linear_infinite]"></div>
                            <div className="absolute inset-4 rounded-full border-b-4 border-purple-400 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                            
                            {/* Center Progress */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl font-black font-mono text-cyan-300">{scanProgress}%</span>
                            </div>

                            {/* Particles flying from left (Simulated) */}
                            <div className="absolute left-[-200px] top-1/2 w-40 h-1 bg-gradient-to-r from-pink-500 to-transparent animate-[pulse_0.2s_infinite]"></div>
                        </div>
                    )}

                    {stage === 'reveal' && (
                        <div className="flex flex-col items-center animate-in zoom-in duration-300">
                            <div className="text-6xl mb-4">🔮</div>
                            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400">
                                匹配完成
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Property Results */}
                <div className="w-1/3 h-[500px] relative">
                    {stage === 'intro' && (
                        <div className="absolute inset-0 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center bg-white/5">
                            <p className="text-white/30 font-mono">等待数据输入...</p>
                        </div>
                    )}
                    
                    {stage === 'scanning' && (
                        <div className="absolute inset-0 grid grid-cols-2 gap-2 opacity-50 blur-sm overflow-hidden">
                            {/* Dummy scanning grid */}
                            {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="bg-slate-800 rounded animate-pulse" style={{animationDelay: `${i*0.1}s`}}></div>
                            ))}
                        </div>
                    )}

                    {stage === 'reveal' && (
                        <div className="absolute inset-0 flex flex-col gap-4">
                            {matches.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <p className="text-slate-400 mb-4">暂无高匹配房源</p>
                                    <button onClick={nextCustomer} className="px-6 py-2 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors">换一位客户</button>
                                </div>
                            ) : (
                                matches.map((m, idx) => (
                                    <div 
                                        key={m.property.id} 
                                        onClick={() => handleNavigate(m.property)}
                                        className="relative bg-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.1)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:-translate-y-1 transition-all cursor-pointer animate-in slide-in-from-right fade-in duration-500 group"
                                        style={{animationDelay: `${idx * 0.2}s`}}
                                    >
                                        {/* Match Badge */}
                                        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black px-3 py-1 rounded-full shadow-lg border-2 border-slate-900 flex items-center gap-1 z-10">
                                            <Zap size={14} fill="white"/> {m.score}%
                                        </div>

                                        <div className="mb-2">
                                            <h3 className="font-bold text-lg text-white mb-1 flex items-center flex-wrap">
                                                {m.property.garden} 
                                                <span className="ml-2 text-sm font-normal text-slate-300 opacity-80 bg-white/10 px-1.5 py-0.5 rounded">
                                                    {m.property.subArea} {m.property.building} {m.property.unit} {m.property.room}
                                                </span>
                                            </h3>
                                            <div className="text-sm text-slate-400 flex items-center gap-2">
                                                <span>{m.property.layout}</span>
                                                <span className="text-slate-600">|</span>
                                                <span>{m.property.area}㎡</span>
                                                <span className="text-slate-600">|</span>
                                                <span>{m.property.floor}层</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end border-t border-white/10 pt-2 mt-2">
                                            <div className="flex flex-wrap gap-1 max-w-[70%]">
                                                {m.reasons.map((r, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 truncate max-w-full">{r}</span>
                                                ))}
                                            </div>
                                            <div className="text-xl font-black text-amber-400 shrink-0">
                                                {m.property.isSale ? `${m.property.salePrice}万` : `${m.property.rentPrice}元`}
                                            </div>
                                        </div>
                                        
                                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none flex items-center justify-center">
                                            <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                                                <ArrowRight size={16}/> 跳转详情
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {matches.length > 0 && (
                                <button onClick={nextCustomer} className="mt-auto w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                                    下一位客户 <ArrowRight size={16}/>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
