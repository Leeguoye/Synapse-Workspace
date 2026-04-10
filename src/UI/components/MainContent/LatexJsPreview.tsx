import React, { useEffect, useState, useRef } from 'react';
import { parse, HtmlGenerator } from 'latex.js';
import { Loader2, AlertTriangle } from 'lucide-react';

interface LatexJsPreviewProps {
    content: string;
    scrollToRatio?: number | null;
    onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
}

export const LatexJsPreview: React.FC<LatexJsPreviewProps> = ({
    content,
    scrollToRatio,
    onScroll
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [htmlDoc, setHtmlDoc] = useState<string>('');

    useEffect(() => {
        const compile = () => {
            setIsCompiling(true);
            setError(null);

            try {
                // Parse the LaTeX string into a DOM tree
                const generator = new HtmlGenerator({ hyphenate: false });
                const doc = parse(content, { generator }).htmlDocument();

                // Set base URL so that relative css/ katex/ font paths resolve to our public folder correctly
                const base = doc.createElement('base');
                base.href = window.location.origin + '/latexjs/';
                doc.head.insertBefore(base, doc.head.firstChild);

                // Fix CSS links: latex.js injects CDN links by default, which breaks offline/CSP scenarios. We replace them with local paths.
                const cssLinks = doc.head.querySelectorAll('link[rel="stylesheet"]');
                cssLinks.forEach((link: any) => {
                    if (link.href && link.href.includes('katex.css')) {
                        link.href = '/latexjs/css/katex.css';
                    } else if (link.href && (link.href.includes('article.css') || link.href.includes('book.css') || link.href.includes('report.css'))) {
                        // Keep the matching filename
                        const match = link.href.match(/([^\/]+\.css)$/);
                        if (match) link.href = '/latexjs/css/' + match[1];
                    }
                });

                // Force inject base.css because picture/drawing environments require it
                const baseCss = doc.createElement('link');
                baseCss.rel = 'stylesheet';
                baseCss.href = '/latexjs/css/base.css';
                doc.head.appendChild(baseCss);

                // Inject responsive override styles
                const style = doc.createElement('style');
                style.innerHTML = `
                    body, .page {
                        margin: 0 !important;
                        padding: 1rem !important;
                        max-width: 100% !important;
                        width: auto !important;
                        height: auto !important;
                        min-height: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: transparent !important;
                        overflow-x: hidden !important;
                        color: #000000 !important;
                    }
                    /* Prevent horizontal scrolling on large math blocks */
                    .katex-display {
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                `;
                doc.head.appendChild(style);

                // Export the full HTML with head and body intact
                setHtmlDoc(doc.documentElement.outerHTML);
            } catch (err: any) {
                console.error("latex.js compilation error:", err);
                setError(err.message || "Failed to compile LaTeX.");
            } finally {
                setIsCompiling(false);
            }
        };

        // Debounce slightly to prevent blocking the UI thread during rapid typing
        const timeoutId = setTimeout(compile, 500);
        return () => clearTimeout(timeoutId);
    }, [content]);

    // Handle Editor -> Preview scrolling
    useEffect(() => {
        if (scrollToRatio !== undefined && scrollToRatio !== null && iframeRef.current?.contentWindow) {
            const win = iframeRef.current.contentWindow;
            const scrollable = win.document.documentElement.scrollHeight - win.innerHeight;
            if (scrollable > 0) {
                win.scrollTo(0, scrollable * scrollToRatio);
            }
        }
    }, [scrollToRatio]);

    // Handle Preview -> Editor scrolling
    const handleIframeLoad = () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;

        // Initial scroll sync on new content load
        if (scrollToRatio && scrollToRatio > 0) {
            const scrollable = win.document.documentElement.scrollHeight - win.innerHeight;
            if (scrollable > 0) win.scrollTo(0, scrollable * scrollToRatio);
        }

        win.addEventListener('scroll', () => {
            if (onScroll) {
                onScroll(
                    win.scrollY || win.document.documentElement.scrollTop,
                    win.document.documentElement.scrollHeight,
                    win.innerHeight
                );
            }
        });
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
            {/* Status indicator bar (similar to SwiftLaTeX preview) */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-transparent z-10">
                {isCompiling && (
                    <div className="h-full bg-blue-500 w-full animate-pulse opacity-70"></div>
                )}
            </div>

            {error && (
                <div className="absolute top-4 right-4 max-w-md max-h-[40%] overflow-y-auto bg-red-950/90 border border-red-800 text-red-200 p-4 rounded-lg shadow-xl z-20 backdrop-blur-sm text-xs font-mono">
                    <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        Compilation Error
                    </div>
                    <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
            )}

            {/* LaTeX.js outputs native DOM, we use an iframe to act as a proper sandbox to preserve <head> styles */}
            <div className="flex-1 w-full h-full overflow-y-auto p-4 flex justify-center">
                {htmlDoc ? (
                    <iframe
                        ref={iframeRef}
                        srcDoc={htmlDoc}
                        onLoad={handleIframeLoad}
                        className="bg-white w-full h-full border-none"
                        style={{ display: 'block' }}
                        title="latex-preview"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-theme-300">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p>Compiling LaTeX...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
