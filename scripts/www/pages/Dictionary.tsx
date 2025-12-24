
import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, MapPin, Plus, Trash2, Save, Upload, Building2, Zap, Droplets, Flame, ChevronRight, LayoutGrid, Edit2, X, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { GardenDetail, BuildingDetails, UnitDetails } from '../types';

// --- Extracted Components ---

const AssetPreview: React.FC<{ filename: string, onRemove: () => void, getAssetUrl: (f: string) => Promise<string | null> }> = ({ filename, onRemove, getAssetUrl }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => { getAssetUrl(filename).then(setUrl) }, [filename, getAssetUrl]);
    if (!url) return <div className="w-20 h-20 bg-slate-100 rounded animate-pulse"></div>;
    return (
        <div className="relative group w-20 h-20">
            <img src={url} className="w-full h-full object-cover rounded border border-slate-200"/>
            <button 
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Trash2 size={12}/>
            </button>
        </div>
    );
};

interface EditableListItemProps {
    name: string;
    type: 'garden'|'building'|'unit';
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    editingItem: {type: string, oldName: string} | null;
    startRename: (type: any, name: string) => void;
    confirmRename: () => void;
    cancelRename: () => void;
    renameValue: string;
    setRenameValue: (val: string) => void;
}

const EditableListItem: React.FC<EditableListItemProps> = ({ name, type, isSelected, onSelect, onDelete, editingItem, startRename, confirmRename, cancelRename, renameValue, setRenameValue }) => {
    const isEditing = editingItem?.type === type && editingItem.oldName === name;
    
    if (isEditing) {
        return (
            <div className="p-2 rounded bg-white dark:bg-slate-900 border border-brand-300 flex items-center gap-1 shadow-sm">
                <input autoFocus className="flex-1 bg-transparent outline-none text-sm min-w-0" value={renameValue} onChange={e=>setRenameValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') confirmRename(); if(e.key==='Escape') cancelRename();}}/>
                <button onClick={confirmRename} className="text-green-600 hover:bg-green-50 rounded p-1"><Check size={14}/></button>
                <button onClick={cancelRename} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={14}/></button>
            </div>
        )
    }

    return (
        <div onClick={onSelect} className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center group ${isSelected ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="truncate">{name}</span>
             <div className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                 <button onClick={(e)=>{e.stopPropagation(); startRename(type, name)}} className={`p-1 rounded ${isSelected?'hover:bg-brand-700 text-white':'hover:bg-slate-200 text-slate-400'}`}><Edit2 size={12}/></button>
                 <button onClick={(e)=>{e.stopPropagation(); onDelete()}} className={`p-1 rounded ${isSelected?'hover:bg-brand-700 text-white':'hover:bg-red-100 text-slate-400 hover:text-red-600'}`}><Trash2 size={12}/></button>
                 {isSelected && <ChevronRight size={14}/>}
             </div>
        </div>
    );
};

// --- Main Component ---

export const Dictionary = () => {
  const { settings, updateSettings, uploadAsset, getAssetUrl, showToast } = useStore();
  
  const [selectedGarden, setSelectedGarden] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitDetails | null>(null);

  const [gardenEdit, setGardenEdit] = useState<GardenDetail>({});
  const [buildingEdit, setBuildingEdit] = useState<BuildingDetails>({});
  const [unitEdit, setUnitEdit] = useState<UnitDetails>({ name: '' });
  const [isDirty, setIsDirty] = useState(false); 
  
  const fileRef = useRef<HTMLInputElement>(null);
  const [newGardenName, setNewGardenName] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  
  const [batchUnitStart, setBatchUnitStart] = useState('');
  const [batchUnitEnd, setBatchUnitEnd] = useState('');
  const [batchUnitSuffix, setBatchUnitSuffix] = useState(''); 
  const [skipFour, setSkipFour] = useState(false);

  const [editingItem, setEditingItem] = useState<{type: 'garden'|'building'|'unit', oldName: string} | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isDirty) {
              e.preventDefault();
              e.returnValue = ''; 
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
     if (selectedGarden) {
         setGardenEdit(settings.gardenDetails?.[selectedGarden] || {});
         setSelectedBuilding(null);
         setSelectedUnit(null);
         setIsDirty(false);
     }
  }, [selectedGarden, settings.gardenDetails]);

  useEffect(() => {
      if (selectedGarden && selectedBuilding) {
          const bData = settings.buildingDict?.[selectedGarden]?.[selectedBuilding] || {};
          setBuildingEdit(bData);
          setSelectedUnit(null);
          setIsDirty(false);
      }
  }, [selectedGarden, selectedBuilding, settings.buildingDict]);

  useEffect(() => {
      if (selectedUnit) {
          setUnitEdit(selectedUnit);
          setIsDirty(false);
      }
  }, [selectedUnit]);

  const updateGardenEdit = (field: keyof GardenDetail, val: any) => {
      setGardenEdit(prev => ({...prev, [field]: val}));
      setIsDirty(true);
  };

  const updateBuildingEdit = (field: keyof BuildingDetails, val: any) => {
      setBuildingEdit(prev => ({...prev, [field]: val}));
      setIsDirty(true);
  };

  const updateUnitEdit = (field: keyof UnitDetails, val: any) => {
      setUnitEdit(prev => ({...prev, [field]: val}));
      setIsDirty(true);
  };

  const handleSelectGarden = (g: string) => {
      if (isDirty && !confirm("当前有未保存的修改，切换将丢失进度。确认切换吗？")) return;
      setSelectedGarden(g);
  };

  const handleSelectBuilding = (b: string) => {
      if (isDirty && !confirm("当前有未保存的修改，切换将丢失进度。确认切换吗？")) return;
      setSelectedBuilding(b);
  };

  const handleSelectUnit = (u: UnitDetails) => {
      if (isDirty && !confirm("当前有未保存的修改，切换将丢失进度。确认切换吗？")) return;
      setSelectedUnit(u);
  };

  const handleSaveGarden = async () => {
     if (!selectedGarden) return;
     const newDetails = { ...settings.gardenDetails, [selectedGarden]: gardenEdit };
     await updateSettings({ gardenDetails: newDetails });
     setIsDirty(false);
     showToast("小区信息已保存");
  };

  const handleSaveBuilding = async () => {
     if (!selectedGarden || !selectedBuilding) return;
     const gardenDict = settings.buildingDict?.[selectedGarden] || {};
     const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: buildingEdit
         }
     };
     await updateSettings({ buildingDict: newBuildingDict });
     setIsDirty(false);
     showToast("分区信息已保存");
  };
  
  const handleSaveUnit = async () => {
      if (!selectedGarden || !selectedBuilding || !unitEdit.name) return;
      const currentUnits = buildingEdit.units || [];
      const exists = currentUnits.find(u => u.name === unitEdit.name);
      let newUnits;
      if (exists) {
          newUnits = currentUnits.map(u => u.name === unitEdit.name ? unitEdit : u);
      } else {
          newUnits = [...currentUnits, unitEdit];
      }
      
      const newBData = { ...buildingEdit, units: newUnits };
      setBuildingEdit(newBData); 
      
      const gardenDict = settings.buildingDict?.[selectedGarden] || {};
      const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: newBData
         }
      };
      await updateSettings({ buildingDict: newBuildingDict });
      setIsDirty(false);
      showToast("栋座信息已保存");
  };

  const handleAddGarden = async () => {
      if (!newGardenName.trim()) return;
      if (settings.gardenData[newGardenName]) { showToast("小区已存在", 'error'); return; }
      if (isDirty && !confirm("当前有未保存的修改，确认添加新小区吗？")) return;

      const current = { ...settings.gardenData };
      current[newGardenName] = [];
      
      await updateSettings({ gardenData: current });
      setNewGardenName('');
      setIsDirty(false);
      setSelectedGarden(newGardenName);
      showToast("小区已添加");
  };

  const handleAddBuilding = async () => {
      if (!selectedGarden || !newBuildingName.trim()) return;
      const currentBuildings = settings.gardenData[selectedGarden] || [];
      if (currentBuildings.includes(newBuildingName)) { showToast("分区已存在", 'error'); return; }
      if (isDirty && !confirm("当前有未保存的修改，确认添加新分区吗？")) return;

      const newBuildings = [...currentBuildings, newBuildingName];
      const newGardenData = { ...settings.gardenData, [selectedGarden]: newBuildings };
      
      await updateSettings({ gardenData: newGardenData });
      setNewBuildingName('');
      setIsDirty(false);
      showToast("分区已添加");
  };

  const handleAddUnit = async () => {
      if (!selectedGarden || !selectedBuilding || !newUnitName.trim()) return;
      const name = newUnitName.trim();
      const currentUnits = buildingEdit.units || [];
      if (currentUnits.find(u => u.name === name)) {
          showToast("栋座已存在", 'error');
          return;
      }
      
      const newUnits = [...currentUnits, { name }];
      const newBData = { ...buildingEdit, units: newUnits };
      setBuildingEdit(newBData);
      
      const gardenDict = settings.buildingDict?.[selectedGarden] || {};
      const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: newBData
         }
      };
      await updateSettings({ buildingDict: newBuildingDict });
      setNewUnitName('');
      showToast("栋座已添加");
  };

  const handleAddBatchUnits = async () => {
      if (!selectedGarden || !selectedBuilding || !batchUnitStart.trim() || !batchUnitEnd.trim()) return;
      
      const unitsToAdd: string[] = [];
      const startStr = batchUnitStart.trim();
      const endStr = batchUnitEnd.trim();
      const suffix = batchUnitSuffix.trim();

      if (/^\d+$/.test(startStr) && /^\d+$/.test(endStr)) {
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (start <= end) {
              for (let i = start; i <= end; i++) {
                  if (skipFour && i.toString().includes('4')) continue;
                  unitsToAdd.push(i.toString() + suffix);
              }
          }
      } else {
           const startCode = startStr.toUpperCase().charCodeAt(0);
           const endCode = endStr.toUpperCase().charCodeAt(0);
           if (startStr.length === 1 && endStr.length === 1 && startCode <= endCode) {
               for (let i = startCode; i <= endCode; i++) {
                  if (skipFour && String.fromCharCode(i).includes('4')) continue;
                  unitsToAdd.push(String.fromCharCode(i) + suffix);
               }
           } else {
               showToast("仅支持纯数字或单字母范围", "error");
               return;
           }
      }
      
      const currentUnits = buildingEdit.units || [];
      const newUnitList = [...currentUnits];
      let addedCount = 0;

      for (const name of unitsToAdd) {
          if (newUnitList.find(u => u.name === name)) continue;
          newUnitList.push({ name });
          addedCount++;
      }

      if (addedCount === 0) {
           showToast("没有添加任何新栋座", 'info');
           return;
      }
      
      const newBData = { ...buildingEdit, units: newUnitList };
      setBuildingEdit(newBData);
      
      const gardenDict = settings.buildingDict?.[selectedGarden] || {};
      const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: newBData
         }
      };
      await updateSettings({ buildingDict: newBuildingDict });
      setBatchUnitStart('');
      setBatchUnitEnd('');
      showToast(`已批量添加 ${addedCount} 个栋座`);
  };

  const startRename = (type: 'garden'|'building'|'unit', oldName: string) => {
      setEditingItem({ type, oldName });
      setRenameValue(oldName);
  };

  const cancelRename = () => {
      setEditingItem(null);
      setRenameValue('');
  };

  const confirmRename = async () => {
      if (!editingItem || !renameValue.trim() || renameValue === editingItem.oldName) {
          cancelRename();
          return;
      }
      const { type, oldName } = editingItem;
      const newName = renameValue.trim();

      if (type === 'garden') {
          if (settings.gardenData[newName]) { showToast('该小区名已存在', 'error'); return; }
          const newGardenData = { ...settings.gardenData };
          newGardenData[newName] = newGardenData[oldName];
          delete newGardenData[oldName];

          const newDetails = { ...settings.gardenDetails };
          if (newDetails[oldName]) {
              newDetails[newName] = newDetails[oldName];
              delete newDetails[oldName];
          }

          const newBuildingDict = { ...settings.buildingDict };
          if (newBuildingDict[oldName]) {
              newBuildingDict[newName] = newBuildingDict[oldName];
              delete newBuildingDict[oldName];
          }

          await updateSettings({ gardenData: newGardenData, gardenDetails: newDetails, buildingDict: newBuildingDict });
          if (selectedGarden === oldName) setSelectedGarden(newName);
      } else if (type === 'building' && selectedGarden) {
          const buildings = settings.gardenData[selectedGarden];
          if (buildings.includes(newName)) { showToast('该分区名已存在', 'error'); return; }
          
          const newBuildings = buildings.map(b => b === oldName ? newName : b);
          const newGardenData = { ...settings.gardenData, [selectedGarden]: newBuildings };

          const gardenDict = settings.buildingDict?.[selectedGarden] || {};
          const newGardenDict = { ...gardenDict };
          if (newGardenDict[oldName]) {
              newGardenDict[newName] = newGardenDict[oldName];
              delete newGardenDict[oldName];
          }
          const newBuildingDict = { ...settings.buildingDict, [selectedGarden]: newGardenDict };

          await updateSettings({ gardenData: newGardenData, buildingDict: newBuildingDict });
          if (selectedBuilding === oldName) setSelectedBuilding(newName);
      } else if (type === 'unit' && selectedGarden && selectedBuilding) {
          const currentUnits = buildingEdit.units || [];
          if (currentUnits.find(u => u.name === newName)) { showToast('该栋座名已存在', 'error'); return; }
          
          const newUnits = currentUnits.map(u => u.name === oldName ? { ...u, name: newName } : u);
          const newBData = { ...buildingEdit, units: newUnits };
          setBuildingEdit(newBData);
          
          const gardenDict = settings.buildingDict?.[selectedGarden] || {};
          const newBuildingDict = { ...settings.buildingDict, [selectedGarden]: { ...gardenDict, [selectedBuilding]: newBData } };
          
          await updateSettings({ buildingDict: newBuildingDict });
          if (selectedUnit?.name === oldName) setSelectedUnit({ ...selectedUnit, name: newName });
      }
      
      cancelRename();
      showToast("重命名成功");
  };

  const deleteGarden = async (name: string) => {
      if(!confirm(`确定删除小区 ${name} 及其所有数据吗？`)) return;
      const newData = { ...settings.gardenData };
      delete newData[name];
      await updateSettings({ gardenData: newData });
      if (selectedGarden === name) setSelectedGarden(null);
  };

  const deleteBuilding = async (name: string) => {
      if(!selectedGarden || !confirm(`确定删除分区 ${name} 吗？`)) return;
      const newBuildings = settings.gardenData[selectedGarden].filter(b => b !== name);
      const newGardenData = { ...settings.gardenData, [selectedGarden]: newBuildings };
      await updateSettings({ gardenData: newGardenData });
      if (selectedBuilding === name) setSelectedBuilding(null);
  };
  
  const deleteUnit = async (name: string) => {
      if(!selectedGarden || !selectedBuilding || !confirm(`确定删除栋座 ${name} 吗？`)) return;
      const newUnits = (buildingEdit.units || []).filter(u => u.name !== name);
      const newBData = { ...buildingEdit, units: newUnits };
      setBuildingEdit(newBData);
      
      const gardenDict = settings.buildingDict?.[selectedGarden] || {};
      const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: newBData
         }
      };
      await updateSettings({ buildingDict: newBuildingDict });
      if (selectedUnit?.name === name) setSelectedUnit(null);
  };
  
  const handleClearUnits = async () => {
      if (!selectedGarden || !selectedBuilding) return;
      if (!confirm(`警告：确定清空【${selectedBuilding}】的所有栋座数据吗？此操作无法撤销。`)) return;
      
      const newBData = { ...buildingEdit, units: [] };
      setBuildingEdit(newBData);
      
      const gardenDict = settings.buildingDict?.[selectedGarden] || {};
      const newBuildingDict = {
         ...settings.buildingDict,
         [selectedGarden]: {
             ...gardenDict,
             [selectedBuilding]: newBData
         }
      };
      await updateSettings({ buildingDict: newBuildingDict });
      setSelectedUnit(null);
      showToast("已清空所有栋座");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedGarden || !e.target.files?.[0]) return;
      const filename = await uploadAsset(`garden_${selectedGarden}`, e.target.files[0]);
      if (filename) {
          const newImages = [...(gardenEdit.images || []), filename];
          setGardenEdit(prev => ({ ...prev, images: newImages }));
          setIsDirty(true); 
      }
  };

  return (
    <div className="h-full flex flex-col fade-in pb-10">
       <div className="flex justify-between items-center mb-4">
           <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="text-brand-600"/> 楼盘字典 Pro</h1>
           <div className="text-sm text-slate-500">层级结构: 小区 &gt; 分区 &gt; 栋座</div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[350px] md:h-[40vh] mb-4 shrink-0 transition-all">
           <div className="bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shadow-sm h-full overflow-hidden">
               <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 font-bold text-sm flex justify-between items-center">
                   <span>1. 选择小区</span>
                   <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600">{Object.keys(settings.gardenData).length}</span>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                   {Object.keys(settings.gardenData).map(g => (
                       <EditableListItem 
                            key={g} 
                            name={g} 
                            type="garden" 
                            isSelected={selectedGarden === g} 
                            onSelect={()=>handleSelectGarden(g)} 
                            onDelete={()=>deleteGarden(g)}
                            editingItem={editingItem}
                            startRename={startRename}
                            confirmRename={confirmRename}
                            cancelRename={cancelRename}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                       />
                   ))}
               </div>
               <div className="p-2 border-t flex gap-2 shrink-0">
                   <input 
                       className="flex-1 border rounded px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-brand-500" 
                       placeholder="新小区名称 (回车)" 
                       value={newGardenName} 
                       onChange={e=>setNewGardenName(e.target.value)}
                       onKeyDown={e=>{if(e.key==='Enter') handleAddGarden()}}
                   />
                   <button onClick={handleAddGarden} className="bg-brand-600 text-white p-1 rounded hover:bg-brand-700"><Plus size={16}/></button>
               </div>
           </div>

           <div className="bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shadow-sm h-full overflow-hidden">
               <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 font-bold text-sm flex justify-between items-center">
                   <span>2. 选择分区</span>
                   {selectedGarden && <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600">{settings.gardenData[selectedGarden]?.length || 0}</span>}
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                   {!selectedGarden ? <div className="text-center text-slate-400 text-xs mt-10">请先选择小区</div> : 
                    (settings.gardenData[selectedGarden] || []).map(b => (
                       <EditableListItem 
                            key={b} 
                            name={b} 
                            type="building" 
                            isSelected={selectedBuilding === b} 
                            onSelect={()=>handleSelectBuilding(b)} 
                            onDelete={()=>deleteBuilding(b)}
                            editingItem={editingItem}
                            startRename={startRename}
                            confirmRename={confirmRename}
                            cancelRename={cancelRename}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                       />
                   ))}
               </div>
               {selectedGarden && (
                   <div className="p-2 border-t flex gap-2 shrink-0">
                       <input 
                           className="flex-1 border rounded px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-brand-500" 
                           placeholder="新分区 (回车)" 
                           value={newBuildingName} 
                           onChange={e=>setNewBuildingName(e.target.value)}
                           onKeyDown={e=>{if(e.key==='Enter') handleAddBuilding()}}
                       />
                       <button onClick={handleAddBuilding} className="bg-brand-600 text-white p-1 rounded hover:bg-brand-700"><Plus size={16}/></button>
                   </div>
               )}
           </div>

           <div className="bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shadow-sm h-full overflow-hidden">
               <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 font-bold text-sm flex justify-between items-center">
                   <span>3. 选择栋座</span>
                   <div className="flex items-center gap-2">
                        {selectedBuilding && (
                            <button onClick={handleClearUnits} className="text-slate-400 hover:text-red-500" title="清空所有栋座"><Trash2 size={14}/></button>
                        )}
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600">{buildingEdit.units?.length || 0}</span>
                   </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                   {!selectedBuilding ? <div className="text-center text-slate-400 text-xs mt-10">请先选择分区</div> : 
                    (buildingEdit.units || []).map(u => (
                       <EditableListItem 
                            key={u.name} 
                            name={u.name} 
                            type="unit" 
                            isSelected={selectedUnit?.name === u.name} 
                            onSelect={()=>handleSelectUnit(u)} 
                            onDelete={()=>deleteUnit(u.name)}
                            editingItem={editingItem}
                            startRename={startRename}
                            confirmRename={confirmRename}
                            cancelRename={cancelRename}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                       />
                   ))}
               </div>
               {selectedBuilding && (
                   <div className="p-2 border-t flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                       <div className="flex gap-2">
                           <input 
                               className="flex-1 border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-brand-500" 
                               placeholder="新增栋座 (如: 1栋)" 
                               value={newUnitName} 
                               onChange={e=>setNewUnitName(e.target.value)}
                               onKeyDown={e=>{if(e.key==='Enter') handleAddUnit()}}
                           />
                           <button onClick={handleAddUnit} className="bg-brand-600 text-white p-1 rounded hover:bg-brand-700 w-8 flex items-center justify-center"><Plus size={16}/></button>
                       </div>

                       <div className="text-[10px] text-slate-400 text-center -my-1 scale-90">或批量生成</div>

                       <div className="flex items-center gap-1">
                            <input className="w-10 border rounded px-1 py-1 text-xs text-center bg-white dark:bg-slate-900" placeholder="1" value={batchUnitStart} onChange={e=>setBatchUnitStart(e.target.value)}/>
                            <span className="text-slate-400">-</span>
                            <input className="w-10 border rounded px-1 py-1 text-xs text-center bg-white dark:bg-slate-900" placeholder="10" value={batchUnitEnd} onChange={e=>setBatchUnitEnd(e.target.value)}/>
                            <input className="w-12 border rounded px-1 py-1 text-xs text-center bg-white dark:bg-slate-900" placeholder="座" value={batchUnitSuffix} onChange={e=>setBatchUnitSuffix(e.target.value)}/>
                            <button onClick={handleAddBatchUnits} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-1 rounded flex-1 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600">批量</button>
                       </div>
                       <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:text-brand-600">
                           <input type="checkbox" checked={skipFour} onChange={e=>setSkipFour(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"/>
                           <span>跳过含4</span>
                       </label>
                   </div>
               )}
           </div>
       </div>

       <div className="bg-bg-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex-1 p-6 relative overflow-y-auto min-h-[400px]">
           {!selectedGarden && (
               <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-50/50">
                   <div className="text-center"><BookOpen size={48} className="mx-auto mb-2 opacity-20"/>请从上方选择层级进行编辑</div>
               </div>
           )}

           {selectedGarden && !selectedBuilding && !selectedUnit && (
               <div className="animate-in fade-in slide-in-from-bottom-4">
                   <div className="flex justify-between items-center mb-6 border-b pb-4">
                       <h2 className="text-xl font-bold flex items-center gap-2"><MapPin className="text-brand-600"/> {selectedGarden} <span className="text-sm font-normal text-slate-500">小区详情配置</span></h2>
                       <div className="flex gap-3">
                           <button onClick={()=>deleteGarden(selectedGarden)} className="text-red-500 px-3 py-1.5 rounded hover:bg-red-50 text-sm font-bold flex items-center gap-1"><Trash2 size={16}/> 删除小区</button>
                           <button onClick={handleSaveGarden} className={`bg-brand-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 hover:bg-brand-700 transition-all ${isDirty?'animate-pulse shadow-lg shadow-brand-500/30':''}`}><Save size={16}/> {isDirty ? '保存 (未保存)' : '保存更改'}</button>
                       </div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                           <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-600">教育配套</label>
                               <div className="flex gap-2">
                                   <input className="flex-1 border p-2 rounded text-sm" placeholder="对口小学" value={gardenEdit.schoolPrimary||''} onChange={e=>updateGardenEdit('schoolPrimary', e.target.value)}/>
                                   <input className="flex-1 border p-2 rounded text-sm" placeholder="对口中学" value={gardenEdit.schoolMiddle||''} onChange={e=>updateGardenEdit('schoolMiddle', e.target.value)}/>
                               </div>
                           </div>
                           <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-600">基本设施</label>
                               <div className="flex gap-2">
                                   <input className="flex-1 border p-2 rounded text-sm" placeholder="物业费 (默认)" value={gardenEdit.propertyFee||''} onChange={e=>updateGardenEdit('propertyFee', e.target.value)}/>
                                   <input className="flex-1 border p-2 rounded text-sm" placeholder="停车费/车位情况" value={gardenEdit.parkingInfo||''} onChange={e=>updateGardenEdit('parkingInfo', e.target.value)}/>
                               </div>
                           </div>
                       </div>
                       <div className="space-y-2">
                           <label className="text-sm font-bold text-slate-600">小区相册</label>
                           <div className="flex gap-2 flex-wrap">
                               {gardenEdit.images?.map((img, i) => (
                                   <AssetPreview 
                                     key={i} 
                                     filename={img} 
                                     onRemove={() => {
                                        const newImages = gardenEdit.images?.filter(x => x !== img);
                                        setGardenEdit({ ...gardenEdit, images: newImages });
                                        setIsDirty(true);
                                     }}
                                     getAssetUrl={getAssetUrl}
                                   />
                               ))}
                               <button onClick={()=>fileRef.current?.click()} className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center text-slate-400 hover:text-brand-600 hover:border-brand-500">
                                   <Upload size={20}/><span className="text-[10px]">上传</span>
                               </button>
                               <input type="file" ref={fileRef} hidden accept="image/*" onChange={handleUpload}/>
                           </div>
                       </div>
                   </div>
               </div>
           )}

           {selectedGarden && selectedBuilding && !selectedUnit && (
               <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                       <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="text-orange-500"/> {selectedBuilding} <span className="text-sm font-normal text-slate-500">分区基础配置</span></h2>
                       <div className="flex gap-3">
                           <button onClick={()=>deleteBuilding(selectedBuilding)} className="text-red-500 px-3 py-1.5 rounded hover:bg-red-50 text-sm font-bold flex items-center gap-1"><Trash2 size={16}/> 删除分区</button>
                           <button onClick={handleSaveBuilding} className={`bg-brand-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 hover:bg-brand-700 transition-all ${isDirty?'animate-pulse shadow-lg shadow-brand-500/30':''}`}><Save size={16}/> {isDirty ? '保存 (未保存)' : '保存更改'}</button>
                       </div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-8">
                       <div className="space-y-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                           <h3 className="font-bold text-sm text-slate-500">基础属性</h3>
                           <div className="grid grid-cols-2 gap-4">
                               <label className="text-xs font-bold">建成年代 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder="YYYY" value={buildingEdit.yearBuilt||''} onChange={e=>updateBuildingEdit('yearBuilt', e.target.value)}/></label>
                               <label className="text-xs font-bold">总楼层 <input type="number" className="w-full border p-2 rounded mt-1 bg-white" value={buildingEdit.totalFloors||''} onChange={e=>updateBuildingEdit('totalFloors', Number(e.target.value))}/></label>
                               <label className="text-xs font-bold">电梯 <select className="w-full border p-2 rounded mt-1 bg-white" value={buildingEdit.hasElevator?'yes':'no'} onChange={e=>updateBuildingEdit('hasElevator', e.target.value==='yes')}><option value="yes">有</option><option value="no">无</option></select></label>
                               <label className="text-xs font-bold">默认朝向 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder="如: 南" value={buildingEdit.orientation||''} onChange={e=>updateBuildingEdit('orientation', e.target.value)}/></label>
                               <label className="text-xs font-bold col-span-2">物业费 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder="如: 2.8元/平/月" value={buildingEdit.propertyFee||''} onChange={e=>updateBuildingEdit('propertyFee', e.target.value)}/></label>
                           </div>
                       </div>
                       <div className="space-y-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                           <h3 className="font-bold text-sm text-slate-500">水电煤配置 (默认)</h3>
                           <div className="grid grid-cols-3 gap-2">
                               <div className="space-y-1"><div className="flex items-center gap-2 text-xs font-bold"><Droplets size={12} className="text-blue-500"/> 水费</div><select className="w-full border p-1 rounded text-xs" value={buildingEdit.waterType||'civil'} onChange={e=>updateBuildingEdit('waterType', e.target.value as any)}><option value="civil">民用</option><option value="commercial">商用</option></select><input className="w-full border p-1 rounded text-xs" placeholder="元/吨" type="number" value={buildingEdit.waterPrice||''} onChange={e=>updateBuildingEdit('waterPrice', Number(e.target.value))}/></div>
                               <div className="space-y-1"><div className="flex items-center gap-2 text-xs font-bold"><Zap size={12} className="text-yellow-500"/> 电费</div><select className="w-full border p-1 rounded text-xs" value={buildingEdit.elecType||'civil'} onChange={e=>updateBuildingEdit('elecType', e.target.value as any)}><option value="civil">民用</option><option value="commercial">商用</option></select><input className="w-full border p-1 rounded text-xs" placeholder="元/度" type="number" value={buildingEdit.elecPrice||''} onChange={e=>updateBuildingEdit('elecPrice', Number(e.target.value))}/></div>
                               <div className="space-y-1"><div className="flex items-center gap-2 text-xs font-bold"><Flame size={12} className="text-orange-500"/> 煤气</div><select className="w-full border p-1 rounded text-xs" value={buildingEdit.gasType||'none'} onChange={e=>updateBuildingEdit('gasType', e.target.value as any)}><option value="natural">天然气</option><option value="liquefied">液化气</option><option value="none">无</option></select><input className="w-full border p-1 rounded text-xs" placeholder="元/方" type="number" value={buildingEdit.gasPrice||''} onChange={e=>updateBuildingEdit('gasPrice', Number(e.target.value))}/></div>
                           </div>
                       </div>
                   </div>
               </div>
           )}

           {selectedUnit && (
               <div className="animate-in fade-in slide-in-from-bottom-4">
                   <div className="flex justify-between items-center mb-6 border-b pb-4">
                       <h2 className="text-xl font-bold flex items-center gap-2"><LayoutGrid className="text-purple-500"/> {selectedUnit.name} <span className="text-sm font-normal text-slate-500">栋座独立配置</span></h2>
                       <button onClick={handleSaveUnit} className={`bg-brand-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 hover:bg-brand-700 transition-all ${isDirty?'animate-pulse shadow-lg shadow-brand-500/30':''}`}><Save size={16}/> {isDirty ? '保存 (未保存)' : '保存栋座'}</button>
                   </div>
                   
                   <div className="p-4 bg-purple-50 dark:bg-slate-800 rounded-xl mb-6">
                       <h3 className="font-bold text-sm text-slate-600 mb-2">基础覆盖</h3>
                       <div className="grid grid-cols-2 gap-4">
                            <label className="text-xs font-bold">特定朝向 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder={`默认: ${buildingEdit.orientation||'未设置'}`} value={unitEdit.orientation||''} onChange={e=>updateUnitEdit('orientation', e.target.value)}/></label>
                            <label className="text-xs font-bold">物业费 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder={`默认: ${buildingEdit.propertyFee||'未设置'}`} value={unitEdit.propertyFee||''} onChange={e=>updateUnitEdit('propertyFee', e.target.value)}/></label>
                            <label className="text-xs font-bold col-span-2">特殊备注 <input className="w-full border p-2 rounded mt-1 bg-white" placeholder="如: 靠近马路" value={unitEdit.remark||''} onChange={e=>updateUnitEdit('remark', e.target.value)}/></label>
                       </div>
                   </div>

                   <div className="p-4 border border-slate-200 rounded-xl">
                       <h3 className="font-bold text-sm text-slate-600 mb-2">水电煤特殊设定 (留空则继承分区)</h3>
                       <div className="grid grid-cols-3 gap-6">
                           <div><label className="text-xs font-bold block mb-1">水费单价</label><input type="number" className="w-full border p-2 rounded" placeholder={buildingEdit.waterPrice ? `继承: ${buildingEdit.waterPrice}` : '无默认值'} value={unitEdit.waterPrice||''} onChange={e=>updateUnitEdit('waterPrice', Number(e.target.value))}/></div>
                           <div><label className="text-xs font-bold block mb-1">电费单价</label><input type="number" className="w-full border p-2 rounded" placeholder={buildingEdit.elecPrice ? `继承: ${buildingEdit.elecPrice}` : '无默认值'} value={unitEdit.elecPrice||''} onChange={e=>updateUnitEdit('elecPrice', Number(e.target.value))}/></div>
                           <div><label className="text-xs font-bold block mb-1">煤气单价</label><input type="number" className="w-full border p-2 rounded" placeholder={buildingEdit.gasPrice ? `继承: ${buildingEdit.gasPrice}` : '无默认值'} value={unitEdit.gasPrice||''} onChange={e=>updateUnitEdit('gasPrice', Number(e.target.value))}/></div>
                       </div>
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};
