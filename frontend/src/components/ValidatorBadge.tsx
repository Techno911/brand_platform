import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ValidationReport } from '../types/api';

// 3-уровневый валидатор (INSIGHTS §4): regex → LLM-judge → methodology-compliance.
// Показываем traffic light и top-3 reasons маркетологу.
export default function ValidatorBadge({ report }: { report: ValidationReport }) {
  const light = report.trafficLight;
  const blocked = report.blockedAtLevel !== 'none';

  return (
    <div className={`border rounded-2xl p-4 ${bgFor(light)}`}>
      <div className="flex items-start gap-3">
        {light === 'green' && <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />}
        {light === 'yellow' && <AlertTriangle className="w-5 h-5 text-[#EAB308] flex-shrink-0 mt-0.5" />}
        {light === 'red' && <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">
            {light === 'green' && 'Валидатор: зелёный — можно утверждать'}
            {light === 'yellow' && 'Валидатор: жёлтый — можно принять, но с оговоркой'}
            {light === 'red' && 'Валидатор: красный — нельзя утверждать'}
          </p>
          <p className="text-xs text-[#6B7280] mb-2">
            Заблокировано на уровне: <span className="font-mono">{report.blockedAtLevel}</span>
          </p>
          {report.reasons.length > 0 && (
            <ul className="text-xs text-[#1A1A1A] space-y-1 list-disc pl-4">
              {report.reasons.slice(0, 3).map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          )}
          {report.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-1">Что исправить:</p>
              <ul className="text-xs text-[#1A1A1A] space-y-1 list-disc pl-4">
                {report.suggestions.slice(0, 3).map((s, i) => (<li key={i}>{s}</li>))}
              </ul>
            </div>
          )}
          {blocked && light === 'red' && (
            <p className="text-xs text-[#EF4444] mt-2 font-medium">
              Отправьте через форму правок — Claude пере-генерирует.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function bgFor(light: 'green' | 'yellow' | 'red'): string {
  switch (light) {
    case 'green': return 'bg-[#F0FDF4] border-green-200';
    case 'yellow': return 'bg-[#FEFCE8] border-yellow-200';
    case 'red': return 'bg-[#FEF2F2] border-red-200';
  }
}
