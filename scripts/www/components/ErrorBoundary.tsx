
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    if (confirm("这将清除浏览器缓存配置（数据文件不会删除），是否继续？")) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              哎呀，出错了
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              应用程序遇到意外错误，已停止运行以保护数据安全。
            </p>
            
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg mb-6 text-left overflow-auto max-h-32">
                <code className="text-xs text-red-500 font-mono break-all">
                    {this.state.error?.message || "Unknown Error"}
                </code>
            </div>

            <div className="space-y-3">
              <button 
                onClick={this.handleReload}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/30"
              >
                <RefreshCw size={18} /> 重新加载
              </button>
              
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <Home size={18} /> 返回首页
              </button>

              <button 
                onClick={this.handleReset}
                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 transition-colors"
              >
                <Trash2 size={12} /> 清除缓存并重试
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fix: Explicitly handle the 'props' access to satisfy the TypeScript compiler by casting 'this' to any
    return (this as any).props.children;
  }
}
