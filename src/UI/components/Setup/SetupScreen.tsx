import React, { useState } from 'react';
import { Shield, Key, Cloud, ArrowRight, ArrowLeft, ExternalLink, Upload, CheckCircle2, Bot, Info } from 'lucide-react';
import { t } from '../../../language';

interface SetupScreenProps {
    onOpenSecurity?: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onOpenSecurity }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [geminiKey, setGeminiKey] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const steps = [
        { id: 'intro', title: t.setup.steps.intro, icon: Info },
        { id: 'api', title: t.setup.steps.api, icon: Cloud },
        { id: 'import', title: t.setup.steps.import, icon: Key },
        { id: 'ai', title: t.setup.steps.ai, icon: Bot },
    ];

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            setSaveStatus('idle');
        }
    };

    const saveOAuthSecret = async () => {
        if (!uploadedFile) return;
        setIsSaving(true);
        try {
            const content = await uploadedFile.text();
            await window.electron.credentials.save({
                key: 'google-oauth-secret',
                name: 'Google OAuth Secret',
                type: 'file',
                fileName: uploadedFile.name,
                fileContent: content
            });
            setSaveStatus('success');
            setTimeout(() => nextStep(), 1000);
        } catch (err) {
            console.error('Save failed:', err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const saveGeminiKey = async () => {
        if (!geminiKey) {
            nextStep();
            return;
        }
        setIsSaving(true);
        try {
            await window.electron.credentials.save({
                key: 'gemini-api-key',
                name: 'Gemini AI Key',
                type: 'string',
                value: geminiKey
            });
            setSaveStatus('success');
            // 點擊完成後重啟應用程式
            window.location.reload();
        } catch (err) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Intro
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-theme-800/50 border border-theme-700 rounded-2xl p-6 text-left">
                            <h2 className="text-xl font-bold text-theme-100 flex items-center gap-3 mb-4">
                                <Shield className="w-6 h-6 text-primary-main" />
                                {t.setup.intro.title}
                            </h2>
                            <p className="text-theme-400 leading-relaxed mb-6">
                                {t.setup.intro.desc}
                            </p>
                            <div className="bg-theme-900/50 rounded-xl p-4 border border-theme-800">
                                <p className="text-sm font-mono text-theme-300 whitespace-pre-line leading-loose">
                                    {t.setup.intro.guide}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-4 mt-6">
                                <button
                                    onClick={() => window.electron.openExternal('https://console.cloud.google.com/')}
                                    className="flex items-center gap-2 px-6 py-3 bg-secondary-main/20 text-secondary-text rounded-xl hover:bg-secondary-main/30 transition-all font-bold"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t.setup.intro.action}
                                </button>
                                
                                {onOpenSecurity && (
                                    <button
                                        onClick={onOpenSecurity}
                                        className="flex items-center gap-2 px-6 py-3 bg-theme-700/50 text-theme-300 rounded-xl hover:bg-theme-700 hover:text-theme-100 transition-all font-bold"
                                    >
                                        <Shield className="w-4 h-4" />
                                        進階：直接進入金鑰管理中心
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 1: // API List
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-theme-800/50 border border-theme-700 rounded-2xl p-6 text-left">
                            <h2 className="text-xl font-bold text-theme-100 mb-4">{t.setup.api.title}</h2>
                            <p className="text-sm text-theme-400 mb-6">{t.setup.api.desc}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(t.setup.api.list).map(([key, label]) => (
                                    <div key={key} className="flex items-center gap-3 p-3 bg-theme-900/50 border border-theme-800 rounded-xl hover:border-theme-700 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-primary-main shadow-[0_0_8px_var(--color-primary-main)]" />
                                        <span className="text-xs text-theme-200">{label as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 2: // Import JSON
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-theme-800/50 border border-theme-700 rounded-2xl p-6 text-left">
                            <h2 className="text-xl font-bold text-theme-100 mb-2">{t.setup.import.title}</h2>
                            <p className="text-sm text-theme-400 mb-6">{t.setup.import.desc}</p>
                            
                            <label className={`flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed rounded-2xl cursor-pointer transition-all ${uploadedFile ? 'bg-primary-main/5 border-primary-main/50' : 'bg-theme-900 border-theme-700 hover:border-primary-main'}`}>
                                {uploadedFile ? (
                                    <div className="flex flex-col items-center">
                                        <CheckCircle2 className="w-10 h-10 text-primary-main mb-2 animate-bounce-short" />
                                        <span className="text-theme-100 font-bold">{uploadedFile.name}</span>
                                        <span className="text-xs text-theme-500">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center px-4">
                                        <Upload className="w-10 h-10 text-theme-600 mb-3" />
                                        <span className="text-theme-300 font-medium">{t.setup.import.dropzone}</span>
                                        <span className="text-xs text-theme-500 mt-2">{t.setup.import.hint}</span>
                                    </div>
                                )}
                                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                            </label>

                            {uploadedFile && saveStatus !== 'success' && (
                                <button
                                    onClick={saveOAuthSecret}
                                    disabled={isSaving}
                                    className="w-full mt-6 py-3 bg-primary-main text-white font-bold rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? t.common.loading : t.common.confirm}
                                </button>
                            )}

                            {saveStatus === 'success' && (
                                <div className="mt-4 p-4 bg-primary-main/10 border border-primary-main/30 text-primary-light rounded-xl flex flex-col items-center gap-2 text-sm justify-center animate-pulse">
                                    <div className="flex items-center gap-2 font-bold">
                                        <CheckCircle2 className="w-5 h-5 text-primary-main" />
                                        憑證已成功存檔！
                                    </div>
                                    <p className="text-xs text-theme-300 mt-1">
                                        請點擊左上角的 <span className="text-secondary-main font-black underline">「重新整理」</span> 按鈕以啟動 Google 授權流程。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 3: // AI Setup
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-theme-800/50 border border-theme-700 rounded-2xl p-6 text-left">
                            <h2 className="text-xl font-bold text-theme-100 flex items-center gap-3 mb-2">
                                <Bot className="w-6 h-6 text-warning-main" />
                                {t.setup.ai.title}
                            </h2>
                            <p className="text-sm text-theme-400 mb-6">{t.setup.ai.desc}</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-theme-500 uppercase tracking-widest mb-2">{t.setup.ai.label}</label>
                                    <input
                                        type="password"
                                        value={geminiKey}
                                        onChange={e => setGeminiKey(e.target.value)}
                                        placeholder={t.setup.ai.placeholder}
                                        className="w-full px-4 py-3 bg-theme-900 border border-theme-700 rounded-xl outline-none focus:border-primary-main transition-colors text-theme-100"
                                    />
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={saveGeminiKey}
                                        disabled={isSaving}
                                        className="flex-1 py-3 bg-primary-main text-white font-bold rounded-xl hover:bg-primary-hover transition-all"
                                    >
                                        {geminiKey ? t.common.finish : t.setup.ai.skip}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col items-center justify-start w-full h-full text-theme-200 p-8 pt-16 pb-24 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl w-full flex flex-col items-center">
                
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-theme-100 to-theme-400 mb-2">
                        {t.setup.title}
                    </h1>
                    <p className="text-theme-400 font-medium">{t.setup.subtitle}</p>
                </div>

                {/* Step Progress Bar */}
                <div className="w-full flex items-center justify-between mb-16 relative px-10">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-theme-800 -translate-y-1/2 z-0 mx-20" />
                    {steps.map((step, idx) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > idx;
                        const isActive = currentStep === idx;
                        return (
                            <div key={step.id} className="flex flex-col items-center z-10 relative">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 
                                    ${isCompleted ? 'bg-primary-main border-primary-main text-white' : 
                                      isActive ? 'bg-theme-900 border-primary-main text-primary-main shadow-[0_0_15px_var(--color-primary-main-alpha)]' : 
                                      'bg-theme-900 border-theme-700 text-theme-500'}`}
                                >
                                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                </div>
                                <span className={`absolute -bottom-8 whitespace-nowrap text-xs font-bold tracking-tighter transition-colors ${isActive ? 'text-primary-main' : 'text-theme-500'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="w-full max-w-2xl min-h-[400px]">
                    {renderStepContent()}
                </div>

                {/* Footer Navigation */}
                <div className="w-full max-w-2xl flex items-center justify-between mt-12 pt-8 border-t border-theme-800">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 0 || isSaving}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-bold ${currentStep === 0 ? 'opacity-0' : 'text-theme-400 hover:bg-theme-800'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t.common.back}
                    </button>
                    
                    {currentStep < 2 && (
                        <button
                            onClick={nextStep}
                            className="flex items-center gap-2 px-8 py-3 bg-primary-main text-white font-bold rounded-xl hover:bg-primary-hover hover:-translate-y-0.5 transition-all shadow-lg shadow-primary-main/20 group"
                        >
                            {t.common.next}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

