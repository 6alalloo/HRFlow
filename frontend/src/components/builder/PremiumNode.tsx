
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { 
    LuMail, 
    LuGlobe, 
    LuDatabase, 
    LuZap, 
    LuSplit, 
    LuClock, 
    LuFileJson 
} from 'react-icons/lu';
import clsx from 'clsx';

// Map node kinds to icons
const getIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
        case 'trigger': return <LuZap className="w-5 h-5 text-amber-400" />;
        case 'email': return <LuMail className="w-5 h-5 text-blue-400" />;
        case 'http': return <LuGlobe className="w-5 h-5 text-green-400" />;
        case 'condition': return <LuSplit className="w-5 h-5 text-purple-400" />;
        case 'database': return <LuDatabase className="w-5 h-5 text-rose-400" />;
        case 'wait': return <LuClock className="w-5 h-5 text-gray-400" />;
        default: return <LuFileJson className="w-5 h-5 text-cyan-400" />;
    }
}

const PremiumNode = ({ data, selected }: NodeProps) => {
    const { name, kind, config } = data;
    
    // Config summary generation (simple for now)
    const summary = React.useMemo(() => {
        if (!config) return "No configuration";
        if (kind === 'email') return `To: ${config.to || 'Undef'}`;
        if (kind === 'http') return `${config.method || 'GET'} ${config.url || ''}`;
        if (kind === 'condition') return `If ${config.field || '?'} ${config.operator || ''}`;
        return config.description || "Click to configure";
    }, [config, kind]);

    return (
        <div className={clsx(
            "relative group transition-all duration-300 min-w-[240px]",
            "rounded-xl bg-navy-900/90 backdrop-blur-md border-[1.5px]",
            selected ? "border-cyan-glow shadow-glow-md scale-105" : "border-white/10 hover:border-white/20 shadow-lg"
        )}>
            {/* Glow backing */}
            <div className={clsx(
                "absolute -inset-0.5 rounded-xl opacity-0 transition-opacity duration-300",
                selected ? "bg-cyan-glow/20 opacity-100 blur-sm" : "group-hover:opacity-30 bg-white/5"
            )} />

            <div className="relative p-4 flex flex-col gap-2 z-10">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                    <div className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10">
                        {getIcon(kind)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                            {kind}
                        </span>
                        <span className="text-sm font-bold text-white leading-tight">
                            {name || kind.charAt(0).toUpperCase() + kind.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="text-xs text-slate-400 font-mono bg-navy-950/50 rounded p-2 border border-white/5 truncate">
                    {summary}
                </div>
            </div>

            {/* Hidden Handles for connectivity */}
            <Handle type="target" position={Position.Left} className="opacity-0 w-2 h-2" />
            <Handle type="source" position={Position.Right} className="opacity-0 w-2 h-2" />
        </div>
    );
};

export default memo(PremiumNode);
