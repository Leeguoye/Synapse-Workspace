import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface DynamicIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className, style }) => {
  // 1. 從 LucideIcons 物件中動態取出對應的組件
  // 我們將首字轉大寫以符合 Component 命名慣例 (例如 "camera" -> "Camera")
  // 但 Lucide 的 export 都是 PascalCase，所以我們假設存入的也是 PascalCase
  const icons = LucideIcons as unknown as Record<string, React.FC<LucideProps>>;

  const IconComponent = icons[name];

  // 2. 如果找不到圖示 (例如名字打錯)，回傳預設問號
  if (!IconComponent) {
    return <HelpCircle className={className} style={style} />;
  }

  // 3. 渲染圖示
  return <IconComponent className={className} style={style} />;
};

export default DynamicIcon;