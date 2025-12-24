
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, User, Plus, Calendar, Home, FileText, LayoutDashboard, Key, Wrench, BookOpen, ArrowRight } from 'lucide-react';
import Fuse from 'fuse.js';
import { useStore } from '../context/StoreContext';

interface CommandItem {
    id: string;
    type: 'page' | 'action' | 'property' | 'customer';
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    keywords?: string[];
    action: () => void;
    score?: number;
}

export const CommandPalette = () => {
    const navigate = useNavigate();
    const { properties, customers, addTodo } = useStore();
    
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // --- Toggle Logic ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setQuery('');
                setActiveIndex(0);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is rendered
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // --- Search Logic ---
    const allItems = useMemo(() => {
        const items: CommandItem[] = [];

        // 1. Pages
        const pages = [
            { path: '/', label: '工作台 / Dashboard', icon: <LayoutDashboard size={16}/> },
            { path: '/properties', label: '房源管理 / Properties', icon: <Building2 size={16}/> },
            { path: '/customers', label: '客源管理 / Customers', icon: <User size={16}/> },
            { path: '/calendar', label: '工作日历 / Calendar', icon: <Calendar size={16}/> },
            { path: '/keys', label: '钥匙管理 / Keys', icon: <Key size={16}/> },
            { path: '/contract', label: '租赁合同 / Rental Contract', icon: <FileText size={16}/> },
            { path: '/sale-contract', label: '买卖合同 / Sale Contract', icon: <FileText size={16}/> },
            { path: '/calculator', label: '房贷计算器 / Calculator', icon: <Wrench size={16}/> },
            { path: '/dictionary', label: '楼盘字典 / Dictionary', icon: <BookOpen size={16}/> },
        ];
        
        pages.forEach(p => items.push({
            id: `page-${p.path}`,
            type: 'page',
            title: p.label,
            icon: p.icon,
            keywords: [p.label],
            action: () => navigate(p.path)
        }));

        // 2. Actions
        items.push({
            id: 'act-add-todo',
            type: 'action',
            title: '记待办 / Quick Todo',
            subtitle: '快速添加一条今日待办事项',
            icon: <Plus size={16}/>,
            keywords: ['todo', 'task', 'dai', 'ji'],
            action: () => {
                const text = prompt("请输入待办事项内容:");
                if (text) {
                    addTodo(text, new Date().toISOString().split('T')[0]);
                }
            }
        });

        // 3. Properties (Limit for perf if needed, but Fuse handles thousands well)
        properties.forEach(p => {
            items.push({
                id: `prop-${p.id}`,
                type: 'property',
                title: `${p.garden} ${p.subArea||''} ${p.building} ${p.unit ? p.unit + '单元 ' : ''}${p.room}`,
                subtitle: `${p.layout} ${p.area}㎡ ${p.isSale ? `售${p.salePrice}万` : `租${p.rentPrice}`}`,
                keywords: [p.garden, p.subArea||'', p.room, p.building || '', p.unit||'', p.ownerName, p.ownerContact, p.layout || ''],
                icon: <Home size={16}/>,
                action: () => navigate(`/properties?q=${encodeURIComponent(p.garden + ' ' + p.room)}`)
            });
        });

        // 4. Customers
        customers.forEach(c => {
            items.push({
                id: `cust-${c.id}`,
                type: 'customer',
                title: `${c.name} (${c.phone})`,
                subtitle: `${c.type==='buy'?'求购':'求租'} ${c.reqGardens?.join(' ')}`,
                keywords: [c.name, c.phone, ...(c.reqGardens||[])],
                icon: <User size={16}/>,
                action: () => navigate(`/customers?q=${encodeURIComponent(c.name)}`)
            });
        });

        return items;
    }, [properties, customers, navigate, addTodo]);

    const filteredItems = useMemo(() => {
        if (!query.trim()) return allItems.slice(0, 15); // Default list

        const fuse = new Fuse(allItems, {
            keys: ['title', 'subtitle', 'keywords'],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true // Search anywhere in the string
        });

        return fuse.search(query).map(r => r.item).slice(0, 50);
    }, [query, allItems]);

    // --- Selection Logic ---
    const handleSelect = (item: CommandItem) => {
        item.action();
        setIsOpen(false);
        setQuery('');
    };

    const handleNavKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filteredItems.length);
            if (listRef.current) {
                const el = listRef.current.children[activeIndex + 1] as HTMLElement;
                if(el) el.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            if (listRef.current) {
                const el = listRef.current.children[activeIndex - 1] as HTMLElement;
                if(el) el.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[activeIndex]) {
                handleSelect(filteredItems[activeIndex]);
            }
        }
    };

    useEffect(() => {
        setActiveIndex(0);
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [query]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4 animate-in fade-in duration-200">
            <div 
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5"
                onClick={e => e.stopPropagation()}
            >
                {/* Input Area */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                    <Search className="text-slate-400" size={20}/>
                    <input 
                        ref={inputRef}
                        className="flex-1 text-lg bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        placeholder="搜索页面、房源、客户或输入命令..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleNavKeyDown}
                    />
                    <div className="hidden md:flex items-center gap-1">
                        <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-500 font-mono">ESC</kbd>
                    </div>
                </div>

                {/* Results List */}
                <div 
                    ref={listRef}
                    className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar"
                >
                    {filteredItems.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            未找到相关结果
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => (
                            <div 
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setActiveIndex(idx)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${idx === activeIndex ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${idx === activeIndex ? 'bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300 border-brand-200 dark:border-brand-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium flex items-center gap-2 ${idx===activeIndex ? 'text-brand-900 dark:text-brand-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {item.title}
                                        {item.type === 'page' && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 dark:border-slate-600">跳转</span>}
                                        {item.type === 'action' && <span className="text-[10px] bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-600 border border-green-200 dark:border-green-800">执行</span>}
                                    </div>
                                    {item.subtitle && <div className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</div>}
                                </div>
                                {idx === activeIndex && (
                                    <ArrowRight size={14} className="text-slate-400 mr-2"/>
                                )}
                            </div>
                        ))
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-400 flex justify-between px-4">
                    <div className="flex gap-3">
                        <span><strong className="font-mono">↑↓</strong> 选择</span>
                        <span><strong className="font-mono">Enter</strong> 确认</span>
                    </div>
                    <div>
                        MingHui Pro Command
                    </div>
                </div>
            </div>
        </div>
    );
};
