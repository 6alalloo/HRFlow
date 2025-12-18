import React from 'react';
import { 
    LuMail, LuGlobe, LuSplit, LuDatabase, LuClock, LuCode, LuX, LuFileText, LuZap
} from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';

type NodePickerProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (kind: string) => void;
    position?: { x: number; y: number } | null;
};

const NODE_TYPES = [
    { kind: 'trigger', label: 'Trigger', icon: LuZap, color: 'text-yellow-400' },
    { kind: 'cv_parser', label: 'CV Parser', icon: LuFileText, color: 'text-indigo-400' },
    { kind: 'email', label: 'Send Email', icon: LuMail, color: 'text-blue-400' },
    { kind: 'http', label: 'HTTP Request', icon: LuGlobe, color: 'text-green-400' },
    { kind: 'condition', label: 'Condition', icon: LuSplit, color: 'text-purple-400' },
    { kind: 'database', label: 'Database', icon: LuDatabase, color: 'text-rose-400' },
    { kind: 'wait', label: 'Delay / Wait', icon: LuClock, color: 'text-amber-400' },
    { kind: 'script', label: 'Run Script', icon: LuCode, color: 'text-cyan-400' },
];

const NodePicker: React.FC<NodePickerProps> = ({ isOpen, onClose, onSelect, position }) => {
    if (!isOpen) return null;

    // Default to center if no position provided
    const style = position 
        ? { position: 'absolute' as const, left: position.x, top: position.y, transform: 'translate(20px, -50%)' }
        : {};

    const containerClasses = position
        ? "z-50 w-[300px] overflow-hidden" 
        : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";

    const content = (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-[300px] overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={position ? style : {}}
        >
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Add Step</span>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <LuX />
                </button>
            </div>
            
            <div className="p-2 grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {NODE_TYPES.map(t => (
                    <button
                        key={t.kind}
                        onClick={() => onSelect(t.kind)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-all group w-full text-left"
                    >
                        <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${t.color}`}>
                            <t.icon className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-200 group-hover:text-white">{t.label}</span>
                    </button>
                ))}
            </div>
        </motion.div>
    );

    return (
        <AnimatePresence>
            {position ? (
                // Floating Popover Mode (Render directly, maybe inside a portal or just absolute in parent)
                // We'll wrap in a generic div for positioning context if needed, but 'style' handles it.
                // Note: If using absolute positioning inside ReactFlow, ensure parent has relative.
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
                     <div className="pointer-events-auto">
                        {content}
                     </div>
                     {/* Backdrop to close on click outside */}
                     <div className="absolute inset-0 z-40" onClick={onClose} />
                </div>
            ) : (
                // Modal Mode
                <div className={containerClasses} onClick={onClose}>
                    {content}
                </div>
            )}
        </AnimatePresence>
    );
};

export default NodePicker;
