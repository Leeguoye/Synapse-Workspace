import { PythonRunner } from './PythonRunner';
import { PluginSandboxRunner } from './PluginSandboxRunner';

export interface PipelineNode {
  id: string;
  type?: string;
  data: Record<string, any>;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export class PipelineRunner {
  private nodes: PipelineNode[];
  private edges: PipelineEdge[];
  
  // 記錄每個節點執行的輸出資料，以便作為下一個節點的輸入
  private contextData: Record<string, any> = {};

  // For Event Bus / IPC propagation
  private onNodeStatusUpdate?: (nodeId: string, status: 'running' | 'success' | 'error', logs?: string[], data?: any) => void;

  constructor(
    nodes: PipelineNode[], 
    edges: PipelineEdge[], 
    onStatusUpdate?: (nodeId: string, status: 'running' | 'success' | 'error', logs?: string[], data?: any) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.onNodeStatusUpdate = onStatusUpdate;
  }

  /**
   * 取得 DAG 執行序列 (Topological Sort)
   * 若畫布中存在「起始節點」(Start Node)，則僅會將該節點及其下游相連的節點加入執行清單，
   * 斷開連接的節點將進入「休眠狀態」不被執行。
   */
  private getExecutionOrder(): string[] {
    // 1. 找出是否有明確的「起始節點」(Start Node 或 Trigger)
    const startNodes = this.nodes.filter(n => 
      n.data?.nodePluginId?.includes('start') || 
      n.data?.nodePluginId?.includes('trigger') ||
      n.data?.isStartNode === true
    );

    let activeNodes = this.nodes;
    let activeEdges = this.edges;

    // 2. BFS: 如果有找到起始節點，過濾出其可達的連通子圖 (Subgraph)
    if (startNodes.length > 0) {
      const reachableIds = new Set<string>();
      const queue = startNodes.map(n => n.id);
      
      const adjMap = new Map<string, string[]>();
      this.nodes.forEach(n => adjMap.set(n.id, []));
      this.edges.forEach(e => {
        if (adjMap.has(e.source)) adjMap.get(e.source)!.push(e.target);
      });

      while (queue.length > 0) {
        const u = queue.shift()!;
        if (!reachableIds.has(u)) {
          reachableIds.add(u);
          adjMap.get(u)?.forEach(v => queue.push(v));
        }
      }

      activeNodes = this.nodes.filter(n => reachableIds.has(n.id));
      activeEdges = this.edges.filter(e => reachableIds.has(e.source) && reachableIds.has(e.target));
    }

    // 3. 原來的 Topological Sort (套用於過濾後的有效節點)
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    activeNodes.forEach(n => {
      adjList.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    activeEdges.forEach(e => {
      if (adjList.has(e.source) && adjList.has(e.target)) {
        adjList.get(e.source)!.push(e.target);
        inDegree.set(e.target, inDegree.get(e.target)! + 1);
      }
    });

    const sortQueue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) sortQueue.push(id);
    });

    const order: string[] = [];
    while (sortQueue.length > 0) {
      const u = sortQueue.shift()!;
      order.push(u);

      adjList.get(u)!.forEach(v => {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) sortQueue.push(v);
      });
    }

