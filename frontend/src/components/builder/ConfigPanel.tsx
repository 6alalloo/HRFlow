import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LuX, LuSave } from 'react-icons/lu';

type ConfigPanelProps = {
    isOpen: boolean;
    node: any; // Using any for now, ideally WorkflowGraphNode
    onClose: () => void;
    onUpdate: (id: number, config: any) => void;
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, node, onClose, onUpdate }) => {
    const [localConfig, setLocalConfig] = useState<any>({});

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

    if (!isOpen || !node) return null;

    return (
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
                        // Actually better to keep local for everything
                        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
                    />
                </div>

                {/* Specific Forms Base on Kind */}
                {node.kind === 'email' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase">To Recipient</label>
                            <input 
                                type="text" 
                                value={localConfig.to || ''} 
                                onChange={(e) => handleChange('to', e.target.value)}
                                placeholder="e.g. {{trigger.email}}"
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
            <div className="p-5 border-t border-white/10 bg-navy-950 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                    Cancel
                </button>
                <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-bold bg-cyan-glow text-navy-950 hover:bg-white hover:scale-105 transition-all shadow-glow-sm flex items-center gap-2">
                    <LuSave className="w-4 h-4" />
                    Save Changes
                </button>
            </div>
        </motion.div>
    );
};

export default ConfigPanel;
