import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <AlertTriangle className="w-12 h-12 text-[#EAB308] mb-4" />
          <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Что-то пошло не так</h2>
          <p className="text-[#6B7280] text-sm mb-4">Попробуйте обновить страницу</p>
          <button
            onClick={() => window.location.reload()}
            className="h-10 px-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium rounded-lg transition-colors"
          >
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