    if (order.length !== activeNodes.length) {
      console.warn("Pipeline Runner Warning: DAG contains cycle or disconnected unmapped nodes.");
    }
    return order;
  }

  /**
   * 背景執行主要函數
   */
  public async executePipeline(): Promise<{ success: boolean; data: any }> {
    const order = this.getExecutionOrder();

    console.log(`[Pipeline Runner] v2.1 - Starting Execution Order: ${order.join(' -> ')}`);
    for (const nodeId of order) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const pType = (node.data as any)?.pipelineType || 'none';
      const nodePluginId = (node.data as any)?.nodePluginId;
      
      console.log(`[Pipeline Runner] Executing Node: ${nodeId} (${(node.data as any)?.label}), Plugin: ${nodePluginId || 'None'}, Type: ${pType}`);

      this.onNodeStatusUpdate?.(nodeId, 'running');

      try {
        await this.executeNode(node);
        this.onNodeStatusUpdate?.(nodeId, 'success', [], this.contextData[nodeId]);
      } catch (err: any) {
        console.error(`[Pipeline Runner] Node ${nodeId} (${(node.data as any)?.label}) 執行失敗:`, err);
        this.onNodeStatusUpdate?.(nodeId, 'error', [err.message || String(err)]);
        return { success: false, data: this.contextData };
      }
    }

    return { success: true, data: this.contextData };
  }

  private async executeNode(node: PipelineNode): Promise<void> {
    const incomingEdges = this.edges.filter(e => e.target === node.id);
    
    // 建立增強版輸入資料
    const allInputsMap: Record<string, any> = {};
    const mergedInputs: Record<string, any> = {};
    incomingEdges.forEach(edge => {
      const sourceData = this.contextData[edge.source];
      if (!sourceData) return;
      allInputsMap[edge.source] = sourceData;
      
          // 埠位精準映射 (Port-to-Port Mapping)
          if (edge.sourceHandle && edge.targetHandle) {
             // 從來源 Handle 取得資料並對應到目標 Handle (Get data from source and map to target)
             const val = sourceData[edge.sourceHandle];
             if (val !== undefined) {
               if (mergedInputs[edge.targetHandle] !== undefined) {
                 // 已有輸入，改為陣列聚合 (Already has input, upgrade to array aggregation)
                 if (!Array.isArray(mergedInputs[edge.targetHandle])) {
                   mergedInputs[edge.targetHandle] = [mergedInputs[edge.targetHandle]];
                 }
                 mergedInputs[edge.targetHandle].push(val);
               } else {
                 mergedInputs[edge.targetHandle] = val;
               }
             }
          } else if (typeof sourceData === 'object' && sourceData !== null) {
            // 向下相容：無 Handle 時進行全量合併 (Legacy logic)
            Object.assign(mergedInputs, sourceData);
          } else {
            // 回退方案 (Fallback)
            const fallbackKey = `${edge.source}_out`;
            if (mergedInputs[fallbackKey] !== undefined) {
                if (!Array.isArray(mergedInputs[fallbackKey])) {
                    mergedInputs[fallbackKey] = [mergedInputs[fallbackKey]];
                }
                mergedInputs[fallbackKey].push(sourceData);
            } else {
                mergedInputs[fallbackKey] = sourceData;
            }
          }
    });

    const executionContext = {
      ...mergedInputs,
      prev_node_id: incomingEdges.length > 0 ? incomingEdges[0].source : null,
      node_label: node.data.label,
      all_inputs: allInputsMap,
      contextData: { 
        prev_node_id: incomingEdges.length > 0 ? incomingEdges[0].source : null,
        label: node.data.label,
        all_inputs: allInputsMap
      }
    };

    // --- Phase D: 插件節點路徑 ---
    const nodePluginId = node.data.nodePluginId;
    if (nodePluginId && typeof nodePluginId === 'string') {
      const [pluginId, nodeType] = nodePluginId.split('::');
      if (!pluginId || !nodeType) throw new Error(`無效的插件節點 ID: ${nodePluginId}`);

      // 合併靜態配置 (nodeInputConfig) 與動態輸入 (executionContext)
      const combinedInputs = {
        ...(node.data.nodeInputConfig || {}),
        ...executionContext,
        ...(node.data.connectedShapeColors ? { connectedShapeColors: node.data.connectedShapeColors } : {})
      };

      // 自動型別轉換 (Auto Type Conversion)
      // 若節點定義了 inputs schema 且類型為 number，嘗試轉換動態傳入的字串
      if (Array.isArray(node.data.inputs)) {
        node.data.inputs.forEach((input: any) => {
          if (input.type === 'number' && typeof combinedInputs[input.key] === 'string') {
            const num = parseFloat(combinedInputs[input.key]);
            if (!isNaN(num)) combinedInputs[input.key] = num;
          }
        });
      }

      console.log(`[Pipeline Runner] Node ${node.id} (${node.data.label}) Combined Inputs:`, JSON.stringify(combinedInputs, null, 2));

      const result = await PluginSandboxRunner.execute(pluginId, nodeType, combinedInputs);
      this.contextData[node.id] = result;
      return;
    }

    // --- Phase C: 舊有路徑 (向下相容) ---
    const pipelineType = node.data.pipelineType || (node.type === 'logicPythonNode' ? 'python' : 'none');
    const pipelineScript = node.data.pipelineScript || node.data.script || '';

    switch (pipelineType) {
      case 'python': {
        const boilerplate = `import sys, json\ncontextData = json.loads(sys.stdin.read())\n`;
        const fullScript = boilerplate + pipelineScript;
        
        const result = await PythonRunner.execute(fullScript, executionContext);
        if (!result.success) {
          throw new Error(`Python Runtime Error: ${result.error}\nLogs:\n${result.logs.join('\n')}`);
        }
        this.contextData[node.id] = result.result;
        break;
      }

      case 'javascript': {
        try {
          const contextData = executionContext;
          // eslint-disable-next-line no-eval
          const result = eval(`(function(contextData) { ${pipelineScript} })(contextData)`);
          this.contextData[node.id] = result;
        } catch (err: any) {
          throw new Error(`Javascript Runtime Error: ${err.message}`);
        }
        break;
      }

      default:
        // 特殊處理原本的舊節點類型
        if (node.type === 'logicDataNode') {
          this.contextData[node.id] = { ...executionContext, nodeValue: node.data.value || null };
        } else if (node.type === 'logicChartNode') {
          this.contextData[node.id] = { chartReady: true, dataForChart: executionContext };
        } else if (node.type === 'resourceNode') {
          // 資源節點：嘗試提取檔案 ID 並輸出供下游插件使用
          const data = node.data;
          const fileId = data.resourceFileId || data.resourceId || data.id || '';
          
          const baseData = {
            fileId,
            id: fileId, // 雙重相容
            label: data.label || data.resourceFileName,
            mimeType: data.resourceMimeType,
            webViewLink: data.resourceWebViewLink,
            appProperties: data.resourceAppProperties,
          };
          
          // 預設所有連接點 (Handle) 都輸出同樣東西，解決方向性 Handle 造成的映射失敗
          this.contextData[node.id] = {
            ...baseData,
            top: baseData,
            bottom: baseData,
            left: baseData,
            right: baseData
          };
        } else {
          // 一般畫布節點：透傳輸入資料並掛上 label 等屬性
          this.contextData[node.id] = { 
            ...executionContext, 
            label: node.data.label,
            colorKey: node.data.colorKey,
            customColor: node.data.customColor
          };
        }
        break;
    }
  }
}
