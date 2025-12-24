
import React, { useEffect, useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle, Building2, User } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const RecycleBin = () => {
    const { trash, loadTrash, restoreProperty, permanentDeleteProperty, restoreCustomer, permanentDeleteCustomer, showToast } = useStore();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        loadTrash().finally(() => setLoading(false));
    }, []);

    const handleRestoreProp = async (id: string) => {
        if(confirm("确定恢复此房源吗？")) await restoreProperty(id);
    };
    
    const handleRestoreCust = async (id: string) => {
        if(confirm("确定恢复此客户吗？")) await restoreCustomer(id);
    };

    const handleDeleteProp = async (id: string) => {
        if(confirm("【警告】永久删除无法撤销！确定删除吗？")) await permanentDeleteProperty(id);
    };

    const handleDeleteCust = async (id: string) => {
        if(confirm("【警告】永久删除无法撤销！确定删除吗？")) await permanentDeleteCustomer(id);
    };

    if (loading) return <div className="p-10 text-center text-slate-500">正在加载回收站数据...</div>;

    const hasItems = trash.properties.length > 0 || trash.customers.length > 0;

    return (
        <div className="space-y-6 fade-in pb-20">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Trash2 className="text-red-500"/> 回收站
            </h1>
            
            {!hasItems ? (
                <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <Trash2 size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>回收站空空如也</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Properties */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Building2 className="text-slate-400"/> 房源 ({trash.properties.length})</h3>
                        {trash.properties.map(p => (
                            <div key={p.id} className="bg-bg-card p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center group">
                                <div>
                                    <div className="font-bold">{p.garden} {p.building}-{p.room}</div>
                                    <div className="text-xs text-slate-500">删除时间: {new Date(p.updatedAt).toLocaleDateString()}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={()=>handleRestoreProp(p.id)} className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100" title="恢复"><RefreshCw size={16}/></button>
                                    <button onClick={()=>handleDeleteProp(p.id)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100" title="彻底删除"><AlertTriangle size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Customers */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><User className="text-slate-400"/> 客源 ({trash.customers.length})</h3>
                        {trash.customers.map(c => (
                            <div key={c.id} className="bg-bg-card p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center group">
                                <div>
                                    <div className="font-bold">{c.name} {c.phone}</div>
                                    <div className="text-xs text-slate-500">删除时间: {new Date(c.updatedAt).toLocaleDateString()}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={()=>handleRestoreCust(c.id)} className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100" title="恢复"><RefreshCw size={16}/></button>
                                    <button onClick={()=>handleDeleteCust(c.id)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100" title="彻底删除"><AlertTriangle size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
