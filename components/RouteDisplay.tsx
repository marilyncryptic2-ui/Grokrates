import React from 'react';
import type { RouteResult } from '../lib/strategies/route';

interface Props {
  route: RouteResult;
}

export const RouteDisplay: React.FC<Props> = ({ route }) => {
  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-xl">
      {/* Route Header Stats */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {route.group ? `${route.group} Optimal Route` : "Optimal Multi-Venue Route"}
          </h3>
          <div className="text-3xl font-extrabold text-emerald-400">
            {route.netApy.toFixed(2)}% <span className="text-sm font-normal text-slate-300">NET APY</span>
          </div>
        </div>
        
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs text-slate-400">Effective Leverage</div>
            <div className="text-lg font-bold text-slate-200">
              {route.netLeverage ? `${route.netLeverage.toFixed(2)}x` : "1.00x"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Route Capital</div>
            <div className="text-sm font-mono font-semibold text-slate-200 mt-1">
              ${(route.principalUsd || 10000).toLocaleString()} USD
            </div>
          </div>
        </div>
      </div>

      {/* Execution Route Step Flow */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Multi-Venue Execution Path
        </h4>
        
        {route.steps && route.steps.length > 0 ? (
          route.steps.map((step, idx) => {
            const actionStr = typeof step === 'string' ? step : step.action || 'SUPPLY';
            const isSupply = actionStr.includes('SUPPLY') || actionStr.includes('Lend') || actionStr.includes('Deposit');
            const isPark = actionStr.includes('PARK') || actionStr.includes('Park');
            
            const badgeClass = isPark 
              ? 'bg-purple-900/60 text-purple-300 border-purple-700' 
              : isSupply 
                ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' 
                : 'bg-rose-900/60 text-rose-300 border-rose-700';

            return (
              <div 
                key={idx} 
                className="flex items-center justify-between p-4 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <span className="text-xs font-mono font-bold text-slate-500 w-6">#{idx + 1}</span>
                  <span className={`text-xs px-2.5 py-1 rounded font-bold border ${badgeClass}`}>
                    {isPark ? 'PARK' : isSupply ? 'SUPPLY' : 'BORROW'}
                  </span>
                  <div>
                    <div className="font-semibold text-slate-100 text-sm">
                      {typeof step === 'string' ? step : `${step.asset} on ${step.venue} (${step.chain})`}
                    </div>
                  </div>
                </div>

                {typeof step !== 'string' && step.apy != null && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-200">{step.apy.toFixed(2)}% APY</div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-xs text-slate-500 italic">No intermediate steps required for this route.</div>
        )}
      </div>
    </div>
  );
};
