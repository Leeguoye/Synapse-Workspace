import { FileText, LayoutDashboard, Presentation, FormInput, Code, Terminal, File, FileJson, FileImage, FileAudio, FileVideo, FileArchive, PenTool, Sigma, Folder, Share2 } from 'lucide-react';
import DynamicIcon from '../components/uiComponent/DynamicIcon';
import type { DriveFile } from '../../shared/types';

/** Read link metadata from a DriveFile object.
 * Priority: linkUrl/linkIcon/linkColor columns (from appProperties) → description JSON → bare URL description */
export const parseLinkData = (descriptionOrFile: string | { linkUrl?: string | null; linkIcon?: string | null; linkColor?: string | null } | undefined) => {
  // Accept a DriveFile-like object directly
  if (descriptionOrFile && typeof descriptionOrFile === 'object') {
    return {
      url:   descriptionOrFile.linkUrl   ?? '',
      icon:  descriptionOrFile.linkIcon  ?? 'LinkIcon',
      color: descriptionOrFile.linkColor ?? '#34d399',
    };
  }
  const description = descriptionOrFile as string | undefined;
  if (!description) return { url: '', icon: 'LinkIcon', color: '#34d399' };
  try {
    const parsed = JSON.parse(description);
    if (parsed.url !== undefined) return parsed;
  } catch (e) {
    // console.error(e);
  }
  return { url: description, icon: 'LinkIcon', color: '#34d399' };
};

export const getDynamicIcon = (mimeType: string, name: string, descriptionOrFile?: string | DriveFile) => {
  if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="w-4 h-4 shrink-0 text-blue-400" />;

  if (mimeType === 'application/vnd.synapse.link' || mimeType === 'application/vnd.nexus.link') {
    const data = parseLinkData(descriptionOrFile);
    const color = data.color || '#34d399';
    let iconName = data.icon || 'Link';
    if (iconName === 'LinkIcon') iconName = 'Link'; // 對齊新版直接使用 Lucide 命名

    return <DynamicIcon name={iconName} className="w-4 h-4 shrink-0" style={{ color }} />;
  }
  if (mimeType.includes('document')) return <FileText className="w-4 h-4 shrink-0 text-blue-500" />;
  if (mimeType.includes('spreadsheet')) return <LayoutDashboard className="w-4 h-4 shrink-0 text-green-500" />;
  if (mimeType.includes('presentation')) return <Presentation className="w-4 h-4 shrink-0 text-yellow-500" />;
  if (mimeType.includes('form')) return <FormInput className="w-4 h-4 shrink-0 text-purple-500" />;
  if (mimeType.includes('script')) return <Code className="w-4 h-4 shrink-0 text-blue-600" />;
  if (mimeType.includes('colaboratory')) return <Terminal className="w-4 h-4 shrink-0 text-orange-500" />;
  if (mimeType === 'application/vnd.synapse.canvas' || mimeType === 'application/vnd.nexus.canvas' || 
      name.toLowerCase().endsWith('.syn_canvas') || name.toLowerCase().endsWith('.nex_canvas')) return <PenTool className="w-4 h-4 shrink-0 text-purple-400" />;
  if (mimeType === 'application/vnd.synapse.graph' || mimeType === 'application/vnd.nexus.graph' || 
      name.toLowerCase().endsWith('.syn_graph') || name.toLowerCase().endsWith('.nex_graph')) return <Share2 className="w-4 h-4 shrink-0 text-emerald-400" />;

  const lowerName = name.toLowerCase();
  if (mimeType === 'text/markdown' || lowerName.endsWith('.md')) return <Code className="w-4 h-4 shrink-0 text-blue-400" />;
  if (mimeType === 'application/x-tex' || lowerName.endsWith('.tex')) return <Sigma className="w-4 h-4 shrink-0 text-emerald-400" />;
  if (mimeType.includes('json') || lowerName.endsWith('.json')) return <FileJson className="w-4 h-4 shrink-0 text-yellow-400" />;
  if (mimeType.includes('image')) return <FileImage className="w-4 h-4 shrink-0 text-red-400" />;
  if (mimeType.includes('video')) return <FileVideo className="w-4 h-4 shrink-0 text-purple-400" />;
  if (mimeType.includes('audio')) return <FileAudio className="w-4 h-4 shrink-0 text-yellow-600" />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <FileArchive className="w-4 h-4 shrink-0 text-red-500" />;

  return <File className="w-4 h-4 shrink-0 text-theme-400" />;
};