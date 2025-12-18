import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LuX, LuSave, LuTrash2 } from 'react-icons/lu';

type ConfigPanelProps = {
    isOpen: boolean;
    node: any; // Using any for now, ideally WorkflowGraphNode
    onClose: () => void;
    onUpdate: (id: number, config: any) => void;
    onDelete: (id: number) => void;
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, node, onClose, onUpdate, onDelete }) => {
    const [localConfig, setLocalConfig] = useState<any>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (node) {
            setLocalConfig(node.config || {});
        }
    }, [node]);

    const handleChange = (key: string, val: any) => {
        setLocalConfig((prev: any) => ({ ...prev, [key]: val }));
    };

    const handleSave = () => {
        if (node) {
            onUpdate(node.id, { config: localConfig });
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (node) {
            onDelete(node.id);
            onClose();
        }
        setShowDeleteConfirm(false);
    };

    if (!isOpen || !node) return null;

    return (
        <>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-4 top-4 bottom-4 w-[400px] bg-navy-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-white">{node.name || 'Configure Step'}</h2>
                        <span className="text-xs text-cyan-glow uppercase tracking-wider font-semibold">{node.kind}</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content (Form) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    
                    {/* Common Field: Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Step Name</label>
                        <input 
                            type="text" 
                            value={node.name || ''} 
                            onChange={(e) => onUpdate(node.id, { name: e.target.value })} 
                            className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                            placeholder={node.kind} // Use kind as placeholder/default visual
                        />
                    </div>

                    {/* Specific Forms */}
                    {node.kind === 'trigger' && (
                         <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">Employee Details</h3>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Employee Name</label>
                                <input 
                                    type="text" 
                                    value={localConfig.name || ''} 
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Employee Email</label>
                                <input 
                                    type="text" 
                                    value={localConfig.email || ''} 
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase">Department</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.department || ''} 
                                        onChange={(e) => handleChange('department', e.target.value)}
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase">Role</label>
                                    <input 
                                        type="text" 
                                        value={localConfig.role || ''} 
                                        onChange={(e) => handleChange('role', e.target.value)}
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                    />
                                </div>
                             </div>
                             
                             <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Start Date</label>
                                <input 
                                    type="date" 
                                    value={localConfig.startDate || ''} 
                                    onChange={(e) => handleChange('startDate', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                             <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Manager Email</label>
                                <input 
                                    type="text" 
                                    value={localConfig.managerEmail || ''} 
                                    onChange={(e) => handleChange('managerEmail', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                         </div>
                    )}

                    {node.kind === 'email' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">To Recipient</label>
                                <input 
                                    type="text" 
                                    value={localConfig.to || ''} 
                                    onChange={(e) => handleChange('to', e.target.value)}
                                    placeholder="e.g. employee@company.com"
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Subject</label>
                                <input 
                                    type="text" 
                                    value={localConfig.subject || ''} 
                                    onChange={(e) => handleChange('subject', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Body</label>
                                <textarea 
                                    rows={6}
                                    value={localConfig.body || ''} 
                                    onChange={(e) => handleChange('body', e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors resize-none"
                                />
                            </div>
                        </>
                    )}

                     {/* Fallback for others */}
                     {!['email', 'trigger'].includes(node.kind) && (
                         <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                            Specific form for <strong>{node.kind}</strong> coming soon. 
                            <br/>
                            <span className="text-xs opacity-70">JSON config is available in Advanced tab.</span>
                         </div>
                     )}

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/10 bg-transparent flex justify-between items-center gap-4">
                     <button 
                        onClick={handleDeleteClick}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                     >
                        <LuTrash2 className="w-4 h-4" />
                        Delete
                     </button>

                     <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-cyan-glow text-navy-950 hover:bg-white hover:scale-[1.02] transition-all shadow-glow-sm flex items-center justify-center gap-2">
                        <LuSave className="w-4 h-4" />
                        Save Changes
                     </button>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-white">Delete Step?</h3>
                        <p className="text-slate-300 text-sm">
                            Are you sure you want to delete this step? This action cannot be undone and will remove connected edges.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                Delete Step
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ConfigPanel;
