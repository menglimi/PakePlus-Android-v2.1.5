
import React, { useRef, useState, useEffect } from 'react';
import { X, Copy, Download, Image as ImageIcon, MessageCircle, LayoutTemplate, Loader2, Settings2, Palette, Type, Check, RefreshCw, Globe, QrCode } from 'lucide-react';
import { Property } from '../types';
import { useStore } from '../context/StoreContext';
import { TEMPLATES } from '../constants';

interface Props {
    property: Property;
    onClose: () => void;
}

export const WeChatShare: React.FC<Props> = ({ property, onClose }) => {
    const { settings, getAssetUrl, showToast } = useStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [generating, setGenerating] = useState(false);
    
    // Designer State
    const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);
    const [customTitle, setCustomTitle] = useState(`${property.garden} ${property.layout}`);
    const [showPrice, setShowPrice] = useState(true);
    const [showAgent, setShowAgent] = useState(true);
    const [showQr, setShowQr] = useState(true);
    
    const [isPublishing, setIsPublishing] = useState(false);
    const [h5Url, setH5Url] = useState('');

    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => { console.warn("Image load failed", e); reject(e); };
            img.src = url;
        });
    };

    const drawPoster = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 1080;
        const height = 1440; // 3:4 Aspect Ratio
        canvas.width = width;
        canvas.height = height;

        // 1. Background Fill
        ctx.fillStyle = activeTemplate.bg;
        ctx.fillRect(0, 0, width, height);

        // 2. Main Image
        let mainImgHeight = 800;
        try {
            if (property.assets && property.assets.length > 0) {
                const url = await getAssetUrl(property.assets[0]);
                if (url) {
                    const img = await loadImage(url);
                    const scale = Math.max(width / img.width, mainImgHeight / img.height);
                    const x = (width - img.width * scale) / 2;
                    const y = (mainImgHeight - img.height * scale) / 2;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, width, mainImgHeight);
                    ctx.clip();
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    ctx.restore();
                }
            } else {
                const grad = ctx.createLinearGradient(0, 0, width, mainImgHeight);
                grad.addColorStop(0, activeTemplate.color);
                grad.addColorStop(1, '#000000');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, mainImgHeight);
            }
        } catch (e) {
            console.error("Image draw failed");
        }

        const grad = ctx.createLinearGradient(0, mainImgHeight - 200, 0, mainImgHeight);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, activeTemplate.id === 'luxury' ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, mainImgHeight - 200, width, 200);

        const cardY = mainImgHeight - 60;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = -10;
        
        ctx.fillStyle = activeTemplate.id === 'luxury' ? '#27272a' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, cardY + 40);
        ctx.arcTo(0, cardY, 40, cardY, 40);
        ctx.arcTo(width, cardY, width, cardY + 40, 40);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        let currentY = cardY + 80;
        ctx.fillStyle = activeTemplate.fontColor;
        ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const maxTitleWidth = showPrice ? width - 350 : width - 100;
        const words = customTitle.split('');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n];
            if (ctx.measureText(testLine).width > maxTitleWidth && n > 0) {
                ctx.fillText(line, 60, currentY);
                line = words[n];
                currentY += 90;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 60, currentY);
        
        if (showPrice) {
            const priceText = property.isSale ? `${property.salePrice}` : `${property.rentPrice}`;
            const unitText = property.isSale ? '万' : '元';
            
            ctx.textAlign = 'right';
            ctx.fillStyle = activeTemplate.color;
            ctx.font = 'bold 90px sans-serif';
            ctx.fillText(priceText, width - 60 - 60, cardY + 80); 
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText(unitText, width - 60, cardY + 125);
        }

        currentY += 100; 

        ctx.textAlign = 'left';
        ctx.fillStyle = activeTemplate.id === 'luxury' ? '#a1a1aa' : '#64748b';
        ctx.font = '40px sans-serif';
        const subTitle = `${property.layout}  |  ${property.area}㎡  |  ${property.orientation || '南北'}  |  ${property.floor}层`;
        ctx.fillText(subTitle, 60, currentY);

        currentY += 80;

        const features = (property.features || []).slice(0, 4);
        if (features.length === 0) features.push("优质房源", "诚意出售");
        
        let tagX = 60;
        features.forEach(tag => {
            ctx.font = '32px sans-serif';
            const tagW = ctx.measureText(tag).width + 40;
            if (tagX + tagW > width - 60) return;

            ctx.fillStyle = activeTemplate.id === 'luxury' ? '#3f3f46' : '#f1f5f9';
            if (activeTemplate.id === 'urgent') ctx.fillStyle = '#fee2e2';
            
            const r = 10, x = tagX, y = currentY, w = tagW, h = 60;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.fill();
            
            ctx.fillStyle = activeTemplate.id === 'luxury' ? '#fcd34d' : '#475569';
            if (activeTemplate.id === 'urgent') ctx.fillStyle = '#b91c1c';
            ctx.fillText(tag, tagX + 20, currentY + 14);
            tagX += tagW + 20;
        });

        const footerY = height - 220;
        ctx.beginPath();
        ctx.strokeStyle = activeTemplate.id === 'luxury' ? '#52525b' : '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.moveTo(60, footerY);
        ctx.lineTo(width - 60, footerY);
        ctx.stroke();

        if (showAgent) {
            const avatarY = footerY + 110;
            ctx.fillStyle = activeTemplate.color;
            ctx.beginPath();
            ctx.arc(120, avatarY, 70, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(settings.agentName?.charAt(0) || "顾", 120, avatarY);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = activeTemplate.fontColor;
            ctx.font = 'bold 50px sans-serif';
            ctx.fillText(settings.agentName || '置业顾问', 230, footerY + 50);
            
            ctx.fillStyle = activeTemplate.id === 'luxury' ? '#a1a1aa' : '#64748b';
            ctx.font = '40px sans-serif';
            ctx.fillText(settings.agentPhone || '138 0000 0000', 230, footerY + 120);
        }

        if (showQr) {
            const qrSize = 180;
            const qrX = width - 60 - qrSize;
            const qrY = footerY + 20;
            
            ctx.fillStyle = activeTemplate.id === 'luxury' ? '#3f3f46' : '#f8fafc';
            ctx.fillRect(qrX, qrY, qrSize, qrSize);
            
            ctx.strokeStyle = activeTemplate.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(qrX, qrY, qrSize, qrSize);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = activeTemplate.fontColor;
            ctx.font = 'bold 24px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText("长按识别", qrX + qrSize/2, qrY + qrSize/2);
        }
    };

    useEffect(() => {
        let active = true;
        const render = async () => {
            setGenerating(true);
            await new Promise(r => setTimeout(r, 50));
            try {
                if (active) await drawPoster();
            } catch (e) {
                console.error("Canvas draw error", e);
            } finally {
                if (active) setGenerating(false);
            }
        };
        render();
        return () => { active = false; };
    }, [activeTemplate, customTitle, showPrice, showAgent, showQr, property, settings]);

    const downloadImage = () => {
        if (!canvasRef.current) return;
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `海报_${property.garden}_${activeTemplate.id}.png`;
            link.href = dataUrl;
            link.click();
            showToast("海报已保存");
        } catch (e) { showToast("下载失败", "error"); }
    };

    const handlePublishH5 = async () => {
        setIsPublishing(true);
        try {
            // 模拟发布过程
            await new Promise(r => setTimeout(r, 1500));
            const mockUrl = `https://mh-pro.web.app/v/${property.id}?ref=${settings.agentPhone}`;
            setH5Url(mockUrl);
            showToast("H5 详情页发布成功！");
        } catch (e) {
            showToast("发布失败", "error");
        } finally {
            setIsPublishing(false);
        }
    }

    const copyText = () => {
        const urlPart = h5Url ? `\n\n查看详情：${h5Url}` : '';
        const text = `【${property.status==='active'?(property.isSale?'出售':'出租'):'已售'}】${property.garden} ${property.layout}\n价格：${property.isSale?property.salePrice+'万':property.rentPrice+'元'}\n面积：${property.area}㎡\n详情：${property.features?.join('，')}${urlPart}`;
        navigator.clipboard.writeText(text);
        showToast("推广文案已复制");
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700">
                
                {/* Left: Preview */}
                <div className="flex-1 bg-slate-200 dark:bg-black/40 relative flex items-center justify-center p-6 overflow-hidden">
                    <div className="h-full shadow-2xl rounded-lg overflow-hidden relative group">
                        {generating && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 z-20 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 size={40} className="animate-spin text-brand-600"/>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="h-full w-auto object-contain bg-white"/>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="w-full md:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2"><LayoutTemplate size={20} className="text-brand-600"/> 营销工作台</h3>
                        <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        
                        {/* H5 Link Display */}
                        {h5Url && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-xl animate-in slide-in-from-top-2">
                                <div className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1"><Globe size={12}/> H5 链接已就绪</div>
                                <div className="text-[10px] text-slate-500 break-all bg-white/50 p-2 rounded mb-2 font-mono">{h5Url}</div>
                                <button onClick={copyText} className="w-full bg-green-600 text-white text-xs py-1.5 rounded font-bold hover:bg-green-700 transition-colors">复制 H5 推广文案</button>
                            </div>
                        )}

                        {/* Templates */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-1"><Palette size={14}/> 风格模板</label>
                            <div className="grid grid-cols-3 gap-2">
                                {TEMPLATES.map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={()=>setActiveTemplate(t)}
                                        className={`p-2 rounded-lg border-2 text-xs font-bold transition-all ${activeTemplate.id === t.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <div className="w-full h-8 rounded mb-1" style={{background: t.id==='luxury'?'#000':t.id==='urgent'?'#fee2e2':'#fff', border: '1px solid #ddd'}}></div>
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Edit */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-1"><Type size={14}/> 标题内容</label>
                            <input 
                                className="w-full border rounded-lg p-2 text-sm bg-slate-50 dark:bg-slate-800 mb-2"
                                value={customTitle}
                                onChange={e=>setCustomTitle(e.target.value)}
                                placeholder="输入大标题"
                            />
                        </div>

                        {/* Toggles */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-1"><Settings2 size={14}/> 显示设置</label>
                            <div className="space-y-2">
                                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="text-sm">显示价格</span>
                                    <input type="checkbox" checked={showPrice} onChange={e=>setShowPrice(e.target.checked)} className="accent-brand-600"/>
                                </label>
                                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="text-sm">显示顾问信息</span>
                                    <input type="checkbox" checked={showAgent} onChange={e=>setShowAgent(e.target.checked)} className="accent-brand-600"/>
                                </label>
                                <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                    <span className="text-sm">包含 H5 留资二维码</span>
                                    <input type="checkbox" checked={showQr} onChange={e=>setShowQr(e.target.checked)} className="accent-brand-600"/>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-900">
                        <button 
                            onClick={handlePublishH5} 
                            disabled={isPublishing}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                        >
                            {isPublishing ? <Loader2 size={20} className="animate-spin"/> : <Globe size={20}/>}
                            生成 H5 详情页 (含获客追踪)
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={downloadImage} className="bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-95">
                                <Download size={18}/> 保存图片
                            </button>
                            <button onClick={copyText} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm hover:bg-slate-100 transition-colors">
                                <Copy size={18}/> 复制文案
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
