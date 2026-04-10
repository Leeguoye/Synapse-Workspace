import { FileText, LayoutDashboard, Presentation, FormInput, ImageIcon, Map, Globe, Video, BrainCircuit } from 'lucide-react';
import { t } from '../../../../language';

// ============================================
// AddMenu (Plus Menu) Constants
// ============================================

// Template Submenu Adjustments
export const TEMPLATE_MENU_OFFSET_X = 5; // px: distance rightwards from the main menu
export const TEMPLATE_MENU_OFFSET_Y = 0; // px: distance downwards from the main menu
export const TEMPLATE_MENU_WIDTH = "200px";

// Main AddMenu Width
export const ADD_MENU_WIDTH_CLASS = "w-52"; // tailwind width class for the mother menu
export const ADD_MENU_SUBMENU_WIDTH_CLASS = "w-48"; // tailwind width class for submenus (Google Office, Web Links)
export const ADD_MENU_SAFE_BOTTOM_SPACE = 280; // px: space from bottom to start rendering upwards

// Applications Configuration
export const OFFICE_APPS = [
    { name: t.apps.googleDocs, mimeType: 'application/vnd.google-apps.document', icon: <FileText className="w-4 h-4 text-blue-500" /> },
    { name: t.apps.googleSheets, mimeType: 'application/vnd.google-apps.spreadsheet', icon: <LayoutDashboard className="w-4 h-4 text-green-500" /> },
    { name: t.apps.googleSlides, mimeType: 'application/vnd.google-apps.presentation', icon: <Presentation className="w-4 h-4 text-yellow-500" /> },
    { name: t.apps.googleForms, mimeType: 'application/vnd.google-apps.form', icon: <FormInput className="w-4 h-4 text-purple-500" /> }
];

export const ADVANCED_APPS = [
    { name: t.apps.googleDrawing, mimeType: 'application/vnd.google-apps.drawing', icon: <ImageIcon className="w-4 h-4 text-red-400" /> },
    { name: t.apps.googleMyMaps, mimeType: 'application/vnd.google-apps.map', icon: <Map className="w-4 h-4 text-red-500" /> },
    { name: t.apps.googleSites, mimeType: 'application/vnd.google-apps.site', icon: <Globe className="w-4 h-4 text-indigo-400" /> },
    { name: t.apps.googleVids, mimeType: 'application/vnd.google-apps.vid', icon: <Video className="w-4 h-4 text-purple-400" /> },
    { name: t.apps.aiStudio, mimeType: 'application/vnd.google.aistudio', icon: <BrainCircuit className="w-4 h-4 text-teal-400" /> }
];


// ============================================
// ContextMenu (Right-click Menu) Constants
// ============================================

export const CONTEXT_MENU_MAIN_WIDTH_CLASS = "w-48"; // tailwind width class
export const CONTEXT_MENU_MAX_HEIGHT = "230px";
export const CONTEXT_MENU_MIN_BOTTOM_SPACE = 230; // px: space from bottom to start rendering upwards

// Submenu offsets relative to mother menu bottom alignment
export const CONTEXT_OFFSET_RENAME = "127px";
export const CONTEXT_OFFSET_DELETE = "0";
export const CONTEXT_OFFSET_PROPERTIES = "0";
export const CONTEXT_OFFSET_TAGS = "0";

// Submenu specific widths
export const CONTEXT_SUBMENU_WIDTH_RENAME = "w-52";
export const CONTEXT_SUBMENU_WIDTH_DELETE = "w-48";
export const CONTEXT_SUBMENU_WIDTH_PROPERTIES = "w-64";
export const CONTEXT_SUBMENU_WIDTH_TAGS = "w-52";

export const TAG_LIST_MAX_HEIGHT = "160px";
export const TAG_PADDING = "px-4 py-0.5";
