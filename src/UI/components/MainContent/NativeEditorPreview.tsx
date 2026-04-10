import React, { forwardRef, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { LatexJsPreview } from './LatexJsPreview';
import { isDarkTheme } from '../../configs/themeConfig';
import type { ThemeType } from '../../configs/themeConfig';

interface NativeEditorPreviewProps {
    content: string;
    onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
    scrollToRatio?: number | null;
    mimeType?: string;
    onUpdateContent?: (newContent: string) => void;
    theme?: ThemeType;
}

export const NativeEditorPreview = forwardRef<HTMLDivElement, NativeEditorPreviewProps>(
    ({ content, onScroll, scrollToRatio, mimeType, onUpdateContent, theme }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const isScrollingFromCode = useRef(false);

        // Expose a combined ref
        const setRefs = (el: HTMLDivElement | null) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        };

        // Scroll preview to match editor position when scrollToRatio changes
        useEffect(() => {
            if (scrollToRatio == null || !containerRef.current) return;
            isScrollingFromCode.current = true;
            const el = containerRef.current;
            el.scrollTop = scrollToRatio * (el.scrollHeight - el.clientHeight);
            setTimeout(() => { isScrollingFromCode.current = false; }, 50);
        }, [scrollToRatio]);

        const handleScroll = () => {
            if (!onScroll || isScrollingFromCode.current || !containerRef.current) return;
            const el = containerRef.current;
            onScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
        };

        return (
            <div
                ref={setRefs}
                onScroll={handleScroll}
                className={`flex-1 h-full overflow-y-auto ${mimeType === 'application/x-tex' ? 'bg-white text-gray-900' : (isDarkTheme(theme) ? 'bg-theme-950 text-theme-100' : 'bg-white text-gray-900')} ${mimeType === 'application/x-tex' ? '' : `p-8 prose max-w-none ${isDarkTheme(theme) ? 'prose-invert' : ''}`}`}
            >
                {mimeType === 'application/x-tex' ? (
                    <LatexJsPreview content={content} />
                ) : (
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                        components={{
                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" {...props} />,
                            img: ({ node, src, alt, ...props }) => {
                                // Support data URLs and absolute URLs directly
                                const resolvedSrc = src || '';
                                return (
                                    <img
                                        src={resolvedSrc}
                                        alt={alt || ''}
                                        className="max-w-full rounded-md shadow-sm"
                                        {...props}
                                    />
                                );
                            },
                            pre: ({ node, ...props }) => <pre className="bg-gray-100 text-gray-900 p-4 rounded-md overflow-x-auto" {...props} />,
                            code: ({ node, inline, className, children, ...props }: any) => {
                                if (inline) {
                                    return <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
                                }
                                return <code className={className} {...props}>{children}</code>;
                            },
                            input: ({ node, type, checked, ...props }: any) => {
                                if (type === 'checkbox') {
                                    return (
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                                if (!onUpdateContent) return;
                                                const isChecked = e.target.checked;

                                                // Find the checkbox in the raw markdown content based on line position
                                                // ReactMarkdown doesn't directly give us absolute position, so we do a regex replace
                                                // This is a heuristic approach: find the Nth checkbox and replace it
                                                const lineIndex = node?.position?.start?.line;
                                                if (lineIndex !== undefined) {
                                                    const lines = content.split('\n');
                                                    const targetLine = lines[lineIndex - 1]; // 1-indexed to 0-indexed
                                                    if (targetLine) {
                                                        const newLine = targetLine.replace(/\[[xX\s]\]/, isChecked ? '[x]' : '[ ]');
                                                        lines[lineIndex - 1] = newLine;
                                                        onUpdateContent(lines.join('\n'));
                                                    }
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer align-middle mt-0"
                                            {...props}
                                            disabled={false}
                                        />
                                    );
                                }
                                return <input type={type} {...props} disabled />;
                            }
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                )}
            </div>
        );
    }
);

NativeEditorPreview.displayName = 'NativeEditorPreview';
