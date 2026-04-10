import { diff_match_patch } from 'diff-match-patch';

/**
 * 針對三個版本的文字內容進行自動合併 (3-way merge)
 * @param origin 最早共用的原始版本 (Base)
 * @param local 本地使用者剛修改的版本
 * @param remote 雲端被別人修改的最新版本
 * @returns { mergedText: string, hasConflict: boolean }
 */
export function autoMergeText(origin: string, local: string, remote: string): { mergedText: string, hasConflict: boolean } {
    const dmp = new diff_match_patch();

    // 找出從 origin 到 local 的所有變更點 (diffs)
    const diff_local = dmp.diff_main(origin, local);
    // 建立從 origin 到 local 的 patch 補丁
    const patches_local = dmp.patch_make(origin, local, diff_local);

    // 嘗試將 local 的 patch 補丁應用到 remote 的最新內容上
    const [mergedText, results] = dmp.patch_apply(patches_local, remote);

    // 檢查是否有完全無法套用的衝突
    // results 是一個 boolean 陣列，標示每一個 patch 是否成功套用
    const hasConflict = results.some(success => !success);

    return {
        mergedText,
        hasConflict
    };
}
