import React, { useState, useEffect } from 'react';
import { getTranslation, Language } from '../i18n';
import {
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  Globe2,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [lang, setLang] = useState<Language>('am');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const t = getTranslation(lang);

  useEffect(() => {
    // Check server /health endpoint to verify full-stack connection
    fetch('/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      })
      .catch(() => setServerStatus('offline'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto shadow-sm border-x border-slate-200">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            M
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">MindRise</h1>
            <span className="text-[10px] text-emerald-600 font-medium">ማይንድራይዝ</span>
          </div>
        </div>

        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border border-slate-200 hover:border-emerald-500 bg-slate-50 transition"
          aria-label="Toggle Language"
        >
          <Globe2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-700">{lang === 'am' ? 'English' : 'አማርኛ'}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-5 space-y-4">
        {/* Backend Connectivity Status Indicator */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-md text-xs text-slate-600">
          <span>Backend API Status:</span>
          <span className="flex items-center space-x-1 font-medium">
            {serverStatus === 'online' && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700">Online (/health 200 OK)</span>
              </>
            )}
            {serverStatus === 'checking' && (
              <span className="text-amber-600">Checking /health...</span>
            )}
            {serverStatus === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-500">Offline (Start server on :5000)</span>
              </>
            )}
          </span>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md space-y-3">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-100" />
            <span>{t.home.privacy_badge}</span>
          </div>
          <h2 className="text-xl font-bold leading-tight">{t.home.welcome}</h2>
          <p className="text-emerald-50 text-xs leading-relaxed">{t.home.subtitle}</p>
          <p className="text-[11px] text-emerald-100/90 bg-emerald-800/40 p-2.5 rounded-lg border border-emerald-500/30">
            {t.home.privacy_explainer}
          </p>
        </div>

        {/* Feature Placeholders Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-800 text-xs">{t.nav.assessment}</h3>
            <p className="text-[11px] text-slate-500 leading-snug">
              Confidential, self-report checkups for stress & burnout.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-800 text-xs">{t.nav.routines}</h3>
            <p className="text-[11px] text-slate-500 leading-snug">
              Daily habit tracker with streaks & growth rewards.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-2 col-span-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-xs">{t.nav.community}</h3>
                <span className="text-[10px] text-slate-400">100% Anonymous Handles</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Moderated peer support spaces with shared cultural understanding.
            </p>
          </div>
        </div>

        {/* Crisis Resource Alert Banner */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2.5">
          <PhoneCall className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-xs text-red-900 leading-snug">
            <span className="font-semibold">
              {lang === 'am' ? 'አስቸኳይ እርዳታ፡ ' : 'Crisis Helpline: '}
            </span>
            <span>{t.home.hotline_banner}</span>
          </div>
        </div>
      </main>

      {/* Footer Navigation Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2.5 flex justify-around text-slate-500 text-[10px]">
        <div className="flex flex-col items-center text-emerald-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mb-0.5" />
          <span>{t.nav.home}</span>
        </div>
        <div className="flex flex-col items-center hover:text-slate-800">
          <span>{t.nav.assessment}</span>
        </div>
        <div className="flex flex-col items-center hover:text-slate-800">
          <span>{t.nav.routines}</span>
        </div>
        <div className="flex flex-col items-center hover:text-slate-800">
          <span>{t.nav.community}</span>
        </div>
      </footer>
    </div>
  );
};
